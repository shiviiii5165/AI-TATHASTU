"""External-AI consent and job-safety regressions (no DB, no network).

Run from worker/:  python -m pytest tests/test_consent.py -q
"""

from __future__ import annotations

import os
import sys
import threading
import time
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import provider_router  # noqa: E402
from intelligence import collaboration, repo_scorer  # noqa: E402
from jobs import Job, LockLost, assert_still_owner  # noqa: E402

REPO = {"id": "r1", "repo_name": "asha/rag-eval", "description": "RAG evaluation harness",
        "languages": {"Python": 1000}, "topics": ["llm"], "stars": 12, "forks": 2}


def _forbidden(*_a, **_k):
    raise AssertionError("an external AI/embedding call was made without consent")


class ExternalAIConsentTests(unittest.TestCase):
    def test_repo_scoring_without_consent_makes_no_ai_call(self) -> None:
        with mock.patch.object(provider_router, "route_llm", _forbidden):
            result = repo_scorer.score_repository(REPO, allow_external_ai=False)
        self.assertTrue(result["rationale"].startswith(repo_scorer.HEURISTIC_PREFIX))

    def test_repo_scoring_with_consent_sends_metadata_only(self) -> None:
        seen = {}

        def fake(**kwargs):
            seen.update(kwargs)
            return provider_router.LLMResult({"impact_score": 80, "rationale": "80 - ok"}, "groq", "m")

        with mock.patch.object(provider_router, "route_llm", side_effect=fake), \
             mock.patch("urllib.request.urlopen", _forbidden):  # no README/source fetching at all
            result = repo_scorer.score_repository(REPO, allow_external_ai=True)
        self.assertEqual(result["impact_score"], 80)
        self.assertIn("asha/rag-eval", seen["user"])
        self.assertNotIn("README", seen["user"])
        self.assertNotIn("Source Code", seen["user"])

    def test_repo_scoring_falls_back_to_labelled_heuristic_when_llm_fails(self) -> None:
        with mock.patch.object(provider_router, "route_llm", side_effect=provider_router.NeedsReviewError("down")):
            result = repo_scorer.score_repository(REPO, allow_external_ai=True)
        self.assertTrue(result["rationale"].startswith(repo_scorer.HEURISTIC_PREFIX))

    def test_heuristic_has_no_hard_coded_repo_results(self) -> None:
        for name in ("someone/corxgb", "someone/medical-ai", "someone/vira"):
            result = repo_scorer.heuristic_impact_score(name, "cancer robotics", {}, [], 0, 0)
            self.assertTrue(result["rationale"].startswith(repo_scorer.HEURISTIC_PREFIX), name)
            self.assertNotIn(result["impact_score"], (94, 86, 83))

    def test_gaps_and_roadmap_make_no_ai_call_at_all(self) -> None:
        # Stronger than the consent check it replaces: the engine has no provider to call.
        # test_career_engine.py holds the same line with AI consent given.
        import inspect

        from intelligence import career_engine

        source = inspect.getsource(career_engine)
        self.assertNotIn("route_llm", source)
        self.assertNotIn("provider_router", source)

    def test_consent_is_a_required_argument(self) -> None:
        with self.assertRaises(TypeError):
            collaboration.compute_profile_vector("student", [], [], [])  # type: ignore[call-arg]

    def test_profile_embedding_without_consent_stays_local(self) -> None:
        with mock.patch.object(collaboration, "fetch_dense_api_embedding", _forbidden):
            vec, summary = collaboration.build_collaboration_embedding(
                {"role": "student", "university": "IIT"}, ["Python"], ["RAG eval"], ["ml_engineer"], allow_external_ai=False
            )
        self.assertEqual(len(vec), collaboration.EMBEDDING_DIM)
        self.assertIn("Python", summary)

    def test_profile_embedding_with_consent_uses_the_api(self) -> None:
        api_vec = [1.0] + [0.0] * (collaboration.EMBEDDING_DIM - 1)
        with mock.patch.object(collaboration, "fetch_dense_api_embedding", return_value=api_vec) as fetch:
            vec, _ = collaboration.build_collaboration_embedding(
                {"role": "student"}, ["Python"], [], [], allow_external_ai=True
            )
        fetch.assert_called_once()
        self.assertEqual(vec, api_vec)


