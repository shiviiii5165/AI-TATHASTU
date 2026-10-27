"""GitHub connector: profile, repositories and languages via the REST API.

Writes code_repositories (one row per repo) and profile_facts with
origin = 'github', extraction_method = 'api:github':
  identity/contact  name, bio → headline, location, blog → website, profile URL
  projects          one entry per repo (record_key = repo full name)
  skills            one per language, with evidence naming the repos

Not yet: README, contributors, 90-day commits and PRs from the plan, and
raw_snapshots (that table doesn't exist yet).
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import psycopg2.extras

from crypto_box import open_credential
from db import enqueue_compute_intelligence, fetch_one, jsonb
from jobs import Job, NeedsReview

log = logging.getLogger("worker.github")

API = "https://api.github.com"
MAX_REPOS = 100  # most recently pushed, owned, non-fork
LANGUAGE_LOOKUPS = 50
STALE_AFTER = timedelta(days=7)


class GithubAuthError(Exception):
    pass


class GithubClient:
    def __init__(self, token: str) -> None:
        self.token = token

    def get(self, path: str) -> Tuple[Any, Dict[str, str]]:
        req = urllib.request.Request(
            path if path.startswith("http") else API + path,
            headers={
                "Authorization": f"Bearer {self.token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "ai-tathastu-worker",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.loads(res.read()), dict(res.headers)
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                raise GithubAuthError("token rejected") from exc
            if exc.code == 403 and exc.headers.get("x-ratelimit-remaining") == "0":
                raise RuntimeError("GitHub rate limit reached; will retry") from exc
            raise

    def paginate(self, path: str, limit: int) -> List[Any]:
        items: List[Any] = []
        url: Optional[str] = path
        while url and len(items) < limit:
            page, headers = self.get(url)
            items.extend(page)
            url = _next_link(headers.get("Link") or headers.get("link") or "")
        return items[:limit]


def _next_link(header: str) -> Optional[str]:
    for part in header.split(","):
        if 'rel="next"' in part:
            return part.split(";")[0].strip().strip("<>")
    return None


def sync_github(conn: Any, job: Job, client_factory=GithubClient) -> None:
    connection_id = job.payload.get("connection_id")
    with conn, conn.cursor() as cur:
        connection = fetch_one(
            cur,
            "SELECT id, token_enc FROM connections WHERE id = %s AND user_id = %s AND source_id = 'github'",
            (connection_id, job.user_id),
        )
        if not connection:
            log.info("connection %s gone (disconnected); nothing to sync", connection_id)
            return
        cur.execute("UPDATE connections SET status = 'syncing' WHERE id = %s", (connection_id,))

    credential = open_credential(connection["token_enc"], job.user_id, "github")
    client = client_factory(credential["access_token"])

    try:
        profile, _ = client.get("/user")
        repos = [
            r for r in client.paginate("/user/repos?per_page=100&affiliation=owner&sort=pushed", MAX_REPOS * 2)
            if not r.get("fork")
        ][:MAX_REPOS]
        languages: Dict[str, Dict[str, int]] = {}
        for repo in repos[:LANGUAGE_LOOKUPS]:
            languages[repo["full_name"]], _ = client.get(f"/repos/{repo['full_name']}/languages")
    except GithubAuthError as exc:
        with conn, conn.cursor() as cur:
            cur.execute("UPDATE connections SET status = 'reauth_needed' WHERE id = %s", (connection_id,))
        raise NeedsReview("GitHub token was revoked or expired; user must reconnect") from exc
    except Exception:
        with conn, conn.cursor() as cur:
            cur.execute("UPDATE connections SET status = 'failed' WHERE id = %s", (connection_id,))
        raise  # retried by the worker

    with conn, conn.cursor() as cur:
        _write(cur, job.user_id, profile, repos, languages)
        now = datetime.now(timezone.utc)
        cur.execute(
            "UPDATE connections SET status = 'connected', last_sync_at = %s, stale_after = %s WHERE id = %s",
            (now, now + STALE_AFTER, connection_id),
        )
        enqueue_compute_intelligence(cur, job.user_id, "connector_sync:github")
    log.info("github sync for %s: %d repos, %d languages", job.user_id, len(repos),
             len({lang for langs in languages.values() for lang in langs}))


def _write(cur: Any, user_id: str, profile: Dict[str, Any], repos: List[Dict[str, Any]], languages: Dict[str, Dict[str, int]]) -> None:
    # code_repositories: upsert current repos, drop ones that disappeared.
    names = [r["full_name"] for r in repos]
    cur.execute(
        "DELETE FROM code_repositories WHERE user_id = %s AND source = 'github' AND NOT (repo_name = ANY(%s))",
        (user_id, names),
    )
    if repos:
        psycopg2.extras.execute_values(
            cur,
            """INSERT INTO code_repositories
                 (user_id, source, repo_name, description, url, languages, topics, stars, forks, last_commit_at)
               VALUES %s
               ON CONFLICT (user_id, source, repo_name) DO UPDATE SET
                 description = EXCLUDED.description, url = EXCLUDED.url, languages = EXCLUDED.languages,
                 topics = EXCLUDED.topics, stars = EXCLUDED.stars, forks = EXCLUDED.forks,
                 last_commit_at = EXCLUDED.last_commit_at""",
            [
                (
                    user_id, "github", r["full_name"], r.get("description"), r.get("html_url"),
                    jsonb(languages.get(r["full_name"], {})), r.get("topics") or [],
                    r.get("stargazers_count") or 0, r.get("forks_count") or 0, r.get("pushed_at"),
                )
                for r in repos
            ],
        )
        # Repo scores are computed by the compute_intelligence job queued after
        # this sync (outside any transaction, cached per repo + last push).

    # profile_facts: replace this source's facts wholesale on every sync.
    cur.execute("DELETE FROM profile_facts WHERE user_id = %s AND origin = 'github'", (user_id,))
    facts: List[Tuple[Any, ...]] = []

    def fact(group: str, field: str, value: Any, evidence: str, record_key: Optional[str] = None) -> None:
        facts.append((user_id, group, field, record_key, jsonb(value), jsonb(value), evidence[:500],
                      "api:github", "github", 1.0, "validated", "unconfirmed"))

    login = profile.get("login", "")
    profile_ev = f"GitHub profile @{login}"
    if profile.get("name"):
        fact("identity", "full_name", profile["name"], profile_ev)
    if profile.get("bio"):
        fact("identity", "headline", profile["bio"].strip(), profile_ev)
    if profile.get("location"):
        fact("identity", "location", profile["location"], profile_ev)
    if profile.get("html_url"):
        fact("contact", "github_url", profile["html_url"], profile_ev)
    if profile.get("blog"):
        blog = profile["blog"] if profile["blog"].startswith("http") else f"https://{profile['blog']}"
        fact("contact", "website", blog, profile_ev)

    by_language: Dict[str, List[Tuple[str, int]]] = {}
    for r in repos:
        name = r["full_name"]
        langs = languages.get(name) or ({r["language"]: 1} if r.get("language") else {})
        ev = f"github.com/{name}"
        fact("projects", "title", r["name"], ev, name)
        if r.get("description"):
            fact("projects", "description", r["description"], ev, name)
        if langs:
            fact("projects", "technologies", sorted(langs, key=langs.get, reverse=True), ev, name)
        fact("projects", "url", r.get("html_url"), ev, name)
        for lang, size in langs.items():
            by_language.setdefault(lang, []).append((name, size))

    for lang, uses in by_language.items():
        top = ", ".join(n for n, _ in sorted(uses, key=lambda u: -u[1])[:5])
        fact("skills", "skill", lang, f"Used in {len(uses)} GitHub repo(s): {top}", f"github-lang:{lang}")

    if facts:
        psycopg2.extras.execute_values(
            cur,
            """INSERT INTO profile_facts
                 (user_id, field_group, field_name, record_key, extracted_value, normalized_value,
                  source_evidence, extraction_method, origin, confidence, validation_status, confirmation)
               VALUES %s""",
            facts,
        )
