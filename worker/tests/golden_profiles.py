"""Graded golden student profiles for every current role, built from the role's own framework and the real extraction
tables (code_signals.PACKAGE_SKILLS, STRUCTURE_SKILLS, skills_catalog), so they follow the ontology instead of a copy.

Each builder returns (facts, repos). Evidence is synthetic: no real student data. See test_golden_roles.py for the
expectations and scripts/golden_report.py for the role-by-role evaluation matrix.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from intelligence import career_engine as engine  # noqa: E402
from intelligence import code_signals  # noqa: E402
from intelligence.frameworks import FRAMEWORKS, Requirement  # noqa: E402
from intelligence.reachability import routes  # noqa: E402
from skills_catalog import CATALOG  # noqa: E402
from test_career_engine import NOW, OLD, RECENT, RESOURCES, canonical, fact, lexicon, repo, with_login  # noqa: E402

CATEGORIES = {name: cat for name, cat, _a, _amb in CATALOG}
LANGUAGE_NAME = {"Bash": "Shell", "SQL": "PLpgSQL", "CUDA": "Cuda"}  # how GitHub's linguist reports them
STRUCTURE_FLAG = {"Software Testing": "tests", "CI/CD": "ci", "Docker": "dockerfile", "Kubernetes": "kubernetes", "Terraform": "terraform"}

_PACKAGE_FOR: Dict[str, str] = {}
for _pkg, _skills in code_signals.PACKAGE_SKILLS.items():
    for _i, _s in enumerate(_skills):
        # Prefer a package whose primary skill is this one (torch -> PyTorch), else any that maps to it.
        if _s not in _PACKAGE_FOR or (_i == 0 and code_signals.PACKAGE_SKILLS[_PACKAGE_FOR[_s]][0] != _s):
            _PACKAGE_FOR[_s] = _pkg

PRACTICE = engine.PRACTICE_SKILLS


def _described_for(comps: Sequence[str]) -> List[str]:
    """What a capable student would describe in projects: competencies no repository can show, and practices (Docker, CI,
    tests) whose files show set-up but not quality, so the engine needs the description to go past Working."""
    return [c for c in comps if not routes(c) or c in PRACTICE]


LEVEL_RANK = {"not_enough_evidence": 0, "early": 1, "developing": 2, "strong": 3, "requirements_demonstrated": 4}


def core(role: str) -> Tuple[Requirement, ...]:
    return FRAMEWORKS[role].requirements


def required(role: str) -> List[str]:
    return [r.competency for r in core(role) if r.required]


def _signals(packages: Sequence[str], structure: Dict[str, bool], readme: Sequence[str], commits=(30, 30)) -> Dict:
    return {
        "version": 2, "contribution": {"login": "me", "commits": commits[0], "total": commits[1]},
        "manifests": {"requirements.txt": list(packages)} if packages else {},
        "structure": {"tests": False, "ci": False, "dockerfile": False, "kubernetes": False, "terraform": False, "notebooks": 0, **structure},
        "readme": {"present": bool(readme), "chars": 1500, "skills": list(readme)},
    }


def code_evidence_repo(name: str, skills: Sequence[str], pushed=RECENT, quality=True, commits=(30, 30)) -> Dict:
    """One repository whose code shows each skill by every route the extractor has for it."""
    languages = {"Python": 300_000}
    packages, structure, readme = [], {}, []
    for s in skills:
        r = routes(s)
        if "language" in r:
            languages[LANGUAGE_NAME.get(s, s)] = 60_000
        if "package" in r and s in _PACKAGE_FOR:
            packages.append(_PACKAGE_FOR[s])
        if "structure" in r:
            structure[STRUCTURE_FLAG[s]] = True
        if "readme" in r:
            readme.append(s)
    if quality:
        structure.setdefault("tests", True)
        structure.setdefault("ci", True)
    return repo(f"me/{name}", languages, signals=_signals(packages, structure, readme, commits), pushed=pushed)


def project_facts(record: str, title: str, techs: Sequence[str], description: str = "") -> List[Dict]:
    rows = [fact("projects", "title", title, record=record), fact("projects", "technologies", list(techs), record=record)]
    if description:
        rows.append(fact("projects", "description", description, record=record))
    return rows


def described_projects(skills: Sequence[str], n: int = 2) -> List[Dict]:
    return [row for i in range(n) for row in project_facts(f"p{i}", f"Project {i}", skills, "Built and evaluated it end to end.")]


# ─── Profiles ───────────────────────────────────────────────────────────────

def beginner_claims(role: str):
    """Skills section lists every competency the role needs; nothing else."""
    return [fact("skills", "skill", c) for c in (r.competency for r in core(role))], []


def resume_inflated(role: str):
    """Claims plus self-described senior projects in every competency, but no repository or platform evidence."""
    comps = [r.competency for r in core(role)]
    return [fact("skills", "skill", c) for c in comps] + described_projects(comps, n=3), []


def high_activity_low_depth(role: str):
    """Twelve recent Python repositories with no dependency files, tests or documentation: lots of activity, no depth."""
    repos = [repo(f"me/script{i}", {"Python": 40_000}, signals=_signals([], {}, [])) for i in range(12)]
    return [], repos


def intermediate(role: str):
    """One own repository showing the required competencies, without tests or CI."""
    reqs = required(role)
    return described_projects([c for c in reqs if not routes(c)], n=1), [code_evidence_repo("work", reqs, quality=False)]


def advanced_practical(role: str):
    """Four recent own repositories showing every core competency with tests and CI, plus described work for what no
    repository can show. No certifications at all."""
    comps = [r.competency for r in core(role)]
    return described_projects(_described_for(comps), n=3), [code_evidence_repo(f"proj{i}", comps) for i in range(4)]


def outdated(role: str):
    """The advanced profile, but all code was last pushed about 2.5 years ago."""
    facts, _ = advanced_practical(role)
    comps = [r.competency for r in core(role)]
    return facts, [code_evidence_repo(f"old{i}", comps, pushed=OLD) for i in range(4)]


def not_own_code(role: str):
    """The advanced profile's repositories, but the student made 1 of 60 commits in each: not attributable to them."""
    comps = [r.competency for r in core(role)]
    return [], [code_evidence_repo(f"team{i}", comps, commits=(1, 60)) for i in range(4)]


