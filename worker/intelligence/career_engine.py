"""One evidence model behind Skill Proficiency, Skill Gaps, Learning Paths, Career Roadmap and the Skill Graph.

Pure and deterministic: no database, no network, no LLM. The same evidence gives the same
output, so every number can be explained and tested, and nothing can be invented.

SCORING (version in ENGINE_VERSION; bump it when any of this changes)

A skill's status says how we know it:
  verified  shown by a source we read directly: repositories, or platform results
  claimed   only the user's own resume or profile says so
  inferred  a related skill suggests it; nothing shows it, and it never gets a score

Proficiency is 0-100, or None ("Not assessed"). Only demonstrated use earns points:
  repositories using it   40 x min(1, repos / 5)
  code volume             15 x min(1, log10(bytes) / 6)   languages only; GitHub reports no other sizes
  recency of that code    (15 if pushed within 6 months, 7.5 within 18) x min(1, repos / 5)
  described in projects, jobs or platform activity   25 x min(1, records / 3)
  verified certification  +5, and only on top of the above: supporting, never proof alone
  platform assessment     raises the score to stars / 5 x 100 if that is higher

A skill-list mention earns nothing, which is what "Not assessed" means. A certification named on a
resume is a claimed credential and earns nothing; a completed course is learning and earns nothing.
A score resting only on the user's own descriptions is capped at 49, since nothing independent backs
it. Repository metadata alone tops out at 70 (Proficient): we don't read source code, so Advanced
also needs described work or an assessment.

Evidence state of a skill (separate from its level):
  demonstrated  a source we read ourselves shows it (repositories, platform activity, assessments)
  unverified    only the student's own descriptions of projects or work show it
  claimed       only listed (skills list, claimed certification, course)
  inferred      only suggested by related skills

Per role (framework in intelligence/frameworks/role_frameworks.json, DRAFT / UNREVIEWED), each
competency is `met` only when its level reaches the expected level AND its evidence meets the
framework's requirement: required competencies need demonstrated evidence; supporting ones accept
described work. The role's alignment state follows explicit rules over its required competencies
(see `alignment`); a count of matching keywords, or many weak sources, can't raise it.

Measures, never blended:
  proficiency  how well the evidence says you use the skill
  confidence   how much evidence there is, from how many independent kinds of source
  alignment    per role: a rule-based state, never shown as a percentage
  coverage     per role, internal only: the weight share of competencies met (kept for older readers)

These weights and the role framework are our own judgement, written down so they can be
challenged. They are not an industry standard or job-market data.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple

from intelligence.frameworks import COMPETENCIES, LEVEL_FLOOR, ROLE_LABELS, RoleFramework, framework_for, framework_meta
from intelligence.skill_graph import SKILL_ONTOLOGY, determine_relationship

# 2: specialist skills and role-specific frameworks for the 20-direction catalog; stable milestone ids.
# 3: structured draft frameworks (required/supporting tiers, evidence requirements), evidence states, alignment
#    states instead of a coverage percentage, gap types and priority reasons, roadmap without time estimates,
#    claimed vs verified certifications, course completion as learning (never proficiency).
ENGINE_VERSION = 3
MAX_EVIDENCE_PER_SKILL = 8
MAX_GRAPH_NODES = 18
UNVERIFIED_CAP = 49
LEVELS = ((75, "Advanced"), (50, "Proficient"), (25, "Working"), (0, "Foundational"))

# Platforms whose data we read directly, rather than the user's own account of themselves.
VERIFIED_ORIGINS = {"kaggle", "stack_exchange", "leetcode", "hackerrank"}
CLAIM_ORIGINS = {"resume", "user_entered", "linkedin_scrape", "linkedin_oidc", "portfolio", "orcid"}

# Planning: no time estimates. We don't know how many hours a student has, so a date or week count would be invented.
ROADMAP_BASIS = "Ordered by what each skill builds on and how central it is to your goal. No time estimates: they'd depend on hours we don't know you have."
# What scripts/check_learning_links.py last found. A course is offered only if its check says "ok"
# for the same URL the catalogue holds; anything else means no course, and the UI says so.
RESOURCE_CHECKS: Dict[str, Dict[str, Any]] = json.loads((Path(__file__).with_name("resource_checks.json")).read_text(encoding="utf-8"))["resources"]
LINK_STALE_DAYS = 90

# Skill -> catalogue courses, by exact learning_resources.title, best first. `difficulty` is our own
# reading of the course.
COURSES: Dict[str, List[Tuple[str, str]]] = {
    "Machine Learning": [("Machine Learning Specialization", "Foundational")],
    "scikit-learn": [("Machine Learning Specialization", "Foundational")],
    "Deep Learning": [("Deep Learning Specialization", "Intermediate"), ("Practical Deep Learning for Coders", "Intermediate")],
    "PyTorch": [("Practical Deep Learning for Coders", "Intermediate")],
    "Large Language Models": [("Generative AI with Large Language Models", "Intermediate")],
    "Fine-tuning": [("Generative AI with Large Language Models", "Intermediate")],
    "Generative AI": [("Generative AI with Large Language Models", "Intermediate")],
    "Hugging Face Transformers": [("Hugging Face Transformers & Diffusion Course", "Intermediate")],
    "Natural Language Processing": [("CS224N: Natural Language Processing with Deep Learning", "Advanced")],
    "Transformers (architecture)": [("CS25: Transformers United", "Advanced")],
    "Computer Vision": [("CS231n: Deep Learning for Computer Vision", "Advanced")],
    "Convolutional Neural Networks": [("CS231n: Deep Learning for Computer Vision", "Advanced")],
    "Reinforcement Learning": [("Deep Reinforcement Learning Course", "Intermediate"), ("Reinforcement Learning Specialization", "Intermediate")],
    "MLflow": [("Machine Learning Engineering for Production (MLOps)", "Intermediate")],
    "CUDA": [("CUDA Mode & GPU Kernel Programming", "Advanced")],
    "SQL": [("Advanced SQL for Data Scientists & Analysts", "Intermediate")],
    "Linear Algebra": [("Mathematics for Machine Learning Specialization", "Foundational"), ("Computational Linear Algebra for Coders", "Intermediate")],
    "Statistics": [("Statistical Inference and Hypothesis Testing", "Intermediate")],
    "AWS": [("Cloud Computing Specialization: AWS & GCP", "Intermediate")],
}

# What to be comfortable with first, from the competency definitions. Ordering only applies within a role's own skills.
PREREQUISITES: Dict[str, List[str]] = {name: list(c["prerequisites"]) for name, c in COMPETENCIES.items() if c.get("prerequisites")}


def level_for(score: Optional[float]) -> str:
    if score is None:
        return "Not assessed"
    return next(name for floor, name in LEVELS if score >= floor)


def priority_for(weight: float) -> str:
    """Display bucket for a framework weight. Ordering itself uses `_priority_key`, not this."""
    return "High" if weight >= 0.8 else "Medium" if weight >= 0.6 else "Low"


# ─── Evidence → skills ──────────────────────────────────────────────────────


@dataclass
class _Tally:
    name: str
    category: str = "other"
    repos: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    bytes: int = 0
    last_push: Optional[datetime] = None
    described: Set[str] = field(default_factory=set)
    platform: Set[str] = field(default_factory=set)
    claimed: bool = False
    certified: bool = False  # a verified certification
    credential_claimed: bool = False  # a certification only named by the student
    courses: Set[str] = field(default_factory=set)  # courses the student says they completed
    assessment: Optional[float] = None
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    fact_refs: List[Tuple[str, str]] = field(default_factory=list)  # (fact id, origin): the authoritative ledger

    def add(self, kind: str, source: str, label: str, ref: Any, at: Any, fact: bool = False) -> None:
        self.evidence.append({"kind": kind, "source": source, "label": str(label)[:140], "ref": str(ref) if ref else None, "at": _iso(at)})
        if fact and ref and (str(ref), source) not in self.fact_refs:
            self.fact_refs.append((str(ref), source))


def _iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    return value if isinstance(value, str) else None


def _as_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(v) for v in value]
    return [v.strip() for v in str(value or "").replace(";", ",").replace("|", ",").split(",") if v.strip()]


def _record_titles(facts: Iterable[Dict[str, Any]]) -> Dict[Tuple[str, str], str]:
    titles: Dict[Tuple[str, str], str] = {}
    for f in facts:
        if f["field_name"] in ("title", "role", "name", "organization") and f.get("record_key"):
            titles.setdefault((f["field_group"], f["record_key"]), str(f["normalized_value"]))
    return titles


def build_skills(
    facts: List[Dict[str, Any]],
    repos: List[Dict[str, Any]],
    canonical: Callable[[str], Optional[str]],
    lexicon_scan: Callable[[str], List[str]],
    categories: Dict[str, str],
    now: datetime,
    learning: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Dict[str, Any]]:
    tallies: Dict[str, _Tally] = {}

    def tally(mention: str) -> Optional[_Tally]:
        name = canonical(mention)
        if not name:
            return None
        return tallies.setdefault(name, _Tally(name=name, category=categories.get(name, "other")))

    for repo in repos:
        pushed = repo.get("last_commit_at")
        languages = repo.get("languages") or {}
        mentions = [(lang, int(size) if isinstance(size, (int, float)) else 0) for lang, size in languages.items()]
        # Topics are free-form tags ("awesome-list"), so only known skills count, and GitHub hyphenates them.
        spelled = [str(topic).replace("-", " ") for topic in (repo.get("topics") or [])] + [str(topic) for topic in (repo.get("topics") or [])]
        mentions += sorted({(canonical(topic), 0) for topic in spelled if categories.get(canonical(topic) or "", "other") != "other"})
        mentions += [(name, 0) for name in lexicon_scan(str(repo.get("description") or ""))]
        for mention, size in mentions:
            t = tally(mention)
            if not t:
                continue
            key = str(repo.get("id") or repo.get("repo_name"))
            if key not in t.repos:
                t.repos[key] = repo
                t.add("repository", "github", repo.get("repo_name") or "Repository", repo.get("url"), pushed)
            t.bytes += size
            if isinstance(pushed, datetime) and (t.last_push is None or pushed > t.last_push):
                t.last_push = pushed

    titles = _record_titles(facts)
    for f in facts:
        group, name, value, origin = f["field_group"], f["field_name"], f["normalized_value"], f["origin"]
        at, ref = f.get("created_at"), f.get("id")
        record = f.get("record_key")
        if origin == "github":
            continue  # the repositories above are the source, and they carry sizes and dates
        if group == "skills" and name == "skill":
            t = tally(str(value))
            if not t:
                continue
            if origin in VERIFIED_ORIGINS:
                t.platform.add(f"{origin}:{record}")
                t.add("platform", origin, f.get("source_evidence") or f"Activity on {origin}", ref, at, fact=True)
            else:
                t.claimed = True
                t.add("claim", origin, "Listed in your skills", ref, at, fact=True)
        elif group == "projects" and name == "technologies":
            for tech in _as_list(value):
                t = tally(tech)
                if t and f"project:{record}" not in t.described:
                    t.described.add(f"project:{record}")
                    t.add("project", origin, titles.get(("projects", record or ""), "Project"), ref, at, fact=True)
        elif group in ("experience", "projects") and name == "description":
            for skill in lexicon_scan(str(value)):
                t = tally(skill)
                if t and f"{group}:{record}" not in t.described and f"project:{record}" not in t.described:
                    t.described.add(f"{group}:{record}")
                    t.add("experience" if group == "experience" else "project", origin, titles.get((group, record or ""), group.title()), ref, at, fact=True)
        elif group == "certifications" and name == "name":
            # Named on a resume or profile: a claimed credential. It never adds points.
            for skill in lexicon_scan(str(value)):
                t = tally(skill)
                if t:
                    t.credential_claimed = True
                    t.add("certification", origin, f"{value} (certification you listed)", ref, at, fact=True)
        elif record == "hackerrank:stats" and isinstance(f.get("extracted_value"), dict):
            for badge, stars in (f["extracted_value"].get("badges") or {}).items():
                t = tally(str(badge).replace("Problem Solving", "Data Structures and Algorithms"))
                if t and isinstance(stars, (int, float)) and stars > 0:
                    t.assessment = max(t.assessment or 0, min(100.0, stars / 5 * 100))
                    t.add("assessment", "hackerrank", f"{badge}: {stars} of 5 stars", ref, at, fact=True)

    for rec in learning or []:
        # Only completed courses and certifications say anything about a skill; a started or recommended
        # course must not create one.
        if not (rec["kind"] == "certification" or (rec["kind"] == "course" and rec.get("status") == "completed")):
            continue
        skills = list(rec.get("skills") or []) or lexicon_scan(str(rec.get("title") or ""))
        for skill in skills:
            t = tally(str(skill))
            if not t:
                continue
            at = rec.get("completed_at") or rec.get("created_at")
            if rec["kind"] == "certification" and rec.get("verification") == "verified":
                t.certified = True
                t.add("certification", rec.get("source") or "learning_record", f"{rec['title']} (verified certification)", rec.get("id"), at)
            elif rec["kind"] == "certification":
                t.credential_claimed = True
                t.add("certification", rec.get("source") or "learning_record", f"{rec['title']} (certification, not verified)", rec.get("id"), at)
            elif rec["kind"] == "course" and rec.get("status") == "completed":
                t.courses.add(str(rec.get("id") or rec["title"]))
                t.add("course", rec.get("source") or "learning_record", f"Completed course: {rec['title']}", rec.get("id"), at)

    return {name: _score(t, now) for name, t in tallies.items()}


def _score(t: _Tally, now: datetime) -> Dict[str, Any]:
    verified_activity = len(t.platform)
    demonstrated_records = len(t.described) + verified_activity
    has_independent = bool(t.repos or t.platform or t.assessment is not None)

    score: Optional[float] = None
    parts: Dict[str, float] = {}
    if t.repos or demonstrated_records or t.assessment is not None:
        if t.repos:
            parts["repositories"] = round(40 * min(1.0, len(t.repos) / 5), 1)
        if t.bytes > 0:
            parts["codeVolume"] = round(15 * min(1.0, math.log10(t.bytes) / 6), 1)
        if t.last_push is not None:
            pushed = t.last_push if t.last_push.tzinfo else t.last_push.replace(tzinfo=timezone.utc)
            months = (now - pushed).days / 30.4
            # In proportion to how much there is: one fresh tiny repository isn't sustained use.
            recency = round((15 if months <= 6 else 7.5 if months <= 18 else 0) * min(1.0, len(t.repos) / 5), 1)
            if recency:
                parts["recency"] = recency
        if demonstrated_records:
            parts["described"] = round(25 * min(1.0, demonstrated_records / 3), 1)
        if t.certified:
            parts["certification"] = 5.0
        score = sum(parts.values())
        if not has_independent:
            score = min(score, UNVERIFIED_CAP)
        if t.assessment is not None and t.assessment > score:
            parts["assessment"] = t.assessment
            score = t.assessment
        score = round(min(100.0, score), 1)

    kinds = sum([bool(t.repos), bool(t.described), bool(t.platform), t.assessment is not None, t.claimed, t.certified or t.credential_claimed, bool(t.courses)])
    confidence = {0: 0.0, 1: 0.35, 2: 0.6, 3: 0.8}.get(kinds, 0.9)
    if not has_independent:
        confidence = min(confidence, 0.35)

    evidence_state = "demonstrated" if has_independent else "unverified" if t.described else "claimed"
    evidence = sorted(t.evidence, key=lambda e: e["at"] or "", reverse=True)
    return {
        "name": t.name,
        "category": t.category,
        "status": "verified" if has_independent else "claimed",
        "evidenceState": evidence_state,
        "proficiency": score,
        "level": level_for(score),
        "confidence": confidence,
        "scoreParts": parts,
        "evidenceCount": len(t.evidence),
        "evidence": evidence[:MAX_EVIDENCE_PER_SKILL],
        "lastEvidenceAt": next((e["at"] for e in evidence if e["at"]), None),
        "credential": "verified" if t.certified else "claimed" if t.credential_claimed else None,
        "coursesCompleted": len(t.courses),
        "_factRefs": t.fact_refs,
    }


def infer_skills(skills: Dict[str, Dict[str, Any]], canonical: Callable[[str], Optional[str]]) -> Dict[str, Dict[str, Any]]:
    """What the ontology suggests from demonstrated skills. A pointer, never a score, and never from a claim alone."""
    found: Dict[str, Dict[str, Any]] = {}
    for name, skill in skills.items():
        if skill["proficiency"] is None:
            continue
        for target, _weight in SKILL_ONTOLOGY.get(name, []):
            resolved = canonical(target) or target
            if resolved in skills:
                continue
            entry = found.setdefault(resolved, {
                "name": resolved, "category": "other", "status": "inferred", "evidenceState": "inferred", "proficiency": None,
                "level": "Not assessed", "confidence": 0.0, "scoreParts": {}, "evidenceCount": 0, "evidence": [], "lastEvidenceAt": None,
                "credential": None, "coursesCompleted": 0, "inferredFrom": [],
            })
            entry["inferredFrom"].append(name)
    return found


# ─── Role gaps ──────────────────────────────────────────────────────────────

GAP_TYPE = {
    "met": "completed",
    "underdeveloped": "insufficient_proficiency",
    "missing": "missing_competency",
    "inferred": "insufficient_evidence",
    "not_assessed": "not_assessed",
}

EVIDENCE_NEEDED = {
    "independent": "work we can see for ourselves: a public repository, platform activity or an assessment",
    "described": "a project or work experience that uses it, or work we can see for ourselves",
}


def _action(state: str, gap_type: str, skill: str) -> Optional[str]:
    """Student-facing next step for a competency row. The concrete project is in the row's `demonstration`."""
    if state == "met":
        return None
    if state == "not_assessed":
        return "Add a resume or connect GitHub so this can be assessed."
    if gap_type == "claimed_unverified":
        return f"We found {skill} in your profile, but need proof of practical use."
    if gap_type == "insufficient_evidence" and state == "unverified":
        return f"Your own descriptions show {skill}; now make the work visible, for example in a public repository."
    if state == "inferred":
        return f"Your related skills suggest {skill}, but nothing shows it yet. Build something that uses it directly."
    if state == "underdeveloped":
        return f"You've started using {skill}. Build a more substantial project to show the next level."
    return f"Learn {skill}, then build something that shows it."


