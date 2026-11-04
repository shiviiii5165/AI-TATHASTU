"""A synthetic check of the scoring model. Not a calibration, and not an accuracy figure.

Each expectation below is one engineer's reading of what the evidence ought to show, written before
looking at the output. There are no hiring or assessment outcomes behind them. A "false positive" here
means the model scored above that reading, and a "false negative" means below it. What this can do is
catch regressions and show where the model and common sense part ways. It can't say the model is right.

  python -m intelligence.evaluation     from worker/, prints the table
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from intelligence import career_engine as engine
from resume.deterministic import _PATTERNS
from skills_catalog import CATALOG, alias_key

NOW = datetime(2026, 11, 2, tzinfo=timezone.utc)
RECENT = NOW - timedelta(days=30)
LAST_YEAR = NOW - timedelta(days=400)
OLD = NOW - timedelta(days=1100)

NOT_ASSESSED = "Not assessed"
ORDER = [NOT_ASSESSED, "Foundational", "Working", "Proficient", "Advanced"]

_ALIASES = {alias_key(a): name for name, _c, aliases, _amb in CATALOG for a in [name, *aliases]}
_CATEGORIES = {name: cat for name, cat, _a, _amb in CATALOG}


def _canonical(mention: str) -> Optional[str]:
    name = mention.strip()
    return _ALIASES.get(alias_key(name), name) if name else None


def _lexicon(text: str) -> List[str]:
    return sorted({c for c, pattern, section_only in _PATTERNS if not section_only and pattern.search(text)})


def _repo(name: str, languages: Optional[Dict[str, int]] = None, topics: Optional[List[str]] = None, pushed: datetime = RECENT) -> Dict[str, Any]:
    return {"id": name, "repo_name": name, "url": f"https://github.com/{name}", "description": None, "languages": languages or {}, "topics": topics or [], "stars": 0, "last_commit_at": pushed}


def _fact(group: str, field_name: str, value: Any, origin: str = "resume", record: Optional[str] = None, extracted: Any = None) -> Dict[str, Any]:
    return {"id": f"{group}-{field_name}-{value}"[:40], "field_group": group, "field_name": field_name, "record_key": record, "normalized_value": value, "extracted_value": extracted if extracted is not None else value, "origin": origin, "confirmation": "confirmed", "source_evidence": None, "created_at": RECENT}


def _project(key: str, *skills: str) -> List[Dict[str, Any]]:
    return [_fact("projects", "title", f"Project {key}", record=key), _fact("projects", "technologies", list(skills), record=key)]


@dataclass
class Case:
    name: str
    group: str
    why: str
    expect: Dict[str, Tuple[str, str]]  # skill -> lowest and highest level this evidence should earn
    facts: List[Dict[str, Any]] = field(default_factory=list)
    repos: List[Dict[str, Any]] = field(default_factory=list)


CASES: List[Case] = [
    Case("tutorial_repo", "beginner", "One small recent repository.", {"Python": ("Foundational", "Working")}, repos=[_repo("a/hello", {"Python": 800})]),
    Case("resume_list_only", "beginner", "Skills listed, nothing behind them.", {"Python": (NOT_ASSESSED, NOT_ASSESSED), "Machine Learning": (NOT_ASSESSED, NOT_ASSESSED)}, facts=[_fact("skills", "skill", "Python"), _fact("skills", "skill", "Machine Learning")]),
    Case("two_course_projects", "beginner", "Two projects the user describes.", {"Python": ("Foundational", "Working")}, facts=_project("p1", "Python") + _project("p2", "Python")),
    Case("no_evidence", "beginner", "Nothing at all.", {"Python": (NOT_ASSESSED, NOT_ASSESSED)}),
    Case("steady_student", "intermediate", "Three real repositories, one described project.", {"Python": ("Working", "Proficient")}, repos=[_repo(f"a/r{i}", {"Python": 150_000}) for i in range(3)], facts=_project("p1", "Python")),
    Case("data_analyst", "intermediate", "SQL in two repositories and two described projects.", {"SQL": ("Working", "Proficient")}, repos=[_repo(f"a/d{i}", {"SQL": 40_000}, pushed=LAST_YEAR) for i in range(2)], facts=_project("p1", "SQL") + _project("p2", "SQL")),
    Case("self_described_three_jobs", "intermediate", "Three described records, nothing independent.", {"Python": ("Foundational", "Working")}, facts=_project("p1", "Python") + _project("p2", "Python") + _project("p3", "Python")),
    Case("prolific_engineer", "experienced", "Eight large recent repositories and three described projects.", {"Python": ("Proficient", "Advanced")}, repos=[_repo(f"a/x{i}", {"Python": 900_000}) for i in range(8)], facts=_project("p1", "Python") + _project("p2", "Python") + _project("p3", "Python")),
    Case("metadata_only_senior", "experienced", "Eight large repositories, no descriptions: strong, but only metadata.", {"Python": ("Proficient", "Proficient")}, repos=[_repo(f"a/y{i}", {"Python": 900_000}) for i in range(8)]),
    Case("private_code_senior", "experienced", "Years of real work, all private: only their own descriptions.", {"Java": ("Proficient", "Advanced")}, facts=_project("p1", "Java") + _project("p2", "Java") + _project("p3", "Java") + _project("p4", "Java")),
    Case("hackerrank_five_stars", "experienced", "Top marks on an independent assessment.", {"Python": ("Advanced", "Advanced")}, facts=[_fact("achievements", "title", "badges", origin="hackerrank", record="hackerrank:stats", extracted={"badges": {"Python": 5}})]),
    Case("lapsed_expert", "conflicting", "Lots of old code, nothing for three years.", {"Python": ("Working", "Proficient")}, repos=[_repo(f"a/o{i}", {"Python": 900_000}, pushed=OLD) for i in range(8)]),
    Case("claim_contradicted", "conflicting", "Resume says Kubernetes; repositories show only a little Python.", {"Kubernetes": (NOT_ASSESSED, NOT_ASSESSED), "Python": ("Foundational", "Working")}, facts=[_fact("skills", "skill", "Kubernetes")], repos=[_repo("a/s", {"Python": 2000})]),
    Case("topic_tagging", "conflicting", "Five tiny repositories that only tag a topic: a label, not work.", {"Kubernetes": ("Foundational", "Foundational")}, repos=[_repo(f"a/t{i}", {}, ["kubernetes"]) for i in range(5)]),
    Case("one_huge_vendored_repo", "conflicting", "A single very large repository, possibly vendored code.", {"C++": ("Foundational", "Working")}, repos=[_repo("a/vendor", {"C++": 50_000_000})]),
]

# (better, worse, role): the first should cover at least as much of the role as the second.
ROLE_PROFILES = {
    "none": ([], []),
    "listed": ([_fact("skills", "skill", s) for s in ("Python", "Machine Learning", "PyTorch")], []),
    "beginner": ([], [_repo("a/b", {"Python": 3000}, ["machine-learning"])]),
    "intermediate": (_project("p1", "Python", "PyTorch"), [_repo(f"a/m{i}", {"Python": 200_000}, ["pytorch", "machine-learning", "docker", "scikit-learn"]) for i in range(3)]),
    "experienced": (_project("p1", "Python", "PyTorch", "Docker") + _project("p2", "Python", "SQL", "Machine Learning") + _project("p3", "Python", "PyTorch"), [_repo(f"a/e{i}", {"Python": 900_000, "SQL": 90_000}, ["pytorch", "scikit-learn", "docker", "machine-learning", "mlflow", "aws", "statistics", "git"]) for i in range(8)]),
}
RANKING = ["none", "listed", "beginner", "intermediate", "experienced"]


def run(facts: List[Dict[str, Any]], repos: List[Dict[str, Any]], roles: Tuple[str, ...] = ("ml_engineer",)) -> Dict[str, Any]:
    return engine.compute(user={}, roles=list(roles), facts=facts, repos=repos, resources=[], canonical=_canonical, lexicon_scan=_lexicon, categories=_CATEGORIES, now=NOW)


def evaluate() -> Dict[str, Any]:
    rows: List[Dict[str, Any]] = []
    for case in CASES:
        by_name = {s["name"]: s for s in run(case.facts, case.repos)["skills"]}
        for skill, (low, high) in case.expect.items():
            actual = by_name[skill]["level"] if skill in by_name else NOT_ASSESSED
            score = by_name[skill]["proficiency"] if skill in by_name else None
            position = ORDER.index(actual)
            outcome = "false_positive" if position > ORDER.index(high) else "false_negative" if position < ORDER.index(low) else "as_expected"
            rows.append({"case": case.name, "group": case.group, "skill": skill, "expected": f"{low}..{high}", "actual": actual, "score": score, "confidence": by_name[skill]["confidence"] if skill in by_name else 0.0, "outcome": outcome, "why": case.why})

    coverage = {name: run(facts, repos)["roles"][0]["coverage"] for name, (facts, repos) in ROLE_PROFILES.items()}
    ranking_ok = all(coverage[a] <= coverage[b] for a, b in zip(RANKING, RANKING[1:]))
    return {
        "rows": rows,
        "total": len(rows),
        "as_expected": sum(r["outcome"] == "as_expected" for r in rows),
        "false_positives": [f"{r['case']}/{r['skill']}" for r in rows if r["outcome"] == "false_positive"],
        "false_negatives": [f"{r['case']}/{r['skill']}" for r in rows if r["outcome"] == "false_negative"],
        "coverage": coverage,
        "ranking_consistent": ranking_ok,
    }


if __name__ == "__main__":
    report = evaluate()
    for row in report["rows"]:
        print(f"{row['group']:<13}{row['case']:<28}{row['skill']:<18}{row['expected']:<28}{row['actual']:<14}{str(row['score']):<7}{row['confidence']:<6}{row['outcome']}")
    print(json.dumps({k: v for k, v in report.items() if k != "rows"}, indent=2))
