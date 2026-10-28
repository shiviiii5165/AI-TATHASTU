"""ERIS (interview readiness) per target role (plan §2.4).

score = weighted mean of available components:
  technical (50%)        Σ weight·readiness(skill) / Σ weight over the role's skills
  problem_solving (25%)  LeetCode/HackerRank evidence (see problem_solving_score);
                         missing when neither is connected, and the other
                         weights are renormalized
  projects (25%)         projects using >=1 required skill, 3 or more = full marks
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from intelligence.config import ERIS_PROJECTS_FOR_FULL_SCORE, ERIS_WEIGHTS, ROLE_SKILLS


LEETCODE_FULL_MARKS = 400  # weighted solves (easy 1, medium 2, hard 3) for a 1.0


def problem_solving_score(facts: List[Dict[str, Any]]) -> Optional[float]:
    """Best of LeetCode (weighted solves) and HackerRank (Problem Solving badge stars / 5); None if neither."""
    scores = []
    for f in facts:
        stats = f.get("extracted_value")
        if not isinstance(stats, dict):
            continue
        if f.get("record_key") == "leetcode:stats":
            counts = [(stats.get(k), w) for k, w in (("easy", 1), ("medium", 2), ("hard", 3))]
            if all(c is None for c, _ in counts):
                continue  # unknown, not zero
            weighted = sum((c or 0) * w for c, w in counts)
            scores.append(min(1.0, weighted / LEETCODE_FULL_MARKS))
        elif f.get("record_key") == "hackerrank:stats":
            stars = (stats.get("badges") or {}).get("Problem Solving")
            if stars:
                scores.append(min(1.0, stars / 5))
    return round(max(scores), 3) if scores else None


def score_role(
    role: str,
    readiness_by_name: Dict[str, float],
    project_technologies: List[List[str]],
    problem_solving: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    required = ROLE_SKILLS.get(role)
    if not required:
        return None

    skills = [{"skill": s, "weight": w, "readiness": readiness_by_name.get(s, 0.0)} for s, w in required]
    total_w = sum(w for _, w in required)
    technical = sum(s["weight"] * s["readiness"] for s in skills) / total_w

    names = {s for s, _ in required}
    relevant = sum(1 for techs in project_technologies if names & set(techs))
    projects = min(1.0, relevant / ERIS_PROJECTS_FOR_FULL_SCORE)

    components = {"technical": technical, "problem_solving": problem_solving, "projects": projects}
    available = {k: v for k, v in components.items() if v is not None}
    weight_sum = sum(ERIS_WEIGHTS[k] for k in available)
    score = sum(ERIS_WEIGHTS[k] * v for k, v in available.items()) / weight_sum

    gaps = sorted((s for s in skills if s["readiness"] < 0.5), key=lambda s: (s["readiness"], -s["weight"]))[:3]
    return {
        "score": round(score, 3),
        "breakdown": {
            "components": {k: (round(v, 3) if v is not None else None) for k, v in components.items()},
            "weights": ERIS_WEIGHTS,
            "missing_components": [k for k, v in components.items() if v is None],
            "skills": skills,
            "relevant_projects": relevant,
            "gaps": [{"skill": g["skill"], "readiness": g["readiness"], "weight": g["weight"]} for g in gaps],
        },
    }
