"""Kaggle: notebooks and datasets → projects, entered competitions → achievements,
notebook languages → skills. Authenticates as the user with the username + key
they pasted (kaggle.json), which is what lets us list *their* competitions."""

from __future__ import annotations

import base64
from typing import Any, Dict, List

from connectors.common import Facts, HttpError, finish_sync, http_json, load_connection, set_status
from jobs import Job, NeedsReview

API = "https://www.kaggle.com/api/v1"


def fetch(username: str, key: str) -> Dict[str, List[Dict[str, Any]]]:
    auth = {"Authorization": "Basic " + base64.b64encode(f"{username}:{key}".encode()).decode()}
    get = lambda path: http_json("GET", f"{API}/{path}", auth) or []  # noqa: E731
    return {
        "kernels": get(f"kernels/list?user={username}&pageSize=50&sortBy=dateRun"),
        "datasets": get(f"datasets/list?user={username}&page=1"),
        "competitions": get("competitions/list?group=entered&page=1"),
    }


def map_kaggle(username: str, data: Dict[str, List[Dict[str, Any]]], facts: Facts) -> Facts:
    profile = f"kaggle.com/{username}"
    facts.add("contact", "kaggle_url", f"https://www.kaggle.com/{username}", f"Kaggle profile {profile}")
    languages: Dict[str, int] = {}
    for k in data.get("kernels", []):
        ref = k.get("ref") or ""
        key = f"kaggle-kernel:{ref}"
        ev = f"kaggle.com/code/{ref}"
        facts.add("projects", "title", k.get("title"), ev, key)
        facts.add("projects", "url", f"https://www.kaggle.com/code/{ref}", ev, key)
        if k.get("language"):
            facts.add("projects", "technologies", [k["language"].title()], ev, key)
            languages[k["language"].title()] = languages.get(k["language"].title(), 0) + 1
    for d in data.get("datasets", []):
        ref = d.get("ref") or ""
        key = f"kaggle-dataset:{ref}"
        ev = f"kaggle.com/datasets/{ref}"
        facts.add("projects", "title", f"Dataset: {d.get('title')}" if d.get("title") else None, ev, key)
        facts.add("projects", "description", d.get("subtitle"), ev, key)
        facts.add("projects", "url", f"https://www.kaggle.com/datasets/{ref}", ev, key)
    for c in data.get("competitions", []):
        ref = c.get("ref") or c.get("url") or ""
        key = f"kaggle-competition:{ref}"
        ev = f"Kaggle competition entered: {c.get('title')}"
        facts.add("achievements", "title", f"Kaggle competition: {c.get('title')}" if c.get("title") else None, ev, key)
        facts.add("achievements", "description", c.get("description"), ev, key)
        facts.add("achievements", "date", (c.get("deadline") or "")[:10] or None, ev, key)
    for lang, n in languages.items():
        facts.add("skills", "skill", "Python" if lang == "Python" else lang, f"Used in {n} Kaggle notebook(s)", f"kaggle-lang:{lang}")
    return facts


def sync_kaggle(conn: Any, job: Job) -> None:
    loaded = load_connection(conn, job, "kaggle")
    if not loaded:
        return
    row, cred = loaded
    try:
        data = fetch(cred["username"], cred["key"])
    except HttpError as exc:
        if exc.status in (401, 403):
            set_status(conn, row["id"], "reauth_needed")
            raise NeedsReview("Kaggle rejected the API key; the user must paste a fresh kaggle.json") from exc
        set_status(conn, row["id"], "failed")
        raise
    finish_sync(conn, job, row["id"], "kaggle", map_kaggle(cred["username"], data, Facts(job.user_id, "kaggle", "api:kaggle")))
