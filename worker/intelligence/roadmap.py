"""Career Roadmap & Next Actions Engine.

Generates structured career trajectories (Current, Short-Term, Mid-Term, Long-Term)
and top 5 high-impact immediate next actions using LLMs with deterministic fallbacks.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


log = logging.getLogger("worker.roadmap")

ROADMAP_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "current_stage": {"type": "string"},
        "short_term": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "title": {"type": "string"},
                "timeline": {"type": "string"},
                "milestones": {"type": "array", "items": {"type": "string"}},
                "focus": {"type": "string"},
            },
            "required": ["title", "timeline", "milestones", "focus"],
        },
        "mid_term": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "title": {"type": "string"},
                "timeline": {"type": "string"},
                "milestones": {"type": "array", "items": {"type": "string"}},
                "focus": {"type": "string"},
            },
            "required": ["title", "timeline", "milestones", "focus"],
        },
        "long_term": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "title": {"type": "string"},
                "timeline": {"type": "string"},
                "milestones": {"type": "array", "items": {"type": "string"}},
                "focus": {"type": "string"},
            },
            "required": ["title", "timeline", "milestones", "focus"],
        },
    },
    "required": ["current_stage", "short_term", "mid_term", "long_term"],
}


def fallback_roadmap(user: Dict[str, Any]) -> Dict[str, Any]:
    role = user.get("role")
    academic_title = user.get("academic_title") or user.get("job_title")

    if role == "faculty":
        current = academic_title or "AI/ML Faculty"
    elif role == "alumni":
        current = academic_title or "Senior AI Engineer"
    else:
        current = f"{user.get('degree') or 'B.Tech'} Candidate ({user.get('academic_year') or 'Final Year'})"

    return {
        "current_stage": current,
        "short_term": {
            "title": "Research Grant & Project",
            "timeline": "0-6 Months",
            "milestones": ["Publish 2 papers", "Build Agentic AI project"],
            "focus": "Research Grant",
        },
        "mid_term": {
            "title": "Industry Collaboration",
            "timeline": "6-18 Months",
            "milestones": ["Industry Collaboration", "Deploy Production Model"],
            "focus": "Industry Collab",
        },
        "long_term": {
            "title": "Center of Excellence",
            "timeline": "2-4 Years",
            "milestones": ["Center of Excellence", "Global Recognition"],
            "focus": "Global Impact",
        },
    }


def generate_career_roadmap(
    user: Dict[str, Any],
    has_consent: bool = True,
    cur: Optional[Any] = None,
) -> Dict[str, Any]:
    """Generates structured career trajectory using RAG + internal LLM router."""
    from intelligence.skill_graph import query_rag_learning_resources
    from provider_router import ConsentRequired, NeedsReviewError, route_llm

    target_role = user.get("career_role") or "Machine Learning Engineer"
    rag_courses = query_rag_learning_resources(cur, [target_role, "Deep Learning", "Systems"]) if cur else []

    if not has_consent:
        return fallback_roadmap(user)

    rag_text = ""
    if rag_courses:
        rag_text = "\nRelevant Verified Learning Resources & Certifications (RAG Context):\n" + "\n".join(
            f"- {c['title']} ({c['provider']}): {c.get('description', '')}" for c in rag_courses
        ) + "\nIncorporate these verified courses and certifications into short_term and mid_term milestones where applicable."

    prompt = (
        f"Generate a career roadmap timeline for this user profile:\n"
        f"Name: {user.get('name')}\n"
        f"Role: {user.get('role')}\n"
        f"Degree/Affiliation: {user.get('degree')} at {user.get('university')}\n"
        f"Department/Title: {user.get('department')}, {user.get('academic_title') or user.get('job_title')}\n"
        f"Target Role: {target_role}\n"
        f"{rag_text}\n\n"
        f"Provide 'current_stage', 'short_term' (0-6 months), 'mid_term' (6-18 months), "
        f"and 'long_term' (2-4 years) with actionable milestones."
    )

    try:
        res = route_llm(
            system="You output strictly structured JSON career roadmaps grounded in real technical domains.",
            user=prompt,
            schema=ROADMAP_SCHEMA,
            consent_granted=has_consent,
            purpose="career_roadmap",
            timeout=15.0,
        )
        if isinstance(res.data, dict) and "current_stage" in res.data:
            return res.data
    except Exception as exc:
        log.warning("LLM roadmap generation failed (%s); using deterministic fallback", exc)

    return fallback_roadmap(user)


def save_roadmap(cur: Any, user_id: str, roadmap: Dict[str, Any]) -> None:
    from db import jsonb

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
    target_role = user.get("career_role") or "AI Researcher"

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
        skill_name = top_gap.get("skill") or "Advanced AI"
        actions.append({
            "num": num,
            "title": f"Target gap: {skill_name}",
            "desc": top_gap.get("description") or f"Strengthen {skill_name} to meet {target_role} benchmarks.",
            "btnText": "Explore Path →",
            "btnHref": "/learning",
            "category": "learning",
        })
        num += 1
    else:
        actions.append({
            "num": num,
            "title": "Enroll in advanced curriculum",
            "desc": f"Explore curated learning paths designed for {target_role}.",
            "btnText": "Browse Paths →",
            "btnHref": "/learning",
            "category": "learning",
        })
        num += 1

    # Action 3: Projects & GitHub
    actions.append({
        "num": num,
        "title": "Sync latest code artifacts",
        "desc": "Connect GitHub repositories to compute your live AI Impact Score.",
        "btnText": "Sync Repos →",
        "btnHref": "/projects",
        "category": "project",
    })
    num += 1

    # Action 4: Second Skill Gap or Skill Assessment
    if gaps and len(gaps) > 1:
        gap2 = gaps[1]
        skill2 = gap2.get("skill") or "MLOps"
        actions.append({
            "num": num,
            "title": f"Upskill in {skill2}",
            "desc": gap2.get("description") or f"Enhance practical {skill2} project implementations.",
            "btnText": "View Skills →",
            "btnHref": "/skills",
            "category": "skills",
        })
        num += 1
    else:
        actions.append({
            "num": num,
            "title": "Take AI domain assessment",
            "desc": "Benchmark your problem solving and code reasoning with AI evaluation.",
            "btnText": "Start Assessment →",
            "btnHref": "/skills",
            "category": "assessment",
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

