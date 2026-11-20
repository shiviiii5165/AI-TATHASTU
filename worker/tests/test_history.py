"""Assessment history (workstream A): explanations are pure; the immutable table is exercised on a local Postgres-protocol
database (HISTORY_TEST_DATABASE_URL, e.g. the e2e PGlite stack at postgres://postgres:postgres@127.0.0.1:55433/postgres
with migrations applied), skipped otherwise."""

from __future__ import annotations

import copy
import os
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import golden_profiles as g  # noqa: E402
from intelligence import history  # noqa: E402


def summary_for(role, profile):
    facts, repos = g.PROFILES[profile](role)
    out = g.run(facts, repos, [role])
    return history.summarize(out, {"facts": len(facts), "repositories": len(repos)}), out


class Explanations(unittest.TestCase):
    def test_identical_assessments_have_the_same_fingerprint(self):
        a, _ = summary_for("ml_engineer", "advanced_practical")
        b, _ = summary_for("ml_engineer", "advanced_practical")
        self.assertEqual(history.fingerprint(a), history.fingerprint(b))

    def test_first_assessment(self):
        a, _ = summary_for("ml_engineer", "beginner_claims")
        self.assertTrue(history.explain(None, a)["first"])

    def test_improvement_names_the_alignment_move_and_new_requirements(self):
        before, _ = summary_for("ml_engineer", "intermediate")
        after, _ = summary_for("ml_engineer", "advanced_practical")
        e = history.explain(before, after)
        self.assertFalse(e["methodologyChanged"])
        kinds = {c["kind"] for c in e["changes"]}
        self.assertIn("alignment", kinds)
        self.assertIn("requirement_met", kinds)
        move = next(c for c in e["changes"] if c["kind"] == "alignment")
        self.assertEqual((move["from"], move["to"]), ("developing", "requirements_demonstrated"))
        self.assertIn("rose", move["text"])

    def test_a_methodology_change_is_reported_as_such_not_as_the_students_progress(self):
        a, _ = summary_for("ml_engineer", "advanced_practical")
        old = copy.deepcopy(a)
        old["engineVersion"] = 4
        old["roles"][0]["met"] = [m for m in old["roles"][0]["met"] if m != "Statistics"]
        e = history.explain(old, a)
        self.assertTrue(e["methodologyChanged"])
        self.assertEqual(e["changes"][0]["kind"], "methodology")
        self.assertFalse(e["evidenceChanged"])

    def test_regression_is_explained(self):
        before, _ = summary_for("ml_engineer", "advanced_practical")
        after, _ = summary_for("ml_engineer", "outdated")
        texts = " ".join(c["text"] for c in history.explain(before, after)["changes"])
        self.assertIn("fell", texts)


class ImmutableTable(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dsn = os.environ.get("HISTORY_TEST_DATABASE_URL", "")
        if not dsn or not ("127.0.0.1" in dsn or "localhost" in dsn):
            raise unittest.SkipTest("set HISTORY_TEST_DATABASE_URL to a local database with migrations applied")
        import psycopg2
        try:
            cls.conn = psycopg2.connect(dsn)
        except Exception as exc:  # noqa: BLE001
            raise unittest.SkipTest(f"database not running: {exc}")
        cls.conn.autocommit = True

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        with self.conn.cursor() as cur:
            cur.execute("INSERT INTO users (email) VALUES (%s) RETURNING id", (f"history-{datetime.now().timestamp()}@example.com",))
            self.user = cur.fetchone()[0]

    def _view(self, profile):
        facts, repos = g.PROFILES[profile]("ml_engineer")
        return {"intelligence": g.run(facts, repos, ["ml_engineer"]), "sources": {"facts": len(facts), "repositories": len(repos)}}

    def _count(self):
        with self.conn.cursor() as cur:
            cur.execute("SELECT count(*) FROM intelligence_snapshots WHERE user_id = %s", (self.user,))
            return cur.fetchone()[0]

    def test_snapshots_are_added_only_on_change_and_never_updated(self):
        from intelligence.compute import record_history
        now = datetime.now(timezone.utc)
        with self.conn.cursor() as cur:
            v1 = self._view("intermediate")
            record_history(cur, self.user, v1, now, "test")
            self.assertTrue(v1["intelligence"]["history"]["first"])
            v1b = self._view("intermediate")
            record_history(cur, self.user, v1b, now + timedelta(minutes=1), "test")
            self.assertEqual(self._count(), 1, "an unchanged assessment adds no snapshot")
            v2 = self._view("advanced_practical")
            record_history(cur, self.user, v2, now + timedelta(minutes=2), "resume_updated")
            self.assertEqual(self._count(), 2)
            self.assertIn("requirement_met", {c["kind"] for c in v2["intelligence"]["history"]["changes"]})
            cur.execute("SELECT trigger FROM intelligence_snapshots WHERE user_id = %s ORDER BY computed_at", (self.user,))
            self.assertEqual([r[0] for r in cur.fetchall()], ["test", "resume_updated"])
            with self.assertRaises(Exception):
                cur.execute("UPDATE intelligence_snapshots SET summary = '{}' WHERE user_id = %s", (self.user,))

    def test_account_deletion_removes_history(self):
        from intelligence.compute import record_history
        with self.conn.cursor() as cur:
            record_history(cur, self.user, self._view("intermediate"), datetime.now(timezone.utc), None)
            cur.execute("DELETE FROM users WHERE id = %s", (self.user,))
        self.assertEqual(self._count(), 0)


if __name__ == "__main__":
    unittest.main()
