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
  certification           +5, and only on top of the above: supporting, never proof alone
  platform assessment     raises the score to stars / 5 x 100 if that is higher

A skill-list mention earns nothing, which is what "Not assessed" means. A score resting only
on the user's own descriptions is capped at 49, since nothing independent backs it. Repository
metadata alone tops out at 70 (Proficient): we don't read source code, so Advanced also needs
described work or an assessment.

Three separate measures, never blended:
  proficiency  how well the evidence says you use the skill
  confidence   how much evidence there is, from how many independent kinds of source
  coverage     per role: the share of its weighted skills at their expected level

These weights and the role framework are our own judgement, written down so they can be
challenged. They are not an industry standard or job-market data.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Optional, Set, Tuple

from intelligence.config import ROLE_SKILLS
from intelligence.skill_graph import SKILL_ONTOLOGY, determine_relationship

ENGINE_VERSION = 1
MAX_EVIDENCE_PER_SKILL = 8
MAX_GRAPH_NODES = 18
UNVERIFIED_CAP = 49
LEVELS = ((75, "Advanced"), (50, "Proficient"), (25, "Working"), (0, "Foundational"))

# Platforms whose data we read directly, rather than the user's own account of themselves.
VERIFIED_ORIGINS = {"kaggle", "stack_exchange", "leetcode", "hackerrank"}
CLAIM_ORIGINS = {"resume", "user_entered", "linkedin_scrape", "linkedin_oidc", "portfolio", "orcid"}

# Expected proficiency by how central the framework says the skill is to the role.
EXPECTED_FOR_WEIGHT = ((0.9, 50), (0.6, 25), (0.0, 10))
HIGH_PRIORITY_WEIGHT = 0.8
MEDIUM_PRIORITY_WEIGHT = 0.6

# Planning estimates, stated with their assumption wherever they're shown. Not measured durations.
HOURS_PER_WEEK_ASSUMED = 6
WEEKS_TO_REACH = {10: 2, 25: 4, 50: 8}

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

# What to be comfortable with first. Ordering only applies within a role's own skills.
PREREQUISITES: Dict[str, List[str]] = {
    "PyTorch": ["Python"],
    "scikit-learn": ["Python"],
    "Pandas": ["Python"],
    "FastAPI": ["Python"],
    "Machine Learning": ["Python", "Statistics"],
    "Deep Learning": ["Machine Learning", "Linear Algebra"],
    "Large Language Models": ["Deep Learning", "Machine Learning"],
    "Retrieval-Augmented Generation": ["Large Language Models", "Vector Databases"],
    "Prompt Engineering": ["Large Language Models"],
    "Fine-tuning": ["Large Language Models", "PyTorch"],
    "LangChain": ["Python", "Large Language Models"],
    "Natural Language Processing": ["Machine Learning", "Python"],
    "Hugging Face Transformers": ["Python", "PyTorch"],
    "Transformers (architecture)": ["Deep Learning"],
    "Computer Vision": ["Deep Learning", "Python"],
    "Convolutional Neural Networks": ["Deep Learning"],
    "Object Detection": ["Convolutional Neural Networks"],
    "Image Segmentation": ["Convolutional Neural Networks"],
    "Reinforcement Learning": ["Probability", "Python"],
    "Kubernetes": ["Docker"],
    "MLflow": ["Machine Learning"],
    "Terraform": ["AWS"],
    "CUDA": ["C++"],
    "JAX": ["Python", "Linear Algebra"],
}


def level_for(score: Optional[float]) -> str:
    if score is None:
        return "Not assessed"
    return next(name for floor, name in LEVELS if score >= floor)


def expected_for(weight: float) -> int:
    return next(expected for floor, expected in EXPECTED_FOR_WEIGHT if weight >= floor)


def priority_for(weight: float) -> str:
    return "High" if weight >= HIGH_PRIORITY_WEIGHT else "Medium" if weight >= MEDIUM_PRIORITY_WEIGHT else "Low"


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
    certified: bool = False
    assessment: Optional[float] = None
    evidence: List[Dict[str, Any]] = field(default_factory=list)

    def add(self, kind: str, source: str, label: str, ref: Any, at: Any) -> None:
        self.evidence.append({"kind": kind, "source": source, "label": str(label)[:140], "ref": str(ref) if ref else None, "at": _iso(at)})


