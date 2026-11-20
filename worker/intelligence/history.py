"""Immutable assessment history and change explanations (workstream A). Pure: compute.py does the reading and writing.

A snapshot is a compact, versioned summary of one assessment: per goal the alignment state and which requirements are met,
and per skill its level and evidence basis. A new snapshot is written only when the summary changes (fingerprint), and
never updated afterwards (migration 0035 refuses UPDATE). `explain` says what changed between two snapshots and why, and
separates a change in the student's evidence from a change in our method (engine or framework version), so a student is
never told they improved or regressed when only the methodology moved.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any, Dict, List, Optional

SNAPSHOT_VERSION = 1
LEVEL_ORDER = ("Not assessed", "Foundational", "Working", "Proficient", "Advanced")
STATE_ORDER = ("not_enough_evidence", "early", "developing", "strong", "requirements_demonstrated")


def summarize(intelligence: Dict[str, Any], sources: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    roles = []
    for a in intelligence.get("roles") or []:
        al = a.get("alignment") or {}
        roles.append({
            "role": a["role"], "label": a.get("label"), "state": al.get("state"), "requiredMet": al.get("requiredMet"), "required": al.get("required"),
            "met": sorted(r["skill"] for r in a.get("skills", []) if r.get("state") == "met"),
        })
    skills = {s["name"]: {"level": s.get("level"), "basis": s.get("evidenceBasis")} for s in intelligence.get("skills") or [] if s.get("proficiency") is not None}
    return {
        "snapshotVersion": SNAPSHOT_VERSION,
        "engineVersion": intelligence.get("engineVersion"),
        "frameworkVersion": (intelligence.get("framework") or {}).get("version"),
        "roles": roles,
        "skills": skills,
        "evidence": {k: (sources or {}).get(k) for k in ("facts", "repositories")},
    }


def fingerprint(summary: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(summary, sort_keys=True, default=str).encode()).hexdigest()[:32]


def _rank(order, value) -> int:
    return order.index(value) if value in order else -1


def explain(previous: Optional[Dict[str, Any]], current: Dict[str, Any]) -> Dict[str, Any]:
    """{methodologyChanged, evidenceChanged, changes:[{kind, role?, skill?, from, to, text}]}. Empty changes when equal."""
    if not previous:
        return {"first": True, "methodologyChanged": False, "evidenceChanged": True, "changes": [{"kind": "first", "text": "Your first assessment."}]}
    method = (previous.get("engineVersion"), previous.get("frameworkVersion")) != (current.get("engineVersion"), current.get("frameworkVersion"))
    evidence = previous.get("evidence") != current.get("evidence")
    changes: List[Dict[str, Any]] = []
    if method:
        changes.append({"kind": "methodology", "from": f"engine v{previous.get('engineVersion')}, framework {previous.get('frameworkVersion')}",
                        "to": f"engine v{current.get('engineVersion')}, framework {current.get('frameworkVersion')}",
                        "text": "We updated how assessments are made. Changes below may come from that update rather than from your work."})
    before_roles = {r["role"]: r for r in previous.get("roles") or []}
    for r in current.get("roles") or []:
        b = before_roles.get(r["role"])
        if not b:
            changes.append({"kind": "goal_added", "role": r["role"], "text": f"{r.get('label') or r['role']} was added as a goal."})
            continue
        if b.get("state") != r.get("state"):
            up = _rank(STATE_ORDER, r.get("state")) > _rank(STATE_ORDER, b.get("state"))
            changes.append({"kind": "alignment", "role": r["role"], "from": b.get("state"), "to": r.get("state"),
                            "text": f"{r.get('label')}: alignment {'rose' if up else 'fell'} from {b.get('state')} to {r.get('state')}."})
        for s in sorted(set(r.get("met") or []) - set(b.get("met") or [])):
            changes.append({"kind": "requirement_met", "role": r["role"], "skill": s, "text": f"{r.get('label')}: {s} now meets its requirement."})
        for s in sorted(set(b.get("met") or []) - set(r.get("met") or [])):
            changes.append({"kind": "requirement_unmet", "role": r["role"], "skill": s,
                            "text": f"{r.get('label')}: {s} no longer meets its requirement" + (" (the method changed)." if method else ".")})
    for role in sorted(set(before_roles) - {r["role"] for r in current.get("roles") or []}):
        changes.append({"kind": "goal_removed", "role": role, "text": f"{before_roles[role].get('label') or role} is no longer a goal."})
    bs, cs = previous.get("skills") or {}, current.get("skills") or {}
    for name in sorted(set(bs) | set(cs)):
        a, b = (bs.get(name) or {}).get("level", "Not assessed"), (cs.get(name) or {}).get("level", "Not assessed")
        if a != b:
            up = _rank(LEVEL_ORDER, b) > _rank(LEVEL_ORDER, a)
            basis = (cs.get(name) or {}).get("basis")
            changes.append({"kind": "level", "skill": name, "from": a, "to": b,
                            "text": f"{name}: {a} -> {b}" + (f" (now based on {basis.replace('_', ' ')} evidence)" if up and basis else "") + "."})
    return {"first": False, "methodologyChanged": method, "evidenceChanged": evidence, "changes": changes}
