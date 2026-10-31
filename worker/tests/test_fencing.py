"""Stale runs can't overwrite newer results, and a hung job can't hold its lock forever."""

import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from connectors import common  # noqa: E402
from jobs import Job, LockLost  # noqa: E402
import worker as worker_module  # noqa: E402
from worker import Heartbeat, Worker  # noqa: E402


class NotOwnerCursor:
    """The job row no longer belongs to this worker; every other statement is an error."""

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def execute(self, sql, params=None):
        if "FROM jobs" not in sql:
            raise AssertionError(f"wrote after losing the lock: {sql}")

    def fetchone(self):
        return None


class Conn:
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def cursor(self, **_):
        return NotOwnerCursor()


class Fencing(unittest.TestCase):
    def test_a_sync_that_lost_its_job_writes_no_facts(self):
        job = Job(id="j", type="connector_sync", user_id="u", payload={}, attempts=1, max_attempts=3, locked_by="old")
        with self.assertRaises(LockLost):
            common.finish_sync(Conn(), job, "c", "github", common.Facts("u", "github", "api"))

    def test_each_queue_thread_has_its_own_identity(self):
        self.assertNotEqual(Worker("dsn").worker_id, Worker("dsn").worker_id)

    def test_a_job_past_its_limit_stops_renewing_its_lock(self):
        beat = Heartbeat("dsn", "j", "w")
        beat.deadline = 0  # Already past it.
        with mock.patch.object(worker_module, "LOCK_SECONDS", 0), mock.patch.object(worker_module.psycopg2, "connect") as connect:
            with mock.patch.object(beat._stopped, "wait", return_value=False):
                beat.run()
        connect.assert_not_called()


if __name__ == "__main__":
    unittest.main()
