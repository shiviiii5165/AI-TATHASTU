"""LeetCode and HackerRank via their public profile APIs (no login, no cookies).

Both also feed ERIS's problem-solving component: the stats live in the
extracted_value of a fact with record_key 'leetcode:stats' / 'hackerrank:stats'.
"""

from __future__ import annotations

from typing import Any, Dict, List

from connectors.common import Facts, HttpError, finish_sync, http_json, load_connection, set_status
from jobs import Job, NeedsReview

LEETCODE_QUERY = """query($u: String!) {
  matchedUser(username: $u) {
    username
    profile { realName ranking }
    submitStatsGlobal { acSubmissionNum { difficulty count } }
    languageProblemCount { languageName problemsSolved }
    badges { name }
  }
  userContestRanking(username: $u) { rating attendedContestsCount topPercentage }
}"""


def fetch_leetcode(username: str) -> Dict[str, Any]:
    out = http_json("POST", "https://leetcode.com/graphql", {"Referer": "https://leetcode.com"},
                    {"query": LEETCODE_QUERY, "variables": {"u": username}}, timeout=15)
    data = (out or {}).get("data") or {}
    if not data.get("matchedUser"):
        raise NeedsReview(f"LeetCode user '{username}' not found")
    return data


def map_leetcode(data: Dict[str, Any], facts: Facts) -> Facts:
    user = data["matchedUser"]
    name = user["username"]
    ev = f"leetcode.com/u/{name}"
    # A count LeetCode didn't return is unknown (None), never 0: no fake zeros.
    rows = ((user.get("submitStatsGlobal") or {}).get("acSubmissionNum")) or []
    solved = {s["difficulty"].lower(): s["count"] for s in rows if s.get("difficulty") and s.get("count") is not None}
    stats: Dict[str, Any] = {k: solved.get(src) for k, src in
                             (("easy", "easy"), ("medium", "medium"), ("hard", "hard"), ("total", "all"))}
    contest = data.get("userContestRanking") or {}
    if contest.get("rating"):
        stats["contest_rating"] = round(contest["rating"])
        stats["contests"] = contest.get("attendedContestsCount")
        stats["top_percentage"] = contest.get("topPercentage")
    if solved:
        split = " · ".join(f"{k.title()} {stats[k]}" for k in ("easy", "medium", "hard") if stats[k] is not None)
        total = f"{stats['total']} problems solved" if stats["total"] is not None else "Problems solved"
        title = f"LeetCode: {total}" + (f" ({split})" if split else "")
        facts.add("achievements", "title", title, ev, "leetcode:stats", extracted=stats)
    if stats.get("contest_rating"):
        facts.add("achievements", "description",
                  f"Contest rating {stats['contest_rating']} over {stats.get('contests')} contests"
                  + (f" (top {stats['top_percentage']}%)" if stats.get("top_percentage") else ""), ev, "leetcode:stats")
    facts.add("contact", "leetcode_url", f"https://leetcode.com/u/{name}", ev)
    for lang in user.get("languageProblemCount") or []:
        if lang.get("problemsSolved"):
            facts.add("skills", "skill", lang["languageName"], f"{lang['problemsSolved']} LeetCode problems solved in {lang['languageName']}",
                      f"leetcode-lang:{lang['languageName']}")
    if (stats["total"] or 0) >= 50:
        facts.add("skills", "skill", "Data Structures and Algorithms", f"{stats['total']} problems solved on LeetCode", "leetcode-dsa")
    return facts


def fetch_hackerrank(username: str) -> Dict[str, Any]:
    profile = http_json("GET", f"https://www.hackerrank.com/rest/contests/master/hackers/{username}/profile")
    if not (profile or {}).get("model"):
        raise NeedsReview(f"HackerRank user '{username}' not found")
    badges = http_json("GET", f"https://www.hackerrank.com/rest/hackers/{username}/badges") or {}
    return {"profile": profile["model"], "badges": badges.get("models") or []}


def map_hackerrank(data: Dict[str, Any], facts: Facts) -> Facts:
    p = data["profile"]
    name = p.get("username")
    ev = f"hackerrank.com/profile/{name}"
    facts.add("contact", "hackerrank_url", f"https://www.hackerrank.com/profile/{name}", ev)
    badges: List[Dict[str, Any]] = [b for b in data.get("badges", []) if b.get("stars")]
    stats = {"badges": {b.get("badge_name"): b.get("stars") for b in badges}}
    if badges:
        summary = ", ".join(f"{b.get('badge_name')} {b.get('stars')}★" for b in badges)
        facts.add("achievements", "title", f"HackerRank badges: {summary}", ev, "hackerrank:stats", extracted=stats)
    for b in badges:
        skill = (b.get("badge_name") or "").replace("Problem Solving", "Data Structures and Algorithms")
        facts.add("skills", "skill", skill, f"HackerRank {b.get('badge_name')} badge, {b.get('stars')} stars", f"hackerrank:{b.get('badge_name')}")
    return facts


def _sync(conn: Any, job: Job, source: str, fetch, mapper) -> None:
    loaded = load_connection(conn, job, source)
    if not loaded:
        return
    row, cred = loaded
    try:
        data = fetch(cred["username"])
    except Exception as exc:  # any failure (timeouts included) must not leave the card stuck on 'syncing'
        set_status(conn, row["id"], "failed")
        if isinstance(exc, HttpError) and 400 <= exc.status < 500 and exc.status not in (408, 429):
            raise NeedsReview(f"{source} returned HTTP {exc.status}") from exc  # permanent: retrying can't help
        raise  # rate limited / server error / timeout: retried with backoff up to max_attempts
    finish_sync(conn, job, row["id"], source, mapper(data, Facts(job.user_id, source, f"api:{source}")))


def sync_leetcode(conn: Any, job: Job) -> None:
    _sync(conn, job, "leetcode", fetch_leetcode, map_leetcode)


def sync_hackerrank(conn: Any, job: Job) -> None:
    _sync(conn, job, "hackerrank", fetch_hackerrank, map_hackerrank)
