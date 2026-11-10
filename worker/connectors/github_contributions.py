"""GitHub contribution calendar via the official GraphQL API (viewer.contributionsCollection).

Runs inside the GitHub connector sync (connectors/github.py) with the same OAuth token and
scope (read:user); it asks for no extra permission. It is independent of the repository sync:
a failure here is recorded on the user's github_contributions row and never touches the last
successful snapshot, and a repository failure never discards a contribution snapshot.

What GitHub returns with this token:
  - the calendar and totals cover public contributions, plus private ones only when the user
    has turned on "Include private contributions on my profile". Private ones the token can't
    see come back as restrictedContributionsCount, with no repository names.
  - per-repository breakdowns list only repositories the token can see.
We store exactly what came back and never fill gaps.
"""

from __future__ import annotations

import logging
import socket
import urllib.error
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional

from db import jsonb

log = logging.getLogger("worker.github.contributions")

SCHEMA_VERSION = 1
SOURCE = "github_graphql"
MAX_REPOSITORIES = 25  # GitHub's cap for commitContributionsByRepository is 100

QUERY = """
query ContributionCalendar($maxRepositories: Int!) {
  viewer {
    login
    contributionsCollection {
      startedAt
      endedAt
      hasAnyRestrictedContributions
      restrictedContributionsCount
      totalCommitContributions
      totalIssueContributions
      totalPullRequestContributions
      totalPullRequestReviewContributions
      totalRepositoriesWithContributedCommits
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            date
            contributionCount
            contributionLevel
          }
        }
      }
      commitContributionsByRepository(maxRepositories: $maxRepositories) {
        repository { nameWithOwner isPrivate }
        contributions { totalCount }
      }
    }
  }
}
"""

LEVELS = {"NONE": 0, "FIRST_QUARTILE": 1, "SECOND_QUARTILE": 2, "THIRD_QUARTILE": 3, "FOURTH_QUARTILE": 4}


class ContributionsError(Exception):
    """The response could not be used. The message is safe to store (no token, no payload)."""


class RateLimited(ContributionsError):
    pass


