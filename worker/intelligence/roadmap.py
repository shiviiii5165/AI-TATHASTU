"""The roadmaps table and the next-actions list. The roadmap itself comes from career_engine.py."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def save_roadmap(cur: Any, user_id: str, roadmap: Optional[Dict[str, Any]]) -> None:
    from db import jsonb

    if roadmap is None:
        # No goal we can plan for: an earlier row must not outlive the goal it was written for.
        cur.execute("DELETE FROM roadmaps WHERE user_id = %s", (user_id,))
        return
    now = datetime.now(timezone.utc)
    cur.execute(
        """INSERT INTO roadmaps (user_id, current_stage, short_term, mid_term, long_term, updated_at)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (user_id) DO UPDATE SET
             current_stage = EXCLUDED.current_stage,
             short_term = EXCLUDED.short_term,
             mid_term = EXCLUDED.mid_term,
             long_term = EXCLUDED.long_term,
             updated_at = EXCLUDED.updated_at""",
        (
            user_id,
            roadmap["current_stage"],
            jsonb(roadmap["short_term"]),
            jsonb(roadmap["mid_term"]),
            jsonb(roadmap["long_term"]),
            now,
        ),
    )


def generate_next_best_actions(
    user: Dict[str, Any],
    gaps: List[Dict[str, Any]],
    completeness: float,
) -> List[Dict[str, Any]]:
    """Calculates top 5 immediate tasks based on profile gaps, completeness, and target role."""
    actions: List[Dict[str, Any]] = []
    num = 1
    target_role = user.get("career_role") or "your goal"

    # Action 1: Profile Completeness or Resume
    if completeness < 0.6:
        actions.append({
            "num": num,
            "title": "Complete your profile & resume",
            "desc": "Upload your CV to unlock automated skills inference and roadmap tracking.",
            "btnText": "Upload Resume →",
            "btnHref": "/onboarding/resume",
            "category": "onboarding",
        })
        num += 1
    elif completeness < 1.0:
        actions.append({
            "num": num,
            "title": "Finalize profile verification",
            "desc": "Confirm all extracted education, patents, and work history milestones.",
            "btnText": "Review Profile →",
            "btnHref": "/profile",
            "category": "profile",
        })
        num += 1

    # Action 2: Top Skill Gap / Learning Path
    if gaps and len(gaps) > 0:
        top_gap = gaps[0]
        skill_name = top_gap["skill"]
        actions.append({
            "num": num,
            "title": f"Target gap: {skill_name}",
            "desc": top_gap.get("description") or f"Strengthen {skill_name} to meet {target_role} benchmarks.",
            "btnText": "Explore Path →",
            "btnHref": "/learning",
            "category": "learning",
        })
        num += 1

    # Action 3: Projects & GitHub, for anyone not connected yet
    if not user.get("github_connected"):
        actions.append({
            "num": num,
            "title": "Connect your GitHub",
            "desc": "Repositories are the strongest evidence of your skills. Without them most stay unverified.",
            "btnText": "Connect →",
            "btnHref": "/connections",
            "category": "project",
        })
        num += 1

    # Action 4: Second Skill Gap
    if gaps and len(gaps) > 1:
        gap2 = gaps[1]
        skill2 = gap2["skill"]
        actions.append({
            "num": num,
            "title": f"Upskill in {skill2}",
            "desc": gap2.get("description") or f"Enhance practical {skill2} project implementations.",
            "btnText": "View Skills →",
            "btnHref": "/skills",
            "category": "skills",
        })
        num += 1

    # Action 5: Network / Collaboration
    actions.append({
        "num": num,
        "title": "Connect with research peers",
        "desc": f"Discover researchers and mentors aligned with {target_role}.",
        "btnText": "Find Peers →",
        "btnHref": "/people",
        "category": "network",
    })

    return actions[:5]
