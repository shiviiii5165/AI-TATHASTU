"""Importing worker code must never pick up .env.local: that is how test runs reached Neon."""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

WORKER = Path(__file__).resolve().parent.parent
ROOT = WORKER.parent


def _clean_env():
    env = {k: v for k, v in os.environ.items() if k not in ("DATABASE_URL", "WORKER_DATABASE_URL")}
    env["PYTHONPATH"] = str(WORKER)
    return env


class ImportLoadsNoCredentials(unittest.TestCase):
    def test_importing_the_worker_sets_no_database_url(self):
        code = "import os, worker; print(os.environ.get('DATABASE_URL'), os.environ.get('WORKER_DATABASE_URL'))"
        out = subprocess.run([sys.executable, "-c", code], cwd=WORKER, env=_clean_env(), capture_output=True, text=True, check=True)
        self.assertEqual(out.stdout.strip().splitlines()[-1], "None None")

    def test_importing_the_server_sets_no_database_url(self):
        code = "import os, server; print(os.environ.get('DATABASE_URL'))"
        out = subprocess.run([sys.executable, "-c", code], cwd=WORKER, env=_clean_env(), capture_output=True, text=True, check=True)
        self.assertEqual(out.stdout.strip().splitlines()[-1], "None")

    def test_only_entry_points_load_env_files(self):
        for name in ("worker.py", "server.py"):
            lines = (WORKER / name).read_text(encoding="utf-8").splitlines()
            for i, line in enumerate(lines):
                if line.lstrip().startswith("load_dotenv("):
                    self.assertTrue(line.startswith("    "), f"{name}:{i + 1} loads env files at module level")
                    guard = next(l for l in reversed(lines[:i]) if l and not l.startswith(" "))
                    self.assertIn('__name__ == "__main__"', guard, f"{name}:{i + 1}")


class ScriptGuard(unittest.TestCase):
    def test_python_embed_script_refuses_a_remote_database_before_connecting(self):
        env = _clean_env()
        env["DATABASE_URL"] = "postgres://u:hidden@db.invalid.example/db"
        env.pop("AIT_APPROVED_WRITE_HOST", None)
        with tempfile.TemporaryDirectory() as cwd:
            out = subprocess.run([sys.executable, str(ROOT / "scripts/embed_learning_resources.py")], cwd=cwd, env=env, capture_output=True, text=True, timeout=120)
        self.assertEqual(out.returncode, 1)
        self.assertIn("Refusing to write to remote database host db.invalid.example", out.stdout)
        self.assertNotIn("hidden", out.stdout + out.stderr)


if __name__ == "__main__":
    unittest.main()