def _iso(value: Any) -> Optional[str]:
    return value.isoformat() if isinstance(value, datetime) else None


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
                t.add("platform", origin, f.get("source_evidence") or f"Activity on {origin}", ref, at)
            else:
                t.claimed = True
                t.add("claim", origin, "Listed in your skills", ref, at)
        elif group == "projects" and name == "technologies":
            for tech in _as_list(value):
                t = tally(tech)
                if t and f"project:{record}" not in t.described:
                    t.described.add(f"project:{record}")
                    t.add("project", origin, titles.get(("projects", record or ""), "Project"), ref, at)
        elif group in ("experience", "projects") and name == "description":
            for skill in lexicon_scan(str(value)):
                t = tally(skill)
                if t and f"{group}:{record}" not in t.described and f"project:{record}" not in t.described:
                    t.described.add(f"{group}:{record}")
                    t.add("experience" if group == "experience" else "project", origin, titles.get((group, record or ""), group.title()), ref, at)
        elif group == "certifications" and name == "name":
            for skill in lexicon_scan(str(value)):
                t = tally(skill)
                if t:
                    t.certified = True
                    t.add("certification", origin, str(value), ref, at)
        elif record == "hackerrank:stats" and isinstance(f.get("extracted_value"), dict):
            for badge, stars in (f["extracted_value"].get("badges") or {}).items():
                t = tally(str(badge).replace("Problem Solving", "Data Structures and Algorithms"))
                if t and isinstance(stars, (int, float)) and stars > 0:
                    t.assessment = max(t.assessment or 0, min(100.0, stars / 5 * 100))
                    t.add("assessment", "hackerrank", f"{badge}: {stars} of 5 stars", ref, at)

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

    kinds = sum([bool(t.repos), bool(t.described), bool(t.platform), t.assessment is not None, t.claimed, t.certified])
    confidence = {0: 0.0, 1: 0.35, 2: 0.6, 3: 0.8}.get(kinds, 0.9)
    if not has_independent:
        confidence = min(confidence, 0.35)

    evidence = sorted(t.evidence, key=lambda e: e["at"] or "", reverse=True)
    return {
        "name": t.name,
        "category": t.category,
        "status": "verified" if has_independent else "claimed",
        "proficiency": score,
        "level": level_for(score),
        "confidence": confidence,
        "scoreParts": parts,
        "evidenceCount": len(t.evidence),
        "evidence": evidence[:MAX_EVIDENCE_PER_SKILL],
        "lastEvidenceAt": next((e["at"] for e in evidence if e["at"]), None),
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
                "name": resolved, "category": "other", "status": "inferred", "proficiency": None, "level": "Not assessed",
                "confidence": 0.0, "scoreParts": {}, "evidenceCount": 0, "evidence": [], "lastEvidenceAt": None, "inferredFrom": [],
            })
            entry["inferredFrom"].append(name)
    return found


# ─── Role gaps ──────────────────────────────────────────────────────────────


def _action(state: str, skill: str) -> str:
    if state == "unverified":
        return f"Show it: add a public repository using {skill}, or confirm a project that used it."
    if state == "inferred":
        return f"Your related skills suggest {skill}, but nothing shows it yet. Add a project that uses it directly."
    if state == "underdeveloped":
        return f"Deepen it: use {skill} in a more substantial project and push it to a public repository."
    return f"Learn {skill}, then build a small public project with it."


