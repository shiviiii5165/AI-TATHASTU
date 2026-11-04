"""Child process for resume/sandbox.py: parses untrusted bytes from stdin, answers JSON.

Runs without the worker's secrets and under resource limits, so a parser bug can
neither read credentials from the environment nor take the queue down with it.
"""

from __future__ import annotations

import json
import os
import sys

# Below a 512 MB instance, leaving room for the worker itself: going over fails this
# child with MemoryError instead of getting the whole container killed. Address space,
# so the real use is lower. Override with PARSER_MEMORY_LIMIT_MB on a different plan.
DEFAULT_MEMORY_LIMIT_MB = 384
CPU_LIMIT_SECONDS = 180
FILE_SIZE_LIMIT_BYTES = 128 * 1024 * 1024
OPEN_FILES_LIMIT = 256


def _memory_limit_bytes() -> int:
    raw = os.environ.get("PARSER_MEMORY_LIMIT_MB", "")
    return (int(raw) if raw.isdigit() and int(raw) > 0 else DEFAULT_MEMORY_LIMIT_MB) * 1024 * 1024


def _limit_resources() -> None:
    try:
        import resource
    except ImportError:  # Windows dev machines; production is Linux
        return
    # Tesseract inherits these. Each is hard (soft == hard), so the child can't raise them.
    memory = _memory_limit_bytes()
    resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
    resource.setrlimit(resource.RLIMIT_CPU, (CPU_LIMIT_SECONDS, CPU_LIMIT_SECONDS))
    resource.setrlimit(resource.RLIMIT_FSIZE, (FILE_SIZE_LIMIT_BYTES, FILE_SIZE_LIMIT_BYTES))
    resource.setrlimit(resource.RLIMIT_NOFILE, (OPEN_FILES_LIMIT, OPEN_FILES_LIMIT))
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))


def _run(op: str, kind: str, force_ocr: bool, data: bytes) -> dict:
    if op == "render":
        from resume.vision import render_pages

        return {"pages": render_pages(data, kind)}

    from resume.text import extract

    doc = extract(data, kind, force_ocr)
    return {
        "blocks": [[b.text, b.page, b.bbox] for b in doc.blocks],
        "pages": [[p.number, p.method, p.ocr_confidence] for p in doc.pages],
        "blank_blocks": doc.blank_blocks,
    }


def main() -> None:
    # Keep the answer channel for ourselves: native libraries may print to stdout.
    answer = os.fdopen(os.dup(1), "w", encoding="utf-8")
    os.dup2(2, 1)
    _limit_resources()
    op, kind, force_ocr = sys.argv[1], sys.argv[2], sys.argv[3] == "1"
    try:
        result = {"ok": _run(op, kind, force_ocr, sys.stdin.buffer.read())}
    except Exception as exc:  # reported by type; the parent decides what it means
        result = {"error": type(exc).__name__, "message": str(exc)[:300]}
    json.dump(result, answer)
    answer.close()


if __name__ == "__main__":
    main()
