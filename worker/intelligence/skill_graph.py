"""Skill relationships: which skills are documented to build on which.

Used by intelligence/career_engine.py for graph edges and for suggesting (never scoring) related
skills. The transfer weights describe how closely skills relate, not how good anyone is at them.
"""


from __future__ import annotations

import logging
from typing import Dict, List, Tuple

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
