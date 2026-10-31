"""Queue survival, oversized uploads and connector settling. No DB, no network
(test_queue_sql.py covers the same rules against real Postgres when available)."""

import io
import re
import sys
import unittest
import zipfile
from pathlib import Path
from unittest import mock

import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from connectors import sync  # noqa: E402
from intelligence.compute import API_ORIGINS  # noqa: E402
from jobs import Job, LockLost, NeedsReview  # noqa: E402
from resume import text, vision  # noqa: E402
from resume.intake import IntakeError, intake  # noqa: E402
from worker import Worker  # noqa: E402

DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def job(attempts=1, max_attempts=3, type_="connector_sync", payload=None) -> Job:
    return Job(id="j", type=type_, user_id="u", payload=payload or {"source_id": "orcid", "connection_id": "c"},
               attempts=attempts, max_attempts=max_attempts)


class QueueThreadSurvival(unittest.TestCase):
    def _run_until_stopped(self, worker, claims):
        def claim():
            item = claims.pop(0)
            if not claims:
                worker.stopping = True
            if isinstance(item, Exception):
                raise item
            return item
        worker.claim = claim
        worker.sleep = lambda _s: None

    def test_connection_lost_while_recording_an_outcome_does_not_kill_the_thread(self):
        worker = Worker("dsn")
        self._run_until_stopped(worker, [job(type_="resume_extract"), None])
        with mock.patch.object(worker, "run_one", side_effect=psycopg2.OperationalError("SSL connection closed")) as run:
            worker.run_forever()  # must return normally
        run.assert_called_once()
        self.assertIsNone(worker.conn)  # reconnects next time

    def test_an_unexpected_error_does_not_kill_the_thread(self):
        worker = Worker("dsn")
        self._run_until_stopped(worker, [job(type_="resume_extract"), None])
        with mock.patch.object(worker, "run_one", side_effect=RuntimeError("bug")):
            worker.run_forever()

    def test_closed_connection_while_claiming_does_not_kill_the_thread(self):
        worker = Worker("dsn")
        self._run_until_stopped(worker, [psycopg2.InterfaceError("connection already closed"), None])
        worker.run_forever()


class OutcomeWrites(unittest.TestCase):
    def _worker(self, deleted):
        worker = Worker("dsn")
        calls = []

        def execute(sql, params=None, fetch=False):
            calls.append(sql)
            if "deleted_at" in sql:
                return {"?column?": 1} if deleted else None
            return 1
        worker.execute = execute
        worker.connect = lambda: mock.Mock()
        return worker, calls

    def test_a_deleted_users_job_never_reaches_its_handler(self):
        worker, calls = self._worker(deleted=True)
        handler = mock.Mock()
        with mock.patch.dict("worker.HANDLERS", {"resume_extract": handler}), mock.patch.object(Worker, "notify") as notify:
            worker._run_one(job(type_="resume_extract"))
        handler.assert_not_called()
        notify.assert_not_called()  # no email to a deleted account
        self.assertTrue(any("status = 'failed'" in c for c in calls))

    def test_an_active_users_job_runs(self):
        worker, _ = self._worker(deleted=False)
        handler = mock.Mock()
        with mock.patch.dict("worker.HANDLERS", {"resume_extract": handler}), mock.patch.object(Worker, "notify"):
            worker._run_one(job(type_="resume_extract"))
        handler.assert_called_once()

    def test_retry_delay_is_jittered_within_bounds(self):
        worker, _ = self._worker(deleted=False)
        seen = []
        original = worker.execute

        def execute(sql, params=None, fetch=False):
            if params and "delay" in params:
                seen.append(params["delay"])
            return original(sql, params, fetch)
        worker.execute = execute
        worker.conn = None
        with mock.patch.dict("worker.HANDLERS", {"resume_extract": mock.Mock(side_effect=RuntimeError("x"))}):
            for _ in range(20):
                worker._run_one(job(attempts=2, type_="resume_extract"))
        self.assertTrue(all(60 <= d <= 75 for d in seen), seen)
        self.assertGreater(len(set(seen)), 1)


