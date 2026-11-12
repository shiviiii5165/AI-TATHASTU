"""Canonical career-role registry and the structured role frameworks, loaded and validated once.

Data lives in intelligence/frameworks/ so it can be reviewed and updated without touching engine code:
  career_roles.json      every role id the product can store (current + retired), with its label. The web app
                         reads the same file (src/lib/onboarding/catalog.ts), so there is one list.
  role_frameworks.json   versioned competency frameworks: shared competency definitions (with prerequisites and
                         behavioural level criteria) plus, per role, which competencies are required, supporting or
                         part of a named specialisation track, the expected level, the evidence each needs and why
                         the role needs it. Public references that informed each role are listed with URLs.

The frameworks are DRAFT / UNREVIEWED (see `status` and `provenance` in the file). The engine passes that status
through to every assessment so nothing downstream can present it as an industry standard.

Tiers:
  required        decides the role's alignment; needs independent evidence
  supporting      strengthens a candidate; never holds alignment back; described work counts
  specialisation  optional depth in a named track; reported separately and never part of alignment or ERIS
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

_DIR = Path(__file__).with_name("frameworks")

LEVEL_ORDER = ("Foundational", "Working", "Proficient", "Advanced")
# Score floor of each level on the engine's 0-100 proficiency scale (career_engine.LEVELS uses the same floors).
# Foundational needs an assessed score at all (any demonstrated or described use); a mention alone never has one.
LEVEL_FLOOR = {"Foundational": 1, "Working": 25, "Proficient": 50, "Advanced": 75}
TIERS = ("required", "supporting", "specialisation")
CORE_TIERS = ("required", "supporting")
EVIDENCE_REQUIREMENTS = ("independent", "described")


class FrameworkError(ValueError):
    pass


@dataclass(frozen=True)
class Requirement:
    competency: str
    tier: str
    weight: float
    expected_level: str
    evidence_requirement: str
    rationale: str = ""
    track: Optional[str] = None

    @property
    def expected(self) -> int:
        return LEVEL_FLOOR[self.expected_level]

    @property
    def required(self) -> bool:
        return self.tier == "required"


@dataclass(frozen=True)
class RoleFramework:
    role: str
    label: str
    status: str
    responsibilities: Tuple[str, ...]
    project_context: Optional[str]
    requirements: Tuple[Requirement, ...]
    completion_criteria: str
    summary: str = ""
    distinguishing_focus: str = ""
    practical_capabilities: Tuple[str, ...] = ()
    specialisations: Tuple[Dict[str, str], ...] = ()
    references: Tuple[str, ...] = ()
    specialisation_requirements: Tuple[Requirement, ...] = ()


def _load(name: str) -> Dict[str, Any]:
    return json.loads((_DIR / name).read_text(encoding="utf-8"))


REGISTRY: Dict[str, Any] = _load("career_roles.json")
_FRAMEWORKS: Dict[str, Any] = _load("role_frameworks.json")

FRAMEWORK_VERSION: str = _FRAMEWORKS["frameworkVersion"]
FRAMEWORK_STATUS: str = _FRAMEWORKS["status"]
FRAMEWORK_PROVENANCE: Dict[str, Any] = _FRAMEWORKS["provenance"]
LEVEL_DEFINITIONS: Dict[str, str] = _FRAMEWORKS["levels"]
LEVEL_RUBRICS: Dict[str, Dict[str, str]] = _FRAMEWORKS.get("levelRubrics", {})
EVIDENCE_FOR_LEVEL: Dict[str, str] = _FRAMEWORKS.get("evidenceForLevel", {})
TIER_DEFINITIONS: Dict[str, str] = _FRAMEWORKS.get("tiers", {})
COMPETENCIES: Dict[str, Dict[str, Any]] = _FRAMEWORKS["competencies"]
REFERENCES: Dict[str, Dict[str, Any]] = {r["id"]: r for r in FRAMEWORK_PROVENANCE.get("references", [])}

ROLE_LABELS: Dict[str, str] = {r["id"]: r["label"] for r in REGISTRY["roles"]}
CURRENT_ROLES: Tuple[str, ...] = tuple(r["id"] for r in REGISTRY["roles"] if r["status"] == "current")
RETIRED_ROLES: Tuple[str, ...] = tuple(r["id"] for r in REGISTRY["roles"] if r["status"] == "retired")


def _req(c: Dict[str, Any]) -> Requirement:
    return Requirement(c["competency"], c["tier"], float(c["weight"]), c["expectedLevel"], c["evidenceRequirement"], c.get("rationale", ""), c.get("track"))


def _build() -> Dict[str, RoleFramework]:
    out: Dict[str, RoleFramework] = {}
    for role, f in _FRAMEWORKS["roles"].items():
        reqs = [_req(c) for c in f["competencies"]]
        out[role] = RoleFramework(
            role, f["label"], f["status"], tuple(f["responsibilities"]), f.get("projectContext"),
            tuple(r for r in reqs if r.tier in CORE_TIERS), f["completionCriteria"],
            summary=f.get("summary", ""), distinguishing_focus=f.get("distinguishingFocus", ""),
            practical_capabilities=tuple(f.get("practicalCapabilities", [])),
            specialisations=tuple(f.get("specialisations", [])), references=tuple(f.get("references", [])),
            specialisation_requirements=tuple(r for r in reqs if r.tier == "specialisation"),
        )
    return out


FRAMEWORKS: Dict[str, RoleFramework] = _build()


def _cycles() -> List[str]:
    """Prerequisite cycles, as 'A -> B -> A' strings. The roadmap orders by prerequisites, so a cycle is a data error."""
    found: List[str] = []
    state: Dict[str, int] = {}

    def visit(name: str, path: List[str]) -> None:
        if state.get(name) == 2:
            return
        if state.get(name) == 1:
            found.append(" -> ".join(path[path.index(name):] + [name]))
            return
        state[name] = 1
        for p in COMPETENCIES.get(name, {}).get("prerequisites", []):
            visit(p, path + [name])
        state[name] = 2

    for name in COMPETENCIES:
        visit(name, [])
    return found


def validate() -> List[str]:
    """Every structural rule the data must keep. Returns problems; empty means valid. Run at import and in tests."""
    problems: List[str] = []
    ids = [r["id"] for r in REGISTRY["roles"]]
    if len(ids) != len(set(ids)):
        problems.append("duplicate role id in registry")
    for c_name, c in COMPETENCIES.items():
        for p in c.get("prerequisites", []):
            if p not in COMPETENCIES:
                problems.append(f"{c_name}: unknown prerequisite {p}")
        if not c.get("description") or not c.get("demonstration"):
            problems.append(f"{c_name}: missing description or demonstration")
        for level in c.get("levelCriteria", {}):
            if level not in LEVEL_FLOOR:
                problems.append(f"{c_name}: unknown level {level} in levelCriteria")
    problems += [f"prerequisite cycle: {c}" for c in _cycles()]
    for ref_id, ref in REFERENCES.items():
        if not str(ref.get("url", "")).startswith("https://") or not ref.get("checkedAt"):
            problems.append(f"reference {ref_id}: needs an https URL and a check date")
    for role in CURRENT_ROLES:
        f = FRAMEWORKS.get(role)
        if not f:
            problems.append(f"{role}: current role has no framework")
            continue
        if not f.responsibilities:
            problems.append(f"{role}: no responsibilities")
        if not any(r.required for r in f.requirements):
            problems.append(f"{role}: no required competency")
        for ref_id in f.references:
            if ref_id not in REFERENCES:
                problems.append(f"{role}: unknown reference {ref_id}")
        tracks = {s["track"] for s in f.specialisations}
        core = {r.competency: r for r in f.requirements}
        seen = set()
        for r in f.specialisation_requirements:
            if r.track not in tracks:
                problems.append(f"{role}/{r.competency}: specialisation track {r.track!r} is not declared")
            if (r.track, r.competency) in seen:
                problems.append(f"{role}/{r.competency}: duplicate in track {r.track}")
            seen.add((r.track, r.competency))
            if r.competency in core and LEVEL_FLOOR[r.expected_level] <= core[r.competency].expected:
                problems.append(f"{role}/{r.competency}: a specialisation must ask for more than the role's core level")
    for role, f in FRAMEWORKS.items():
        if role not in ROLE_LABELS:
            problems.append(f"{role}: framework for a role not in the registry")
        elif f.label != ROLE_LABELS[role]:
            problems.append(f"{role}: framework label differs from the registry")
        names = [r.competency for r in f.requirements]
        if len(names) != len(set(names)):
            problems.append(f"{role}: duplicate competency")
        for r in (*f.requirements, *f.specialisation_requirements):
            if r.competency not in COMPETENCIES:
                problems.append(f"{role}: unknown competency {r.competency}")
            if r.tier not in TIERS or r.expected_level not in LEVEL_FLOOR or r.evidence_requirement not in EVIDENCE_REQUIREMENTS:
                problems.append(f"{role}/{r.competency}: invalid tier, level or evidence requirement")
    return problems


_problems = validate()
if _problems:
    raise FrameworkError("; ".join(_problems))


def framework_for(role: str) -> Optional[RoleFramework]:
    return FRAMEWORKS.get(role)


def prerequisites_of(competency: str) -> List[str]:
    return list(COMPETENCIES.get(competency, {}).get("prerequisites", []))


def level_criteria(competency: str, kind: str) -> Dict[str, str]:
    """Behavioural criteria per level: the competency's own where written, else the rubric for its kind of skill."""
    own = COMPETENCIES.get(competency, {}).get("levelCriteria")
    if own:
        return dict(own)
    return dict(LEVEL_RUBRICS.get(kind) or LEVEL_RUBRICS.get("concept") or LEVEL_DEFINITIONS)


def references_for(role: str) -> List[Dict[str, Any]]:
    f = FRAMEWORKS.get(role)
    return [REFERENCES[r] for r in (f.references if f else ()) if r in REFERENCES]


def framework_meta() -> Dict[str, Any]:
    """What every assessment carries so its basis is never misrepresented."""
    return {
        "version": FRAMEWORK_VERSION, "status": FRAMEWORK_STATUS, "basis": FRAMEWORK_PROVENANCE["basis"],
        "reviewed": FRAMEWORK_PROVENANCE["reviewedBy"] is not None, "draftedAt": FRAMEWORK_PROVENANCE.get("draftedAt"),
        "evidenceForLevel": EVIDENCE_FOR_LEVEL, "tiers": TIER_DEFINITIONS,
    }
