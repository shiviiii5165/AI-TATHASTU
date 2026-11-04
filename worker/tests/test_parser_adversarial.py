"""Hostile files through the real child process: each must fail as a parse failure and leave the worker running.

The OCR test needs Tesseract; on Linux these run under the real resource limits (see DEPLOYMENT.md).
"""

from __future__ import annotations

import io
import shutil
import struct
import unittest
import zipfile
import zlib

import fitz

from resume import sandbox
from resume.intake import IntakeError, intake

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def huge_png(width: int, height: int) -> bytes:
    """A valid header claiming enormous dimensions, in a few bytes: a decompression bomb's shape."""
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data))
    header = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(b"\0" * 1024)) + chunk(b"IEND", b"")


def pdf(pages: int = 1, width: float = 612, height: float = 792, text: str = "") -> bytes:
    document = fitz.open()
    for _ in range(pages):
        page = document.new_page(width=width, height=height)
        if text:
            page.insert_text((72, 72), text, fontsize=14)
    return document.tobytes()


class HostileFiles(unittest.TestCase):
    def test_pdf_with_too_many_pages(self):
        with self.assertRaisesRegex(sandbox.ParseFailed, "pages"):
            sandbox.extract(pdf(pages=51), "pdf")

    def test_pdf_with_a_giant_page(self):
        with self.assertRaisesRegex(sandbox.ParseFailed, "too large"):
            sandbox.extract(pdf(width=14000, height=14000), "pdf")

    def test_garbage_pdf(self):
        with self.assertRaises(sandbox.ParseFailed):
            sandbox.extract(b"%PDF-1.7\n" + b"\xff" * 4096, "pdf")

    @unittest.skipUnless(shutil.which("tesseract"), "needs tesseract")
    def test_image_pixel_bomb(self):
        with self.assertRaises(sandbox.ParseFailed):
            sandbox.extract(huge_png(30000, 30000), "image")

    def test_render_refuses_a_pixel_bomb(self):
        with self.assertRaises(ValueError):
            sandbox.render_pages(huge_png(30000, 30000), "image")

    def test_corrupt_docx(self):
        with self.assertRaises(sandbox.ParseFailed):
            sandbox.extract(b"PK\x03\x04 not really a zip", "docx")

    def test_docx_decompression_bomb_is_refused_before_parsing(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("[Content_Types].xml", "<Types/>")
            archive.writestr("word/document.xml", b"\0" * (101 * 1024 * 1024))
        with self.assertRaises(IntakeError):
            intake(buffer.getvalue(), DOCX, None)

    def test_the_worker_still_parses_after_hostile_files(self):
        with self.assertRaises(sandbox.ParseFailed):
            sandbox.extract(b"%PDF-not really", "pdf")
        self.assertIn("still works", sandbox.extract(b"still works", "txt").text)


class LegitimateFiles(unittest.TestCase):
    def test_text_pdf(self):
        text = "Asha Rao, Software Engineer, asha@example.com, Python and Rust"
        self.assertIn("asha@example.com", sandbox.extract(pdf(text=text), "pdf").text)

    def test_four_page_render_fits_the_output_limit(self):
        pages = sandbox.render_pages(pdf(pages=4, text="Page content"), "pdf")
        self.assertEqual(len(pages), 4)

    @unittest.skipUnless(shutil.which("tesseract"), "needs tesseract")
    def test_ocr_of_a_six_page_scan_works_under_the_memory_limit(self):
        # The regression that matters: the lower limit must still fit real OCR work.
        scanned = pdf(pages=6, text="Asha Rao Software Engineer Python Rust Kubernetes Machine Learning")
        doc = sandbox.extract(scanned, "pdf", force_ocr=True)
        self.assertEqual([p.method for p in doc.pages], ["ocr"] * 6)
        self.assertIn("Software", doc.text)


if __name__ == "__main__":
    unittest.main()
