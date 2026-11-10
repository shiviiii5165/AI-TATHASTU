"""Canonical career-role registry and the structured role frameworks, loaded and validated once.

Data lives in intelligence/frameworks/ so it can be reviewed and updated without touching engine code:
  career_roles.json      every role id the product can store (current + retired), with its label. The web app
                         reads the same file (src/lib/onboarding/catalog.ts), so there is one list.
  role_frameworks.json   versioned competency frameworks: shared competency definitions plus, per role, which
                         competencies are required or supporting, the expected level and the evidence each needs.

The frameworks are DRAFT / UNREVIEWED (see `status` and `provenance` in the file). The engine passes that status
through to every assessment so nothing downstream can present it as an industry standard.
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
TIERS = ("required", "supporting")
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


def _load(name: str) -> Dict[str, Any]:
    return json.loads((_DIR / name).read_text(encoding="utf-8"))


REGISTRY: Dict[str, Any] = _load("career_roles.json")
_FRAMEWORKS: Dict[str, Any] = _load("role_frameworks.json")

FRAMEWORK_VERSION: str = _FRAMEWORKS["frameworkVersion"]
FRAMEWORK_STATUS: str = _FRAMEWORKS["status"]
FRAMEWORK_PROVENANCE: Dict[str, Any] = _FRAMEWORKS["provenance"]
LEVEL_DEFINITIONS: Dict[str, str] = _FRAMEWORKS["levels"]
COMPETENCIES: Dict[str, Dict[str, Any]] = _FRAMEWORKS["competencies"]

ROLE_LABELS: Dict[str, str] = {r["id"]: r["label"] for r in REGISTRY["roles"]}
CURRENT_ROLES: Tuple[str, ...] = tuple(r["id"] for r in REGISTRY["roles"] if r["status"] == "current")
RETIRED_ROLES: Tuple[str, ...] = tuple(r["id"] for r in REGISTRY["roles"] if r["status"] == "retired")


def _build() -> Dict[str, RoleFramework]:
    out: Dict[str, RoleFramework] = {}
    for role, f in _FRAMEWORKS["roles"].items():
        reqs = tuple(
            Requirement(c["competency"], c["tier"], float(c["weight"]), c["expectedLevel"], c["evidenceRequirement"])
            for c in f["competencies"]
        )
        out[role] = RoleFramework(role, f["label"], f["status"], tuple(f["responsibilities"]), f.get("projectContext"), reqs, f["completionCriteria"])
    return out


FRAMEWORKS: Dict[str, RoleFramework] = _build()


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
    for role in CURRENT_ROLES:
        f = FRAMEWORKS.get(role)
        if not f:
            problems.append(f"{role}: current role has no framework")
            continue
        if not f.responsibilities:
            problems.append(f"{role}: no responsibilities")
        if not any(r.required for r in f.requirements):
            problems.append(f"{role}: no required competency")
    for role, f in FRAMEWORKS.items():
        if role not in ROLE_LABELS:
            problems.append(f"{role}: framework for a role not in the registry")
        elif f.label != ROLE_LABELS[role]:
            problems.append(f"{role}: framework label differs from the registry")
        names = [r.competency for r in f.requirements]
        if len(names) != len(set(names)):
            problems.append(f"{role}: duplicate competency")
        for r in f.requirements:
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


def framework_meta() -> Dict[str, Any]:
    """What every assessment carries so its basis is never misrepresented."""
    return {"version": FRAMEWORK_VERSION, "status": FRAMEWORK_STATUS, "basis": FRAMEWORK_PROVENANCE["basis"], "reviewed": FRAMEWORK_PROVENANCE["reviewedBy"] is not None}
