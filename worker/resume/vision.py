"""Render a resume to page images for multimodal (vision) extraction."""

from __future__ import annotations

import base64
import io
from typing import List

MAX_PAGES = 4  # resumes past page 4 are rare; keeps requests well under provider limits
DPI = 130  # legible for vision models at ~1100x1430 px per A4 page
MAX_SIDE = 2000  # uploaded photos/scans are downscaled to this
MAX_PIXELS = 40_000_000  # same limit as OCR (resume/text.py); larger decodes can exhaust a 512 MB worker


def render_pages(data: bytes, kind: str) -> List[str]:
    """Base64 PNGs, one per page (PDF) or one for an image upload. [] for DOCX/TXT."""
    if kind == "pdf":
        import fitz

        out = []
        with fitz.open(stream=data, filetype="pdf") as pdf:
            for page in list(pdf)[:MAX_PAGES]:
                png = page.get_pixmap(dpi=DPI).tobytes("png")
                out.append(base64.b64encode(png).decode("ascii"))
        return out

    if kind == "image":
        from PIL import Image

        img = Image.open(io.BytesIO(data))
        if img.width * img.height > MAX_PIXELS:  # read from the header; nothing decoded yet
            raise ValueError("image is too large to process")
        img = img.convert("RGB")
        img.thumbnail((MAX_SIDE, MAX_SIDE))
        buf = io.BytesIO()
        img.save(buf, format="PNG", optimize=True)
        return [base64.b64encode(buf.getvalue()).decode("ascii")]

    return []
