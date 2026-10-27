"""AI Tathastu background worker.

Handlers: resume_extract (resume/), connector_sync (connectors/),
compute_intelligence (intelligence/).

Claims jobs from the Postgres `jobs` table with FOR UPDATE SKIP LOCKED, so any
number of worker processes can run side by side without double-processing.

Lifecycle of a job row:
    queued --claim--> running --ok--> done
                         |--NeedsReview--> needs_review
                         |--error, attempts left--> queued (run_at pushed back)
                         `--error, no attempts left--> failed
A worker that dies mid-job leaves `locked_until` in the past; the next claim
picks the job up again (or fails it if it was on its last attempt).

Run:  python worker.py            (reads DATABASE_URL from ../.env.local or .env)
"""

from __future__ import annotations

import logging
import os
import signal
import socket
import threading
import time
from pathlib import Path
from typing import Any, Callable, Dict, Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from connectors.sync import SUPPORTED_SOURCES, process_connector_sync
from intelligence.compute import process_compute_intelligence
from intelligence.matches import process_compute_matches
from jobs import Job, LockLost, NeedsReview
from notify import notify_job, notify_profile_updated
from resume.extract import process_resume_extract

HERE = Path(__file__).resolve().parent
load_dotenv(HERE / ".env")
load_dotenv(HERE.parent / ".env.local")

WORKER_ID = os.environ.get("WORKER_ID") or f"{socket.gethostname()}:{os.getpid()}"
LOCK_SECONDS = int(os.environ.get("WORKER_LOCK_SECONDS", "300"))
IDLE_POLL_MIN_S = 1.0
IDLE_POLL_MAX_S = 10.0
RETRY_BASE_S = 30

def process_generate_roadmap(conn: Any, job: Job) -> None:
    """Legacy job type: compute_intelligence already regenerates the roadmap and
    the web app no longer queues this, but rows queued before that change are
    still drained safely here."""
    from db import fetch_one, has_consent
    from intelligence.roadmap import generate_career_roadmap, save_roadmap
    with conn, conn.cursor() as cur:
        user = fetch_one(
            cur,
            "SELECT name, role::text AS role, degree, university, department, academic_title, company, job_title FROM users WHERE id = %s",
            (job.user_id,),
        )
        ai_ok = has_consent(cur, job.user_id, "external_ai")
    if user:
        rm = generate_career_roadmap(user, has_consent=ai_ok)  # network call outside the transaction
        with conn, conn.cursor() as cur:
            save_roadmap(cur, job.user_id, rm)

Handler = Callable[[Any, Job], None]
HANDLERS: Dict[str, Handler] = {
    "resume_extract": process_resume_extract,
    "connector_sync": process_connector_sync,
    "compute_intelligence": process_compute_intelligence,
    "compute_matches": process_compute_matches,
    "generate_roadmap": process_generate_roadmap,
}

log = logging.getLogger("worker")

CLAIM_SQL = """
UPDATE jobs
   SET status = 'running',
       attempts = attempts + 1,
       locked_by = %(worker)s,
       locked_until = now() + make_interval(secs => %(lock)s)
 WHERE id = (
       SELECT id FROM jobs
        WHERE type = ANY(%(types)s)
          -- connector_sync only for sources this worker can sync; others wait.
          AND (type <> 'connector_sync' OR payload->>'source_id' = ANY(%(sources)s))
          AND attempts < max_attempts
          AND (   (status = 'queued' AND run_at <= now())
               OR (status = 'running' AND locked_until < now()))  -- crashed worker
        ORDER BY run_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1)
RETURNING id, type, user_id, payload, attempts, max_attempts, locked_by
"""

# Extends the lock of a job that is still running, fenced on ownership.
HEARTBEAT_SQL = """
UPDATE jobs SET locked_until = now() + make_interval(secs => %(lock)s)
 WHERE id = %(id)s AND locked_by = %(worker)s AND status = 'running'
"""

