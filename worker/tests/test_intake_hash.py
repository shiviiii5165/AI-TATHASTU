"""The worker never trusts the hash recorded at upload: it hashes the bytes it downloaded and refuses
a mismatch before any parsing, OCR or AI runs."""

import hashlib
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from resume.intake import IntakeError, intake  # noqa: E402

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"


class IntakeHash(unittest.TestCase):
    def test_matching_bytes_pass_and_the_hash_is_recomputed(self):
        info = intake(PDF, "application/pdf", hashlib.sha256(PDF).hexdigest())
        self.assertEqual(info.sha256, hashlib.sha256(PDF).hexdigest())

    def test_bytes_that_differ_from_the_recorded_hash_are_refused(self):
        with self.assertRaises(IntakeError) as ctx:
            intake(PDF, "application/pdf", "0" * 64)
        self.assertIn("SHA-256", str(ctx.exception))

    def test_a_single_changed_byte_is_caught(self):
        recorded = hashlib.sha256(PDF).hexdigest()
        tampered = PDF[:-2] + b"X\n"
        with self.assertRaises(IntakeError):
            intake(tampered, "application/pdf", recorded)

    def test_contents_must_match_the_declared_type_too(self):
        with self.assertRaises(IntakeError):
            intake(b"not a pdf at all", "application/pdf", hashlib.sha256(b"not a pdf at all").hexdigest())


if __name__ == "__main__":
    unittest.main()
