"""Stack Exchange: top tags → skills, reputation and badges → achievements.
Public API with our app key (STACK_EXCHANGE_KEY); the user only gave a profile URL."""

from __future__ import annotations

import os
import urllib.parse
from typing import Any, Dict, List

from connectors.common import Facts, HttpError, finish_sync, http_json, load_connection, set_status
from jobs import Job, NeedsReview

API = "https://api.stackexchange.com/2.3"
TOP_TAGS = 15


def fetch(site: str, user_id: int) -> Dict[str, Any]:
    params = {"site": site}
    if os.environ.get("STACK_EXCHANGE_KEY"):
        params["key"] = os.environ["STACK_EXCHANGE_KEY"]
    q = urllib.parse.urlencode(params)
    users = http_json("GET", f"{API}/users/{user_id}?{q}")["items"]
    if not users:
        raise NeedsReview(f"Stack Exchange user {user_id} not found on {site}")
    tags = http_json("GET", f"{API}/users/{user_id}/top-tags?pagesize={TOP_TAGS}&{q}")["items"]
    return {"user": users[0], "tags": tags}


def map_stack_exchange(site: str, data: Dict[str, Any], facts: Facts) -> Facts:
    u = data["user"]
    link = u.get("link") or ""
    ev = f"{site} profile {link}"
    facts.add("contact", "stackexchange_url", link, ev)
    rep = u.get("reputation")
    if rep:
        badges = u.get("badge_counts") or {}
        badge_text = ", ".join(f"{badges[k]} {k}" for k in ("gold", "silver", "bronze") if badges.get(k))
        facts.add("achievements", "title", f"{site.title()} reputation {rep:,}", ev, f"se:{site}:reputation")
        facts.add("achievements", "description", f"Badges: {badge_text}" if badge_text else None, ev, f"se:{site}:reputation")
    tags: List[Dict[str, Any]] = data.get("tags", [])
    for t in tags:
        name = (t.get("tag_name") or "").replace("-", " ")
        facts.add(
            "skills", "skill", name,
            f"{site} top tag '{t.get('tag_name')}': {t.get('answer_count', 0)} answers, score {t.get('answer_score', 0)}",
            f"se-tag:{t.get('tag_name')}",
        )
    return facts


def sync_stack_exchange(conn: Any, job: Job) -> None:
    loaded = load_connection(conn, job, "stack_exchange")
    if not loaded:
        return
    row, cred = loaded
    try:
        data = fetch(cred["site"], int(cred["userId"]))
    except HttpError as exc:
        set_status(conn, row["id"], "failed")
        raise  # throttles / outages are retried
    finish_sync(conn, job, row["id"], "stack_exchange",
                map_stack_exchange(cred["site"], data, Facts(job.user_id, "stack_exchange", "api:stack_exchange")))
