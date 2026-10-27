"""Shared job types for handlers."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict


@dataclass(frozen=True)
class Job:
    id: str
    type: str
    user_id: str
    payload: Dict[str, Any]
    attempts: int
    max_attempts: int
    # The worker that claimed it; "" when a job is built by hand (tests).
    locked_by: str = ""


class NeedsReview(Exception):
    """Raise from a handler when a human must look at the job; it is not retried."""


class LockLost(Exception):
    """The job's lock expired and another worker took it over; drop this run's results."""


def assert_still_owner(cur: Any, job: Job) -> None:
    """Call inside the transaction that writes a long job's results: locks the
    job row and checks this worker still owns it, so an expired run can't
    overwrite the newer run's output."""
    if not job.locked_by:
        return
    cur.execute(
        "SELECT 1 FROM jobs WHERE id = %s AND locked_by = %s AND status = 'running' FOR UPDATE",
        (job.id, job.locked_by),
    )
    if cur.fetchone() is None:
        raise LockLost(f"job {job.id} is no longer owned by {job.locked_by}")