def contradicted(role: str):
    """Claims every competency; repositories only tag them as topics (no code uses them)."""
    comps = [r.competency for r in core(role)]
    topics = [c.lower().replace(" ", "-") for c in comps]
    return [fact("skills", "skill", c) for c in comps], [repo(f"me/tagged{i}", {"Python": 20_000}, topics=topics, signals=_signals([], {}, [])) for i in range(3)]


def missing_prerequisite(role: str):
    """A strong student with no evidence for one required foundation, and only claims for the required competencies that
    build on it (they can't be done well without it). Everything else is the advanced profile. Returns (facts, repos,
    foundation) or None when the role has no such pair, or when other competencies' code legitimately evidences the
    foundation too (torch is Deep Learning evidence), which would make the case unconstructible."""
    from intelligence.frameworks import prerequisites_of
    reqs = required(role)
    for foundation in (c for c in reqs if c != "Python"):
        dependents = [o for o in reqs if o != foundation and foundation in prerequisites_of(o)]
        if not dependents:
            continue
        comps = [r.competency for r in core(role) if r.competency not in {foundation, *dependents}]
        repos = [code_evidence_repo(f"proj{i}", comps) for i in range(4)]
        if any(foundation in _PACKAGE_SKILLS_OF(p) for rp in repos for p in (rp["code_signals"]["manifests"].get("requirements.txt") or [])):
            continue
        facts = described_projects(_described_for(comps), n=3) + [fact("skills", "skill", d) for d in dependents]
        return facts, repos, foundation, dependents
    return None


def _PACKAGE_SKILLS_OF(package: str):
    return code_signals.PACKAGE_SKILLS.get(package, ())


PROFILES = {
    "beginner_claims": beginner_claims,
    "resume_inflated": resume_inflated,
    "high_activity_low_depth": high_activity_low_depth,
    "contradicted": contradicted,
    "not_own_code": not_own_code,
    "intermediate": intermediate,
    "outdated": outdated,
    "advanced_practical": advanced_practical,
}


def run(facts, repos, roles: Sequence[str]):
    out = engine.compute(user={}, roles=list(roles), facts=with_login(facts, repos), repos=list(repos), resources=RESOURCES,
                         canonical=canonical, lexicon_scan=lexicon, categories=CATEGORIES, now=NOW)
    out.pop("_ledger", None)
    return out


def analysis(out, role: str):
    return next(a for a in out["roles"] if a["role"] == role)


def false_expertise(out) -> List[str]:
    """Rows marked met, or skills at Proficient or above, without the evidence the method requires. The invariant:
      met         -> demonstrated evidence, or described work where the requirement accepts it (described tier, or v5's
                     not-code-verifiable rule)
      Proficient+ -> some code evidence (claims and descriptions are capped below it)"""
    bad = []
    for a in out["roles"]:
        for r in a["skills"]:
            if r["state"] != "met":
                continue
            ok = r["evidenceState"] == "demonstrated" or (r["proficiency"] is not None and (r["evidenceRequirement"] == "described" or r.get("codeVerifiable") is False))
            if not ok:
                bad.append(f"{a['role']}/{r['skill']}: met on {r['evidenceState']}")
    for s in out["skills"]:
        if s["proficiency"] is not None and s["proficiency"] >= 50 and s.get("evidenceState") != "demonstrated" and not s.get("assessment"):
            bad.append(f"skill {s['name']}: {s['level']} on {s.get('evidenceState')}")
    return bad