# Jobs whose worker died on their final attempt can't be reclaimed; close them out.
EXPIRE_SQL = """
UPDATE jobs
   SET status = 'failed', finished_at = now(), locked_by = NULL, locked_until = NULL,
       last_error = 'Worker lock expired on the final attempt'
 WHERE status = 'running' AND locked_until < now() AND attempts >= max_attempts
"""

# Every outcome write is fenced on locked_by, so a worker whose lock expired
# (and whose job was reclaimed) can't overwrite the new owner's result.
DONE_SQL = """
UPDATE jobs
   SET status = 'done', finished_at = now(), locked_by = NULL, locked_until = NULL, last_error = NULL
 WHERE id = %(id)s AND locked_by = %(worker)s
"""

NEEDS_REVIEW_SQL = """
UPDATE jobs
   SET status = 'needs_review', finished_at = now(), locked_by = NULL, locked_until = NULL, last_error = %(error)s
 WHERE id = %(id)s AND locked_by = %(worker)s
"""

RETRY_SQL = """
UPDATE jobs
   SET status = 'queued', run_at = now() + make_interval(secs => %(delay)s),
       locked_by = NULL, locked_until = NULL, last_error = %(error)s
 WHERE id = %(id)s AND locked_by = %(worker)s
"""

FAIL_SQL = """
UPDATE jobs
   SET status = 'failed', finished_at = now(), locked_by = NULL, locked_until = NULL, last_error = %(error)s
 WHERE id = %(id)s AND locked_by = %(worker)s
"""


class Heartbeat(threading.Thread):
    """Keeps a long job's lock alive (every LOCK_SECONDS/3), so a slow but
    healthy job isn't reclaimed by another worker. Uses its own connection,
    opened only if the job outlives the first beat."""

    def __init__(self, dsn: str, job_id: str) -> None:
        super().__init__(name=f"heartbeat-{job_id}", daemon=True)
        self.dsn = dsn
        self.job_id = job_id
        self._stopped = threading.Event()

    def run(self) -> None:
        conn: Optional[Any] = None
        try:
            while not self._stopped.wait(max(5.0, LOCK_SECONDS / 3)):
                try:
                    if conn is None or conn.closed:
                        conn = psycopg2.connect(self.dsn, application_name=f"ait-worker-heartbeat {WORKER_ID}")
                    with conn, conn.cursor() as cur:
                        cur.execute(HEARTBEAT_SQL, {"id": self.job_id, "worker": WORKER_ID, "lock": LOCK_SECONDS})
                        if cur.rowcount == 0:
                            return  # finished or taken over; nothing to extend
                except psycopg2.Error:
                    log.warning("heartbeat for job %s failed; retrying", self.job_id, exc_info=True)
                    conn = None
        finally:
            if conn is not None and not conn.closed:
                conn.close()

    def stop(self) -> None:
        self._stopped.set()


