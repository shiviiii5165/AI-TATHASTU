"""`connector_sync` handler: dispatches by payload.source_id."""

from __future__ import annotations

from typing import Any, Callable, Dict

from connectors.coding_profiles import sync_hackerrank, sync_leetcode
from connectors.github import sync_github
from connectors.kaggle import sync_kaggle
from connectors.linkedin import sync_linkedin
from connectors.orcid import sync_orcid
from connectors.portfolio import sync_portfolio
from connectors.stack_exchange import sync_stack_exchange
from jobs import Job, LockLost, NeedsReview

SYNCERS: Dict[str, Callable[[Any, Job], None]] = {
    "github": sync_github,
    "kaggle": sync_kaggle,
    "stack_exchange": sync_stack_exchange,
    "portfolio": sync_portfolio,
    "linkedin": sync_linkedin,
    "leetcode": sync_leetcode,
    "hackerrank": sync_hackerrank,
    "orcid": sync_orcid,
}

# worker.py only claims connector_sync jobs for these sources; jobs for a
# source without a syncer stay queued until a worker that supports it runs.
SUPPORTED_SOURCES = list(SYNCERS)


def process_connector_sync(conn: Any, job: Job) -> None:
    source = job.payload.get("source_id")
    syncer = SYNCERS.get(str(source))
    if not syncer:
        raise NeedsReview(f"no syncer for source {source!r}")
    try:
        syncer(conn, job)
    except LockLost:
        raise
    except Exception as exc:
        # Syncers mark the failures they recognise; a timeout or bad response body
        # would otherwise leave the card on 'syncing' after the last retry.
        if isinstance(exc, NeedsReview) or job.attempts >= job.max_attempts:
            _settle_stuck_connection(conn, job)
        raise


def _settle_stuck_connection(conn: Any, job: Job) -> None:
    conn.rollback()
    with conn, conn.cursor() as cur:
        cur.execute(
            "UPDATE connections SET status = 'failed' WHERE id = %s AND user_id = %s AND status = 'syncing'",
            (job.payload.get("connection_id"), job.user_id),
        )
