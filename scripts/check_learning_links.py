"""Rechecks the learning catalogue's links and records what it found.

  python scripts/check_learning_links.py            writes worker/intelligence/resource_checks.json
  python scripts/check_learning_links.py --curated  checks worker/intelligence/learning_catalogue.json (the engine's
                                                    curated resources) into learning_catalogue_checks.json, by id
  python scripts/check_learning_links.py --dry-run  prints only

Reads the catalogue from the migration file, so it needs no database and no credentials. Bounded on
purpose: one request at a time, at most MAX_URLS, a pause between requests, no retries, and it reads
only the start of each page. The worker recommends a course only if its check here says "ok".

Reaching a page isn't proof the course is still there, so "ok" also requires that the page isn't
reporting itself missing, that we weren't redirected somewhere else, and that it names the course.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
MIGRATION = ROOT / "src/db/migrations/0015_pgvector_and_rag.sql"
OUTPUT = ROOT / "worker/intelligence/resource_checks.json"
CURATED = ROOT / "worker/intelligence/learning_catalogue.json"
CURATED_OUTPUT = ROOT / "worker/intelligence/learning_catalogue_checks.json"

MAX_URLS = 80
MAX_CURATED_URLS = 200
TIMEOUT_S = 12
PAUSE_S = 0.75
MAX_BYTES = 400_000
USER_AGENT = "AITathastu-LinkCheck/1.0 (+https://aitathastu.com)"
ENTRY = re.compile(r"^\('((?:[^']|'')+)', '((?:[^']|'')+)', '([^']*)', '((?:[^']|'')*)'\)", re.M)
MISSING_PAGE = re.compile(r"(page not found|404 not found|not found \||course (is )?(no longer|not) available|this course is unavailable|has been retired)", re.I)
STOP_WORDS = {"and", "for", "the", "with", "from", "course", "specialization", "introduction", "advanced", "learning"}


def catalogue(text: str) -> List[Dict[str, str]]:
    return [
        {"title": t.replace("''", "'"), "provider": p.replace("''", "'"), "url": u}
        for t, p, u, _d in ENTRY.findall(text)
    ]


def structure_problem(url: str) -> Optional[str]:
    """Why a URL can't identify a specific course, without any network."""
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or not parts.hostname or "." not in parts.hostname:
        return "invalid"
    if parts.username or parts.password or parts.hostname.replace(".", "").isdigit():
        return "invalid"
    return None


def normalized(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    return f"{(parts.hostname or '').removeprefix('www.')}{parts.path.rstrip('/').lower()}"


def classify(title: str, url: str, status: Optional[int], final_url: Optional[str], body: str) -> str:
    """Status for a fetched page. Pure, so it's tested without a network."""
    if status is None:
        return "unreachable"
    if status in (404, 410):
        return "dead"
    if status in (401, 403, 406, 429, 999):
        return "blocked"  # the site refused a bot: that says nothing either way
    if status >= 400:
        return "unreachable"
    if final_url and normalized(final_url) != normalized(url):
        moved = urllib.parse.urlsplit(final_url).path.strip("/") == ""
        return "generic" if moved else "redirected"
    page_title = re.search(r"<title[^>]*>(.*?)</title>", body, re.I | re.S)
    head = html.unescape(page_title.group(1)) if page_title else ""
    if MISSING_PAGE.search(head) or MISSING_PAGE.search(html.unescape(re.sub(r"<[^>]+>", " ", body[:20_000]))[:3_000]):
        return "dead"
    words = {w for w in re.findall(r"[a-z0-9+]{3,}", title.lower()) if w not in STOP_WORDS}
    # A site's front page is fine if the whole site is the course, which its own title has to say.
    # Any large homepage mentions these words somewhere, so its body doesn't count.
    is_front_page = urllib.parse.urlsplit(url).path.strip("/") == ""
    text = (head if is_front_page else html.unescape(body)).lower()
    found = sum(1 for w in words if w in text)
    if words and found / len(words) < 0.5:
        return "generic" if is_front_page else "identity_unconfirmed"
    return "ok"


def fetch(url: str) -> Tuple[Optional[int], Optional[str], str]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_S) as response:
            body = response.read(MAX_BYTES).decode("utf-8", "replace")
            return response.status, response.geturl(), body
    except urllib.error.HTTPError as exc:
        return exc.code, url, ""
    except Exception:
        return None, None, ""


def check_all(entries: List[Dict[str, str]], checked_at: str, key_field: str = "title", max_urls: Optional[int] = None) -> Dict[str, Any]:
    results: Dict[str, Any] = {}
    seen: Dict[str, str] = {}
    requests = 0
    cap = MAX_URLS if max_urls is None else max_urls
    for entry in entries:
        url = entry["url"]
        key = normalized(url)
        record: Dict[str, Any] = {"title": entry["title"], "provider": entry["provider"], "url": url, "checkedAt": checked_at}
        problem = structure_problem(url)
        if key in seen:
            record.update(status="duplicate", duplicateOf=seen[key])
        elif problem:
            record["status"] = problem
        elif requests >= cap:
            record["status"] = "not_checked"
        else:
            requests += 1
            status, final_url, body = fetch(url)
            record.update(status=classify(entry["title"], url, status, final_url, body), httpStatus=status, finalUrl=final_url if final_url != url else None)
            time.sleep(PAUSE_S)
        seen.setdefault(key, entry[key_field])
        results[entry[key_field]] = record
        print(f"{record['status']:<22} {entry[key_field]}", flush=True)
    return {"checkedAt": checked_at, "requests": requests, "resources": results}


def curated_entries() -> List[Dict[str, str]]:
    return [{"id": r["id"], "title": r["title"], "provider": r["provider"], "url": r["url"]} for r in json.loads(CURATED.read_text(encoding="utf-8"))["resources"]]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--curated", action="store_true", help="check the engine's curated learning catalogue")
    args = parser.parse_args()
    today = datetime.now(timezone.utc).date().isoformat()
    if args.curated:
        entries = curated_entries()
        report = check_all(entries, today, key_field="id", max_urls=MAX_CURATED_URLS)
        target = CURATED_OUTPUT
    else:
        entries = catalogue(MIGRATION.read_text(encoding="utf-8"))
        report = check_all(entries, today)
        target = OUTPUT
    counts: Dict[str, int] = {}
    for record in report["resources"].values():
        counts[record["status"]] = counts.get(record["status"], 0) + 1
    print(json.dumps({"total": len(entries), "requests": report["requests"], **counts}))
    if not args.dry_run:
        target.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