class RepoScoringConcurrencyTests(unittest.TestCase):
    def test_scoring_is_bounded(self) -> None:
        in_flight = 0
        peak = 0
        lock = threading.Lock()

        def slow(repo, *, allow_external_ai):
            nonlocal in_flight, peak
            with lock:
                in_flight += 1
                peak = max(peak, in_flight)
            time.sleep(0.02)
            with lock:
                in_flight -= 1
            return {"impact_score": 70, "rationale": "x"}

        repos = [dict(REPO, id=f"r{i}") for i in range(20)]
        with mock.patch.object(repo_scorer, "score_repository", side_effect=slow):
            scored = repo_scorer.score_repos(repos, allow_external_ai=False)
        self.assertEqual(len(scored), 20)
        self.assertLessEqual(peak, repo_scorer.MAX_CONCURRENCY)
        self.assertEqual([s["repo"]["id"] for s in scored], [r["id"] for r in repos])


class _Cursor:
    def __init__(self, row):
        self.row = row
        self.sql = None

    def execute(self, sql, params=None):
        self.sql = sql

    def fetchone(self):
        return self.row


class _ConsentCursor:
    """Answers the latest-consent query with one stored row, and counts how often it was asked."""

    class _Col:
        def __init__(self, name):
            self.name = name

    def __init__(self, row):
        self.row = row
        self.queries = 0
        self.description = [self._Col("granted"), self._Col("policy_version")]

    def execute(self, sql, params=None):
        self.queries += 1
        assert "ORDER BY created_at DESC LIMIT 1" in sql

    def fetchall(self):
        return [self.row] if self.row else []


class ConsentScopeTests(unittest.TestCase):
    def setUp(self) -> None:
        from db import EXTERNAL_AI_FULL_SCOPE_SINCE, has_consent

        self.has_consent, self.since = has_consent, EXTERNAL_AI_FULL_SCOPE_SINCE

    def test_one_grant_is_reused_for_every_later_operation(self) -> None:
        cur = _ConsentCursor((True, self.since))
        # Uploads, syncs and recomputes all read the same stored grant: nothing new is recorded or asked.
        self.assertTrue(all(self.has_consent(cur, "u1", "external_ai", min_version=self.since) for _ in range(5)))
        self.assertTrue(self.has_consent(cur, "u1", "external_ai"))
        self.assertTrue(self.has_consent(_ConsentCursor((True, "2027-03-01")), "u1", "external_ai", min_version=self.since))

    def test_an_earlier_grant_still_covers_resume_reading_but_not_the_newly_disclosed_purposes(self) -> None:
        old = _ConsentCursor((True, "2026-10-29"))
        self.assertTrue(self.has_consent(old, "u1", "external_ai"))  # resume reading was always disclosed
        self.assertFalse(self.has_consent(old, "u1", "external_ai", min_version=self.since))

    def test_withdrawal_and_unknown_versions_never_count_as_consent(self) -> None:
        self.assertFalse(self.has_consent(_ConsentCursor((False, self.since)), "u1", "external_ai", min_version=self.since))
        self.assertFalse(self.has_consent(_ConsentCursor((False, self.since)), "u1", "external_ai"))
        self.assertFalse(self.has_consent(_ConsentCursor(None), "u1", "external_ai"))
        for version in (None, "", "test", "v2"):
            self.assertFalse(self.has_consent(_ConsentCursor((True, version)), "u1", "external_ai", min_version=self.since), version)

    def test_scope_versions_match_the_web_app(self) -> None:
        from pathlib import Path

        catalog = (Path(__file__).resolve().parents[2] / "src" / "lib" / "consent" / "catalog.ts").read_text(encoding="utf-8")
        self.assertIn(f'EXTERNAL_AI_FULL_SCOPE_SINCE = "{self.since}"', catalog)

    def test_portfolio_and_compute_require_the_full_scope_and_resume_does_not(self) -> None:
        import inspect

        from connectors import portfolio
        from intelligence import compute
        from resume import extract

        self.assertIn("min_version=EXTERNAL_AI_FULL_SCOPE_SINCE", inspect.getsource(portfolio.sync_portfolio))
        self.assertIn("min_version=EXTERNAL_AI_FULL_SCOPE_SINCE", inspect.getsource(compute))
        self.assertNotIn("min_version", inspect.getsource(extract.process_resume_extract))


class OwnershipFenceTests(unittest.TestCase):
    def job(self, locked_by="worker-a"):
        return Job(id="j1", type="compute_intelligence", user_id="u1", payload={}, attempts=1, max_attempts=3,
                   locked_by=locked_by)

    def test_owner_may_write(self) -> None:
        cur = _Cursor((1,))
        assert_still_owner(cur, self.job())
        self.assertIn("FOR UPDATE", cur.sql)

    def test_expired_run_cannot_write(self) -> None:
        with self.assertRaises(LockLost):
            assert_still_owner(_Cursor(None), self.job())

    def test_hand_built_jobs_skip_the_fence(self) -> None:
        cur = _Cursor(None)
        assert_still_owner(cur, self.job(locked_by=""))
        self.assertIsNone(cur.sql)


if __name__ == "__main__":
    unittest.main()
