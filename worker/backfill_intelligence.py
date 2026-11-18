"""Recompute intelligence for every active student who has data but no current profile (or every student).

Dry run by default: prints who would be recomputed and why. With --apply, each student gets a real
compute_intelligence job row, owned by this process while it runs the normal handler, then marked done or failed,
so the job history shows exactly what happened. The queue worker never claims these rows (they are locked and
running), and the handler's own "a newer result wins" guard still applies. No partner webhooks are sent.

  python backfill_intelligence.py                  # dry run: missing or stale profiles only
  python backfill_intelligence.py --all            # dry run: every eligible student
  python backfill_intelligence.py --apply [--all]  # do it

Reads DATABASE_URL (or WORKER_DATABASE_URL) from the environment or ../.env.local.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import socket
import sys
import traceback
import uuid
from pathlib import Path

import psycopg2

sys.path.insert(0, str(Path(__file__).resolve().parent))

from intelligence import career_engine  # noqa: E402
from intelligence.compute import process_compute_intelligence  # noqa: E402
from jobs import Job  # noqa: E402

BACKFILL_ID = f"backfill:{socket.gethostname()}:{os.getpid()}"
LOCK_SECONDS = 900

# Active students with an onboarding row and something to compute from. Reason says why they're picked.
ELIGIBLE_SQL = """
SELECT u.id::text AS id,
       CASE WHEN pv.user_id IS NULL THEN 'no_profile'
            WHEN NOT (pv.view ? 'intelligence') THEN 'pre_engine_profile'
            WHEN coalesce((pv.view->'intelligence'->>'engineVersion')::int, 0) < %(engine)s THEN 'old_engine'
            WHEN NOT (pv.view ? 'admin') THEN 'no_admin_view'
            ELSE 'current' END AS reason
  FROM users u
  JOIN onboarding_state os ON os.user_id = u.id
  LEFT JOIN profile_views pv ON pv.user_id = u.id
 WHERE u.role = 'student' AND u.deleted_at IS NULL
   AND (EXISTS (SELECT 1 FROM profile_facts f WHERE f.user_id = u.id AND f.superseded_by IS NULL AND f.confirmation <> 'rejected')
        OR EXISTS (SELECT 1 FROM code_repositories r WHERE r.user_id = u.id))
 ORDER BY u.created_at
"""


def load_env() -> str:
    """A URL set in the environment always wins; .env.local only fills in when none is set. (Mixing the two once
    sent a "local" run to the .env.local database: WORKER_DATABASE_URL from the file outranked DATABASE_URL.)"""
    explicit = os.environ.get("WORKER_DATABASE_URL") or os.environ.get("DATABASE_URL")
    env = Path(__file__).resolve().parent.parent / ".env.local"
    if env.exists():
        from dotenv import load_dotenv
        load_dotenv(env, override=False)
    dsn = explicit or os.environ.get("WORKER_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not dsn:
        raise SystemExit("Set DATABASE_URL (or WORKER_DATABASE_URL).")
    host = dsn.split("@")[-1].split("/")[0].split(":")[0]
    print(json.dumps({"database_host": host}))
    return dsn


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="actually recompute (default: dry run)")
    ap.add_argument("--all", action="store_true", help="every eligible student, not only missing/stale profiles")
    args = ap.parse_args()
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "WARNING"), format="%(levelname)s %(name)s: %(message)s")

    dsn = load_env()
    connect = lambda: psycopg2.connect(dsn, application_name=f"ait-backfill {BACKFILL_ID}")  # noqa: E731
    conn = connect()
    with conn, conn.cursor() as cur:
        cur.execute(ELIGIBLE_SQL, {"engine": career_engine.ENGINE_VERSION})
        rows = cur.fetchall()
    picked = [(uid, reason) for uid, reason in rows if args.all or reason != "current"]
    reasons: dict = {}
    for _, r in rows:
        reasons[r] = reasons.get(r, 0) + 1
    print(json.dumps({"eligible": len(rows), "by_reason": reasons, "selected": len(picked), "apply": args.apply}))
    if not args.apply:
        return 0

    done = failed = 0
    conn.close()
    for uid, reason in picked:
        # A fresh connection per student: Neon closes connections left idle during the slow external steps.
        conn = connect()
        job_id = str(uuid.uuid4())
        with conn, conn.cursor() as cur:
            cur.execute(
                """INSERT INTO jobs (id, type, user_id, idempotency_key, status, payload, attempts, max_attempts, locked_by, locked_until)
                   VALUES (%s, 'compute_intelligence', %s, %s, 'running', %s, 1, 1, %s, now() + make_interval(secs => %s))""",
                (job_id, uid, f"compute_intelligence:{uid}:backfill:{job_id}", json.dumps({"trigger": f"admin_backfill:{reason}"}), BACKFILL_ID, LOCK_SECONDS),
            )
        job = Job(id=job_id, type="compute_intelligence", user_id=uid, payload={"trigger": f"admin_backfill:{reason}"},
                  attempts=1, max_attempts=1, locked_by=BACKFILL_ID)
        try:
            process_compute_intelligence(conn, job)
            status, error = "done", None
            done += 1
        except Exception as exc:  # noqa: BLE001 - record and continue with the next student
            status, error = "failed", f"{type(exc).__name__}: {exc}"[:500]
            failed += 1
            traceback.print_exc(limit=2)
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass
        conn = connect()
        with conn, conn.cursor() as cur:
            cur.execute(
                """UPDATE jobs SET status = %s, last_error = %s, finished_at = now(), locked_by = NULL, locked_until = NULL
                    WHERE id = %s AND locked_by = %s""",
                (status, error, job_id, BACKFILL_ID),
            )
        conn.close()
        print(json.dumps({"job": job_id, "reason": reason, "status": status, "error": error}), flush=True)
    print(json.dumps({"done": done, "failed": failed}))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
