"""Claim and expiry SQL against real Postgres. Runs only against a local
throwaway database (`node e2e/support/stack.mts`, then DATABASE_URL pointing at
127.0.0.1); skipped otherwise, including in CI's worker job."""

import json
import os
import sys
import unittest
import uuid
from pathlib import Path

import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from worker import DONE_SQL, Worker  # noqa: E402


class QueueSql(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        dsn = os.environ.get("QUEUE_TEST_DATABASE_URL", "")
        if "127.0.0.1" not in dsn and "localhost" not in dsn:
            raise unittest.SkipTest("set QUEUE_TEST_DATABASE_URL to a local throwaway database")
        try:
            cls.conn = psycopg2.connect(dsn)
        except psycopg2.OperationalError as exc:
            raise unittest.SkipTest(f"database not running: {exc}")
        cls.conn.autocommit = True
        cls.dsn = dsn

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def setUp(self):
        # Other rows would be claimed first; this database is disposable.
        self.run_sql("DELETE FROM jobs")
        self.user = str(uuid.uuid4())
        self.run_sql("INSERT INTO users (id, email) VALUES (%s, %s)", (self.user, f"{self.user}@example.com"))
        self.worker = Worker(self.dsn)

    def tearDown(self):
        if self.worker.conn:
            self.worker.conn.close()

    def run_sql(self, sql, params=None):
        with self.conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.fetchall() if cur.description else None

    def add_job(self, type_="compute_intelligence", status="queued", locked="NULL", attempts=0, payload=None):
        job_id = str(uuid.uuid4())
        self.run_sql(
            f"""INSERT INTO jobs (id, type, user_id, idempotency_key, payload, status, attempts, locked_by, locked_until)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, {locked})""",
            (job_id, type_, self.user, job_id, json.dumps(payload or {}), status, attempts,
             None if locked == "NULL" else "other-worker"),
        )
        return job_id

    def test_second_recompute_for_a_user_waits_for_the_running_one(self):
        self.add_job(status="running", locked="now() + interval '5 minutes'", attempts=1)
        waiting = self.add_job()
        self.assertIsNone(self.worker.claim())
        self.run_sql("UPDATE jobs SET status = 'done', locked_until = NULL WHERE id <> %s", (waiting,))
        self.assertEqual(str(self.worker.claim().id), waiting)

    def test_second_sync_of_a_connection_waits_but_other_connections_run(self):
        same = {"source_id": "github", "connection_id": "c1"}
        self.add_job("connector_sync", status="running", locked="now() + interval '5 minutes'", attempts=1, payload=same)
        self.add_job("connector_sync", payload=same)
        self.assertIsNone(self.worker.claim())
        other = self.add_job("connector_sync", payload={"source_id": "github", "connection_id": "c2"})
        self.assertEqual(str(self.worker.claim().id), other)

    def test_two_threads_of_one_process_are_fenced_from_each_other(self):
        # server.py runs several Workers in one process. A's lock expires and B takes the job:
        # A's late outcome must not land.
        job_id = self.add_job()
        first = self.worker.claim()
        self.run_sql("UPDATE jobs SET locked_until = now() - interval '1 minute' WHERE id = %s", (job_id,))
        other = Worker(self.dsn)
        try:
            second = other.claim()
            self.assertEqual(str(second.id), job_id)
            self.assertNotEqual(first.locked_by, second.locked_by)
            self.assertEqual(self.worker.execute(DONE_SQL, {"id": first.id, "worker": first.locked_by}), 0)
            self.assertEqual(self.run_sql("SELECT status FROM jobs WHERE id = %s", (job_id,))[0][0], "running")
        finally:
            if other.conn:
                other.conn.close()

    def test_a_crashed_run_does_not_block_the_next_one(self):
        self.add_job(status="running", locked="now() - interval '1 minute'", attempts=1)
        self.assertIsNotNone(self.worker.claim())

    def test_other_users_and_job_types_are_not_held_back(self):
        self.add_job(status="running", locked="now() + interval '5 minutes'", attempts=1)
        resume = self.add_job(type_="resume_extract")
        self.assertEqual(str(self.worker.claim().id), resume)

    def test_final_attempt_expiry_fails_the_job_and_settles_the_connection(self):
        self.run_sql(
            "INSERT INTO connections (user_id, source_id, access_method, status) VALUES (%s, 'orcid', 'oauth', 'syncing')",
            (self.user,),
        )
        job_id = self.add_job(type_="connector_sync", status="running", locked="now() - interval '1 minute'",
                              attempts=3, payload={"source_id": "orcid", "connection_id": "x"})
        self.assertIsNone(self.worker.claim())
        self.assertEqual(self.run_sql("SELECT status FROM jobs WHERE id = %s", (job_id,))[0][0], "failed")
        self.assertEqual(self.run_sql("SELECT status FROM connections WHERE user_id = %s", (self.user,))[0][0], "failed")


if __name__ == "__main__":
    unittest.main()
