"""External-AI consent enforced by the real worker handlers on real Postgres, plus the retired generate_roadmap job.

Needs QUEUE_TEST_DATABASE_URL pointing at a local throwaway database with the migrations applied (pgvector
included); skipped otherwise. Only the network and object storage are replaced: every consent decision is the
handler's own, read from the consents table.

  resume_extract   any earlier grant covers it (resume reading was always disclosed)
  portfolio sync   needs a grant under the full-scope policy (EXTERNAL_AI_FULL_SCOPE_SINCE)
  compute          repository scoring and people matching need the same (see test_compute_integration.py)
"""

from __future__ import annotations

import json
import os
import sys
import unittest
import uuid
from unittest import mock

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import provider_router  # noqa: E402
from connectors import portfolio  # noqa: E402
from db import EXTERNAL_AI_FULL_SCOPE_SINCE  # noqa: E402
from intelligence import compute  # noqa: E402
from jobs import Job, NeedsReview  # noqa: E402
from resume import extract  # noqa: E402

OLD = "2026-10-29"
LONG_PAGE = "Portfolio of Asha. " * 40


def _forbidden(*_a, **_k):
    raise AssertionError("an outside AI call was made without covering consent")


class ConsentOnPostgres(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dsn = os.environ.get("QUEUE_TEST_DATABASE_URL", "")
        if "127.0.0.1" not in dsn and "localhost" not in dsn:
            raise unittest.SkipTest("set QUEUE_TEST_DATABASE_URL to a local throwaway database")
        try:
            cls.conn = psycopg2.connect(dsn)
        except psycopg2.OperationalError as exc:
            raise unittest.SkipTest(f"database not running: {exc}")

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def sql(self, statement, params=None, fetch=False):
        with self.conn, self.conn.cursor() as cur:
            cur.execute(statement, params)
            return cur.fetchall() if fetch else None

    def setUp(self):
        self.user = str(uuid.uuid4())
        self.sql("INSERT INTO users (id, email, name, role) VALUES (%s, %s, 'Test', 'student')", (self.user, f"{self.user}@example.com"))
        self.sql("INSERT INTO onboarding_state (user_id, current_step, career_role, career_roles) VALUES (%s, 'done', 'ml_engineer', %s)", (self.user, json.dumps(["ml_engineer"])))
        self.file = str(uuid.uuid4())
        self.sql(
            "INSERT INTO files (id, user_id, kind, storage_key, sha256, size_bytes, mime) VALUES (%s, %s, 'resume', 'k', %s, 10, 'application/pdf')",
            (self.file, self.user, uuid.uuid4().hex),
        )

    def consent(self, granted, version):
        self.sql("INSERT INTO consents (user_id, purpose, granted, policy_version, created_at) VALUES (%s, 'external_ai', %s, %s, now() + make_interval(secs => (SELECT count(*) FROM consents WHERE user_id = %s)))", (self.user, granted, version, self.user))

    def consent_rows(self):
        return self.sql("SELECT count(*) FROM consents WHERE user_id = %s", (self.user,), fetch=True)[0][0]

    def job(self, type_, payload=None):
        return Job(id=str(uuid.uuid4()), type=type_, user_id=self.user, payload=payload or {}, attempts=1, max_attempts=3)

    # ── the handlers' own decisions ─────────────────────────────────────────

    def resume_consent(self) -> bool:
        """Runs resume_extract; returns the consent the handler decided to extract with."""
        seen = {}

        def fake_extract(data, mime, sha, consent):
            seen["consent"] = consent
            raise NeedsReview("stop after the consent decision")

        with mock.patch.object(extract, "read_object", return_value=b"%PDF"), mock.patch.object(extract, "extract_facts", side_effect=fake_extract):
            with self.assertRaises(NeedsReview):
                extract.process_resume_extract(self.conn, self.job("resume_extract", {"fileId": self.file}))
        return seen["consent"]

    def portfolio_used_ai(self) -> bool:
        """Runs the portfolio sync; True if it sent the page to the LLM."""
        calls = []
        with mock.patch.object(portfolio, "load_connection", return_value=({"id": str(uuid.uuid4())}, {"url": "https://asha.dev"})), \
             mock.patch.object(portfolio, "scrape", return_value=LONG_PAGE), \
             mock.patch.object(portfolio.llm, "extract_full", side_effect=lambda doc, consent: calls.append(consent) or []), \
             mock.patch.object(portfolio, "finish_sync"):
            portfolio.sync_portfolio(self.conn, self.job("connector_sync", {"source_id": "portfolio"}))
        return bool(calls)

    def compute_allowed(self) -> bool:
        """Runs compute_intelligence; returns whether repository scoring and matching were allowed outside AI."""
        with mock.patch("intelligence.compute.score_repos", return_value=[]) as score, \
             mock.patch("intelligence.collaboration.fetch_dense_api_embedding", return_value=None) as embed:
            compute.process_compute_intelligence(self.conn, self.job("compute_intelligence"))
        allowed = score.call_args.kwargs["allow_external_ai"]
        if not allowed:
            embed.assert_not_called()
        return allowed

    # ── scenarios ───────────────────────────────────────────────────────────

    def test_old_consent_allows_resume_reading_only(self):
        self.consent(True, OLD)
        self.assertTrue(self.resume_consent())
        with mock.patch.object(provider_router, "route_llm", _forbidden):
            self.assertFalse(self.portfolio_used_ai())
            self.assertFalse(self.compute_allowed())

    def test_current_consent_allows_everything_disclosed(self):
        self.consent(True, EXTERNAL_AI_FULL_SCOPE_SINCE)
        self.assertTrue(self.resume_consent())
        self.assertTrue(self.portfolio_used_ai())
        self.assertTrue(self.compute_allowed())

    def test_no_answer_declined_or_withdrawn_blocks_all_outside_ai(self):
        with mock.patch.object(provider_router, "route_llm", _forbidden):
            # Never answered.
            self.assertFalse(self.resume_consent())
            self.assertFalse(self.portfolio_used_ai())
            self.assertFalse(self.compute_allowed())
            # Declined under the current policy.
            self.consent(False, EXTERNAL_AI_FULL_SCOPE_SINCE)
            self.assertFalse(self.resume_consent())
            self.assertFalse(self.portfolio_used_ai())
            self.assertFalse(self.compute_allowed())
            # Granted, then withdrawn: the latest answer wins.
            self.consent(True, EXTERNAL_AI_FULL_SCOPE_SINCE)
            self.consent(False, EXTERNAL_AI_FULL_SCOPE_SINCE)
            self.assertFalse(self.resume_consent())
            self.assertFalse(self.portfolio_used_ai())
            self.assertFalse(self.compute_allowed())

    def test_one_accepted_consent_is_reused_across_operations_and_retries(self):
        self.consent(True, EXTERNAL_AI_FULL_SCOPE_SINCE)
        for _ in range(3):  # uploads, syncs, recomputes and their retries all read the same row
            self.assertTrue(self.resume_consent())
            self.assertTrue(self.portfolio_used_ai())
            self.assertTrue(self.compute_allowed())
        self.assertEqual(self.consent_rows(), 1, "processing must never record or request consent again")

    # ── retired generate_roadmap job ────────────────────────────────────────

    def test_legacy_generate_roadmap_job_hands_its_work_to_compute_intelligence(self):
        from worker import process_generate_roadmap

        with mock.patch.object(provider_router, "route_llm", _forbidden):
            process_generate_roadmap(self.conn, self.job("generate_roadmap"))
        queued = self.sql("SELECT payload->>'trigger' FROM jobs WHERE user_id = %s AND type = 'compute_intelligence' AND status = 'queued'", (self.user,), fetch=True)
        self.assertEqual(queued, [("legacy:generate_roadmap",)])
        # A second legacy job collapses into the one already waiting.
        process_generate_roadmap(self.conn, self.job("generate_roadmap"))
        self.assertEqual(self.sql("SELECT count(*) FROM jobs WHERE user_id = %s AND type = 'compute_intelligence'", (self.user,), fetch=True)[0][0], 1)

    def test_legacy_generate_roadmap_job_for_a_deleted_account_does_nothing(self):
        from worker import process_generate_roadmap

        self.sql("UPDATE users SET deleted_at = now() WHERE id = %s", (self.user,))
        process_generate_roadmap(self.conn, self.job("generate_roadmap"))
        self.assertEqual(self.sql("SELECT count(*) FROM jobs WHERE user_id = %s", (self.user,), fetch=True)[0][0], 0)

    def test_a_retrying_legacy_job_is_claimed_and_completed_by_the_real_queue(self):
        import worker

        # As left by the old handler: one failed attempt (the ImportError), queued for retry. Oldest run_at so the
        # shared test database's other queued jobs don't get claimed first.
        self.sql(
            """INSERT INTO jobs (type, user_id, idempotency_key, attempts, last_error, run_at)
               VALUES ('generate_roadmap', %s, %s, 1, 'ImportError: cannot import name generate_career_roadmap', '2000-01-01')""",
            (self.user, f"legacy:{self.user}"),
        )
        runner = worker.Worker(os.environ["QUEUE_TEST_DATABASE_URL"])
        try:
            claimed = runner.claim()
            self.assertIsNotNone(claimed)
            self.assertEqual((claimed.type, str(claimed.user_id)), ("generate_roadmap", self.user))
            with mock.patch.object(provider_router, "route_llm", _forbidden), mock.patch.object(worker.Worker, "notify"):
                runner.run_one(claimed)
        finally:
            if runner.conn is not None:
                runner.conn.close()
        self.assertEqual(self.sql("SELECT status, last_error FROM jobs WHERE user_id = %s AND type = 'generate_roadmap'", (self.user,), fetch=True), [("done", None)])
        self.assertEqual(self.sql("SELECT count(*) FROM jobs WHERE user_id = %s AND type = 'compute_intelligence' AND status = 'queued'", (self.user,), fetch=True)[0][0], 1)


if __name__ == "__main__":
    unittest.main()