def analyze_role(role: str, skills: Dict[str, Dict[str, Any]], inferred: Dict[str, Dict[str, Any]], has_evidence_base: bool, canonical: Callable[[str], Optional[str]]) -> Optional[Dict[str, Any]]:
    required = ROLE_SKILLS.get(role)
    if not required:
        return None

    rows: List[Dict[str, Any]] = []
    for raw_name, weight in required:
        name = canonical(raw_name) or raw_name
        skill = skills.get(name)
        expected = expected_for(weight)
        score = skill["proficiency"] if skill else None
        if not has_evidence_base:
            state = "not_assessed"  # nothing to read yet: not knowing isn't a gap
        elif score is not None and score >= expected:
            state = "met"
        elif score is not None:
            state = "underdeveloped"
        elif skill:
            state = "unverified"  # claimed, nothing shows it
        elif name in inferred:
            state = "inferred"
        else:
            state = "missing"
        rows.append({
            "skill": name,
            "weight": weight,
            "priority": priority_for(weight),
            "expected": expected,
            "expectedLevel": level_for(expected),
            "proficiency": score,
            "level": level_for(score),
            "confidence": skill["confidence"] if skill else 0.0,
            "state": state,
            "insufficientEvidence": state in ("unverified", "inferred", "not_assessed"),
            "action": None if state == "met" else ("Add a resume or connect GitHub so this can be assessed." if state == "not_assessed" else _action(state, name)),
            "evidence": [e["label"] for e in (skill["evidence"] if skill else [])[:3]],
        })

    total = sum(w for _, w in required)
    met = sum(r["weight"] for r in rows if r["state"] == "met")
    # High importance first, then the larger shortfall. A stable name tie-break keeps it deterministic.
    open_rows = sorted(
        (r for r in rows if r["state"] != "met"),
        key=lambda r: (-r["weight"], -(r["expected"] - (r["proficiency"] or 0)), r["skill"]),
    )
    return {
        "role": role,
        "coverage": round(met / total, 3),
        "assessed": has_evidence_base,
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


def recommend(roles: List[Dict[str, Any]], resources: List[Dict[str, Any]], now: datetime, limit: int = 12) -> List[Dict[str, Any]]:
    """From open gaps only. A claimed-but-unshown skill needs proof, not a course, so it gets no course."""
    catalogue = _catalogue(resources)
    chosen: Dict[str, Dict[str, Any]] = {}
    for rank, analysis in enumerate(roles):
        state_of = {r["skill"]: r for r in analysis["skills"]}
        for row in analysis["open"]:
            if row["state"] not in ("missing", "underdeveloped", "inferred"):
                continue
            prereqs = [{"skill": p, "met": state_of[p]["state"] == "met"} for p in PREREQUISITES.get(row["skill"], []) if p in state_of]
            gap = row["expected"] - (row["proficiency"] or 0)
            value = round(row["weight"] * 100 + gap / 2 - rank * 5 - sum(5 for p in prereqs if not p["met"]), 2)
            existing = chosen.get(row["skill"])
            if existing:
                if analysis["role"] not in existing["roles"]:
                    existing["roles"].append(analysis["role"])
                    existing["rankScore"] = max(existing["rankScore"], value) + 5  # helps more than one goal
                continue
            options = [(c, d) for c, d in COURSES.get(row["skill"], []) if c in catalogue and _usable_check(c, catalogue[c]["url"])]
            course = catalogue[options[0][0]] if options else None
            check = _usable_check(course["title"], course["url"]) if course else None
            chosen[row["skill"]] = {
                "skill": row["skill"],
                "targetLevel": row["expectedLevel"],
                "target": row["expected"],
                "current": row["proficiency"],
                "currentLevel": row["level"],
                "state": row["state"],
                "priority": row["priority"],
                "why": _why(row, analysis["role"]),
                "currentEvidence": row["evidence"],
                "roles": [analysis["role"]],
                "prerequisites": prereqs,
                "resource": {
                    "title": course["title"], "provider": course.get("provider"), "url": course["url"], "description": course.get("description"),
                    "difficulty": options[0][1], "duration": None, "linkCheckedOn": check["checkedAt"], "linkStale": _is_stale(check["checkedAt"], now),
                } if course and check else None,
                "demonstration": f"Publish a repository that uses {row['skill']}, naming it in the description or topics, so it can count here.",
                "status": "not_started" if row["proficiency"] is None else "in_progress",
                "rankScore": value,
            }
    ordered = sorted(chosen.values(), key=lambda r: (-r["rankScore"], r["skill"]))
    return ordered[:limit]


def _why(row: Dict[str, Any], role: str) -> str:
    target = f"{row['priority'].lower()}-priority for {role} (expected: {row['expectedLevel']})"
    if row["state"] == "underdeveloped":
        return f"Evidence puts you at {row['level']}; it's {target}."
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


def _milestone(row: Dict[str, Any], present: Set[str]) -> Dict[str, Any]:
    return {
        "skill": row["skill"],
        "state": row["state"],
        "done": row["state"] == "met",
        "requires": [p for p in PREREQUISITES.get(row["skill"], []) if p in present],
        "deliverable": f"A public project using {row['skill']}",
        "criterion": f"{row['skill']} reaches {row['expectedLevel']} from your evidence",
        "estimateWeeks": WEEKS_TO_REACH[row["expected"]],
    }


def build_roadmap(analysis: Optional[Dict[str, Any]], position: Optional[str]) -> Optional[Dict[str, Any]]:
    """Stages come from the role's own open skills. Progress is the share of its skills evidence shows at level, and nothing else."""
    if not analysis:
        return None
    rows = _dependency_order(sorted(analysis["skills"], key=lambda r: (-r["weight"], r["skill"])))
    present = {r["skill"] for r in rows}
    open_rows = [r for r in rows if r["state"] != "met"]
    # Foundations can't wait on anything still open; next builds on them; last is the rest.
    open_names = {r["skill"] for r in open_rows}
    foundation = [r for r in open_rows if not (set(PREREQUISITES.get(r["skill"], [])) & open_names)]
    remaining = [r for r in open_rows if r not in foundation]
    middle = [r for r in remaining if r["priority"] != "Low"]
    later = [r for r in remaining if r["priority"] == "Low"]

    def stage(key: str, title: str, items: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not items:
            return None
        milestones = [_milestone(r, present) for r in items]
        return {"key": key, "title": title, "milestones": milestones, "estimateWeeks": sum(m["estimateWeeks"] for m in milestones)}

    stages = [s for s in (
        stage("foundation", "Build the foundations", foundation),
        stage("build", "Build on them", middle),
        stage("deepen", "Round out the role", later),
    ) if s]
    return {
        "role": analysis["role"],
        "currentPosition": position,
        "progress": analysis["coverage"],
        "completed": [r["skill"] for r in rows if r["state"] == "met"],
        "stages": stages,
        "assumption": f"Estimates assume about {HOURS_PER_WEEK_ASSUMED} hours a week, one skill at a time. They are planning figures, not measured.",
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
        return {"title": s["title"], "milestones": [m["deliverable"] for m in s["milestones"]], "timeline": f"About {s['estimateWeeks']} weeks", "focus": s["milestones"][0]["skill"]}

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
) -> Dict[str, Any]:
    skills = build_skills(facts, repos, canonical, lexicon_scan, categories, now)
    inferred = infer_skills(skills, canonical)
    # With nothing to read, every role skill would look "missing". That's not knowing, not a gap.
    has_evidence_base = bool(repos) or any(f["origin"] != "user_entered" or f["field_group"] in ("skills", "projects", "experience") for f in facts)

    analyses = [a for a in (analyze_role(r, skills, inferred, has_evidence_base, canonical) for r in roles) if a]
    primary = analyses[0] if analyses else None
    recommendations = recommend(analyses, resources, now) if has_evidence_base else []
    roadmap = build_roadmap(primary, position_from(user))

    ordered = sorted(skills.values(), key=lambda s: (-(s["proficiency"] if s["proficiency"] is not None else -1), s["name"]))
    return {
        "engineVersion": ENGINE_VERSION,
        "computedAt": now.isoformat(),
        "hasEvidenceBase": has_evidence_base,
        "skills": ordered,
        "inferred": sorted(inferred.values(), key=lambda s: s["name"]),
        "roles": analyses,
        "unsupportedRoles": [r for r in roles if r not in ROLE_SKILLS],
        "recommendations": recommendations,
        "roadmap": roadmap,
        "graph": build_graph(skills, inferred, canonical),
        "counts": {
            "verified": sum(1 for s in skills.values() if s["status"] == "verified"),
            "claimed": sum(1 for s in skills.values() if s["status"] == "claimed"),
            "inferred": len(inferred),
            "assessed": sum(1 for s in skills.values() if s["proficiency"] is not None),
        },
    }


def legacy_gaps_and_paths(intelligence: Dict[str, Any]) -> Dict[str, Any]:
    """The older view keys Yora and next actions read, now from the same source."""
    primary = intelligence["roles"][0] if intelligence["roles"] else None
    gaps = []
    if primary and primary["assessed"]:
        for row in primary["open"]:
            if not row["insufficientEvidence"]:
                gaps.append({"skill": row["skill"], "description": row["action"], "priority": f"{row['priority']} Priority", "action": row["action"]})
    return {"gaps": gaps, "learning_paths": []}