def _why_matters(fw: RoleFramework, req_tier: str, skill: str, prerequisite_for: List[str]) -> str:
    role = fw.label
    head = f"A required skill for {role}" if req_tier == "required" else f"A supporting skill for {role}"
    desc = COMPETENCIES.get(skill, {}).get("description", "").rstrip(".")
    tail = f"; {', '.join(prerequisite_for)} build{'s' if len(prerequisite_for) == 1 else ''} on it" if prerequisite_for else ""
    return f"{head}. {desc or skill}{tail}."


def _priority_key(row: Dict[str, Any]) -> Tuple:
    """Required before supporting; then what unblocks the most other open skills; then importance; then shortfall."""
    return (0 if row["tier"] == "required" else 1, -len(row["unblocks"]), -row["weight"], -(row["expected"] - (row["proficiency"] or 0)), row["skill"])


def _priority_reason(row: Dict[str, Any]) -> str:
    parts = ["Required for this goal" if row["tier"] == "required" else "Supporting skill (optional for the goal)"]
    if row["unblocks"]:
        parts.append(f"needed before {', '.join(row['unblocks'])}")
    if row["proficiency"] is None:
        parts.append("no assessed evidence yet")
    elif row["proficiency"] < row["expected"]:
        parts.append(f"currently {row['level']}, expected {row['expectedLevel']}")
    else:
        parts.append("level reached but needs work we can see for ourselves")
    return "; ".join(parts) + "."


