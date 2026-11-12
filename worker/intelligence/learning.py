"""Choosing a learning resource for a skill gap, from the curated catalogue (learning_catalogue.json).

A resource is offered only if scripts/check_learning_links.py last found its link "ok" (learning_catalogue_checks.json)
for the same URL. Selection is a written rule, not popularity or keyword matching:

  1. it must teach the skill (the catalogue lists the skills each resource covers)
  2. its entry level must not be above the student's current level, and it must take them further than where they are
     (a resource that starts above their level is used only when nothing else exists, and says so)
  3. preferred: it reaches the target level; its focus suits the gap (hands-on practice when the student already uses
     the skill but below the expected level; a structured course or docs when there's no evidence yet); its own
     prerequisites are skills the student already shows; it's official documentation or a university course
  4. ties go to resources that also cover the student's other open gaps

Every choice carries the reason in words. If no checked resource fits, the result says so instead of offering
something irrelevant.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

_DIR = Path(__file__).parent
CATALOGUE: Dict[str, Any] = json.loads((_DIR / "learning_catalogue.json").read_text(encoding="utf-8"))
_CHECKS_PATH = _DIR / "learning_catalogue_checks.json"
CHECKS: Dict[str, Dict[str, Any]] = json.loads(_CHECKS_PATH.read_text(encoding="utf-8"))["resources"] if _CHECKS_PATH.exists() else {}
RESOURCES: List[Dict[str, Any]] = CATALOGUE["resources"]
LINK_STALE_DAYS = 90

LEVEL_INDEX = {"none": 0, "Not assessed": 0, "Foundational": 1, "Working": 2, "Proficient": 3, "Advanced": 4}
CREDIBLE_TYPES = {"official_docs", "university_course", "standard"}
TYPE_LABEL = {
    "official_docs": "Official documentation", "university_course": "University course", "course": "Course", "tutorial": "Tutorial",
    "book": "Book", "interactive": "Interactive lessons", "video_course": "Video course", "article": "Article", "guide": "Guide",
    "standard": "Standard", "tool_docs": "Tool documentation",
}


def check_for(resource: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    check = CHECKS.get(resource["id"])
    return check if check and check.get("status") == "ok" and check.get("url") == resource["url"] else None


def usable(resource: Dict[str, Any]) -> bool:
    return check_for(resource) is not None


def by_skill(skill: str) -> List[Dict[str, Any]]:
    return [r for r in RESOURCES if skill in r["skills"]]


def coverage() -> Dict[str, Dict[str, int]]:
    """skill -> {catalogued, verified}: what the catalogue can offer, for tests and the data-coverage report."""
    out: Dict[str, Dict[str, int]] = {}
    for r in RESOURCES:
        for s in r["skills"]:
            row = out.setdefault(s, {"catalogued": 0, "verified": 0})
            row["catalogued"] += 1
            row["verified"] += int(usable(r))
    return out


def _stale(checked_at: str, now: datetime) -> bool:
    return (now.date() - datetime.fromisoformat(checked_at).date()).days > LINK_STALE_DAYS


def _score(r: Dict[str, Any], current: int, target: int, has_evidence: bool, shown: Set[str], open_skills: Set[str]) -> Tuple[float, List[str], bool]:
    start, reach = LEVEL_INDEX[r["start"]], LEVEL_INDEX[r["reach"]]
    reasons: List[str] = []
    stretch = start > current
    score = 0.0
    if reach <= current:
        return -100.0, ["it doesn't go beyond your current level"], stretch
    if stretch:
        score -= 6
        reasons.append("starts a little above your current level, so do the basics first if it feels too fast")
    elif start == current:
        score += 3
        reasons.append("starts where you are now")
    else:
        score += 1.5
        reasons.append("covers the basics you'll build on")
    if reach >= target:
        score += 2
        reasons.append("goes as far as the level this goal expects")
    if has_evidence and r["focus"] == "practical":
        score += 2
        reasons.append("hands-on, which suits building on skills you already use")
    elif not has_evidence and r["focus"] in ("mixed", "practical"):
        score += 1
        reasons.append("teaches the concepts with practice")
    prereqs = r.get("prerequisites") or []
    unmet = [p for p in prereqs if p not in shown]
    score -= 1.5 * len(unmet)
    if prereqs and not unmet:
        score += 1
        reasons.append("its prerequisites are already in your evidence")
    if r["type"] in CREDIBLE_TYPES:
        score += 1
        reasons.append(f"from {TYPE_LABEL[r['type']].lower()}")
    also = sorted((set(r["skills"]) & open_skills) - {""})
    score += 0.3 * max(0, len(also) - 1)
    return score, reasons, stretch


def _public(r: Dict[str, Any], now: datetime, reasons: List[str], stretch: bool, unmet: List[str], skill: str, open_skills: Set[str]) -> Dict[str, Any]:
    check = check_for(r) or {}
    also = sorted((set(r["skills"]) & open_skills) - {skill})
    return {
        "id": r["id"], "title": r["title"], "provider": r["provider"], "url": r["url"], "type": r["type"], "typeLabel": TYPE_LABEL.get(r["type"], r["type"]),
        "focus": r["focus"], "levelWindow": {"start": r["start"], "reach": r["reach"]}, "outcome": r["outcome"],
        "fitReason": ("; ".join(reasons[:3]) or "the closest match in our checked catalogue").capitalize() + ".",
        "stretch": stretch, "unmetPrerequisites": unmet, "alsoCovers": also,
        "description": None, "difficulty": r["reach"], "duration": None,  # older readers; no duration is ever invented
        "linkCheckedOn": check.get("checkedAt"), "linkStale": bool(check.get("checkedAt")) and _stale(check["checkedAt"], now),
    }


def choose(skill: str, current_level: Optional[str], target_level: str, has_evidence: bool, shown: Set[str], open_skills: Set[str], now: datetime,
           started: Optional[Set[str]] = None) -> Dict[str, Any]:
    """{resource, alternative, catalogued, verified, reason}. resource is None when no checked resource fits. A resource the
    student has already started (by title) is preferred: finishing it beats starting something new."""
    current = LEVEL_INDEX.get(current_level or "none", 0)
    target = LEVEL_INDEX.get(target_level, 2)
    listed = by_skill(skill)
    candidates = [r for r in listed if usable(r)]
    scored = []
    for r in candidates:
        s, reasons, stretch = _score(r, current, target, has_evidence, shown, open_skills)
        if started and r["title"] in started and s > -100:
            s += 50  # decisive: any started resource that teaches the skill beats a fresh one
            reasons = ["you've already started it, so finish it first"] + reasons
        if s > -100:
            scored.append((s, r, reasons, stretch))
    scored.sort(key=lambda x: (-x[0], x[1]["id"]))
    base = {"catalogued": len(listed), "verified": len(candidates)}
    if not scored:
        if not listed:
            why = f"We don't have a checked resource for {skill} in our catalogue yet."
        elif not candidates:
            why = f"Our resources for {skill} failed their last link check, so we're not offering them."
        else:
            why = f"Our checked resources for {skill} don't go beyond your current level."
        return {**base, "resource": None, "alternative": None, "reason": why}
    best = scored[0]
    alt = next((x for x in scored[1:] if x[1]["type"] != best[1]["type"] or x[1]["focus"] != best[1]["focus"]), None)

    def pub(x):
        return _public(x[1], now, x[2], x[3], [p for p in (x[1].get("prerequisites") or []) if p not in shown], skill, open_skills)

    return {**base, "resource": pub(best), "alternative": pub(alt) if alt else None, "reason": None}
