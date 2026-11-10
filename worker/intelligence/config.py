"""Static inputs to compute_intelligence.

The plan stores these in intelligence_config, widget_role_affinity and
role_skill_matrix so they can change without a deploy; those tables don't
exist yet, so this module is the stand-in. Moving them to tables changes
where they're loaded from, not the scoring code.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

ALL_PERSONAS: Tuple[str, ...] = ("student", "faculty", "alumni")

# P(w) = αI + βG + γR + δF
WEIGHTS = {"alpha": 0.35, "beta": 0.30, "gamma": 0.25, "delta": 0.10}
STALE_THRESHOLD_HOURS = 7 * 24

# Evidence strength by source (plan §2.2).
STRENGTH = {
    "resume_confirmed": 0.5,
    "github_language": 0.7,  # scaled by how many repos use it
    "assessment": 0.9,
    "mentor": 1.0,
    "self_reported": 0.3,
}

ENGINEERING_ROLES = [
    "generative_ai_engineer", "ml_engineer", "ai_engineer", "deep_learning_engineer", "mlops_engineer",
    "nlp_engineer", "computer_vision_engineer", "robotics_ai_engineer", "rl_engineer",
    # Added with the 20-direction catalog (src/lib/onboarding/catalog.ts).
    "llm_application_engineer", "llm_model_engineer", "llmops_engineer", "ai_agent_engineer",
    "multimodal_ai_engineer", "speech_ai_engineer", "graph_ai_engineer", "ai_infrastructure_engineer",
    "ai_evaluation_safety_engineer", "edge_federated_ai_engineer",
]


@dataclass(frozen=True)
class WidgetDef:
    id: str
    module: str
    label: str
    required_intent: List[str]
    required_data: List[str]  # field groups that need >=1 usable fact
    freshness_source: Optional[str] = None
    # role → affinity (G). Unlisted roles use `default_affinity`.
    affinity: Dict[str, float] = field(default_factory=dict)
    default_affinity: float = 0.5
    # Which personas' dashboards include it (users.role).
    personas: Tuple[str, ...] = ("student",)
    # Layout preview: shown before its data source (a Phase 4 module) exists.
    preview: bool = False


def _roles(value: float, roles: List[str]) -> Dict[str, float]:
    return {r: value for r in roles}


# Mirrors the plan's widget registry (§3.1). The Phase 3 TypeScript registry
# must keep the same ids.
WIDGETS: List[WidgetDef] = [
    WidgetDef(
        "eris_readiness", "eris", "Where you stand", ["avasar_jobs"], ["skills", "experience"],
        affinity={**_roles(0.9, ENGINEERING_ROLES), "data_scientist": 0.9, "ai_researcher": 0.5, "still_exploring": 0.2},
    ),
    WidgetDef(
        "job_matches", "avasar", "Jobs that fit you", ["avasar_jobs"], ["skills", "experience", "education"],
        affinity={**_roles(1.0, ENGINEERING_ROLES), "data_scientist": 1.0, "ai_researcher": 0.4,
                  "ai_product_founder": 0.3, "still_exploring": 0.2},
    ),
    WidgetDef(
        "skill_gaps", "learn", "Skills to develop", ["learn_ai_ml", "avasar_jobs"], ["skills"],
        affinity={"still_exploring": 0.7}, default_affinity=0.9,
    ),
    WidgetDef(
        "github_activity", "profile", "Recent GitHub work", ["build_projects", "avasar_jobs"], [],
        freshness_source="github",
        affinity={**_roles(0.8, ENGINEERING_ROLES), "ai_product_founder": 0.8}, default_affinity=0.5,
        personas=ALL_PERSONAS,
    ),
    WidgetDef(
        "project_ideas", "projects", "Projects to build next", ["build_projects", "learn_ai_ml"], ["skills"],
        affinity={"still_exploring": 0.8, "ai_product_founder": 0.9}, default_affinity=0.7,
    ),
    WidgetDef(
        "collaboration_opportunities", "collaborate", "Teams looking for you", ["collaborate", "people_mentors"], ["skills"],
        affinity={"ai_product_founder": 0.9}, default_affinity=0.6,
    ),
    # No intent of its own: it ranks on goal/readiness alone and drops out at 100%.
    WidgetDef("profile_completeness", "profile", "Finish your profile", [], [], default_affinity=0.6, personas=ALL_PERSONAS),
    WidgetDef("mentor_sessions", "collaborate", "Mentors in your field", ["people_mentors"], [], default_affinity=0.6),
    WidgetDef(
        "research_feed", "meet", "Papers and events", ["research_events", "research"], [],
        affinity={"ai_researcher": 1.0, "deep_learning_engineer": 0.6, "nlp_engineer": 0.6,
                  "computer_vision_engineer": 0.6, "rl_engineer": 0.7}, default_affinity=0.4,
        personas=("student", "faculty"), preview=True,
    ),
    # ── Faculty / mentors. Intents come from their answers (persona_intents). ──
    WidgetDef("student_matches", "collaborate", "Students who match your expertise", ["mentoring", "research"], [],
              default_affinity=0.9, personas=("faculty",), preview=True),
    WidgetDef("mentee_requests", "mentor", "Mentee requests", ["mentoring", "reviewing"], [],
              default_affinity=0.8, personas=("faculty",), preview=True),
    # ── Alumni ──
    WidgetDef("top_talent", "avasar", "Top student talent", ["referrals", "network"], [],
              default_affinity=0.9, personas=("alumni",), preview=True),
    WidgetDef("referral_requests", "avasar", "Referral requests", ["referrals"], [],
              default_affinity=0.8, personas=("alumni",), preview=True),
    WidgetDef("alumni_network", "collaborate", "Your alumni network", ["network", "mentoring"], [],
              default_affinity=0.7, personas=("alumni",), preview=True),
]


def persona_intents(persona: str, state: Dict) -> List[str]:
    """Faculty and alumni have no Step 2 priorities; their answers play that role (primary first)."""
    if persona == "faculty":
        m = state.get("mentorship") or {}
        out = ["mentoring"] if (m.get("capacity") or 0) > 0 else []
        if m.get("canReviewResumes") or m.get("canVerifyEris"):
            out.append("reviewing")
        return out + ["research"]
    if persona == "alumni":
        g = state.get("give_back") or {}
        out = ["referrals"] if g.get("refer") else []
        if g.get("mentor"):
            out.append("mentoring")
        return out + ["network"]
    return list(state.get("priorities") or [])

# Role frameworks live in intelligence/frameworks/role_frameworks.json (versioned, DRAFT / UNREVIEWED) and the
# role list in intelligence/frameworks/career_roles.json. These two views keep older callers (ERIS, tests)
# working; they are derived, never edited here.
from intelligence.frameworks import FRAMEWORKS as _FRAMEWORKS  # noqa: E402

ROLE_SKILLS: Dict[str, List[Tuple[str, float]]] = {
    role: [(r.competency, r.weight) for r in f.requirements] for role, f in _FRAMEWORKS.items()
}
ROLE_PROJECT_CONTEXT: Dict[str, str] = {role: f.project_context for role, f in _FRAMEWORKS.items() if f.project_context}

# ERIS component weights (plan §2.4).
ERIS_WEIGHTS = {"technical": 0.5, "problem_solving": 0.25, "projects": 0.25}
ERIS_PROJECTS_FOR_FULL_SCORE = 3