ALIGNMENT_LABELS = {
    "not_enough_evidence": "Not enough evidence to assess",
    "early": "Early alignment",
    "developing": "Developing alignment",
    "strong": "Strong alignment",
    "requirements_demonstrated": "Requirements adequately demonstrated",
}

ALIGNMENT_RULES = (
    "not_enough_evidence: nothing to read yet, or no competency in the framework has any evidence (even a claim). "
    "requirements_demonstrated: every required competency is met (expected level, demonstrated evidence). "
    "strong: every required competency has an assessed level, at least half are met, and every required competency with no "
    "required prerequisite (the foundations) is met. "
    "developing: at least one required competency is met, or at least half have an assessed level. "
    "early: anything else with some evidence. Supporting competencies never raise the state."
)


def alignment(rows: List[Dict[str, Any]], has_evidence_base: bool) -> Dict[str, Any]:
    """The role-alignment state, by the documented ALIGNMENT_RULES. Counts competencies, never evidence volume."""
    required = [r for r in rows if r["tier"] == "required"]
    names = {r["skill"] for r in required}
    met = [r for r in required if r["state"] == "met"]
    assessed = [r for r in required if r["proficiency"] is not None]
    foundations = [r for r in required if not (set(PREREQUISITES.get(r["skill"], [])) & names)]
    any_evidence = any(r["hasEvidence"] for r in rows)

    if not has_evidence_base or not any_evidence:
        state = "not_enough_evidence"
    elif len(met) == len(required):
        state = "requirements_demonstrated"
    elif len(assessed) == len(required) and 2 * len(met) >= len(required) and all(r["state"] == "met" for r in foundations):
        state = "strong"
    elif met or 2 * len(assessed) >= len(required):
        state = "developing"
    else:
        state = "early"

    critical = [r["skill"] for r in sorted(required, key=_priority_key) if r["state"] != "met" and r["proficiency"] is None]
    return {
        "state": state,
        "label": ALIGNMENT_LABELS[state],
        "required": len(required),
        "requiredMet": len(met),
        "requiredAssessed": len(assessed),
        "requiredClaimedOnly": sum(1 for r in required if r["gapType"] == "claimed_unverified"),
        "requiredMissing": sum(1 for r in required if r["state"] == "missing"),
        "supportingMet": sum(1 for r in rows if r["tier"] == "supporting" and r["state"] == "met"),
        "supporting": sum(1 for r in rows if r["tier"] == "supporting"),
        "criticalGaps": critical,
        "foundationsMet": all(r["state"] == "met" for r in foundations),
    }


