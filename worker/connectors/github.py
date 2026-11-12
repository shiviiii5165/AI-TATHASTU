"""GitHub connector: profile, repositories and languages via the REST API.

Writes code_repositories (one row per repo) and profile_facts with
origin = 'github', extraction_method = 'api:github':
  identity/contact  name, bio → headline, location, blog → website, profile URL
  projects          one entry per repo (record_key = repo full name)
  skills            one per language, with evidence naming the repos

Code signals (migration 0031, code_repositories.code_signals): for the most recently pushed repositories, the
dependency files at the root (requirements.txt, pyproject.toml, package.json...), the root structure (tests,
CI workflows, Dockerfile, Kubernetes, Terraform) and the skills the README names. Only parsed results are
stored: package names, flags, and README skill names, never README text. A repository whose last push hasn't
changed keeps its stored signals, so a re-sync costs no extra requests. If the column doesn't exist yet, the
sync behaves exactly as before.

Not yet: contributors, 90-day commits and PRs from the plan, and raw_snapshots (that table doesn't exist yet).
"""

from __future__ import annotations

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import psycopg2.extras

from connectors import github_contributions as contributions
from connectors.common import still_connected
from crypto_box import open_credential
from db import enqueue_compute_intelligence, fetch_all, fetch_one, jsonb
from intelligence import code_signals
from jobs import Job, NeedsReview, assert_still_owner

log = logging.getLogger("worker.github")

