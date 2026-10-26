"""Skill Graph and Gap Analysis Engine.

Performs ontological skill mapping (e.g., PyTorch -> Python, Deep Learning)
and generates prioritized skill gaps and curated learning paths using internal
LLM routing (Groq/Gemini/OpenRouter) with deterministic fallback.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set, Tuple

log = logging.getLogger("worker.skill_graph")

# Ontological relationships: Source skill -> List of (Inferred Target Skill, Transfer Weight)
SKILL_ONTOLOGY: Dict[str, List[Tuple[str, float]]] = {
    # ML / DL Frameworks
    "PyTorch": [
        ("Python", 0.95),
        ("Deep Learning", 0.95),
        ("Neural Networks", 0.90),
        ("Machine Learning", 0.85),
    ],
    "TensorFlow": [
        ("Python", 0.90),
        ("Deep Learning", 0.95),
        ("Machine Learning", 0.85),
    ],
    "Keras": [
        ("Python", 0.85),
        ("Deep Learning", 0.90),
        ("Machine Learning", 0.85),
    ],
    "JAX": [
        ("Python", 0.90),
        ("Deep Learning", 0.90),
        ("High-Performance Computing", 0.80),
    ],
    "scikit-learn": [
        ("Python", 0.90),
        ("Machine Learning", 0.95),
        ("Data Science", 0.85),
    ],
    "XGBoost": [
        ("Python", 0.85),
        ("Machine Learning", 0.90),
        ("Gradient Boosting", 0.95),
    ],
    "LightGBM": [
        ("Python", 0.85),
        ("Machine Learning", 0.90),
        ("Gradient Boosting", 0.95),
    ],
    # LLM & Agent Ecosystem
    "Hugging Face Transformers": [
        ("Large Language Models", 0.95),
        ("Natural Language Processing", 0.95),
        ("Deep Learning", 0.90),
        ("Python", 0.85),
    ],
    "LangChain": [
        ("Large Language Models", 0.95),
        ("AI Agents", 0.90),
        ("RAG", 0.90),
        ("Python", 0.85),
    ],
    "LlamaIndex": [
        ("RAG", 0.95),
        ("Large Language Models", 0.90),
        ("Vector Search", 0.85),
        ("Python", 0.85),
    ],
    # Computer Vision & NLP
    "OpenCV": [
        ("Computer Vision", 0.95),
        ("Image Processing", 0.90),
        ("Python", 0.80),
    ],
    "spaCy": [
        ("Natural Language Processing", 0.95),
        ("Text Processing", 0.85),
        ("Python", 0.85),
    ],
    "NLTK": [
        ("Natural Language Processing", 0.90),
        ("Text Processing", 0.85),
        ("Python", 0.85),
    ],
    # Data & Analytics
    "Pandas": [
        ("Python", 0.95),
        ("Data Analysis", 0.95),
        ("Data Science", 0.85),
    ],
    "NumPy": [
        ("Python", 0.90),
        ("Scientific Computing", 0.85),
        ("Linear Algebra", 0.80),
    ],
    "Apache Spark": [
        ("Big Data", 0.95),
        ("Distributed Systems", 0.90),
        ("Data Engineering", 0.90),
    ],
    "Apache Airflow": [
        ("MLOps", 0.90),
        ("Data Engineering", 0.90),
        ("Python", 0.85),
    ],
    "Apache Kafka": [
        ("Distributed Systems", 0.90),
        ("Event Streaming", 0.95),
        ("Backend", 0.80),
    ],
    # DevOps / Infrastructure
    "Docker": [
        ("DevOps", 0.90),
        ("Containerization", 0.95),
        ("Linux", 0.85),
    ],
    "Kubernetes": [
        ("DevOps", 0.95),
        ("Container Orchestration", 0.95),
        ("Cloud Infrastructure", 0.90),
    ],
    "CUDA": [
        ("GPU Computing", 0.95),
        ("C++", 0.85),
        ("Parallel Computing", 0.90),
    ],
    # Web & Systems
    "FastAPI": [
        ("Python", 0.95),
        ("REST APIs", 0.90),
        ("Backend", 0.85),
    ],
    "React": [
        ("JavaScript", 0.95),
        ("Frontend", 0.95),
        ("Web Development", 0.90),
    ],
    "Next.js": [
        ("React", 0.95),
        ("JavaScript", 0.90),
        ("TypeScript", 0.85),
        ("Full Stack", 0.85),
    ],
    "TypeScript": [
        ("JavaScript", 0.95),
        ("Web Development", 0.85),
    ],
    "PostgreSQL": [
        ("SQL", 0.95),
        ("Relational Databases", 0.95),
        ("Backend", 0.80),
    ],
}


def determine_relationship(source: str, target: str) -> str:
    """Classifies the relational logic between source and target skill."""
    languages = {"Python", "JavaScript", "TypeScript", "SQL", "C++", "Java", "Go", "Rust", "HTML", "CSS"}
    if target in languages:
        return "requires"
    if source == "Next.js" and target == "React":
        return "built_on"
    if source in {"PyTorch", "TensorFlow", "Keras", "JAX", "scikit-learn", "XGBoost", "LightGBM"}:
        if target in {"Deep Learning", "Neural Networks", "Gradient Boosting"}:
            return "implements"
        if target in {"Machine Learning", "Data Science"}:
            return "subdomain_of"
        return "prerequisite"
    if source in {"Hugging Face Transformers", "LangChain", "LlamaIndex"}:
        if target in {"Large Language Models", "RAG", "AI Agents"}:
            return "extends"
        return "implements"
    if source in {"Docker", "Kubernetes", "Apache Spark", "Apache Airflow", "Apache Kafka", "CUDA"}:
        return "enables"
    if source in {"OpenCV", "spaCy", "NLTK"}:
        return "implements"
    if target in {"Machine Learning", "Deep Learning", "Data Science"}:
        return "subdomain_of"
    return "relates_to"


def categorize_skill(name: str) -> str:
    """Categorizes skill into domain group."""
    languages = {"Python", "JavaScript", "TypeScript", "SQL", "C++", "Java", "Go", "Rust"}
    if name in languages:
        return "Programming Language"
    frameworks = {
        "PyTorch", "TensorFlow", "Keras", "JAX", "scikit-learn",
        "XGBoost", "LightGBM", "React", "Next.js", "FastAPI"
    }
    if name in frameworks:
        return "Framework & Libraries"
    ai_specialties = {
        "Large Language Models", "Natural Language Processing", "Deep Learning",
        "Neural Networks", "Computer Vision", "RAG", "AI Agents", "Vector Search",
        "Gradient Boosting", "Scientific Computing", "Linear Algebra", "Image Processing",
        "Text Processing", "High-Performance Computing", "GPU Computing", "Parallel Computing"
    }
    if name in ai_specialties:
        return "AI/ML Specialization"
    infra = {
        "Docker", "Kubernetes", "Containerization", "DevOps", "Cloud Infrastructure",
        "Linux", "Apache Spark", "Apache Airflow", "Apache Kafka", "Big Data",
        "Distributed Systems", "Data Engineering", "Event Streaming", "Container Orchestration",
        "MLOps"
    }
    if name in infra:
        return "Infrastructure & MLOps"
    return "Core Competency"


class SkillGraph:
    """Directed graph inference engine for developer and researcher skills."""

    def __init__(self, ontology: Optional[Dict[str, List[Tuple[str, float]]]] = None):
        self.ontology = ontology or SKILL_ONTOLOGY

    def infer(self, direct_skills: Dict[str, float]) -> Dict[str, Dict[str, Any]]:
        """Given {skill_name: direct_strength}, infer parent and related skills.

        Returns a dictionary of:
        {
          skill_name: {
            "strength": float,
            "is_direct": bool,
            "inferred_from": [str]
          }
        }
        """
        results: Dict[str, Dict[str, Any]] = {}

        # 1. Initialize with direct skills
        for name, strength in direct_skills.items():
            results[name] = {
                "strength": min(1.0, float(strength)),
                "is_direct": True,
                "inferred_from": [],
            }

        # 2. Traverse inferences
        for source_skill, source_strength in direct_skills.items():
            inferences = self.ontology.get(source_skill, [])
            for target_skill, weight in inferences:
                inferred_strength = round(source_strength * weight * 0.85, 3)
                if target_skill in results:
                    existing = results[target_skill]
                    # Boost existing competence
                    combined = min(1.0, existing["strength"] + (inferred_strength * 0.35))
                    existing["strength"] = round(combined, 3)
                    if source_skill not in existing["inferred_from"]:
                        existing["inferred_from"].append(source_skill)
                else:
                    results[target_skill] = {
                        "strength": min(1.0, inferred_strength),
                        "is_direct": False,
                        "inferred_from": [source_skill],
                    }

        return results

    def build_graph(self, direct_skills: Dict[str, float]) -> Dict[str, Any]:
        """Builds a complete network graph payload with nodes, edges, and relational logic."""
        inferred = self.infer(direct_skills)

        # Build node list
        nodes: List[Dict[str, Any]] = []
        for sname, sdata in inferred.items():
            strength = sdata["strength"]
            confidence = int(round(strength * 100))
            is_direct = sdata["is_direct"]
            inferred_from = sdata["inferred_from"]

            if is_direct:
                source = "Found in verified repository code & profile evidence"
                reason = f"Directly evidenced from your project commits, verified repositories, and profile facts with {confidence}% confidence."
            else:
                parents = ", ".join(inferred_from) if inferred_from else "evidenced skills"
                first_parent = inferred_from[0] if inferred_from else "evidenced skills"
                rel = determine_relationship(first_parent, sname)
                rel_display = "which requires" if rel == "requires" else f"which is a {rel} for"
                source = f"Inferred from {parents}"
                reason = f"Inferred because you know [{parents}], {rel_display} [{sname}]."

            nodes.append({
                "id": sname,
                "name": sname,
                "strength": strength,
                "confidence": confidence,
                "isDirect": is_direct,
                "is_direct": is_direct,
                "source": source,
                "reason": reason,
                "inferredFrom": inferred_from,
                "inferred_from": inferred_from,
                "category": categorize_skill(sname),
            })

        # Build edges list with relational logic
        edges: List[Dict[str, Any]] = []
        seen_edges: Set[Tuple[str, str]] = set()
        node_names = set(inferred.keys())

        # 1. Edges from ontological relationships between present nodes
        for source_name in node_names:
            for target_name, weight in self.ontology.get(source_name, []):
                if target_name in node_names:
                    edge_key = (source_name, target_name)
                    if edge_key not in seen_edges:
                        seen_edges.add(edge_key)
                        rel = determine_relationship(source_name, target_name)
                        edges.append({
                            "source": source_name,
                            "target": target_name,
                            "relationship": rel,
                            "weight": weight,
                        })

        # 2. Ensure every inferred node has connecting edge(s) to its parent(s)
        for sname, sdata in inferred.items():
            if not sdata["is_direct"]:
                for parent in sdata["inferred_from"]:
                    if parent in node_names:
                        edge_key = (parent, sname)
                        if edge_key not in seen_edges:
                            seen_edges.add(edge_key)
                            rel = determine_relationship(parent, sname)
                            edges.append({
                                "source": parent,
                                "target": sname,
                                "relationship": rel,
                                "weight": 0.85,
                            })

        return {
            "nodes": nodes,
            "edges": edges,
        }

    def to_graph(self, direct_skills: Dict[str, float]) -> Dict[str, Any]:
        """Convenience alias for build_graph."""
        return self.build_graph(direct_skills)


# ─── LLM GAPS & LEARNING PATHS GENERATOR ────────────────────────────────────

GAP_RECOMMENDATIONS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "gaps": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "skill": {"type": "string"},
                    "description": {"type": "string"},
                    "priority": {"type": "string", "enum": ["High Priority", "Medium Priority", "Low Priority"]},
                    "action": {"type": "string"},
                },
                "required": ["skill", "description", "priority", "action"],
            },
        },
        "learning_paths": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "modules_count": {"type": "integer"},
                    "duration_weeks": {"type": "integer"},
                    "focus_areas": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["title", "description", "modules_count", "duration_weeks", "focus_areas"],
            },
        },
    },
    "required": ["gaps", "learning_paths"],
}


def query_rag_learning_resources(cur: Any, gap_skills: List[str], limit: int = 4) -> List[Dict[str, Any]]:
    """Retrieves verified learning resources from NeonDB using pgvector cosine distance."""
    if not cur:
        return []
    from intelligence.collaboration import compute_profile_vector

    found: List[Dict[str, Any]] = []
    seen = set()
    for skill in gap_skills[:3]:
        vec = compute_profile_vector("course", [skill], [], [skill], dim=768)
        vec_str = f"[{','.join(f'{x:.6f}' for x in vec)}]"
        try:
            cur.execute(
                """SELECT title, provider, url, description
                     FROM learning_resources
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector ASC
                    LIMIT 2""",
                (vec_str,),
            )
            rows = cur.fetchall()
            for r in rows:
                title = r["title"] if isinstance(r, dict) else r[0]
                provider = r["provider"] if isinstance(r, dict) else r[1]
                url = r["url"] if isinstance(r, dict) else r[2]
                desc = r["description"] if isinstance(r, dict) else r[3]
                if title not in seen:
                    seen.add(title)
                    found.append({"title": title, "provider": provider, "url": url, "description": desc})
        except Exception as exc:
            log.debug("RAG resource lookup failed: %s", exc)
    return found[:limit]


def fallback_gaps_and_paths(
    target_role: str,
    existing_skills: Set[str],
    rag_courses: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """Deterministic, high-quality fallback grounded in real courses when available."""
    default_paths = [
        {
            "title": "Advanced LLMs: From Foundations to Agents",
            "description": "DeepLearning.AI & AWS - Fine-tuning, PEFT, and autonomous agents",
            "modules_count": 12,
            "duration_weeks": 6,
            "focus_areas": ["RAG", "Agent Architectures", "Fine-Tuning"],
        },
        {
            "title": "MLOps for Real-World AI",
            "description": "DeepLearning.AI - Production deployment and monitoring pipelines",
            "modules_count": 10,
            "duration_weeks": 5,
            "focus_areas": ["Docker", "Kubernetes", "Prometheus", "Triton"],
        },
        {
            "title": "Practical Deep Learning for Coders",
            "description": "Fast.ai - Hands-on neural networks, PyTorch, and visual models",
            "modules_count": 8,
            "duration_weeks": 4,
            "focus_areas": ["PyTorch", "Computer Vision", "Model Optimization"],
        },
    ]

    if rag_courses and len(rag_courses) >= 2:
        default_paths = [
            {
                "title": c["title"],
                "description": f"{c['provider']} - {(c.get('description') or '')[:70]}",
                "modules_count": 10 + (idx * 2),
                "duration_weeks": 4 + idx,
                "focus_areas": [c["title"].split(":")[0].strip()[:20], "Production AI", "Applied ML"],
            }
            for idx, c in enumerate(rag_courses[:3])
        ]

    return {
        "gaps": [
            {
                "skill": "Advanced LLM Evaluation",
                "description": "RAGAS, LLM-as-a-judge, benchmark evaluation pipelines",
                "priority": "High Priority",
                "action": "Take Assessment",
            },
            {
                "skill": "MLOps & Deployment",
                "description": "Model serving, monitoring, production MLOps pipelines",
                "priority": "Medium Priority",
                "action": "Start Module",
            },
            {
                "skill": "Agentic AI Systems",
                "description": "Multi-agent frameworks, LangChain, tool-calling agents",
                "priority": "Medium Priority",
                "action": "Build Project",
            },
            {
                "skill": "AI Security",
                "description": "Prompt injection, guardrails, model alignment and safety",
                "priority": "Low Priority",
                "action": "Read Specs",
            },
        ],
        "learning_paths": default_paths,
    }


def generate_skill_gaps_and_recommendations(
    inferred_skills: Dict[str, Any],
    target_role: str = "ml_engineer",
    has_consent: bool = True,
    cur: Optional[Any] = None,
) -> Dict[str, Any]:
    """Generates prioritized gaps and curated learning paths using RAG + internal LLM router."""
    from provider_router import ConsentRequired, NeedsReviewError, route_llm

    known_skills = list(inferred_skills.keys())
    existing_set = set(known_skills)

    rag_courses = query_rag_learning_resources(cur, ["Large Language Models", "MLOps", target_role]) if cur else []

    if not has_consent:
        return fallback_gaps_and_paths(target_role, existing_set, rag_courses)

    rag_text = ""
    if rag_courses:
        rag_text = "\nVerified Learning Resources Catalog (RAG):\n" + "\n".join(
            f"- {c['title']} ({c['provider']}): {c.get('description', '')}" for c in rag_courses
        ) + "\nGround recommended learning paths in these specific verified courses."

    prompt = (
        f"You are the AI Tathastu Skill Intelligence Engine.\n"
        f"Target Role: {target_role}\n"
        f"User's Evidenced and Inferred Skills: {', '.join(known_skills[:30])}\n"
        f"{rag_text}\n\n"
        f"Identify the top 4 skill gaps categorized as High Priority, Medium Priority, Low Priority. "
        f"Also recommend 3 curated learning paths with specific module counts and duration in weeks."
    )

    try:
        res = route_llm(
            system="You output strictly structured JSON skill gap and learning roadmap intelligence.",
            user=prompt,
            schema=GAP_RECOMMENDATIONS_SCHEMA,
            consent_granted=has_consent,
            purpose="skill_gap_analysis",
            timeout=15.0,
        )
        data = res.data
        if isinstance(data, dict) and "gaps" in data and "learning_paths" in data:
            return data
    except Exception as exc:
        log.warning("LLM gap analysis failed (%s); using deterministic engine fallback", exc)

    return fallback_gaps_and_paths(target_role, existing_set, rag_courses)
