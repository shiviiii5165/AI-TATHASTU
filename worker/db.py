"""Small psycopg2 helpers shared by handlers."""

from __future__ import annotations

import json
import uuid
from typing import Any, Dict, List, Optional, Sequence

import psycopg2.extras

psycopg2.extras.register_uuid()


def fetch_all(cur: Any, sql: str, params: Optional[Sequence[Any]] = None) -> List[Dict[str, Any]]:
    cur.execute(sql, params)
    cols = [c.name for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetch_one(cur: Any, sql: str, params: Optional[Sequence[Any]] = None) -> Optional[Dict[str, Any]]:
    rows = fetch_all(cur, sql, params)
    return rows[0] if rows else None


def jsonb(value: Any) -> Optional[str]:
    return None if value is None else json.dumps(value)


def has_consent(cur: Any, user_id: str, purpose: str) -> bool:
    """Latest consents row wins; no row means not granted."""
    row = fetch_one(
        cur,
        "SELECT granted FROM consents WHERE user_id = %s AND purpose = %s ORDER BY created_at DESC LIMIT 1",
        (user_id, purpose),
    )
    return bool(row and row["granted"])


def enqueue_compute_matches(cur: Any, user_id: str, trigger: str) -> None:
    """Queues match scoring for a user unless one is already waiting. Past the limit it's postponed, as below."""
    cur.execute(
        """
        INSERT INTO jobs (type, user_id, idempotency_key, payload, run_at)
        SELECT 'compute_matches', %(user)s, %(key)s, %(payload)s,
               now() + make_interval(secs => hit_sliding_limit('paid:matches:' || %(user)s, 30, 3600))
         WHERE NOT EXISTS (SELECT 1 FROM jobs WHERE user_id = %(user)s AND type = 'compute_matches' AND status = 'queued')
        ON CONFLICT (idempotency_key) DO NOTHING
        """,
        {"user": user_id, "key": f"compute_matches:{user_id}:{uuid.uuid4()}", "payload": json.dumps({"trigger": trigger})},
    )


def enqueue_compute_intelligence(cur: Any, user_id: str, trigger: str) -> None:
    """
    Queues a recompute unless one is already waiting (a waiting job will read
    the latest data anyway). Skipped until onboarding is done: the
    "Generate my profile" button queues the first one.

    Past the limit (shared with src/lib/jobs-queue.ts) it's postponed, not dropped: the
    data did change, and while it waits later requests collapse into it.
    """
    cur.execute(
        """
        INSERT INTO jobs (type, user_id, idempotency_key, payload, run_at)
        SELECT 'compute_intelligence', %(user)s, %(key)s, %(payload)s,
               now() + make_interval(secs => GREATEST(
                 hit_sliding_limit('paid:recompute:' || %(user)s, 30, 3600),
                 hit_sliding_limit('paid_global:recompute', 5000, 3600)))
         WHERE EXISTS (SELECT 1 FROM onboarding_state WHERE user_id = %(user)s AND current_step = 'done')
           AND NOT EXISTS (SELECT 1 FROM jobs WHERE user_id = %(user)s
                             AND type = 'compute_intelligence' AND status = 'queued')
        ON CONFLICT (idempotency_key) DO NOTHING
        """,
        {
            "user": user_id,
            "key": f"compute_intelligence:{user_id}:{uuid.uuid4()}",
            "payload": json.dumps({"trigger": trigger}),
        },
    )