# ─── ERIS — Intelligence Score ──────────────────────────────────────────────
#
# How much of the selected role's competency framework the student's evidence currently backs, 0-100.
# For each framework competency (counted once), with its framework weight w:
#   attainment = min(1, proficiency / expected)          when the engine scored it
#   credit     = attainment                              evidence meets the framework's requirement
#              = attainment * DESCRIBED_ONLY_FACTOR      only the student's own descriptions back a competency
#                                                        that needs independent evidence
#              = 0                                       no engine score (listed only, suggested, missing):
#                                                        no evidence, so no credit; never shown as a level
#   score = round(100 * sum(w * credit) / sum(w))
# Not a proficiency, not the alignment state, not a probability of being hired. None (never 0) when the role
# can't be assessed, alignment is "not enough evidence", or no competency has a score.

SCORE_VERSION = 1
DESCRIBED_ONLY_FACTOR = 0.5


def _credit_kind(row: Dict[str, Any]) -> str:
    if row.get("proficiency") is None:
        return "none"
    if row.get("state") == "met" or row.get("evidenceRequirement") != "independent" or row.get("evidenceState") == "demonstrated":
        return "evidenced"
    return "described"


def _credit(row: Dict[str, Any]) -> float:
    kind = _credit_kind(row)
    if kind == "none" or not row.get("expected"):
        return 0.0
    attained = min(1.0, max(0.0, float(row["proficiency"])) / float(row["expected"]))
    return attained * DESCRIBED_ONLY_FACTOR if kind == "described" else attained