class ConnectorSettling(unittest.TestCase):
    def _sync(self, error, attempts):
        conn = mock.MagicMock()
        cur = conn.cursor.return_value.__enter__.return_value
        with mock.patch.dict(sync.SYNCERS, {"orcid": mock.Mock(side_effect=error)}):
            with self.assertRaises(type(error)):
                sync.process_connector_sync(conn, job(attempts=attempts))
        return cur

    def test_last_attempt_of_an_unrecognised_failure_marks_the_card_failed(self):
        cur = self._sync(TimeoutError("read timed out"), attempts=3)
        self.assertIn("status = 'failed'", cur.execute.call_args.args[0])
        self.assertIn("status = 'syncing'", cur.execute.call_args.args[0])  # never overrides a settled status

    def test_earlier_attempts_stay_syncing_for_the_retry(self):
        self._sync(TimeoutError("read timed out"), attempts=1).execute.assert_not_called()

    def test_needs_review_is_terminal(self):
        self.assertIn("status = 'failed'", self._sync(NeedsReview("x"), attempts=1).execute.call_args.args[0])

    def test_lock_lost_touches_nothing(self):
        self._sync(LockLost("x"), attempts=3).execute.assert_not_called()


class OversizedUploads(unittest.TestCase):
    def _docx(self, payload_bytes):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("word/document.xml", b"\0" * payload_bytes)
        return buf.getvalue()

    def test_docx_decompression_bomb_is_refused_at_intake(self):
        bomb = self._docx(150 * 1024 * 1024)
        self.assertLess(len(bomb), 1024 * 1024)  # passes the 10 MB upload limit
        with self.assertRaises(IntakeError):
            intake(bomb, DOCX, "")

    def test_normal_docx_passes_intake(self):
        self.assertEqual(intake(self._docx(1024), DOCX, "").kind, "docx")

    def _pdf(self, pages=1, size=(612, 792)):
        import fitz
        pdf = fitz.open()
        for _ in range(pages):
            pdf.new_page(width=size[0], height=size[1]).insert_text((50, 50), "Asha Rao resume text that is long enough to count")
        return pdf.tobytes()

    def test_pdf_with_too_many_pages_is_refused(self):
        with self.assertRaisesRegex(ValueError, "pages"):
            text.extract(self._pdf(pages=text.MAX_PDF_PAGES + 1), "pdf")

    def test_pdf_with_a_huge_page_is_refused_before_rendering(self):
        with self.assertRaisesRegex(ValueError, "too large"):
            text.extract(self._pdf(size=(14400, 14400)), "pdf")

    def test_normal_pdf_still_extracts(self):
        self.assertIn("Asha Rao", text.extract(self._pdf(pages=2), "pdf").text)

    def test_vision_refuses_a_decompression_bomb_image(self):
        from PIL import Image
        buf = io.BytesIO()
        Image.new("1", (7000, 7000)).save(buf, format="PNG")  # 49 MP, small on disk
        self.assertLess(len(buf.getvalue()), 1024 * 1024)
        with self.assertRaisesRegex(ValueError, "too large"):
            vision.render_pages(buf.getvalue(), "image")


class OriginsStayInSync(unittest.TestCase):
    def test_worker_and_web_treat_the_same_sources_as_usable(self):
        source = (Path(__file__).resolve().parents[2] / "src/lib/profile/unified.ts").read_text(encoding="utf-8")
        block = re.search(r"API_ORIGINS: FactOrigin\[\] = \[(.*?)\]", source, re.S).group(1)
        self.assertEqual(set(re.findall(r'"(\w+)"', block)), set(API_ORIGINS))
        self.assertIn("orcid", API_ORIGINS)


if __name__ == "__main__":
    unittest.main()
