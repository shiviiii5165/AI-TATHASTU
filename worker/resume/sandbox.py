"""Parses untrusted files in a child process with no secrets and hard limits.

Same signatures as resume.text.extract and resume.vision.render_pages. The child
still has network access: this contains credential theft and resource exhaustion,
not every effect of a parser compromise.
"""

from __future__ import annotations

import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any, List, Tuple

from resume.text import Block, Document, OcrUnavailable, PageInfo

WORKER_DIR = Path(__file__).resolve().parent.parent
TIMEOUT_SECONDS = 240
# Four page images at most (resume/vision.py), base64 in JSON. A larger answer is a misbehaving child.
MAX_OUTPUT_BYTES = 64 * 1024 * 1024
READ_CHUNK = 64 * 1024
# Only what the interpreter and Tesseract need. Everything else, secrets included, stays out.
PASSED_ENV = ("PATH", "TESSDATA_PREFIX", "SYSTEMROOT", "LANG", "LC_ALL", "PARSER_MEMORY_LIMIT_MB")

# The memory limit is per process, and the queue runs two threads on a small instance:
# one parser at a time keeps a pair of large files from adding up and taking the worker down.
_parser_slot = threading.Semaphore(1)


def block_environ_reads() -> None:
    """The child shares our UID, so without this it could read /proc/<parent>/environ."""
    if not sys.platform.startswith("linux"):
        return
    import ctypes

    PR_SET_DUMPABLE = 4
    if ctypes.CDLL(None).prctl(PR_SET_DUMPABLE, 0, 0, 0, 0) != 0:
        raise RuntimeError("could not protect the worker's environment from parser processes")


class ParseFailed(Exception):
    """The child crashed, timed out or hit a limit. Treated like a corrupt file."""


def _kill_tree(process: "subprocess.Popen[bytes]") -> None:
    """The child and anything it started, such as Tesseract. Safe if they already exited."""
    try:
        if os.name == "posix":
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
    except (ProcessLookupError, PermissionError):
        pass


def _communicate(command: List[str], env: dict, data: bytes) -> Tuple[int, bytes]:
    process = subprocess.Popen(
        command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        cwd=WORKER_DIR, env=env, start_new_session=os.name == "posix",
    )
    chunks: List[bytes] = []
    too_large = threading.Event()

    def feed() -> None:
        try:
            process.stdin.write(data)
            process.stdin.close()
        except OSError:  # the child exited or was killed without reading it all
            pass

    def drain() -> None:
        size = 0
        while True:
            chunk = process.stdout.read(READ_CHUNK)
            if not chunk:
                return
            size += len(chunk)
            if size > MAX_OUTPUT_BYTES:
                too_large.set()
                _kill_tree(process)
                return
            chunks.append(chunk)

    writer = threading.Thread(target=feed, daemon=True)
    reader = threading.Thread(target=drain, daemon=True)
    writer.start()
    reader.start()
    try:
        process.wait(timeout=TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired as exc:
        raise ParseFailed(f"parsing exceeded {TIMEOUT_SECONDS}s") from exc
    finally:
        _kill_tree(process)
        process.wait()
    reader.join(timeout=5)
    if too_large.is_set():
        raise ParseFailed(f"parser output exceeded {MAX_OUTPUT_BYTES} bytes")
    return process.returncode, b"".join(chunks)


def _call(op: str, kind: str, force_ocr: bool, data: bytes) -> Any:
    command = [sys.executable, "-m", "resume.parse_child", op, kind, "1" if force_ocr else "0"]
    with _parser_slot:
        temp_dir = tempfile.mkdtemp(prefix="parse-")
        env = {k: os.environ[k] for k in PASSED_ENV if k in os.environ}
        # Tesseract's working files land here, and go with it whatever happens to the child.
        env.update(PYTHONDONTWRITEBYTECODE="1", OMP_THREAD_LIMIT="1", TMPDIR=temp_dir, TEMP=temp_dir, TMP=temp_dir)
        try:
            returncode, output = _communicate(command, env, data)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    if returncode != 0:
        raise ParseFailed(f"parser exited with {returncode}")
    try:
        answer = json.loads(output)
    except ValueError as exc:
        raise ParseFailed("parser returned no result") from exc
    if "ok" in answer:
        return answer["ok"]
    if answer["error"] == "OcrUnavailable":
        raise OcrUnavailable(answer["message"])
    raise ParseFailed(f"{answer['error']}: {answer['message']}")


def extract(data: bytes, kind: str, force_ocr: bool = False) -> Document:
    out = _call("extract", kind, force_ocr, data)
    blocks = [Block(text, page, tuple(bbox) if bbox else None) for text, page, bbox in out["blocks"]]
    pages = [PageInfo(number, method, conf) for number, method, conf in out["pages"]]
    return Document(blocks, pages, blank_blocks=out["blank_blocks"])


def render_pages(data: bytes, kind: str) -> List[str]:
    if kind not in ("pdf", "image"):
        return []
    try:
        return _call("render", kind, False, data)["pages"]
    except ParseFailed as exc:
        raise ValueError(str(exc)) from exc  # the caller's "can't render, not retryable" path