def _weighted(rows: List[Dict[str, Any]]) -> Optional[int]:
    valid = [r for r in rows if (r.get("weight") or 0) > 0]
    total = sum(r["weight"] for r in valid)
    if not total:
        return None
    return int(round(100 * sum(r["weight"] * _credit(r) for r in valid) / total + 1e-9))


def alignment_score(rows: List[Dict[str, Any]], has_evidence_base: bool, alignment_state: str) -> Optional[Dict[str, Any]]:
    if not has_evidence_base or alignment_state == "not_enough_evidence":
        return None
    unique: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        key = str(r["skill"]).strip().lower()
        if key not in unique or _credit(r) > _credit(unique[key]):
            unique[key] = r
    deduped = list(unique.values())
    if not any(_credit_kind(r) != "none" for r in deduped):
        return None
    value = _weighted(deduped)
    if value is None:
        return None
    required = [r for r in deduped if r.get("tier", "required") == "required"]
    supporting = [r for r in deduped if r.get("tier") == "supporting"]
    counts = {"evidenced": 0, "described": 0, "none": 0}
    for r in deduped:
        counts[_credit_kind(r)] += 1
    return {
        "value": value,
        "version": SCORE_VERSION,
        "required": {"score": _weighted(required), "competencies": len(required)},
        "supporting": {"score": _weighted(supporting), "competencies": len(supporting)},
        "counts": counts,
    }


def _evidence_state(skill: Dict[str, Any]) -> str:
    """Older callers (ERIS tests, stored skills) may lack evidenceState: verified means demonstrated, else claimed."""
    return skill.get("evidenceState") or ("demonstrated" if skill.get("status") == "verified" else "claimed")


def analyze_role(role: str, skills: Dict[str, Dict[str, Any]], inferred: Dict[str, Dict[str, Any]], has_evidence_base: bool, canonical: Callable[[str], Optional[str]]) -> Optional[Dict[str, Any]]:
    fw = framework_for(role)
    if not fw:
        return None

    rows: List[Dict[str, Any]] = []
    for req in fw.requirements:
        name = canonical(req.competency) or req.competency
        skill = skills.get(name)
        expected = req.expected
        score = skill["proficiency"] if skill else None
        evidence_state = _evidence_state(skill) if skill else None
        evidence_ok = bool(skill) and (evidence_state == "demonstrated" if req.evidence_requirement == "independent" else score is not None)
        if not has_evidence_base:
            state = "not_assessed"  # nothing to read yet: not knowing isn't a gap
        elif score is not None and score >= expected and evidence_ok:
            state = "met"
        elif score is not None and score >= expected:
            state = "unverified"  # level reached on the student's own descriptions; the framework needs more
        elif score is not None:
            state = "underdeveloped"
        elif skill:
            state = "unverified"  # claimed, nothing shows it
        elif name in inferred:
            state = "inferred"
        else:
            state = "missing"
        gap_type = GAP_TYPE.get(state) or ("insufficient_evidence" if score is not None else "claimed_unverified")
        competency = COMPETENCIES.get(name, {})
        rows.append({
            "skill": name,
            "tier": req.tier,
            "required": req.required,
            "weight": req.weight,
            "priority": priority_for(req.weight),
            "expected": expected,
            "expectedLevel": req.expected_level,
            "evidenceRequirement": req.evidence_requirement,
            "proficiency": score,
            "level": level_for(score),
            "confidence": skill["confidence"] if skill else 0.0,
            "evidenceState": evidence_state or ("inferred" if name in inferred else "missing"),
            "hasEvidence": bool(skill),
            "state": state,
            "gapType": gap_type,
            "insufficientEvidence": state in ("unverified", "inferred", "not_assessed"),
            "action": _action(state, gap_type, name),
            "demonstration": None if state == "met" else competency.get("demonstration"),
            "evidence": [e["label"] for e in (skill["evidence"] if skill else [])[:3]],
            "prerequisites": [p for p in PREREQUISITES.get(name, []) if p in {canonical(r.competency) or r.competency for r in fw.requirements}],
        })

    by_name = {r["skill"]: r for r in rows}
    for r in rows:
        r["prerequisiteFor"] = sorted(o["skill"] for o in rows if r["skill"] in o["prerequisites"])
        r["blockedBy"] = [p for p in r["prerequisites"] if p in by_name and by_name[p]["state"] != "met"] if r["state"] != "met" else []
        r["unblocks"] = [o for o in r["prerequisiteFor"] if by_name[o]["state"] != "met"] if r["state"] != "met" else []
        r["whyItMatters"] = _why_matters(fw, r["tier"], r["skill"], r["prerequisiteFor"])

    open_rows = sorted((r for r in rows if r["state"] != "met"), key=_priority_key)
    for rank, r in enumerate(open_rows, 1):
        r["priorityRank"] = rank
        r["priorityReason"] = _priority_reason(r)

    total = sum(r["weight"] for r in rows)
    met = sum(r["weight"] for r in rows if r["state"] == "met")
    role_alignment = alignment(rows, has_evidence_base)
    return {
        "role": role,
        "label": fw.label,
        "framework": {"version": framework_meta()["version"], "status": framework_meta()["status"], "responsibilities": list(fw.responsibilities), "completionCriteria": fw.completion_criteria},
        # Internal only (documented above); the dashboard shows `alignment`, never this as a percentage.
        "coverage": round(met / total, 3) if total else 0.0,
        "assessed": has_evidence_base,
        "alignment": role_alignment,
        "alignmentScore": alignment_score(rows, has_evidence_base, role_alignment["state"]),
        "skills": rows,
        "open": open_rows,
        "counts": {state: sum(1 for r in rows if r["state"] == state) for state in ("met", "underdeveloped", "unverified", "inferred", "missing", "not_assessed")},
    }


