"""Stage 1 — intake: size, magic bytes vs declared type, SHA-256."""

from __future__ import annotations

import hashlib
import io
import zipfile
from dataclasses import dataclass

MAX_BYTES = 10 * 1024 * 1024
MAX_DOCX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024  # the worker has 512 MB; real resumes are far below this

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
KINDS = {
    "application/pdf": "pdf",
    DOCX: "docx",
    "image/jpeg": "image",
    "image/png": "image",
    "image/webp": "image",
    "text/plain": "txt",
}


class IntakeError(Exception):
    """The file itself is unusable; retrying won't help."""


@dataclass(frozen=True)
class Intake:
    kind: str  # pdf | docx | image | txt
    mime: str
    sha256: str
    size: int


def _is_docx(data: bytes) -> bool:
    if not data.startswith(b"PK\x03\x04"):
        return False
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            # Refuse decompression bombs before python-docx inflates them in memory.
            if sum(i.file_size for i in z.infolist()) > MAX_DOCX_UNCOMPRESSED_BYTES:
                return False
            return "word/document.xml" in z.namelist()
    except zipfile.BadZipFile:
        return False


def _is_text(data: bytes) -> bool:
    head = data[:8192]
    if b"\x00" in head:
        return False
    try:
        head.decode("utf-8")
        return True
    except UnicodeDecodeError:
        # Could be cut mid-character at 8192, or Latin-1 text; accept if mostly printable.
        printable = sum(32 <= b < 127 or b in (9, 10, 13) for b in head)
        return printable / max(len(head), 1) > 0.9


MAGIC = {
    "application/pdf": lambda d: d.startswith(b"%PDF-"),
    DOCX: _is_docx,
    "image/jpeg": lambda d: d[:3] == b"\xff\xd8\xff",
    "image/png": lambda d: d[:8] == b"\x89PNG\r\n\x1a\n",
    "image/webp": lambda d: d[:4] == b"RIFF" and d[8:12] == b"WEBP",
    "text/plain": _is_text,
}


def intake(data: bytes, declared_mime: str, expected_sha256: str) -> Intake:
    if not data:
        raise IntakeError("file is empty")
    if len(data) > MAX_BYTES:
        raise IntakeError("file exceeds 10 MB")
    if declared_mime not in MAGIC:
        raise IntakeError(f"unsupported type {declared_mime}")
    if not MAGIC[declared_mime](data):
        raise IntakeError(f"contents don't match declared type {declared_mime}")
    sha = hashlib.sha256(data).hexdigest()
    if expected_sha256 and sha != expected_sha256:
        raise IntakeError("SHA-256 doesn't match the uploaded file's recorded hash")
    return Intake(kind=KINDS[declared_mime], mime=declared_mime, sha256=sha, size=len(data))