def _count(value: Any, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ContributionsError(f"unexpected {field} in GitHub response")
    return value


def parse_contributions(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Validates a GraphQL response and turns it into the stored snapshot. Raises on anything odd."""
    errors = payload.get("errors") or []
    if errors:
        if any((e or {}).get("type") == "RATE_LIMITED" for e in errors):
            raise RateLimited("GitHub GraphQL rate limit reached")
        first = str((errors[0] or {}).get("message") or "unknown error")[:200]
        raise ContributionsError(f"GitHub GraphQL error: {first}")

    viewer = (payload.get("data") or {}).get("viewer")
    collection = (viewer or {}).get("contributionsCollection")
    calendar = (collection or {}).get("contributionCalendar")
    if not viewer or not collection or not calendar:
        raise ContributionsError("GitHub response had no contribution calendar")

    days: Dict[str, Dict[str, Any]] = {}
    for week in calendar.get("weeks") or []:
        for day in (week or {}).get("contributionDays") or []:
            raw_date = (day or {}).get("date")
            try:
                parsed = date.fromisoformat(str(raw_date))
            except ValueError as exc:
                raise ContributionsError("unexpected date in GitHub response") from exc
            level = LEVELS.get(str(day.get("contributionLevel")))
            if level is None:
                raise ContributionsError("unexpected contribution level in GitHub response")
            days[parsed.isoformat()] = {
                "date": parsed.isoformat(),
                "count": _count(day.get("contributionCount"), "contributionCount"),
                "level": level,
            }

    repositories: List[Dict[str, Any]] = []
    for item in collection.get("commitContributionsByRepository") or []:
        repo = (item or {}).get("repository") or {}
        name = repo.get("nameWithOwner")
        if not name:
            continue  # GitHub withholds repositories the token can't see
        repositories.append({
            "name": str(name),
            "commits": _count(((item.get("contributions") or {}).get("totalCount")), "totalCount"),
            "private": bool(repo.get("isPrivate")),
        })

    restricted = _count(collection.get("restrictedContributionsCount") or 0, "restrictedContributionsCount")
    return {
        "login": viewer.get("login"),
        "range_start": collection.get("startedAt"),
        "range_end": collection.get("endedAt"),
        "total": _count(calendar.get("totalContributions"), "totalContributions"),
        "days": [days[k] for k in sorted(days)],
        "totals": {
            "commits": _count(collection.get("totalCommitContributions"), "totalCommitContributions"),
            "pullRequests": _count(collection.get("totalPullRequestContributions"), "totalPullRequestContributions"),
            "issues": _count(collection.get("totalIssueContributions"), "totalIssueContributions"),
            "reviews": _count(collection.get("totalPullRequestReviewContributions"), "totalPullRequestReviewContributions"),
            "repositories": _count(
                collection.get("totalRepositoriesWithContributedCommits") or 0, "totalRepositoriesWithContributedCommits"
            ),
            "restricted": restricted,
        },
        "repositories": repositories,
        "has_restricted": bool(collection.get("hasAnyRestrictedContributions")) or restricted > 0,
    }


def describe_error(exc: BaseException) -> str:
    """A short, storable reason. Never includes the token or response bodies."""
    if isinstance(exc, ContributionsError):
        return str(exc)
    if isinstance(exc, urllib.error.HTTPError):
        if exc.code == 401:
            return "GitHub rejected the token; reconnect GitHub"
        if exc.code in (403, 429):
            return "GitHub rate limit reached" if exc.code == 429 or exc.headers.get("x-ratelimit-remaining") == "0" else "GitHub refused the request (HTTP 403)"
        return f"GitHub returned HTTP {exc.code}"
    if isinstance(exc, (urllib.error.URLError, socket.timeout, TimeoutError)):
        return "Could not reach GitHub"
    name = type(exc).__name__
    if name == "GithubAuthError":
        return "GitHub rejected the token; reconnect GitHub"
    if "rate limit" in str(exc).lower():
        return "GitHub rate limit reached"
    return f"Contribution fetch failed ({name})"


def table_exists(cur: Any) -> bool:
    """Whether migration 0027 has run. Reads the value directly so it is right for tuple and dict cursors alike
    (db.fetch_one re-zips rows, which turns a dict row into {"present": "present"}, always truthy)."""
    cur.execute("SELECT to_regclass('public.github_contributions') IS NOT NULL AS present")
    row = cur.fetchone()
    if row is None:
        return False
    return bool(row["present"] if isinstance(row, dict) else row[0])


def fetch(client: Any) -> Dict[str, Any]:
    return parse_contributions(client.graphql(QUERY, {"maxRepositories": MAX_REPOSITORIES}))


def write_snapshot(cur: Any, user_id: str, snap: Dict[str, Any], now: Optional[datetime] = None) -> None:
    now = now or datetime.now(timezone.utc)
    cur.execute(
        """INSERT INTO github_contributions
             (user_id, range_start, range_end, total_contributions, days, category_totals, repositories,
              has_restricted_contributions, github_login, source, schema_version,
              synced_at, last_attempt_at, last_error, last_error_at, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NULL, NULL, %s)
           ON CONFLICT (user_id) DO UPDATE SET
             range_start = EXCLUDED.range_start, range_end = EXCLUDED.range_end,
             total_contributions = EXCLUDED.total_contributions, days = EXCLUDED.days,
             category_totals = EXCLUDED.category_totals, repositories = EXCLUDED.repositories,
             has_restricted_contributions = EXCLUDED.has_restricted_contributions,
             github_login = EXCLUDED.github_login, source = EXCLUDED.source,
             schema_version = EXCLUDED.schema_version, synced_at = EXCLUDED.synced_at,
             last_attempt_at = EXCLUDED.last_attempt_at, last_error = NULL, last_error_at = NULL,
             updated_at = EXCLUDED.updated_at""",
        (
            user_id, snap["range_start"], snap["range_end"], snap["total"], jsonb(snap["days"]),
            jsonb(snap["totals"]), jsonb(snap["repositories"]), snap["has_restricted"], snap["login"],
            SOURCE, SCHEMA_VERSION, now, now, now,
        ),
    )


def record_failure(cur: Any, user_id: str, reason: str, now: Optional[datetime] = None) -> None:
    """Touches only the attempt/error columns: the last good snapshot stays exactly as it was."""
    now = now or datetime.now(timezone.utc)
    cur.execute(
        """INSERT INTO github_contributions (user_id, last_attempt_at, last_error, last_error_at, updated_at)
           VALUES (%s, %s, %s, %s, %s)
           ON CONFLICT (user_id) DO UPDATE SET
             last_attempt_at = EXCLUDED.last_attempt_at, last_error = EXCLUDED.last_error,
             last_error_at = EXCLUDED.last_error_at, updated_at = EXCLUDED.updated_at""",
        (user_id, now, reason[:300], now, now),
    )
