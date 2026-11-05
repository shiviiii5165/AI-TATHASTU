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
        "eris_readiness", "eris", "Interview Readiness", ["avasar_jobs"], ["skills", "experience"],
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

# ERIS: (canonical skill, weight) per role. Canonical names come from
# skills_catalog.CATALOG. "still_exploring" has no target, so no ERIS.
ROLE_SKILLS: Dict[str, List[Tuple[str, float]]] = {
    "generative_ai_engineer": [("Python", 1.0), ("Large Language Models", 1.0), ("Retrieval-Augmented Generation", 0.9),
                               ("Prompt Engineering", 0.7), ("Fine-tuning", 0.7), ("Vector Databases", 0.7),
                               ("PyTorch", 0.6), ("LangChain", 0.5), ("FastAPI", 0.5), ("Docker", 0.4)],
    "ml_engineer": [("Python", 1.0), ("Machine Learning", 1.0), ("scikit-learn", 0.8), ("PyTorch", 0.8),
                    ("SQL", 0.6), ("Docker", 0.6), ("MLflow", 0.5), ("Statistics", 0.6), ("AWS", 0.4), ("Git", 0.4)],
    "ai_engineer": [("Python", 1.0), ("Machine Learning", 0.8), ("Large Language Models", 0.8), ("REST APIs", 0.7),
                    ("FastAPI", 0.6), ("Docker", 0.6), ("SQL", 0.5), ("Git", 0.5), ("PyTorch", 0.5)],
    "ai_researcher": [("Python", 1.0), ("Deep Learning", 1.0), ("PyTorch", 0.9), ("Linear Algebra", 0.8),
                      ("Probability", 0.8), ("Statistics", 0.7), ("Transformers (architecture)", 0.7), ("JAX", 0.4)],
    "data_scientist": [("Python", 1.0), ("Statistics", 1.0), ("SQL", 0.9), ("Pandas", 0.9), ("Machine Learning", 0.8),
                       ("scikit-learn", 0.7), ("Matplotlib", 0.5), ("Tableau", 0.4), ("Time Series Analysis", 0.4)],
    "deep_learning_engineer": [("Python", 1.0), ("Deep Learning", 1.0), ("PyTorch", 1.0), ("CUDA", 0.6),
                               ("Convolutional Neural Networks", 0.6), ("Transformers (architecture)", 0.7),
                               ("TensorFlow", 0.4), ("Linear Algebra", 0.5)],
    "mlops_engineer": [("Python", 0.9), ("Docker", 1.0), ("Kubernetes", 0.9), ("CI/CD", 0.9), ("MLflow", 0.7),
                       ("AWS", 0.7), ("Linux", 0.7), ("Terraform", 0.5), ("Apache Airflow", 0.5)],
    "nlp_engineer": [("Python", 1.0), ("Natural Language Processing", 1.0), ("Hugging Face Transformers", 0.9),
                     ("PyTorch", 0.8), ("Large Language Models", 0.8), ("spaCy", 0.5), ("Fine-tuning", 0.6)],
    "computer_vision_engineer": [("Python", 1.0), ("Computer Vision", 1.0), ("OpenCV", 0.9), ("PyTorch", 0.8),
                                 ("Convolutional Neural Networks", 0.8), ("Object Detection", 0.7),
                                 ("Image Segmentation", 0.6)],
    "robotics_ai_engineer": [("Python", 0.9), ("C++", 0.9), ("ROS", 1.0), ("Computer Vision", 0.6),
                             ("Reinforcement Learning", 0.6), ("Simulation", 0.6), ("Linux", 0.5)],
    "rl_engineer": [("Python", 1.0), ("Reinforcement Learning", 1.0), ("PyTorch", 0.8), ("Probability", 0.7),
                    ("Simulation", 0.6), ("Deep Learning", 0.7)],
    "ai_product_founder": [("Python", 0.6), ("Large Language Models", 0.8), ("Generative AI", 0.8),
                           ("Prompt Engineering", 0.6), ("Next.js", 0.5), ("REST APIs", 0.5)],
    # ── Directions added with the 20-role catalog. Every skill is canonical (skills_catalog.CATALOG); the
    # specialist skills (speech, graph, federated/edge, LLM evaluation, agents, VLMs) carry the role.
    "llm_application_engineer": [("Python", 1.0), ("Large Language Models", 1.0), ("Retrieval-Augmented Generation", 0.9),
                                 ("Prompt Engineering", 0.9), ("LangChain", 0.8), ("REST APIs", 0.8), ("FastAPI", 0.7),
                                 ("Vector Databases", 0.7), ("LLM Evaluation", 0.5), ("TypeScript", 0.4), ("Docker", 0.4)],
    "llm_model_engineer": [("Python", 1.0), ("Large Language Models", 1.0), ("Fine-tuning", 1.0), ("PyTorch", 1.0),
                           ("Transformers (architecture)", 0.9), ("Hugging Face Transformers", 0.8), ("Distributed Training", 0.7),
                           ("CUDA", 0.6), ("Model Quantization", 0.6), ("LLM Evaluation", 0.6), ("Deep Learning", 0.7)],
    "llmops_engineer": [("Python", 0.9), ("Large Language Models", 0.9), ("Docker", 1.0), ("Kubernetes", 0.9),
                        ("CI/CD", 0.8), ("LLM Evaluation", 0.8), ("vLLM", 0.7), ("Model Quantization", 0.5),
                        ("Triton Inference Server", 0.5), ("Weights & Biases", 0.5), ("AWS", 0.6), ("Linux", 0.6)],
    "ai_agent_engineer": [("Python", 1.0), ("Large Language Models", 1.0), ("AI Agents", 1.0), ("Prompt Engineering", 0.9),
                          ("LangChain", 0.8), ("Retrieval-Augmented Generation", 0.7), ("REST APIs", 0.8),
                          ("LLM Evaluation", 0.6), ("FastAPI", 0.6), ("Vector Databases", 0.5), ("LlamaIndex", 0.4)],
    "multimodal_ai_engineer": [("Python", 1.0), ("Deep Learning", 1.0), ("Vision-Language Models", 1.0), ("PyTorch", 0.9),
                               ("Computer Vision", 0.9), ("Transformers (architecture)", 0.8),
                               ("Natural Language Processing", 0.7), ("Hugging Face Transformers", 0.7),
                               ("Audio Signal Processing", 0.4)],
    "speech_ai_engineer": [("Python", 1.0), ("Speech Recognition", 1.0), ("Deep Learning", 0.9),
                           ("Audio Signal Processing", 0.9), ("PyTorch", 0.9), ("Text-to-Speech", 0.7),
                           ("Transformers (architecture)", 0.7), ("Hugging Face Transformers", 0.6), ("NumPy", 0.5)],
    "graph_ai_engineer": [("Python", 1.0), ("Graph Neural Networks", 1.0), ("Deep Learning", 0.9), ("PyTorch", 0.8),
                          ("Knowledge Graphs", 0.8), ("Linear Algebra", 0.7), ("Data Structures and Algorithms", 0.7),
                          ("NetworkX", 0.6), ("Recommender Systems", 0.5), ("Neo4j", 0.4)],
    "ai_infrastructure_engineer": [("Python", 0.8), ("Kubernetes", 1.0), ("Docker", 1.0), ("Linux", 0.9), ("CUDA", 0.8),
                                   ("Distributed Training", 0.8), ("Terraform", 0.7), ("AWS", 0.7),
                                   ("Triton Inference Server", 0.6), ("TensorRT", 0.5), ("Google Cloud", 0.5)],
    "ai_evaluation_safety_engineer": [("Python", 1.0), ("LLM Evaluation", 1.0), ("AI Safety", 1.0), ("Statistics", 0.9),
                                      ("Large Language Models", 0.9), ("Machine Learning", 0.8), ("Probability", 0.7),
                                      ("Prompt Engineering", 0.6), ("Pandas", 0.5), ("Weights & Biases", 0.4)],
    "edge_federated_ai_engineer": [("Python", 0.9), ("On-device ML", 1.0), ("Federated Learning", 0.9),
                                   ("Model Quantization", 0.8), ("Deep Learning", 0.8), ("ONNX", 0.8), ("C++", 0.7),
                                   ("TensorFlow Lite", 0.7), ("Differential Privacy", 0.6), ("PyTorch", 0.6),
                                   ("TensorRT", 0.5)],
}

