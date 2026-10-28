"""Pytest configuration for worker tests.
Ensures test processes explicitly load isolated test configuration and fail closed if production endpoints are targeted.
"""

from __future__ import annotations

import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent.parent
test_env = ROOT / ".env.test"

if test_env.exists():
    load_dotenv(test_env, override=True)

# Fail-closed safeguard: refuse any test run against a live Neon database
for var in ("DATABASE_URL", "WORKER_DATABASE_URL"):
    dsn = os.environ.get(var, "")
    if "neon.tech" in dsn:
        raise RuntimeError(
            f"FAIL-CLOSED: {var} targets a remote Neon database in tests! "
            "Automated test infrastructure must target a disposable local database (127.0.0.1)."
        )

# Ensure external AI provider quotas and third-party APIs are stubbed/empty during test execution
for provider_key in (
    "GROQ_KEYS",
    "GEMINI_KEYS",
    "OPENROUTER_KEYS",
    "FIRECRAWL_KEYS",
    "APIFY_TOKENS",
    "KAGGLE_KEYS",
    "STACK_EXCHANGE_KEY",
):
    os.environ[provider_key] = ""

