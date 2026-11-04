"""The real compute_intelligence handler on real Postgres. Needs QUEUE_TEST_DATABASE_URL pointing at a
local throwaway database with the migrations applied; skipped otherwise."""

from __future__ import annotations

import json
import os
import sys
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from intelligence import compute  # noqa: E402
from intelligence.collaboration import EMBEDDING_DIM  # noqa: E402
from jobs import Job, LockLost  # noqa: E402

NOW = datetime.now(timezone.utc)


class ComputeOnPostgres(unittest.TestCase):
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

    @staticmethod
    def topics(values):
        return values

    def setUp(self):
        self.user = str(uuid.uuid4())
        self.sql("INSERT INTO users (id, email, name, role) VALUES (%s, %s, 'Test', 'student')", (self.user, f"{self.user}@example.com"))
        self.sql("INSERT INTO onboarding_state (user_id, current_step, career_role, career_roles) VALUES (%s, 'done', 'ml_engineer', %s)", (self.user, json.dumps(["ml_engineer", "data_scientist"])))
        for i in range(3):
            self.sql(
                """INSERT INTO code_repositories (user_id, source, repo_name, url, languages, topics, stars, last_commit_at)
                   VALUES (%s, 'github', %s, %s, %s, %s, 0, %s)""",
                (self.user, f"a/r{i}", f"https://github.com/a/r{i}", json.dumps({"Python": 200000}), self.topics(["machine-learning", "docker"]), NOW - timedelta(days=10)),
            )
        self.job = Job(id=str(uuid.uuid4()), type="compute_intelligence", user_id=self.user, payload={"trigger": "test"}, attempts=1, max_attempts=3)

    def view(self):
        return self.sql("SELECT view FROM profile_views WHERE user_id = %s", (self.user,), fetch=True)[0][0]

    def counts(self):
        tables = ("skill_evidence", "unified_projects", "eris_scores", "roadmaps", "collaboration_embeddings", "github_scores")
        return {t: self.sql(f"SELECT count(*) FROM {t} WHERE user_id = %s", (self.user,), fetch=True)[0][0] for t in tables}

    def test_stored_outputs_agree_across_modules(self):
        compute.process_compute_intelligence(self.conn, self.job)
        view = self.view()
        role = view["intelligence"]["roles"][0]
        self.assertEqual(role["role"], "ml_engineer")
        stored = dict(self.sql("SELECT role, breakdown_json FROM eris_scores WHERE user_id = %s", (self.user,), fetch=True))
        self.assertEqual(set(stored), {"ml_engineer", "data_scientist"})
        self.assertEqual([g["skill"] for g in stored["ml_engineer"]["gaps"]], [r["skill"] for r in role["open"][:3]])
        self.assertEqual(view["erisScore"]["gaps"], stored["ml_engineer"]["gaps"])
        widget = next(w for w in view["widgets"] if w["id"] == "skill_gaps")
        self.assertEqual(widget["data"]["gaps"], stored["ml_engineer"]["gaps"])
        self.assertEqual(view["skillGapsAndPaths"]["gaps"][0]["skill"], next(r["skill"] for r in role["open"] if not r["insufficientEvidence"]))
        python = next(s for s in view["skills"] if s["name"] == "Python")
        engine_python = next(s for s in view["intelligence"]["skills"] if s["name"] == "Python")
        self.assertEqual((python["proficiency"], python["verificationStatus"]), (engine_python["proficiency"], "verified"))
        self.assertEqual(view["sources"]["repositories"], 3)

    def test_running_twice_gives_the_same_rows(self):
        compute.process_compute_intelligence(self.conn, self.job)
        first = self.counts()
        scores = self.sql("SELECT role, score FROM eris_scores WHERE user_id = %s ORDER BY role", (self.user,), fetch=True)
        compute.process_compute_intelligence(self.conn, self.job)
        self.assertEqual(self.counts(), first)
        self.assertEqual(self.sql("SELECT role, score FROM eris_scores WHERE user_id = %s ORDER BY role", (self.user,), fetch=True), scores)

    def test_a_stale_run_keeps_the_newer_result(self):
        compute.process_compute_intelligence(self.conn, self.job)
        future = (NOW + timedelta(hours=1)).isoformat()
        self.sql("UPDATE profile_views SET view = jsonb_set(view, '{computedAt}', %s::jsonb) WHERE user_id = %s", (json.dumps(future), self.user))
        self.sql("DELETE FROM eris_scores WHERE user_id = %s", (self.user,))
        compute.process_compute_intelligence(self.conn, self.job)
        self.assertEqual(self.view()["computedAt"], future)
        self.assertEqual(self.counts()["eris_scores"], 0)

    def test_a_run_that_lost_its_lock_writes_nothing(self):
        lost = Job(id=self.job.id, type=self.job.type, user_id=self.user, payload={}, attempts=1, max_attempts=3, locked_by="someone-else")
        with self.assertRaises(LockLost):
            compute.process_compute_intelligence(self.conn, lost)
        self.assertEqual(self.sql("SELECT count(*) FROM profile_views WHERE user_id = %s", (self.user,), fetch=True)[0][0], 0)

    def grant_ai(self, granted=True):
        self.sql(
            "INSERT INTO consents (user_id, purpose, granted, policy_version) VALUES (%s, 'external_ai', %s, 'test')",
            (self.user, granted),
        )

    def test_an_unchanged_profile_reuses_its_embedding_and_a_change_or_revocation_does_not(self):
        self.grant_ai()
        dense = [1.0] + [0.0] * (EMBEDDING_DIM - 1)
        calls = []

        def provider(text, target_dim=EMBEDDING_DIM):
            calls.append(text)
            compute.ai_budget.current_use().succeeded += 1
            return dense

        with mock.patch("intelligence.collaboration.fetch_dense_api_embedding", provider), mock.patch("intelligence.compute.score_repos", return_value=[]):
            compute.process_compute_intelligence(self.conn, self.job)
            self.assertEqual(len(calls), 1)
            compute.process_compute_intelligence(self.conn, self.job)
            self.assertEqual(len(calls), 1, "unchanged profile called the provider again")

            self.sql("UPDATE code_repositories SET topics = %s WHERE user_id = %s", (self.topics(["pytorch"]), self.user))
            compute.process_compute_intelligence(self.conn, self.job)
            self.assertEqual(len(calls), 2, "a changed profile must get a new vector")

            self.grant_ai(False)
            compute.process_compute_intelligence(self.conn, self.job)
            self.assertEqual(len(calls), 2, "no provider call after consent was revoked")
            self.assertIsNone(self.view()["embeddingFingerprint"])

    def test_a_local_fallback_vector_is_not_cached_as_if_the_provider_made_it(self):
        self.grant_ai()
        with mock.patch("intelligence.collaboration.fetch_dense_api_embedding", return_value=None) as provider, mock.patch("intelligence.compute.score_repos", return_value=[]):
            compute.process_compute_intelligence(self.conn, self.job)
            compute.process_compute_intelligence(self.conn, self.job)
        self.assertEqual(provider.call_count, 2)
        self.assertIsNone(self.view()["embeddingFingerprint"])


if __name__ == "__main__":
    unittest.main()
