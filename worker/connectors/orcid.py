"""ORCID: publications, positions, education and keywords from the user's
public ORCID record (pub.orcid.org v3.0, no token needed).

The ORCID iD comes from the OAuth `/authenticate` sign-in on the web side
(src/app/api/connectors/orcid), which proves the user owns the record; only
the iD is stored, never an ORCID token.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from connectors.common import Facts, HttpError, finish_sync, http_json, load_connection, set_status
from jobs import Job, NeedsReview

ORCID_ID = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")
API = "https://pub.orcid.org/v3.0"
MAX_WORKS = 100


def _get(d: Any, *path: str) -> Any:
    for key in path:
        if not isinstance(d, dict):
            return None
        d = d.get(key)
    return d


def _year(date: Any) -> Optional[str]:
    return _get(date, "year", "value")


def fetch(orcid: str) -> Dict[str, Any]:
    if not ORCID_ID.match(orcid):
        raise NeedsReview(f"not an ORCID iD: {orcid!r}")
    return http_json("GET", f"{API}/{orcid}/record", headers={"Accept": "application/json"})


def _affiliations(record: Dict[str, Any], kind: str) -> List[Dict[str, Any]]:
    groups = _get(record, "activities-summary", f"{kind}s", "affiliation-group") or []
    return [s[f"{kind}-summary"] for g in groups for s in (g.get("summaries") or []) if s.get(f"{kind}-summary")]


def map_orcid(orcid: str, record: Dict[str, Any], facts: Facts) -> Facts:
    ev = f"orcid.org/{orcid}"
    given = _get(record, "person", "name", "given-names", "value")
    family = _get(record, "person", "name", "family-name", "value")
    facts.add("identity", "full_name", " ".join(p for p in (given, family) if p) or None, ev)
    facts.add("contact", "orcid_url", f"https://orcid.org/{orcid}", ev)

    for kw in _get(record, "person", "keywords", "keyword") or []:
        content = (kw.get("content") or "").strip()
        if content:
            facts.add("skills", "skill", content, ev, record_key=f"orcid:kw:{content.lower()}")

    for group in (_get(record, "activities-summary", "works", "group") or [])[:MAX_WORKS]:
        work = (group.get("work-summary") or [{}])[0]
        key = f"orcid:work:{work.get('put-code')}"
        title = _get(work, "title", "title", "value")
        if not title:
            continue
        doi = next(
            (x.get("external-id-value") for x in _get(work, "external-ids", "external-id") or []
             if x.get("external-id-type") == "doi" and x.get("external-id-value")),
            None,
        )
        facts.add("publications", "title", title, ev, key)
        facts.add("publications", "venue", _get(work, "journal-title", "value"), ev, key)
        facts.add("publications", "date", _year(work.get("publication-date")), ev, key)
        facts.add("publications", "url", f"https://doi.org/{doi}" if doi else _get(work, "url", "value"), ev, key)

    for job in _affiliations(record, "employment"):
        key = f"orcid:employment:{job.get('put-code')}"
        facts.add("experience", "organization", _get(job, "organization", "name"), ev, key)
        facts.add("experience", "role", ", ".join(p for p in (job.get("role-title"), job.get("department-name")) if p) or None, ev, key)
        facts.add("experience", "start_date", _year(job.get("start-date")), ev, key)
        facts.add("experience", "end_date", _year(job.get("end-date")) or "Present", ev, key)

    for edu in _affiliations(record, "education"):
        key = f"orcid:education:{edu.get('put-code')}"
        facts.add("education", "institution", _get(edu, "organization", "name"), ev, key)
        facts.add("education", "degree", edu.get("role-title"), ev, key)
        facts.add("education", "field_of_study", edu.get("department-name"), ev, key)
        facts.add("education", "start_date", _year(edu.get("start-date")), ev, key)
        facts.add("education", "end_date", _year(edu.get("end-date")), ev, key)
    return facts


def sync_orcid(conn: Any, job: Job) -> None:
    loaded = load_connection(conn, job, "orcid")
    if not loaded:
        return
    row, cred = loaded
    try:
        record = fetch(cred["orcid"])
    except (HttpError, NeedsReview):
        set_status(conn, row["id"], "failed")
        raise
    finish_sync(conn, job, row["id"], "orcid", map_orcid(cred["orcid"], record, Facts(job.user_id, "orcid", "api:orcid")))
