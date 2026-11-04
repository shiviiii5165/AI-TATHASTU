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
    if dsn and not any(host in dsn for host in ("@127.0.0.1", "@localhost", "@host.docker.internal")):
        raise RuntimeError(
            f"FAIL-CLOSED: {var} targets a remote database in tests! "
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

# Most worker tests have no database and fake their providers, so they get a gate that
# allows everything. test_ai_budget.py covers the real one, and swaps it in itself.
import sys  # noqa: E402
from decimal import Decimal  # noqa: E402

sys.path.insert(0, str(ROOT / "worker"))
import ai_budget  # noqa: E402


class AllowAllGate:
    def reserve(self, scope, provider, model, purpose, amount, timeout):
        return ai_budget.Reservation(None, provider, model, Decimal(amount))

    def settle(self, reservation, status, cost, tokens_in, tokens_out):
        pass


ai_budget.set_gate_for_tests(AllowAllGate())