class Worker:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn
        self.conn: Optional[Any] = None
        self.stopping = False

    # ── connection ──────────────────────────────────────────────────────────

    def connect(self) -> Any:
        if self.conn is None or self.conn.closed:
            self.conn = psycopg2.connect(
                self.dsn,
                application_name=f"ait-worker {WORKER_ID}",
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=3,
            )
            log.info("connected to database")
        return self.conn

    def execute(self, sql: str, params: Optional[dict] = None, fetch: bool = False) -> Any:
        """Runs one statement in its own transaction."""
        conn = self.connect()
        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return cur.fetchone() if fetch else cur.rowcount

    # ── queue ───────────────────────────────────────────────────────────────

    def claim(self) -> Optional[Job]:
        self.execute(EXPIRE_SQL)
        row = self.execute(
            CLAIM_SQL,
            {"worker": WORKER_ID, "lock": LOCK_SECONDS, "types": list(HANDLERS), "sources": SUPPORTED_SOURCES},
            fetch=True,
        )
        return Job(**row) if row else None

    def run_one(self, job: Job) -> None:
        log.info("job %s (%s) attempt %d/%d", job.id, job.type, job.attempts, job.max_attempts)
        started = time.monotonic()
        heartbeat = Heartbeat(self.dsn, job.id)
        heartbeat.start()
        try:
            self._run_one(job)
        finally:
            heartbeat.stop()
            log.info("job %s (%s) took %dms", job.id, job.type, (time.monotonic() - started) * 1000)

    def _run_one(self, job: Job) -> None:
        params: Dict[str, Any] = {"id": job.id, "worker": WORKER_ID}
        try:
            HANDLERS[job.type](self.connect(), job)
        except LockLost as exc:
            # Another worker owns the job now; its run records the outcome.
            log.warning("job %s: %s; result discarded", job.id, exc)
            if self.conn is not None and not self.conn.closed:
                self.conn.rollback()
            return
        except NeedsReview as exc:
            log.warning("job %s needs review: %s", job.id, exc)
            if self.execute(NEEDS_REVIEW_SQL, {**params, "error": str(exc)[:2000]}):
                self.notify(job, "needs_review")
            return
        except Exception as exc:  # noqa: BLE001 - any handler failure is a job failure
            log.exception("job %s failed", job.id)
            error = f"{type(exc).__name__}: {exc}"[:2000]
            if self.conn is not None and not self.conn.closed:
                self.conn.rollback()
            if job.attempts >= job.max_attempts:
                if self.execute(FAIL_SQL, {**params, "error": error}):
                    self.notify(job, "failed")
            else:
                delay = RETRY_BASE_S * 2 ** (job.attempts - 1)
                self.execute(RETRY_SQL, {**params, "error": error, "delay": delay})
                log.info("job %s retrying in %ds", job.id, delay)
            return

        if self.execute(DONE_SQL, params) == 0:
            log.warning("job %s finished after its lock was taken over; result not recorded", job.id)
        else:
            log.info("job %s done", job.id)
            self.notify(job, "done")

    @staticmethod
    def notify(job: Job, outcome: str) -> None:
        """Resume results either way; connector syncs only when they fail (the app decides if it's the user's to fix);
        a recomputed profile goes to the user's linked apps."""
        if job.type == "resume_extract" or (job.type == "connector_sync" and outcome != "done"):
            notify_job(str(job.id))
        elif job.type == "compute_intelligence" and outcome == "done":
            notify_profile_updated(str(job.id), str(job.user_id))

    # ── main loop ───────────────────────────────────────────────────────────

    def run_forever(self) -> None:
        idle = IDLE_POLL_MIN_S
        while not self.stopping:
            try:
                job = self.claim()
            except psycopg2.OperationalError:
                log.exception("database unavailable; reconnecting in %.0fs", IDLE_POLL_MAX_S)
                self.conn = None
                self.sleep(IDLE_POLL_MAX_S)
                continue

            if job is None:
                self.sleep(idle)
                idle = min(idle * 2, IDLE_POLL_MAX_S)  # back off while the queue is empty
                continue

            idle = IDLE_POLL_MIN_S
            self.run_one(job)
        log.info("stopped")

    def sleep(self, seconds: float) -> None:
        end = time.monotonic() + seconds
        while not self.stopping and time.monotonic() < end:
            time.sleep(min(0.25, end - time.monotonic()))

    def stop(self, *_: Any) -> None:
        # Finish the current job, then exit; a hard kill is covered by lock expiry.
        log.info("shutdown requested; finishing current job")
        self.stopping = True


def configure_logging() -> None:
    logging.basicConfig(
        level=os.environ.get("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(threadName)s %(name)s: %(message)s",
    )


def database_url() -> str:
    dsn = os.environ.get("WORKER_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("Set DATABASE_URL (or WORKER_DATABASE_URL) in .env.local or the environment.")
    return dsn


def main() -> None:
    """Queue loop only (local dev / a paid Background Worker). On Render's free
    tier the entrypoint is server.py, which runs this loop in a thread."""
    configure_logging()
    worker = Worker(database_url())
    signal.signal(signal.SIGTERM, worker.stop)
    signal.signal(signal.SIGINT, worker.stop)
    log.info("worker %s polling for %s", WORKER_ID, ", ".join(HANDLERS))
    worker.run_forever()


if __name__ == "__main__":
    main()