# Where a roadmap project should sit for each direction, so milestone deliverables differ by goal
# (e.g. PyTorch for a speech engineer is practised on a speech pipeline). Plain context, not a course.
ROLE_PROJECT_CONTEXT: Dict[str, str] = {
    "ml_engineer": "an end-to-end model you train, evaluate and deploy",
    "data_scientist": "an analysis of a real dataset with a written conclusion",
    "deep_learning_engineer": "a neural network you train from scratch",
    "generative_ai_engineer": "a generation pipeline over your own data",
    "llm_application_engineer": "an LLM-powered app with retrieval and tools",
    "llm_model_engineer": "fine-tuning and serving an open language model",
    "mlops_engineer": "a deployed, monitored ML pipeline",
    "llmops_engineer": "a deployed LLM service with evaluation and tracing",
    "ai_agent_engineer": "an agent that plans and uses tools",
    "nlp_engineer": "a text understanding or generation system",
    "computer_vision_engineer": "an image or video model",
    "multimodal_ai_engineer": "a model that combines images and text",
    "speech_ai_engineer": "a speech pipeline (transcription or voice)",
    "rl_engineer": "an agent trained in a simulated environment",
    "robotics_ai_engineer": "a robot or simulator controlled through ROS",
    "graph_ai_engineer": "a graph learning task on real relational data",
    "ai_infrastructure_engineer": "GPU training or serving infrastructure",
    "ai_evaluation_safety_engineer": "an evaluation suite for a model's quality and safety",
    "edge_federated_ai_engineer": "a model running on a device or trained across devices",
    "ai_researcher": "a reproduced paper or a new experiment",
}

# ERIS component weights (plan §2.4).
ERIS_WEIGHTS = {"technical": 0.5, "problem_solving": 0.25, "projects": 0.25}
ERIS_PROJECTS_FOR_FULL_SCORE = 3
