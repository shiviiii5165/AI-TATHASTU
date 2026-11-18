"""Deep idle: the queue lets Neon suspend when nothing is queued, and a wake ping restarts it.
No database, no network."""

import sys
import threading
import time
import unittest
from io import BytesIO
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import worker as worker_mod  # noqa: E402
from worker import Worker  # noqa: E402


class DeepIdle(unittest.TestCase):
    def _worker(self, next_due_seconds):
        w = Worker("dsn")
        conn = mock.Mock(closed=False)
        w.conn = conn
        w.execute = mock.Mock(return_value={"seconds": next_due_seconds})
        w.wait_for_wake = mock.Mock()
        return w, conn

    def test_closes_the_connection_so_the_database_can_suspend(self):
        w, conn = self._worker(None)
        w.deep_idle()
        conn.close.assert_called_once()
        self.assertIsNone(w.conn)

    def test_waits_the_full_deep_idle_when_nothing_is_scheduled(self):
        w, _ = self._worker(None)
        self.assertEqual(w.deep_idle(), worker_mod.DEEP_IDLE_S)

    def test_wakes_in_time_for_a_scheduled_retry(self):
        w, _ = self._worker(95.0)
        self.assertEqual(w.deep_idle(), 95.0)

    def test_an_overdue_job_still_waits_the_short_floor_not_zero(self):
        w, _ = self._worker(-30.0)
        self.assertEqual(w.deep_idle(), worker_mod.IDLE_POLL_MAX_S)

    def test_the_loop_goes_deep_only_after_the_queue_was_empty_for_a_while(self):
        w = Worker("dsn")
        claims = [None] * 6
        def claim():
            claims.pop(0)
            if not claims:
                w.stopping = True
            return None
        w.claim = claim
        w.sleep = mock.Mock()
        w.deep_idle = mock.Mock()
        clock = iter([0, 1, 2, 3, 200, 201, 202, 203, 204, 205])  # minutes pass after the 3rd poll
        with mock.patch.object(worker_mod.time, "monotonic", side_effect=lambda: next(clock)):
            w.run_forever()
        self.assertGreaterEqual(w.sleep.call_count, 2)  # short polls first
        w.deep_idle.assert_called()  # then deep idle


class WakeSignal(unittest.TestCase):
    def test_a_wake_ping_ends_the_wait_early(self):
        w = Worker("dsn")
        threading.Timer(0.2, worker_mod.wake).start()
        started = time.monotonic()
        w.wait_for_wake(30)
        self.assertLess(time.monotonic() - started, 5)

    def test_stop_ends_the_wait(self):
        w = Worker("dsn")
        threading.Timer(0.2, w.stop).start()
        started = time.monotonic()
        w.wait_for_wake(30)
        self.assertLess(time.monotonic() - started, 5)

    def test_every_thread_sees_one_ping(self):
        a, b = Worker("dsn"), Worker("dsn")
        done = []
        threads = [threading.Thread(target=lambda w=w: (w.wait_for_wake(30), done.append(1))) for w in (a, b)]
        for t in threads:
            t.start()
        time.sleep(0.2)
        worker_mod.wake()
        for t in threads:
            t.join(5)
        self.assertEqual(len(done), 2)


class WakeEndpoint(unittest.TestCase):
    def _get(self, path):
        import server
        alive = mock.Mock(is_alive=mock.Mock(return_value=True))
        handler_cls = server.make_handler([alive])
        handler = handler_cls.__new__(handler_cls)
        handler.path, handler.command = path, "GET"
        handler.wfile = BytesIO()
        handler.send_response = mock.Mock()
        handler.send_header = mock.Mock()
        handler.end_headers = mock.Mock()
        with mock.patch.object(server, "wake") as wake:
            handler.do_GET()
        return wake, handler.send_response.call_args[0][0]

    def test_wake_paths_wake_the_queue(self):
        for path in ("/wake", "/health?wake=1", "/?wake=1"):
            wake, status = self._get(path)
            wake.assert_called_once()
            self.assertEqual(status, 200)

    def test_a_plain_health_check_does_not_wake_it(self):
        for path in ("/health", "/", "/health?x=1"):
            wake, status = self._get(path)
            wake.assert_not_called()
            self.assertEqual(status, 200)

    def test_unknown_paths_are_404_and_do_not_wake(self):
        wake, status = self._get("/admin")
        wake.assert_not_called()
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
