"""Unified project matching (plan §2.1): one canonical record per project
across the CV and GitHub.

A CV project and a repo are matched when at least two signals agree:
  - name token overlap >= 60%
  - repository URL match, and explicit URL link (a CV link that points at
    the repo satisfies both, so it counts as two)
  - >= 2 shared technologies
Date overlap is not used yet: CV project entries rarely carry dates.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set

STOPWORDS = {"a", "an", "the", "of", "for", "and", "with", "using", "based", "app", "project", "system", "tool"}
MIN_SIGNALS = 2


@dataclass
class ProjectRecord:
    kind: str  # "cv" | "repo"
    title: str
    url: Optional[str]
    technologies: Set[str]
    fact_ids: List[str]
    last_commit_at: Optional[Any] = None
    repo_name: Optional[str] = None  # owner/name for repos


@dataclass
class Unified:
    canonical_title: str
    fact_ids: List[str]
    technologies: List[str]
    match_confidence: float
    status: str  # "matched" | "standalone"
    timeline_end: Optional[Any] = None
    signals: List[str] = field(default_factory=list)


def tokens(text: str) -> Set[str]:
    spaced = re.sub(r"([a-z])([A-Z])", r"\1 \2", text or "")
    return {t for t in re.split(r"[^a-z0-9]+", spaced.lower()) if t and t not in STOPWORDS}


def _repo_path(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    m = re.search(r"github\.com/([\w.-]+/[\w.-]+)", url, re.I)
    return m.group(1).lower().removesuffix(".git") if m else None


def signals(cv: ProjectRecord, repo: ProjectRecord) -> List[str]:
    found: List[str] = []
    a, b = tokens(cv.title), tokens(repo.title)
    compact = lambda t: re.sub(r"[^a-z0-9]", "", (t or "").lower())  # noqa: E731
    shared = len(a & b)
    exact = bool(compact(cv.title)) and len(compact(cv.title)) >= 6 and compact(cv.title) == compact(repo.title)
    if (a and b and shared / min(len(a), len(b)) >= 0.6) or exact:
        found.append("name")
        # Resume projects carry no URL and rarely technologies, so a second signal almost never exists and nothing
        # matched. The repositories here are the student's own, so a specific name match (an exact multi-character
        # name, or two or more meaningful shared words) is itself strong evidence: it counts as a second signal.
        # Never against contradicting evidence: both list technologies and none are shared → probably different work.
        contradicts = bool(cv.technologies) and bool(repo.technologies) and not (cv.technologies & repo.technologies)
        if (exact or shared >= 2) and not contradicts:
            found.append("name_specific")
    if _repo_path(cv.url) and _repo_path(cv.url) == (repo.repo_name or "").lower():
        found += ["repo_url", "explicit_link"]
    if len(cv.technologies & repo.technologies) >= 2:
        found.append("technologies")
    return found


def unify(records: List[ProjectRecord]) -> List[Unified]:
    cvs = [r for r in records if r.kind == "cv"]
    repos = [r for r in records if r.kind == "repo"]

    # Score every CV×repo pair, then match greedily, strongest first, one-to-one.
    pairs = []
    for i, cv in enumerate(cvs):
        for j, repo in enumerate(repos):
            s = signals(cv, repo)
            if len(s) >= MIN_SIGNALS:
                pairs.append((len(s), i, j, s))
    pairs.sort(key=lambda p: -p[0])
    used_cv, used_repo, out = set(), set(), []
    for n, i, j, s in pairs:
        if i in used_cv or j in used_repo:
            continue
        used_cv.add(i)
        used_repo.add(j)
        cv, repo = cvs[i], repos[j]
        out.append(
            Unified(
                canonical_title=repo.title,  # prefer the GitHub repo name
                fact_ids=cv.fact_ids + repo.fact_ids,
                technologies=sorted(cv.technologies | repo.technologies),
                match_confidence=round(min(1.0, n / 4), 2),
                status="matched",
                timeline_end=repo.last_commit_at,
                signals=s,
            )
        )
    for i, cv in enumerate(cvs):
        if i not in used_cv:
            out.append(Unified(cv.title, cv.fact_ids, sorted(cv.technologies), 0.0, "standalone"))
    for j, repo in enumerate(repos):
        if j not in used_repo:
            out.append(Unified(repo.title, repo.fact_ids, sorted(repo.technologies), 0.0, "standalone",
                               timeline_end=repo.last_commit_at))
    return out


def records_from(
    facts: List[Dict[str, Any]],
    repos: List[Dict[str, Any]],
    canonical: Callable[[str], Optional[str]],
) -> List[ProjectRecord]:
    """CV/user projects from facts (grouped by record_key); GitHub projects from code_repositories."""
    def techs(values: List[str]) -> Set[str]:
        return {c for c in (canonical(v) for v in values) if c}

    entries: Dict[str, Dict[str, Any]] = {}
    for f in facts:
        if f["field_group"] != "projects" or f["origin"] == "github":
            continue
        key = f"{f['origin']}:{f['record_key'] or f['id']}"
        e = entries.setdefault(key, {"ids": [], "title": None, "url": None, "tech": []})
        e["ids"].append(f["id"])
        v = f["normalized_value"]
        if f["field_name"] == "title":
            e["title"] = str(v)
        elif f["field_name"] == "url":
            e["url"] = str(v)
        elif f["field_name"] == "technologies":
            e["tech"] += v if isinstance(v, list) else re.split(r",|;|\|", str(v))
    out = [
        ProjectRecord("cv", e["title"], e["url"], techs(e["tech"]), e["ids"])
        for e in entries.values()
        if e["title"]
    ]

    github_fact_ids: Dict[str, List[str]] = {}
    for f in facts:
        if f["field_group"] == "projects" and f["origin"] == "github" and f["record_key"]:
            github_fact_ids.setdefault(f["record_key"], []).append(f["id"])
    for r in repos:
        out.append(
            ProjectRecord(
                "repo",
                r["repo_name"].split("/")[-1],
                r["url"],
                techs(list((r["languages"] or {}).keys()) + list(r["topics"] or [])),
                github_fact_ids.get(r["repo_name"], []),
                last_commit_at=r["last_commit_at"],
                repo_name=r["repo_name"],
            )
        )
    return out
