"""LinkedIn Tier 4: the user's own public profile via an Apify actor (no
cookies, never logs in as anyone). Requires `linkedin_scrape` consent; without
it the job parks as needs_review and is re-queued when consent is granted."""

from __future__ import annotations

import os
import re
from typing import Any, Dict, Iterable, List, Optional

from connectors.common import Facts, HttpError, finish_sync, http_json, load_connection, set_status
from db import has_consent
from jobs import Job, NeedsReview
from provider_router import KeyPool

ACTOR = os.environ.get("APIFY_LINKEDIN_ACTOR", "harvestapi~linkedin-profile-scraper")
MODE = "Profile details no email ($4 per 1k)"
LOGIN_WALL = re.compile(r"sign in|join linkedin|authwall", re.I)

_pool = None


def _keys() -> KeyPool:
    global _pool
    if _pool is None:
        _pool = KeyPool("apify", "APIFY_TOKENS")
    return _pool


def fetch(url: str) -> Dict[str, Any]:
    pool = _keys()
    for _ in range(max(len(pool.keys), 1)):
        key = pool.acquire()
        if key is None:
            break
        try:
            items = http_json(
                "POST",
                f"https://api.apify.com/v2/acts/{ACTOR}/run-sync-get-dataset-items?timeout=150",
                {"Authorization": f"Bearer {key.secret}"},
                {"profileScraperMode": MODE, "urls": [url]},
                timeout=180,
            )
        except HttpError as exc:
            if exc.status in (402, 429):  # out of monthly credit / throttled: next token
                pool.report(key, 429, 3600 if exc.status == 402 else 60)
                continue
            if exc.status in (401, 403):
                pool.report(key, 401)
                continue
            raise
        return (items or [{}])[0]
    raise RuntimeError("no Apify token available (all throttled or out of credit)")


def quality_gate(item: Dict[str, Any]) -> None:
    """Reject login walls and empty results instead of storing junk."""
    if not item.get("firstName") and not item.get("lastName"):
        raise NeedsReview("LinkedIn scrape returned no profile (private profile or bad URL)")
    if LOGIN_WALL.search(str(item.get("headline") or "")):
        raise NeedsReview("LinkedIn scrape hit a login wall")


def _text(d: Any, *keys: str) -> Optional[str]:
    if isinstance(d, str):
        return d
    if not isinstance(d, dict):
        return None
    for k in keys:
        v = d.get(k)
        if isinstance(v, dict):
            v = v.get("text") or v.get("name")
        if v:
            return str(v)
    return None


def _items(v: Any) -> Iterable[Any]:
    return v if isinstance(v, list) else []


def map_linkedin(item: Dict[str, Any], facts: Facts) -> Facts:
    url = item.get("linkedinUrl") or ""
    ev = f"LinkedIn {url}"
    name = " ".join(x for x in (item.get("firstName"), item.get("lastName")) if x)
    facts.add("identity", "full_name", name, ev)
    facts.add("identity", "headline", item.get("headline"), ev)
    facts.add("identity", "location", _text(item.get("location"), "linkedinText", "text"), ev)
    facts.add("contact", "linkedin_url", url, ev)
    for w in _items(item.get("websites"))[:1]:
        facts.add("contact", "website", _text(w, "url") or w, ev)

    for i, x in enumerate(_items(item.get("experience"))):
        k = f"li-exp:{i}"
        facts.add("experience", "organization", _text(x, "companyName"), ev, k)
        facts.add("experience", "role", _text(x, "position", "title"), ev, k)
        facts.add("experience", "start_date", _text(x, "startDate"), ev, k)
        facts.add("experience", "end_date", _text(x, "endDate"), ev, k)
        facts.add("experience", "description", _text(x, "description"), ev, k)
    for i, x in enumerate(_items(item.get("education"))):
        k = f"li-edu:{i}"
        facts.add("education", "institution", _text(x, "schoolName", "title"), ev, k)
        facts.add("education", "degree", _text(x, "degree"), ev, k)
        facts.add("education", "field_of_study", _text(x, "fieldOfStudy"), ev, k)
        facts.add("education", "start_date", _text(x, "startDate"), ev, k)
        facts.add("education", "end_date", _text(x, "endDate"), ev, k)
    skills = {(_text(s, "name", "title") or "").strip() for s in [*_items(item.get("skills")), *_items(item.get("topSkills"))]}
    for s in sorted(x for x in skills if x):
        facts.add("skills", "skill", s, f"{ev} (skills)", f"li-skill:{s}")
    for i, x in enumerate(_items(item.get("certifications"))):
        k = f"li-cert:{i}"
        facts.add("certifications", "name", _text(x, "title", "name"), ev, k)
        facts.add("certifications", "issuer", _text(x, "issuedBy", "authority", "companyName"), ev, k)
        facts.add("certifications", "date", _text(x, "issuedAt", "startDate"), ev, k)
    for i, x in enumerate(_items(item.get("honorsAndAwards"))):
        k = f"li-award:{i}"
        facts.add("achievements", "title", _text(x, "title", "name"), ev, k)
        facts.add("achievements", "description", _text(x, "description", "issuedBy"), ev, k)
        facts.add("achievements", "date", _text(x, "issuedAt", "date"), ev, k)
    for i, x in enumerate(_items(item.get("projects"))):
        k = f"li-proj:{i}"
        facts.add("projects", "title", _text(x, "title", "name"), ev, k)
        facts.add("projects", "description", _text(x, "description"), ev, k)
    for i, x in enumerate(_items(item.get("publications"))):
        k = f"li-pub:{i}"
        facts.add("publications", "title", _text(x, "title", "name"), ev, k)
        facts.add("publications", "venue", _text(x, "publishedIn", "publisher"), ev, k)
    for i, x in enumerate(_items(item.get("languages"))):
        k = f"li-lang:{i}"
        facts.add("languages", "language", _text(x, "name", "language"), ev, k)
        facts.add("languages", "proficiency", _text(x, "proficiency"), ev, k)
    return facts


def sync_linkedin(conn: Any, job: Job) -> None:
    loaded = load_connection(conn, job, "linkedin")
    if not loaded:
        return
    row, cred = loaded
    if not cred.get("url"):  # Tier 1 (sign-in only): nothing to scrape
        set_status(conn, row["id"], "connected")
        return
    with conn, conn.cursor() as cur:
        if not has_consent(cur, job.user_id, "linkedin_scrape"):
            cur.execute("UPDATE connections SET status = 'connected' WHERE id = %s", (row["id"],))
            raise NeedsReview("waiting for linkedin_scrape consent; re-queued automatically when granted")
    try:
        item = fetch(cred["url"])
        quality_gate(item)
    except NeedsReview:
        set_status(conn, row["id"], "failed")
        raise
    except (HttpError, RuntimeError):
        set_status(conn, row["id"], "failed")
        raise
    finish_sync(conn, job, row["id"], "linkedin", map_linkedin(item, Facts(job.user_id, "linkedin_scrape", "apify:linkedin")),
                consent="linkedin_scrape")
