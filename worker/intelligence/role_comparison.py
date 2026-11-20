"""Multi-role and transferable-competency intelligence (workstream B). Pure: reads role analyses already computed by
career_engine.analyze_role, so a competency's state is the same in every comparison and nothing is re-scored.

For a student with several goals, against the primary goal:
  shared         competencies both roles ask for, with each role's expected level (they can differ)
  transfers      shared and already met for the other role too: work that counts twice
  raiseLevel     shared and met for the primary goal, but the other role expects more
  newToLearn     only the other role asks for it, and it isn't met
  alreadyCovered only the other role asks for it, and the student's evidence already meets it
and across every selected goal, `commonFoundations`: open competencies two or more goals need, so one piece of learning
moves several goals. Effort is described by these counts and names only: no hours or probabilities are invented.
"""

from __future__ import annotations

from typing import Any, Dict, List, Sequence

from intelligence.frameworks import FRAMEWORKS, LEVEL_FLOOR

MAX_COMPARED = 5  # comparisons stored per assessment; a student rarely selects more goals than this


def _rows(analysis: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {r["skill"]: r for r in analysis.get("skills", [])}


def compare_pair(primary: Dict[str, Any], other: Dict[str, Any]) -> Dict[str, Any]:
    p, o = _rows(primary), _rows(other)
    shared = sorted(set(p) & set(o))
    out = {
        "role": other["role"], "label": other["label"],
        "shared": [{
            "skill": s, "primaryExpected": p[s]["expectedLevel"], "otherExpected": o[s]["expectedLevel"],
            "primaryTier": p[s]["tier"], "otherTier": o[s]["tier"], "otherState": o[s]["state"],
        } for s in shared],
        "transfers": [s for s in shared if o[s]["state"] == "met"],
        "raiseLevel": [s for s in shared if p[s]["state"] == "met" and o[s]["state"] != "met"
                       and LEVEL_FLOOR[o[s]["expectedLevel"]] > LEVEL_FLOOR[p[s]["expectedLevel"]]],
        "newToLearn": sorted((s for s in set(o) - set(p) if o[s]["state"] != "met"),
                             key=lambda s: (0 if o[s]["tier"] == "required" else 1, o[s].get("priorityRank") or 99, s)),
        "alreadyCovered": sorted(s for s in set(o) - set(p) if o[s]["state"] == "met"),
        "primaryOnly": sorted(set(p) - set(o)),
    }
    req_o = [s for s, r in o.items() if r["tier"] == "required"]
    out["counts"] = {
        "shared": len(shared), "transfers": len(out["transfers"]), "raiseLevel": len(out["raiseLevel"]),
        "newToLearn": len(out["newToLearn"]), "newRequired": sum(1 for s in out["newToLearn"] if o[s]["tier"] == "required"),
        "otherRequired": len(req_o), "otherRequiredMet": sum(1 for s in req_o if o[s]["state"] == "met"),
    }
    out["summary"] = _summary(primary["label"], out)
    return out


def _summary(primary_label: str, c: Dict[str, Any]) -> str:
    n = c["counts"]
    parts = [f"{n['shared']} of {c['label']}'s competencies are shared with {primary_label}"]
    if n["transfers"]:
        parts.append(f"{n['transfers']} already count for both")
    if n["raiseLevel"]:
        parts.append(f"{n['raiseLevel']} need a higher level for {c['label']}")
    parts.append(f"{n['newToLearn']} are new for {c['label']} ({n['newRequired']} required)" if n["newToLearn"] else f"nothing new to learn for {c['label']}")
    return "; ".join(parts) + "."


def common_foundations(analyses: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Open competencies needed by two or more selected goals, most-shared first: learning that moves several goals."""
    seen: Dict[str, Dict[str, Any]] = {}
    for a in analyses:
        for r in a.get("skills", []):
            if r["state"] == "met":
                continue
            row = seen.setdefault(r["skill"], {"skill": r["skill"], "roles": [], "requiredBy": []})
            row["roles"].append(a["role"])
            if r["tier"] == "required":
                row["requiredBy"].append(a["role"])
    rows = [r for r in seen.values() if len(r["roles"]) >= 2]
    return sorted(rows, key=lambda r: (-len(r["requiredBy"]), -len(r["roles"]), r["skill"]))[:12]


def compare(analyses: Sequence[Dict[str, Any]]) -> Dict[str, Any] | None:
    """None for a single goal. Comparisons are against the primary (first) goal; analyses are the full ones, before
    compaction, so every row carries its state, tier and expected level."""
    analyses = [a for a in analyses if a and a.get("role") in FRAMEWORKS]
    if len(analyses) < 2:
        return None
    primary = analyses[0]
    return {
        "primary": primary["role"],
        "comparisons": [compare_pair(primary, other) for other in analyses[1:1 + MAX_COMPARED]],
        "commonFoundations": common_foundations(analyses[:1 + MAX_COMPARED]),
        "basis": ("Counts of the competencies each goal's framework asks for, from the same evidence and the same assessment. "
                  "Not a time estimate and not a likelihood of being hired."),
    }