API = "https://api.github.com"
# Most recently pushed non-fork repos the user owns, collaborates on, or can see
# through an organisation. Visibility is still limited by the token's scope.
MAX_REPOS = 100
LANGUAGE_LOOKUPS = 50
# Repositories whose files are (re)read per sync; unchanged ones reuse stored signals and cost nothing.
SIGNAL_LOOKUPS = 30
MAX_MANIFEST_FETCHES = 4
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

    def graphql(self, query: str, variables: Dict[str, Any]) -> Dict[str, Any]:
        """POST to the GraphQL API. GraphQL errors come back in the body; HTTP errors raise."""
        req = urllib.request.Request(
            API + "/graphql",
            data=json.dumps({"query": query, "variables": variables}).encode(),
            method="POST",
            headers={
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "User-Agent": "ai-tathastu-worker",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.loads(res.read())
        except urllib.error.HTTPError as exc:
            if exc.code == 401:
                raise GithubAuthError("token rejected") from exc
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
        has_signals = signals_column_exists(cur)
        previous_signals = {
            r["repo_name"]: r["code_signals"]
            for r in fetch_all(cur, "SELECT repo_name, code_signals FROM code_repositories WHERE user_id = %s AND source = 'github' AND code_signals IS NOT NULL", (job.user_id,))
        } if has_signals else {}

    credential = open_credential(connection["token_enc"], job.user_id, "github")
    client = client_factory(credential["access_token"])

    # Before the repositories, and committed on its own, so either can fail without the other.
    _sync_contributions(conn, job, connection_id, client)

    try:
        profile, _ = client.get("/user")
        repos = [
            r for r in client.paginate("/user/repos?per_page=100&affiliation=owner,collaborator,organization_member&sort=pushed", MAX_REPOS * 2)
            if not r.get("fork")
        ][:MAX_REPOS]
        languages: Dict[str, Dict[str, int]] = {}
        for repo in repos[:LANGUAGE_LOOKUPS]:
            try:
                languages[repo["full_name"]], _ = client.get(f"/repos/{repo['full_name']}/languages")
            except urllib.error.HTTPError as exc:
                if exc.code != 404:  # renamed/deleted since listing: keep its primary language, sync the rest
                    raise
        signals = collect_signals(client, repos, previous_signals, profile.get("login")) if has_signals else {}
    except GithubAuthError as exc:
        with conn, conn.cursor() as cur:
            cur.execute("UPDATE connections SET status = 'reauth_needed' WHERE id = %s", (connection_id,))
        raise NeedsReview("GitHub token was revoked or expired; user must reconnect") from exc
    except Exception:
        with conn, conn.cursor() as cur:
            cur.execute("UPDATE connections SET status = 'failed' WHERE id = %s", (connection_id,))
        raise  # retried by the worker

    with conn, conn.cursor() as cur:
        assert_still_owner(cur, job)  # Also how account deletion stops a running sync: it clears locked_by.
        if not still_connected(cur, connection_id, job.user_id):
            log.info("github connection %s was disconnected mid-sync; results discarded", connection_id)
            return
        if has_signals:
            _write(cur, job.user_id, profile, repos, languages, signals)
        else:
            _write(cur, job.user_id, profile, repos, languages)
        now = datetime.now(timezone.utc)
        cur.execute(
            "UPDATE connections SET status = 'connected', last_sync_at = %s, stale_after = %s WHERE id = %s",
            (now, now + STALE_AFTER, connection_id),
        )
        enqueue_compute_intelligence(cur, job.user_id, "connector_sync:github")
    log.info("github sync for %s: %d repos, %d languages", job.user_id, len(repos),
             len({lang for langs in languages.values() for lang in langs}))


def _sync_contributions(conn: Any, job: Job, connection_id: Any, client: Any) -> None:
    """Fetches the contribution calendar and stores it, or records why it couldn't.

    Never raises for a GitHub failure: the repository sync goes ahead, and the next sync tries
    again. A failure leaves the last successful snapshot untouched (record_failure).
    """
    try:
        with conn, conn.cursor() as cur:
            if not contributions.table_exists(cur):
                log.info("github_contributions table missing (migration 0027 not applied); skipping calendar")
                return
    except Exception as exc:  # noqa: BLE001 - the calendar is optional; the repository sync must still run
        log.warning("github contributions for %s skipped: table check failed (%s)", job.user_id, type(exc).__name__)
        return

    snapshot: Optional[Dict[str, Any]] = None
    reason = ""
    try:
        snapshot = contributions.fetch(client)
    except Exception as exc:  # noqa: BLE001 - every GitHub failure is recorded, none is fatal here
        reason = contributions.describe_error(exc)
        log.warning("github contributions for %s not refreshed: %s", job.user_id, reason)

    # Ownership is checked outside the guarded write: losing the job lock must stop the whole sync.
    with conn, conn.cursor() as cur:
        assert_still_owner(cur, job)
        if not still_connected(cur, connection_id, job.user_id):
            return

    try:
        # Its own transaction: a failed write rolls back completely, so the previous snapshot is untouched.
        with conn, conn.cursor() as cur:
            if snapshot is not None:
                contributions.write_snapshot(cur, job.user_id, snapshot)
            else:
                contributions.record_failure(cur, job.user_id, reason)
    except Exception as exc:  # noqa: BLE001 - a storage problem here must not break the repository sync
        log.warning("github contributions for %s not stored: %s", job.user_id, type(exc).__name__)
        if snapshot is None:
            return
        try:
            with conn, conn.cursor() as cur:
                contributions.record_failure(cur, job.user_id, f"Could not store the calendar ({type(exc).__name__})")
        except Exception as exc2:  # noqa: BLE001
            log.warning("github contributions for %s: failure not recorded either (%s)", job.user_id, type(exc2).__name__)


_signals_column: Optional[bool] = None


def signals_column_exists(cur: Any) -> bool:
    """Whether migration 0031 (code_repositories.code_signals) has been applied. Checked once per process, so a worker
    started before the migration needs a restart to begin reading repository files."""
    global _signals_column
    if _signals_column is None:
        row = fetch_one(cur, """SELECT EXISTS (SELECT 1 FROM information_schema.columns
                                  WHERE table_schema = 'public' AND table_name = 'code_repositories' AND column_name = 'code_signals') AS present""")
        _signals_column = bool(row) and row.get("present") is True
    return _signals_column


def _content(client: Any, full_name: str, path: str) -> Optional[Tuple[str, int]]:
    """A file's text via the contents API (base64), or None if it isn't there. Other HTTP errors propagate."""
    try:
        data, _ = client.get(f"/repos/{full_name}/contents/{urllib.parse.quote(path)}")
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise
    if not isinstance(data, dict) or data.get("encoding") != "base64":
        return None
    raw = base64.b64decode(data.get("content") or "")
    return raw.decode("utf-8", "replace"), int(data.get("size") or len(raw))


def _contribution(client: Any, full_name: str, login: str) -> Optional[Dict[str, Any]]:
    """The student's commits against all commits, from GitHub's contributors API (first 100 contributors). None when
    GitHub can't say (empty or very large repository): the engine then treats contribution as unconfirmed."""
    try:
        people, _ = client.get(f"/repos/{full_name}/contributors?per_page=100")
    except urllib.error.HTTPError as exc:
        if exc.code in (204, 403, 404, 409):
            return None
        raise
    if not isinstance(people, list) or not people:
        return None
    total = sum(int(p.get("contributions") or 0) for p in people if isinstance(p, dict))
    mine = sum(int(p.get("contributions") or 0) for p in people if isinstance(p, dict) and str(p.get("login", "")).lower() == login.lower())
    return {"login": login, "commits": mine, "total": total, "contributors": len(people), "truncated": len(people) >= 100} if total else None


def fetch_code_signals(client: Any, repo: Dict[str, Any], readme_skills: Any, login: Optional[str] = None) -> Dict[str, Any]:
    """Root listing, up to MAX_MANIFEST_FETCHES dependency files, the workflows folder and the README of one repository."""
    full = repo["full_name"]
    base = {"version": code_signals.SIGNALS_VERSION, "pushedAt": repo.get("pushed_at"), "private": bool(repo.get("private")),
            "fetchedAt": datetime.now(timezone.utc).isoformat()}
    try:
        listing, _ = client.get(f"/repos/{full}/contents/")
    except urllib.error.HTTPError as exc:
        if exc.code in (404, 409):  # empty repository
            return {**base, "unavailable": "empty repository"}
        raise
    if not isinstance(listing, list):
        return {**base, "unavailable": "unexpected listing"}
    by_name = {item.get("name"): item for item in listing if isinstance(item, dict)}
    workflows = 0
    if ".github" in by_name:
        try:
            wf, _ = client.get(f"/repos/{full}/contents/.github/workflows")
            workflows = sum(1 for f in wf if isinstance(f, dict) and str(f.get("name", "")).endswith((".yml", ".yaml"))) if isinstance(wf, list) else 0
        except urllib.error.HTTPError as exc:
            if exc.code != 404:
                raise
    manifests: Dict[str, List[str]] = {}
    skipped: List[str] = []
    for name in code_signals.MANIFESTS:
        item = by_name.get(name)
        if not item or item.get("type") != "file":
            continue
        if int(item.get("size") or 0) > code_signals.MAX_MANIFEST_BYTES or len(manifests) >= MAX_MANIFEST_FETCHES:
            skipped.append(name)
            continue
        got = _content(client, full, name)
        if got:
            manifests[name] = code_signals.parse_manifest(name, got[0])
    readme: Dict[str, Any] = {"present": False, "chars": 0, "skills": []}
    try:
        data, _ = client.get(f"/repos/{full}/readme")
        if isinstance(data, dict) and data.get("encoding") == "base64" and int(data.get("size") or 0) <= code_signals.MAX_README_BYTES * 4:
            text = base64.b64decode(data.get("content") or "").decode("utf-8", "replace")[: code_signals.MAX_README_BYTES]
            readme = {"present": True, "chars": len(text), "skills": readme_skills(text)}
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
    out = {**base, "manifests": manifests, "structure": code_signals.structure_from_listing(by_name.keys(), workflows), "readme": readme}
    if login:
        out["contribution"] = _contribution(client, full, login)
    if skipped:
        out["skipped"] = skipped
    return out


def collect_signals(client: Any, repos: List[Dict[str, Any]], previous: Dict[str, Any], login: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
    """Signals per repository: reused when the last push hasn't changed, fetched for up to SIGNAL_LOOKUPS others.
    Optional by design: a rate limit or transient error stops fetching more, and the sync still succeeds."""
    from resume.deterministic import _PATTERNS  # local: the resume lexicon is the one skill vocabulary

    def readme_skills(text: str) -> List[str]:
        return sorted({canonical for canonical, pattern, section_only in _PATTERNS if not section_only and pattern.search(text)})

    out: Dict[str, Dict[str, Any]] = {}
    fetched = 0
    stopped: Optional[str] = None
    for repo in repos:
        name = repo["full_name"]
        old = previous.get(name)
        if isinstance(old, dict) and old.get("version") == code_signals.SIGNALS_VERSION and old.get("pushedAt") == repo.get("pushed_at"):
            out[name] = old
            continue
        if stopped or fetched >= SIGNAL_LOOKUPS:
            if isinstance(old, dict):
                out[name] = old  # older signals beat none; their pushedAt shows they're older
            continue
        try:
            out[name] = fetch_code_signals(client, repo, readme_skills, login)
            fetched += 1
        except GithubAuthError:
            raise
        except Exception as exc:  # noqa: BLE001 - signals are optional; the repository sync must still succeed
            stopped = type(exc).__name__
            log.warning("github code signals stopped after %d repositories: %s", fetched, stopped)
            if isinstance(old, dict):
                out[name] = old
    return out


def _write(cur: Any, user_id: str, profile: Dict[str, Any], repos: List[Dict[str, Any]], languages: Dict[str, Dict[str, int]],
           signals: Optional[Dict[str, Dict[str, Any]]] = None) -> None:
    # code_repositories: upsert current repos, drop ones that disappeared.
    names = [r["full_name"] for r in repos]
    cur.execute(
        "DELETE FROM code_repositories WHERE user_id = %s AND source = 'github' AND NOT (repo_name = ANY(%s))",
        (user_id, names),
    )
    if repos and signals is not None:
        psycopg2.extras.execute_values(
            cur,
            """INSERT INTO code_repositories
                 (user_id, source, repo_name, description, url, languages, topics, stars, forks, last_commit_at, code_signals)
               VALUES %s
               ON CONFLICT (user_id, source, repo_name) DO UPDATE SET
                 description = EXCLUDED.description, url = EXCLUDED.url, languages = EXCLUDED.languages,
                 topics = EXCLUDED.topics, stars = EXCLUDED.stars, forks = EXCLUDED.forks,
                 last_commit_at = EXCLUDED.last_commit_at,
                 code_signals = COALESCE(EXCLUDED.code_signals, code_repositories.code_signals)""",
            [
                (
                    user_id, "github", r["full_name"], r.get("description"), r.get("html_url"),
                    jsonb(languages.get(r["full_name"], {})), r.get("topics") or [],
                    r.get("stargazers_count") or 0, r.get("forks_count") or 0, r.get("pushed_at"),
                    jsonb(signals[r["full_name"]]) if r["full_name"] in signals else None,
                )
                for r in repos
            ],
        )
    elif repos:
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
