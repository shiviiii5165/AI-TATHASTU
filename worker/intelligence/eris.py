"""ERIS (interview readiness) per target role (plan §2.4).

score = weighted mean of available components:
  technical (50%)        Σ weight·min(1, proficiency/expected) / Σ weight, from the career engine's role analysis
  problem_solving (25%)  LeetCode/HackerRank evidence (see problem_solving_score);
                         missing when neither is connected, and the other
                         weights are renormalized
  projects (25%)         projects using >=1 required skill, 3 or more = full marks

Skills, levels and gaps all come from the career engine. Only problem solving and projects are
ERIS's own, because they measure something different from how well a skill is evidenced.
No score at all when there is nothing to base one on.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from intelligence.config import ERIS_PROJECTS_FOR_FULL_SCORE, ERIS_WEIGHTS


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
    analysis: Optional[Dict[str, Any]],
    project_technologies: List[List[str]],
    problem_solving: Optional[float] = None,
) -> Optional[Dict[str, Any]]:
    """`analysis` is career_engine.analyze_role's output, so ERIS can't disagree with the skill gaps."""
    if not analysis or not analysis["assessed"]:
        return None

    rows = analysis["skills"]
    attained = [_attainment(r) for r in rows]
    total_w = sum(r["weight"] for r in rows)
    technical = sum(r["weight"] * a for r, a in zip(rows, attained)) / total_w

    names = {r["skill"] for r in rows}
    relevant = sum(1 for techs in project_technologies if names & set(techs))
    projects = min(1.0, relevant / ERIS_PROJECTS_FOR_FULL_SCORE)

    # Listed skills with nothing behind them, and nothing else to go on: "no score" is the honest answer, not 0.
    if technical == 0 and relevant == 0 and problem_solving is None:
        return None

    components = {"technical": technical, "problem_solving": problem_solving, "projects": projects}
    available = {k: v for k, v in components.items() if v is not None}
    weight_sum = sum(ERIS_WEIGHTS[k] for k in available)
    score = sum(ERIS_WEIGHTS[k] * v for k, v in available.items()) / weight_sum

    # Most important gap first, in the engine's order, so every card lists them alike.
    ordered = analysis["open"] + [r for r in rows if r["state"] == "met"]
    return {
        "score": round(score, 3),
        "breakdown": {
            "components": {k: (round(v, 3) if v is not None else None) for k, v in components.items()},
            "weights": ERIS_WEIGHTS,
            "missing_components": [k for k, v in components.items() if v is None],
            "skills": [_row(r) for r in ordered],
            "relevant_projects": relevant,
            "gaps": [_row(r) for r in analysis["open"][:3]],
        },
    }


def _attainment(row: Dict[str, Any]) -> float:
    """Share of the role's expected level. A skill with no score contributes nothing."""
    return 0.0 if row["proficiency"] is None else min(1.0, row["proficiency"] / row["expected"])


def _row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "skill": row["skill"],
        "weight": row["weight"],
        "readiness": None if row["proficiency"] is None else round(row["proficiency"] / 100, 3),
        "state": row["state"],
        "level": row["level"],
        "expectedLevel": row["expectedLevel"],
    }