# ─── Learning recommendations ───────────────────────────────────────────────


def _catalogue(resources: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    return {r["title"]: r for r in resources if r.get("url")}


def _usable_check(title: str, url: str) -> Optional[Dict[str, Any]]:
    check = RESOURCE_CHECKS.get(title)
    return check if check and check["status"] == "ok" and check["url"] == url else None


def _is_stale(checked_at: str, now: datetime) -> bool:
    return (now.date() - datetime.fromisoformat(checked_at).date()).days > LINK_STALE_DAYS


def course_statuses(learning: Optional[List[Dict[str, Any]]]) -> Dict[str, str]:
    """Course title -> the student's furthest status (started / completed)."""
    rank = {"recommended": 0, "started": 1, "completed": 2}
    out: Dict[str, str] = {}
    for rec in learning or []:
        if rec["kind"] == "course" and rec.get("status") in rank:
            current = out.get(rec["title"])
            if current is None or rank[rec["status"]] > rank[current]:
                out[rec["title"]] = rec["status"]
    return out


def recommend(roles: List[Dict[str, Any]], resources: List[Dict[str, Any]], now: datetime, limit: int = 12, learning: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """From open gaps only. A claimed-but-unshown skill needs proof, not a course, so it gets no course."""
    catalogue = _catalogue(resources)
    taken = course_statuses(learning)
    chosen: Dict[str, Dict[str, Any]] = {}
    for rank, analysis in enumerate(roles):
        state_of = {r["skill"]: r for r in analysis["skills"]}
        for row in analysis["open"]:
            if row["state"] not in ("missing", "underdeveloped", "inferred"):
                continue
            prereqs = [{"skill": p, "met": state_of[p]["state"] == "met"} for p in PREREQUISITES.get(row["skill"], []) if p in state_of]
            gap = row["expected"] - (row["proficiency"] or 0)
            value = round((100 if row["tier"] == "required" else 0) + row["weight"] * 100 + gap / 2 - rank * 5 - sum(5 for p in prereqs if not p["met"]), 2)
            existing = chosen.get(row["skill"])
            if existing:
                if analysis["role"] not in existing["roles"]:
                    existing["roles"].append(analysis["role"])
                    existing["rankScore"] = max(existing["rankScore"], value) + 5  # helps more than one goal
                continue
            options = [(c, d) for c, d in COURSES.get(row["skill"], []) if c in catalogue and _usable_check(c, catalogue[c]["url"])]
            course = catalogue[options[0][0]] if options else None
            check = _usable_check(course["title"], course["url"]) if course else None
            course_status = taken.get(course["title"]) if course else None
            demonstration = COMPETENCIES.get(row["skill"], {}).get("demonstration") or f"Publish a repository that uses {row['skill']}."
            chosen[row["skill"]] = {
                "skill": row["skill"],
                "tier": row["tier"],
                "targetLevel": row["expectedLevel"],
                "target": row["expected"],
                "current": row["proficiency"],
                "currentLevel": row["level"],
                "state": row["state"],
                "gapType": row["gapType"],
                "priority": row["priority"],
                "why": _why(row, analysis["label"]) + (" You've completed the course; now show the skill in practice." if course_status == "completed" else ""),
                "currentEvidence": row["evidence"],
                "roles": [analysis["role"]],
                "prerequisites": prereqs,
                "resource": {
                    "title": course["title"], "provider": course.get("provider"), "url": course["url"], "description": course.get("description"),
                    "difficulty": options[0][1], "duration": None, "linkCheckedOn": check["checkedAt"], "linkStale": _is_stale(check["checkedAt"], now),
                } if course and check else None,
                "courseStatus": course_status,
                "demonstration": demonstration + " Name the skill in the repository description or topics so it can count here.",
                "status": "not_started" if row["proficiency"] is None else "in_progress",
                "rankScore": value,
            }
    ordered = sorted(chosen.values(), key=lambda r: (-r["rankScore"], r["skill"]))
    return ordered[:limit]


def _why(row: Dict[str, Any], role_label: str) -> str:
    tier = "required" if row["tier"] == "required" else "supporting"
    target = f"a {tier} skill for {role_label} (expected: {row['expectedLevel']})"
    if row["state"] == "underdeveloped":
        return f"Your evidence puts you at {row['level']}; it's {target}."
    if row["state"] == "inferred":
        return f"Only suggested by related skills so far; it's {target}."
    return f"No evidence found yet; it's {target}."


# ─── Roadmap ────────────────────────────────────────────────────────────────


def _dependency_order(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Prerequisites first, keeping priority order otherwise. Tolerates cycles by keeping input order."""
    present = {r["skill"]: r for r in rows}
    ordered: List[Dict[str, Any]] = []
    placed: Set[str] = set()
    visiting: Set[str] = set()

    def place(row: Dict[str, Any]) -> None:
        name = row["skill"]
        if name in placed or name in visiting:
            return
        visiting.add(name)
        for prereq in PREREQUISITES.get(name, []):
            if prereq in present:
                place(present[prereq])
        visiting.discard(name)
        placed.add(name)
        ordered.append(row)

    for row in rows:
        place(row)
    return ordered


def milestone_id(role: str, skill: str) -> str:
    """Stable across runs: the same role and skill always give the same id, so saved progress keeps matching."""
    return f"{role}:{re.sub(r'[^a-z0-9]+', '-', skill.lower()).strip('-')}"


def _objective(row: Dict[str, Any]) -> str:
    if row["gapType"] == "claimed_unverified":
        return f"Back up your {row['skill']} with work we can see"
    if row["gapType"] == "insufficient_evidence" and row["proficiency"] is not None:
        return f"Make your {row['skill']} work visible"
    if row["state"] == "underdeveloped":
        return f"Take {row['skill']} from {row['level']} to {row['expectedLevel']}"
    return f"Reach {row['expectedLevel']} in {row['skill']}"


def _milestone(row: Dict[str, Any], present: Set[str], fw: RoleFramework, recs: Dict[str, Dict[str, Any]], optional: bool) -> Dict[str, Any]:
    competency = COMPETENCIES.get(row["skill"], {})
    context = fw.project_context
    task = competency.get("demonstration") or f"A public project using {row['skill']}."
    if context:
        task = f"{task.rstrip('.')}, ideally as part of {context}."
    rec = recs.get(row["skill"])
    return {
        "id": milestone_id(fw.role, row["skill"]),
        "skill": row["skill"],
        "state": row["state"],
        "gapType": row["gapType"],
        "tier": row["tier"],
        "optional": optional,
        "done": row["state"] == "met",
        "requires": [p for p in PREREQUISITES.get(row["skill"], []) if p in present],
        "blockedBy": row["blockedBy"],
        "objective": _objective(row),
        "why": row["whyItMatters"],
        "practicalTask": task,
        "deliverable": task,
        "evidenceRequired": EVIDENCE_NEEDED[row["evidenceRequirement"]],
        "criterion": f"{row['skill']} reaches {row['expectedLevel']}, shown by {EVIDENCE_NEEDED[row['evidenceRequirement']]}",
        "recommendedResource": {"title": rec["resource"]["title"], "url": rec["resource"]["url"]} if rec and rec.get("resource") else None,
        "priorityReason": row.get("priorityReason"),
        "estimateWeeks": None,
    }


def build_roadmap(analysis: Optional[Dict[str, Any]], position: Optional[str], recommendations: Optional[List[Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    """Stages come from the role's own open competencies, ordered by prerequisites and priority.

    foundation  open required competencies with no open required prerequisite
    build       the other open required competencies
    deepen      open supporting competencies: optional, never a condition for the goal
    """
    if not analysis:
        return None
    fw = framework_for(analysis["role"])
    assert fw is not None
    recs = {r["skill"]: r for r in recommendations or []}
    rows = _dependency_order(sorted(analysis["skills"], key=lambda r: (_priority_key(r) if r["state"] != "met" else (2,), r["skill"])))
    present = {r["skill"] for r in rows}
    open_rows = [r for r in rows if r["state"] != "met"]
    open_names = {r["skill"] for r in open_rows}
    # The path to the goal: open required competencies plus any open supporting one a required one builds on
    # (e.g. Vector Databases before Retrieval-Augmented Generation). A step never waits on an optional stage.
    path: Set[str] = set()
    pending = [r["skill"] for r in open_rows if r["tier"] == "required"]
    while pending:
        name = pending.pop()
        if name in path:
            continue
        path.add(name)
        pending.extend(p for p in PREREQUISITES.get(name, []) if p in open_names)
    foundation = [r for r in open_rows if r["skill"] in path and not (set(PREREQUISITES.get(r["skill"], [])) & path)]
    build = [r for r in open_rows if r["skill"] in path and r not in foundation]
    deepen = [r for r in open_rows if r["skill"] not in path]
    requirements_met = analysis["alignment"]["state"] == "requirements_demonstrated"

    def stage(key: str, title: str, items: List[Dict[str, Any]], optional: bool) -> Optional[Dict[str, Any]]:
        if not items:
            return None
        return {"key": key, "title": title, "optional": optional, "milestones": [_milestone(r, present, fw, recs, optional) for r in items], "estimateWeeks": None}

    stages = [s for s in (
        stage("foundation", "Build the foundations", foundation, False),
        stage("build", "Build on them", build, False),
        stage("deepen", "Optional: go further" if requirements_met else "Round out the role (optional)", deepen, True),
    ) if s]
    return {
        "role": analysis["role"],
        "currentPosition": position,
        "progress": analysis["coverage"],
        "alignment": analysis["alignment"]["state"],
        "requirementsMet": requirements_met,
        "provisional": not analysis["assessed"] or analysis["alignment"]["state"] == "not_enough_evidence",
        "completed": [r["skill"] for r in rows if r["state"] == "met"],
        "completedMilestones": [{"id": milestone_id(analysis["role"], r["skill"]), "skill": r["skill"], "tier": r["tier"]} for r in rows if r["state"] == "met"],
        "stages": stages,
        "framework": framework_meta(),
        "assumption": ROADMAP_BASIS,
    }


def legacy_roadmap(roadmap: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The roadmaps table's columns, which Yora also reads."""
    if not roadmap:
        return None
    stages = {s["key"]: s for s in roadmap["stages"]}

    def column(key: str) -> Dict[str, Any]:
        s = stages.get(key)
        if not s:
            return {"title": "", "milestones": [], "timeline": "", "focus": ""}
        return {"title": s["title"], "milestones": [m["deliverable"] for m in s["milestones"]], "timeline": "", "focus": s["milestones"][0]["skill"]}

    return {"current_stage": roadmap["currentPosition"] or "Not stated", "short_term": column("foundation"), "mid_term": column("build"), "long_term": column("deepen")}


# ─── Graph ──────────────────────────────────────────────────────────────────


def build_graph(skills: Dict[str, Dict[str, Any]], inferred: Dict[str, Dict[str, Any]], canonical: Callable[[str], Optional[str]]) -> Dict[str, Any]:
    """Edges are either two skills evidenced by the same repository or project, or a documented ontology relation."""
    ranked = sorted(skills.values(), key=lambda s: (-(s["proficiency"] or 0), -s["evidenceCount"], s["name"]))
    direct = ranked[:MAX_GRAPH_NODES]
    room = max(0, MAX_GRAPH_NODES - len(direct))
    extra = sorted(inferred.values(), key=lambda s: (-len(s["inferredFrom"]), s["name"]))[:room]
    nodes = direct + extra
    present = {n["name"] for n in nodes}

    edges: List[Dict[str, Any]] = []
    together: Dict[Tuple[str, str], Set[str]] = {}
    by_source: Dict[str, Set[str]] = {}
    for node in direct:
        for e in skills[node["name"]]["evidence"]:
            if e["kind"] in ("repository", "project", "experience"):
                by_source.setdefault(e["label"], set()).add(node["name"])
    for label, names in by_source.items():
        ordered = sorted(names)
        for i, a in enumerate(ordered):
            for b in ordered[i + 1:]:
                together.setdefault((a, b), set()).add(label)
    for (a, b), labels in sorted(together.items()):
        edges.append({"source": a, "target": b, "relationship": "used_together", "basis": "evidence", "evidence": sorted(labels)[:3], "weight": len(labels)})

    seen = {(e["source"], e["target"]) for e in edges} | {(e["target"], e["source"]) for e in edges}
    for name in sorted(present):
        for target, weight in SKILL_ONTOLOGY.get(name, []):
            resolved = canonical(target) or target
            if resolved in present and resolved != name and (name, resolved) not in seen:
                seen.add((name, resolved))
                edges.append({"source": name, "target": resolved, "relationship": determine_relationship(name, target), "basis": "ontology", "evidence": [], "weight": weight})

    return {
        "nodes": [
            {
                "id": n["name"], "name": n["name"], "category": n["category"], "status": n["status"], "level": n["level"],
                "proficiency": n["proficiency"], "confidence": n["confidence"], "evidenceCount": n["evidenceCount"],
                "evidence": n["evidence"][:4], "inferredFrom": n.get("inferredFrom", []),
            }
            for n in nodes
        ],
        "edges": edges,
        "totalSkills": len(skills) + len(inferred),
    }


# ─── Assembly ───────────────────────────────────────────────────────────────


def position_from(user: Dict[str, Any]) -> Optional[str]:
    """Only what the user's own record says, or None."""
    if user.get("job_title"):
        return " at ".join(p for p in (user["job_title"], user.get("company")) if p)
    if user.get("academic_title"):
        return " at ".join(p for p in (user["academic_title"], user.get("university")) if p)
    if user.get("degree"):
        return " at ".join(p for p in (user["degree"], user.get("university")) if p)
    return None


def evidence_ledger(skills: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Every (skill, profile fact) pair the engine used, for the skill_evidence projection. Strength is the skill's confidence."""
    return [
        {"skill": s["name"], "factId": fact_id, "source": source, "strength": s["confidence"]}
        for s in skills.values() for fact_id, source in s["_factRefs"]
    ]


def compute(
    *,
    user: Dict[str, Any],
    roles: List[str],
    facts: List[Dict[str, Any]],
    repos: List[Dict[str, Any]],
    resources: List[Dict[str, Any]],
    canonical: Callable[[str], Optional[str]],
    lexicon_scan: Callable[[str], List[str]],
    categories: Dict[str, str],
    now: datetime,
    learning: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    skills = build_skills(facts, repos, canonical, lexicon_scan, categories, now, learning)
    inferred = infer_skills(skills, canonical)
    # With nothing to read, every role skill would look "missing". That's not knowing, not a gap.
    has_evidence_base = bool(repos) or any(f["origin"] != "user_entered" or f["field_group"] in ("skills", "projects", "experience") for f in facts)

    analyses = [a for a in (analyze_role(r, skills, inferred, has_evidence_base, canonical) for r in roles) if a]
    primary = analyses[0] if analyses else None
    recommendations = recommend(analyses, resources, now, learning=learning) if has_evidence_base else []
    roadmap = build_roadmap(primary, position_from(user), recommendations)
    ledger = evidence_ledger(skills)
    public = {name: {k: v for k, v in s.items() if not k.startswith("_")} for name, s in skills.items()}

    ordered = sorted(public.values(), key=lambda s: (-(s["proficiency"] if s["proficiency"] is not None else -1), s["name"]))
    return {
        "engineVersion": ENGINE_VERSION,
        "framework": {**framework_meta(), "alignmentRules": ALIGNMENT_RULES},
        "computedAt": now.isoformat(),
        "hasEvidenceBase": has_evidence_base,
        "skills": ordered,
        "inferred": sorted(inferred.values(), key=lambda s: s["name"]),
        "roles": analyses,
        "unsupportedRoles": [r for r in roles if framework_for(r) is None],
        "recommendations": recommendations,
        "roadmap": roadmap,
        "graph": build_graph(public, inferred, canonical),
        "counts": {
            "verified": sum(1 for s in public.values() if s["status"] == "verified"),
            "claimed": sum(1 for s in public.values() if s["status"] == "claimed"),
            "inferred": len(inferred),
            "assessed": sum(1 for s in public.values() if s["proficiency"] is not None),
        },
        # Not part of the dashboard document: compute.py pops it to write the skill_evidence projection.
        "_ledger": ledger,
    }


def legacy_gaps_and_paths(intelligence: Dict[str, Any]) -> Dict[str, Any]:
    """The older view keys Yora and next actions read, now from the same source."""
    primary = intelligence["roles"][0] if intelligence["roles"] else None
    gaps = []
    if primary and primary["assessed"]:
        for row in primary["open"]:
            if not row["insufficientEvidence"] and row["tier"] == "required":
                gaps.append({"skill": row["skill"], "description": row["action"], "priority": f"{row['priority']} Priority", "action": row["action"]})
    return {"gaps": gaps, "learning_paths": []}


def role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role.replace("_", " "))
