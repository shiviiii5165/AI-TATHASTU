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
from intelligence import collaboration, repo_scorer, roadmap, skill_graph  # noqa: E402
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

    def test_skill_gaps_without_consent_makes_no_ai_call(self) -> None:
        with mock.patch.object(provider_router, "route_llm", _forbidden):
            out = skill_graph.generate_skill_gaps_and_recommendations(
                {"Python": {"strength": 0.9}}, "ml_engineer", has_consent=False, rag_courses=[]
            )
        self.assertIn("gaps", out)

    def test_roadmap_without_consent_makes_no_ai_call(self) -> None:
        user = {"name": "Asha", "role": "student", "degree": "B.Tech", "university": "IIT", "career_role": "ml_engineer"}
        with mock.patch.object(provider_router, "route_llm", _forbidden):
            out = roadmap.generate_career_roadmap(user, has_consent=False, rag_courses=[])
        self.assertIn("current_stage", out)

    def test_consent_is_a_required_argument(self) -> None:
        with self.assertRaises(TypeError):
            skill_graph.generate_skill_gaps_and_recommendations({}, "ml_engineer")  # type: ignore[call-arg]
        with self.assertRaises(TypeError):
            roadmap.generate_career_roadmap({})  # type: ignore[call-arg]
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
