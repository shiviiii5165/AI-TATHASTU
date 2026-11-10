"""Student ↔ mentor matching (compute_matches). Pure scoring; I/O is in
intelligence/matches.py.

Alumni → student: the alum's current role (company, job title, closest area)
against the student's target roles, boosted when they went to the same
university (normalized institution_id) and when the alum offers referrals.

Faculty → student: research interests against the student's skills, the same
specialization (specialization_id), and the directions the faculty member
mentors in. Faculty with no mentoring capacity aren't matched.

Each pair gets a 0–1 score and short reasons shown on the dashboards.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple

MIN_SCORE = 0.2
MAX_PER_STUDENT = 20

# id → label from the canonical registry (intelligence/frameworks/career_roles.json), shared with the web app.
from intelligence.frameworks import ROLE_LABELS  # noqa: E402

STOP = {"and", "of", "the", "in", "for", "to", "a", "an", "with", "on", "engineer", "engineering", "senior", "staff",
        "lead", "principal", "junior", "intern", "learning"}
# "learning" is a stop word so "machine learning" vs "deep learning" doesn't count as overlap by itself.


def tokens(text: Optional[str]) -> Set[str]:
    words = re.findall(r"[a-z0-9+#]+", (text or "").lower())
    return {w for w in words if w not in STOP and len(w) > 1}


@dataclass
class Student:
    id: str
    roles: List[str]  # career_roles, primary first
    skills: List[str]
    institution_id: Optional[str] = None
    institution_name: Optional[str] = None
    specialization_id: Optional[str] = None
    specialization_name: Optional[str] = None


@dataclass
class Alum:
    id: str
    company: Optional[str]
    job_title: Optional[str]
    career_role: Optional[str]
    institution_id: Optional[str] = None
    specialization_id: Optional[str] = None
    give_back: Dict[str, bool] = field(default_factory=dict)


@dataclass
class Faculty:
    id: str
    interests: List[str]
    expertise_areas: List[str]
    capacity: int
    institution_id: Optional[str] = None
    specialization_id: Optional[str] = None


def _role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role.replace("_", " "))


def score_alum(alum: Alum, student: Student) -> Tuple[float, List[str]]:
    score, reasons = 0.0, []
    where = f" at {alum.company}" if alum.company else ""
    title = alum.job_title or (_role_label(alum.career_role) if alum.career_role else None)

    # Role fit: the alum works in (or close to) a role the student is aiming for.
    if alum.career_role and student.roles and alum.career_role == student.roles[0]:
        score += 0.45
        reasons.append(f"Works as {title}{where}, your primary goal")
    elif alum.career_role and alum.career_role in student.roles:
        score += 0.35
        reasons.append(f"Works as {title}{where}, one of your goals")
    elif alum.job_title and any(tokens(alum.job_title) & tokens(_role_label(r)) for r in student.roles):
        score += 0.25
        reasons.append(f"Works as {alum.job_title}{where}, close to your goals")

    # Same university (normalized ids, not free text).
    if alum.institution_id and alum.institution_id == student.institution_id:
        score += 0.3
        reasons.append(f"Also from {student.institution_name}" if student.institution_name else "Same university")
    if alum.specialization_id and alum.specialization_id == student.specialization_id:
        score += 0.1
        reasons.append(f"Same specialization ({student.specialization_name})" if student.specialization_name else "Same specialization")
    if score > 0 and alum.give_back.get("refer") and alum.company:
        score += 0.1
        reasons.append(f"Open to referrals at {alum.company}")
    return min(round(score, 3), 1.0), reasons


def score_faculty(fac: Faculty, student: Student) -> Tuple[float, List[str]]:
    if fac.capacity <= 0:
        return 0.0, []
    score, reasons = 0.0, []

    # Research interests ∩ the student's evidenced skills.
    skill_tokens = {s: tokens(s) for s in student.skills}
    hits: List[Tuple[str, str]] = []
    for interest in fac.interests:
        it = tokens(interest)
        for skill, st in skill_tokens.items():
            if it and st and (it & st or interest.lower() in skill.lower() or skill.lower() in interest.lower()):
                hits.append((interest, skill))
                break
    if hits:
        score += min(len(hits), 2) * 0.225
        interest, skill = hits[0]
        reasons.append(f"Researches {interest}, close to your {skill}" if interest.lower() != skill.lower() else f"Researches {interest}, a skill of yours")
        if len(hits) > 1:
            reasons.append(f"{len(hits)} research interests overlap your skills")

    if fac.specialization_id and fac.specialization_id == student.specialization_id:
        score += 0.25
        reasons.append(f"Same field ({student.specialization_name})" if student.specialization_name else "Same field")
    areas = [r for r in student.roles if r in fac.expertise_areas]
    if areas:
        score += 0.2
        reasons.append(f"Mentors students heading to {_role_label(areas[0])}")
    if score > 0 and fac.institution_id and fac.institution_id == student.institution_id:
        score += 0.1
        reasons.append("At your university")
    return min(round(score, 3), 1.0), reasons
