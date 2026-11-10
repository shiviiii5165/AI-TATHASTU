"""GitHub contribution calendar: parsing GitHub's GraphQL response, error handling, and the
sync contract (a failure keeps the last good snapshot; repositories and calendar are independent).

The Postgres tests need QUEUE_TEST_DATABASE_URL pointing at a local throwaway database with the
migrations applied (the e2e stack's database works); they are skipped otherwise."""

from __future__ import annotations

import io
import json
import os
import sys
import unittest
import urllib.error
import uuid
from datetime import date, timedelta
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from connectors import github  # noqa: E402
from connectors import github_contributions as gc  # noqa: E402
from jobs import Job  # noqa: E402

LEVEL_NAMES = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"]


def calendar_response(start: date, counts, *, restricted=0, repos=None, totals=(0, 0, 0, 0), login="asha"):
    """A response shaped like GitHub's: weeks start on Sunday, each with up to 7 days."""
    days = [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            "contributionCount": c,
            "contributionLevel": LEVEL_NAMES[0 if c == 0 else min(4, 1 + c // 3)],
        }
        for i, c in enumerate(counts)
    ]
    weeks, week = [], []
    for d in days:
        week.append(d)
        if date.fromisoformat(d["date"]).weekday() == 5:  # Saturday closes a GitHub week
            weeks.append({"contributionDays": week})
            week = []
    if week:
        weeks.append({"contributionDays": week})
    commits, prs, issues, reviews = totals
    return {
        "data": {
            "viewer": {
                "login": login,
                "contributionsCollection": {
                    "startedAt": f"{start.isoformat()}T00:00:00Z",
                    "endedAt": f"{(start + timedelta(days=len(counts) - 1)).isoformat()}T23:59:59Z",
                    "hasAnyRestrictedContributions": restricted > 0,
                    "restrictedContributionsCount": restricted,
                    "totalCommitContributions": commits,
                    "totalIssueContributions": issues,
                    "totalPullRequestContributions": prs,
                    "totalPullRequestReviewContributions": reviews,
                    "totalRepositoriesWithContributedCommits": len(repos or []),
                    "contributionCalendar": {"totalContributions": sum(counts) + restricted, "weeks": weeks},
                    "commitContributionsByRepository": repos or [],
                },
            }
        }
    }


class ParseContributions(unittest.TestCase):
    def test_totals_days_and_levels_come_straight_from_github(self):
        counts = [0, 3, 0, 7, 1, 0, 12] * 52 + [2]
        snap = gc.parse_contributions(calendar_response(date(2025, 11, 9), counts, totals=(500, 10, 4, 2)))
        self.assertEqual(snap["total"], sum(counts))
        self.assertEqual(len(snap["days"]), 365)
        self.assertEqual(snap["days"][0], {"date": "2025-11-09", "count": 0, "level": 0})
        self.assertEqual(snap["days"][6], {"date": "2025-11-15", "count": 12, "level": 4})
        self.assertEqual(snap["days"][-1]["date"], "2026-11-08")
        self.assertEqual(
            snap["totals"],
            {"commits": 500, "pullRequests": 10, "issues": 4, "reviews": 2, "repositories": 0, "restricted": 0},
        )
        self.assertEqual(snap["login"], "asha")

    def test_leap_day_and_year_boundary_are_kept_as_calendar_dates(self):
        counts = [1] * 366
        snap = gc.parse_contributions(calendar_response(date(2027, 12, 31), counts))
        dates = [d["date"] for d in snap["days"]]
        self.assertIn("2028-02-29", dates)
        self.assertIn("2027-12-31", dates)
        self.assertIn("2028-01-01", dates)
        self.assertEqual(len(dates), len(set(dates)), "no day duplicated or dropped")
        self.assertEqual(dates, sorted(dates))

    def test_empty_calendar_is_zero_not_missing(self):
        snap = gc.parse_contributions(calendar_response(date(2025, 11, 9), [0] * 365))
        self.assertEqual(snap["total"], 0)
        self.assertTrue(all(d["count"] == 0 and d["level"] == 0 for d in snap["days"]))

    def test_private_contributions_are_reported_only_as_github_reports_them(self):
        repos = [
            {"repository": {"nameWithOwner": "asha/public", "isPrivate": False}, "contributions": {"totalCount": 9}},
            {"repository": None, "contributions": {"totalCount": 40}},  # withheld by GitHub
        ]
        snap = gc.parse_contributions(calendar_response(date(2025, 11, 9), [1] * 10, restricted=40, repos=repos))
        self.assertTrue(snap["has_restricted"])
        self.assertEqual(snap["totals"]["restricted"], 40)
        self.assertEqual(snap["total"], 50)  # GitHub's own total, not recomputed
        self.assertEqual(snap["repositories"], [{"name": "asha/public", "commits": 9, "private": False}])

    def test_no_private_contributions_when_github_reports_none(self):
        snap = gc.parse_contributions(calendar_response(date(2025, 11, 9), [1] * 10))
        self.assertFalse(snap["has_restricted"])
        self.assertEqual(snap["totals"]["restricted"], 0)

    def test_graphql_errors_and_malformed_responses_raise(self):
        with self.assertRaises(gc.RateLimited):
            gc.parse_contributions({"errors": [{"type": "RATE_LIMITED", "message": "API rate limit exceeded"}]})
        with self.assertRaises(gc.ContributionsError):
            gc.parse_contributions({"errors": [{"type": "FORBIDDEN", "message": "Resource not accessible"}]})
        for bad in ({}, {"data": {"viewer": None}}, {"data": {"viewer": {"contributionsCollection": {}}}}):
            with self.assertRaises(gc.ContributionsError):
                gc.parse_contributions(bad)
        broken = calendar_response(date(2025, 11, 9), [1, 2])
        broken["data"]["viewer"]["contributionsCollection"]["contributionCalendar"]["weeks"][0]["contributionDays"][0]["contributionCount"] = -1
        with self.assertRaises(gc.ContributionsError):
            gc.parse_contributions(broken)
        bad_date = calendar_response(date(2025, 11, 9), [1])
        bad_date["data"]["viewer"]["contributionsCollection"]["contributionCalendar"]["weeks"][0]["contributionDays"][0]["date"] = "2026-02-30"
        with self.assertRaises(gc.ContributionsError):
            gc.parse_contributions(bad_date)

    def test_error_descriptions_are_short_and_never_echo_the_token(self):
        rate = urllib.error.HTTPError("u", 403, "Forbidden", {"x-ratelimit-remaining": "0"}, io.BytesIO(b"secret-body"))
        self.assertEqual(gc.describe_error(rate), "GitHub rate limit reached")
        self.assertEqual(gc.describe_error(github.GithubAuthError("token rejected")), "GitHub rejected the token; reconnect GitHub")
        self.assertEqual(gc.describe_error(urllib.error.URLError("dns")), "Could not reach GitHub")
        for exc in (rate, RuntimeError("ghp_supersecrettoken")):
            self.assertNotIn("secret", gc.describe_error(exc))


class SyncIndependence(unittest.TestCase):
    """The sync with a fake GitHub and a mocked database."""

    def run_sync(self, graphql, repos_fail=False):
        calls = {"snapshot": None, "failure": None, "repos_written": False}

        class Client:
            def __init__(self, _token): pass
            def get(self, path):
                if path == "/user":
                    return {"login": "asha", "html_url": "https://github.com/asha"}, {}
                return {"Python": 10}, {}
            def paginate(self, path, limit):
                if repos_fail:
                    raise urllib.error.HTTPError(path, 502, "Bad Gateway", {}, io.BytesIO(b""))
                return [{"full_name": "asha/a", "name": "a", "fork": False}]
            def graphql(self, query, variables):
                return graphql()

        conn, cur = mock.MagicMock(), mock.MagicMock()
        conn.cursor.return_value.__enter__.return_value = cur
        job = Job(id="j", type="connector_sync", user_id="u1", payload={"connection_id": "c"}, attempts=1, max_attempts=3)
        with mock.patch.object(github, "fetch_one", return_value={"id": "c", "token_enc": "x"}), \
             mock.patch.object(github, "open_credential", return_value={"access_token": "t"}), \
             mock.patch.object(gc, "table_exists", return_value=True), \
             mock.patch.object(github, "still_connected", return_value=True), \
             mock.patch.object(github, "assert_still_owner"), \
             mock.patch.object(gc, "write_snapshot", side_effect=lambda c, u, s: calls.update(snapshot=(u, s))), \
             mock.patch.object(gc, "record_failure", side_effect=lambda c, u, r: calls.update(failure=(u, r))), \
             mock.patch.object(github, "_write", side_effect=lambda *a: calls.update(repos_written=True)), \
             mock.patch.object(github, "enqueue_compute_intelligence"):
            try:
                github.sync_github(conn, job, client_factory=Client)
                calls["raised"] = None
            except Exception as exc:  # noqa: BLE001
                calls["raised"] = exc
        return calls

    def test_success_stores_the_snapshot_for_the_job_user(self):
        calls = self.run_sync(lambda: calendar_response(date(2025, 11, 9), [1] * 365))
        self.assertEqual(calls["snapshot"][0], "u1")
        self.assertEqual(calls["snapshot"][1]["total"], 365)
        self.assertIsNone(calls["failure"])
        self.assertTrue(calls["repos_written"])

    def test_contribution_failure_is_recorded_and_repositories_still_sync(self):
        def rate_limited():
            raise urllib.error.HTTPError("u", 403, "Forbidden", {"x-ratelimit-remaining": "0"}, io.BytesIO(b""))

        for graphql, reason in (
            (rate_limited, "GitHub rate limit reached"),
            (lambda: {"errors": [{"type": "RATE_LIMITED", "message": "x"}]}, "GitHub GraphQL rate limit reached"),
            (lambda: {"data": {"viewer": None}}, "GitHub response had no contribution calendar"),
        ):
            calls = self.run_sync(graphql)
            self.assertIsNone(calls["snapshot"], "no snapshot is fabricated on failure")
            self.assertEqual(calls["failure"], ("u1", reason))
            self.assertTrue(calls["repos_written"])
            self.assertIsNone(calls["raised"])

    def test_repository_failure_keeps_the_contribution_snapshot(self):
        calls = self.run_sync(lambda: calendar_response(date(2025, 11, 9), [2] * 365), repos_fail=True)
        self.assertIsNotNone(calls["snapshot"])
        self.assertFalse(calls["repos_written"])
        self.assertIsNotNone(calls["raised"], "the repository failure still goes to the job's retry")

    def test_missing_table_skips_the_api_call(self):
        called = []
        conn, cur = mock.MagicMock(), mock.MagicMock()
        conn.cursor.return_value.__enter__.return_value = cur
        client = mock.Mock(graphql=lambda *a: called.append(1))
        job = Job(id="j", type="connector_sync", user_id="u1", payload={}, attempts=1, max_attempts=3)
        with mock.patch.object(gc, "table_exists", return_value=False):
            github._sync_contributions(conn, job, "c", client)
        self.assertEqual(called, [])


class ContributionsOnPostgres(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import psycopg2
        import psycopg2.extras

        dsn = os.environ.get("QUEUE_TEST_DATABASE_URL", "")
        if "127.0.0.1" not in dsn and "localhost" not in dsn:
            raise unittest.SkipTest("set QUEUE_TEST_DATABASE_URL to a local throwaway database")
        try:
            cls.conn = psycopg2.connect(dsn, cursor_factory=psycopg2.extras.RealDictCursor)
        except psycopg2.OperationalError as exc:
            raise unittest.SkipTest(f"database not running: {exc}")

    @classmethod
    def tearDownClass(cls):
        cls.conn.close()

    def new_user(self):
        user = str(uuid.uuid4())
        with self.conn, self.conn.cursor() as cur:
            cur.execute("INSERT INTO users (id, email, name) VALUES (%s, %s, 'T')", (user, f"{user}@example.com"))
        return user

    def row(self, user):
        with self.conn, self.conn.cursor() as cur:
            cur.execute("SELECT * FROM github_contributions WHERE user_id = %s", (user,))
            return cur.fetchone()

    def test_table_detected(self):
        with self.conn, self.conn.cursor() as cur:
            self.assertTrue(gc.table_exists(cur))

    def test_failure_keeps_last_good_snapshot_and_records_the_error(self):
        user = self.new_user()
        snap = gc.parse_contributions(calendar_response(date(2025, 11, 9), [4] * 365, totals=(1460, 0, 0, 0)))
        with self.conn, self.conn.cursor() as cur:
            gc.write_snapshot(cur, user, snap)
        good = self.row(user)
        with self.conn, self.conn.cursor() as cur:
            gc.record_failure(cur, user, "GitHub rate limit reached")
        after = self.row(user)
        for col in ("total_contributions", "days", "category_totals", "synced_at", "range_start", "repositories"):
            self.assertEqual(after[col], good[col], col)
        self.assertEqual(after["total_contributions"], 1460)
        self.assertEqual(after["last_error"], "GitHub rate limit reached")
        self.assertIsNotNone(after["last_error_at"])

        # The next success clears the error.
        with self.conn, self.conn.cursor() as cur:
            gc.write_snapshot(cur, user, snap)
        self.assertIsNone(self.row(user)["last_error"])

    def test_failure_before_any_success_is_unavailable_not_zero(self):
        user = self.new_user()
        with self.conn, self.conn.cursor() as cur:
            gc.record_failure(cur, user, "Could not reach GitHub")
        row = self.row(user)
        self.assertIsNone(row["synced_at"])
        self.assertIsNone(row["total_contributions"])
        self.assertIsNone(row["days"])

    def test_users_are_isolated(self):
        a, b = self.new_user(), self.new_user()
        with self.conn, self.conn.cursor() as cur:
            gc.write_snapshot(cur, a, gc.parse_contributions(calendar_response(date(2025, 11, 9), [5] * 365)))
            gc.write_snapshot(cur, b, gc.parse_contributions(calendar_response(date(2025, 11, 9), [0] * 365)))
            gc.record_failure(cur, b, "Could not reach GitHub")
        self.assertEqual(self.row(a)["total_contributions"], 1825)
        self.assertIsNone(self.row(a)["last_error"])
        self.assertEqual(self.row(b)["total_contributions"], 0)

    def test_incomplete_snapshot_is_rejected_by_the_database(self):
        import psycopg2

        user = self.new_user()
        with self.assertRaises(psycopg2.errors.CheckViolation):
            with self.conn, self.conn.cursor() as cur:
                cur.execute("INSERT INTO github_contributions (user_id, synced_at) VALUES (%s, now())", (user,))

    def test_account_deletion_removes_the_snapshot(self):
        user = self.new_user()
        with self.conn, self.conn.cursor() as cur:
            gc.write_snapshot(cur, user, gc.parse_contributions(calendar_response(date(2025, 11, 9), [1] * 7)))
            cur.execute("DELETE FROM users WHERE id = %s", (user,))
        self.assertIsNone(self.row(user))


if __name__ == "__main__":
    unittest.main()
