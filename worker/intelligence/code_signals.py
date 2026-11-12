"""What a repository's own files show about the skills it uses: dependency manifests, structure and README.

The GitHub connector fetches a few small files per repository (connectors/github.py `fetch_code_signals`) and
stores the parsed result in code_repositories.code_signals (migration 0031). This module is the pure half: parsing
manifests, mapping packages to canonical skills, and turning stored signals into evidence the engine can score.

What each signal can and can't show:
  dependency   the project declares the package (requirements.txt, pyproject.toml, package.json...). Strong evidence
               the code uses it; it does NOT show how well, or that the student wrote that part.
  structure    a tests folder, CI workflows, a Dockerfile, Kubernetes or Terraform files exist in the repository.
  readme       the README names the skill: the student's own words, in a public place next to the code.

Nothing here reads source code, runs it, or judges its quality. Contribution ownership is not established either:
GitHub lists repositories the student owns or collaborates on, and the engine says so.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

# 2: adds `contribution` (the student's share of commits, from GitHub's contributors API).
SIGNALS_VERSION = 2
ACCEPTED_VERSIONS = (1, 2)
CONFIRMED_SHARE = 0.5          # most commits are the student's
CONFIRMED_SHARE_MIN_COMMITS = (0.25, 20)  # or a substantial share with real volume

# Root files worth fetching, smallest set that covers Python and JavaScript projects.
MANIFESTS = ("requirements.txt", "pyproject.toml", "environment.yml", "environment.yaml", "setup.py", "Pipfile", "package.json", "setup.cfg")
MAX_MANIFEST_BYTES = 60_000
MAX_README_BYTES = 40_000

# Package (normalised: lower-case, "_" and "." as "-") -> canonical skills it evidences. A library implies the concept
# it is used for only where that is its main purpose (scikit-learn -> Machine Learning); general-purpose packages
# (numpy, requests, pillow) imply nothing beyond themselves.
PACKAGE_SKILLS: Dict[str, Tuple[str, ...]] = {
    # Deep learning frameworks
    "torch": ("PyTorch", "Deep Learning"), "pytorch": ("PyTorch", "Deep Learning"), "pytorch-lightning": ("PyTorch", "Deep Learning"),
    "lightning": ("PyTorch", "Deep Learning"), "torchvision": ("PyTorch", "Computer Vision"), "torchaudio": ("PyTorch", "Audio Signal Processing"),
    "tensorflow": ("TensorFlow", "Deep Learning"), "tensorflow-cpu": ("TensorFlow", "Deep Learning"), "tensorflow-gpu": ("TensorFlow", "Deep Learning"),
    "tf-keras": ("Keras", "Deep Learning"), "keras": ("Keras", "Deep Learning"), "jax": ("JAX",), "flax": ("JAX", "Deep Learning"),
    "timm": ("PyTorch", "Computer Vision"),
    # Classical ML
    "scikit-learn": ("scikit-learn", "Machine Learning"), "sklearn": ("scikit-learn", "Machine Learning"),
    "xgboost": ("XGBoost", "Machine Learning"), "lightgbm": ("LightGBM", "Machine Learning"), "catboost": ("Machine Learning",),
    "statsmodels": ("Statistics",), "pingouin": ("Statistics",), "scipy": ("SciPy",), "prophet": ("Time Series Analysis",),
    "sktime": ("Time Series Analysis",), "darts": ("Time Series Analysis",), "surprise": ("Recommender Systems",), "implicit": ("Recommender Systems",),
    # Data
    "pandas": ("Pandas",), "polars": ("Data Preparation",), "numpy": ("NumPy",), "pyspark": ("Apache Spark",),
    "matplotlib": ("Matplotlib", "Data Visualization"), "seaborn": ("Seaborn", "Data Visualization"), "plotly": ("Plotly", "Data Visualization"),
    "altair": ("Data Visualization",), "bokeh": ("Data Visualization",),
    "sqlalchemy": ("SQL",), "psycopg2": ("SQL",), "psycopg2-binary": ("SQL",), "psycopg": ("SQL",), "duckdb": ("SQL",),
    "pymongo": ("MongoDB",), "redis": ("Redis",), "elasticsearch": ("Elasticsearch",), "kafka-python": ("Apache Kafka",), "confluent-kafka": ("Apache Kafka",),
    # Language models and generative AI
    "transformers": ("Hugging Face Transformers",), "sentence-transformers": ("Embeddings",),
    "peft": ("Fine-tuning",), "trl": ("Fine-tuning",), "unsloth": ("Fine-tuning",), "axolotl": ("Fine-tuning",),
    "bitsandbytes": ("Model Quantization",), "auto-gptq": ("Model Quantization",), "autoawq": ("Model Quantization",), "optimum": ("Model Quantization",),
    "deepspeed": ("Distributed Training",), "openai": ("Large Language Models",), "anthropic": ("Large Language Models",),
    "google-generativeai": ("Large Language Models",), "google-genai": ("Large Language Models",), "cohere": ("Large Language Models",),
    "mistralai": ("Large Language Models",), "groq": ("Large Language Models",), "ollama": ("Large Language Models",), "litellm": ("Large Language Models",),
    "langchain": ("LangChain", "Large Language Models"), "langchain-core": ("LangChain", "Large Language Models"),
    "langchain-community": ("LangChain", "Large Language Models"), "langchain-openai": ("LangChain", "Large Language Models"),
    "langgraph": ("AI Agents", "Large Language Models"), "crewai": ("AI Agents", "Large Language Models"), "autogen": ("AI Agents", "Large Language Models"),
    "pyautogen": ("AI Agents", "Large Language Models"), "ag2": ("AI Agents", "Large Language Models"), "smolagents": ("AI Agents", "Large Language Models"),
    "openai-agents": ("AI Agents", "Large Language Models"), "llama-index": ("LlamaIndex", "Large Language Models"),
    "llama-index-core": ("LlamaIndex", "Large Language Models"), "faiss-cpu": ("Vector Databases",), "faiss-gpu": ("Vector Databases",),
    "chromadb": ("Vector Databases",), "pinecone": ("Vector Databases",), "pinecone-client": ("Vector Databases",), "qdrant-client": ("Vector Databases",),
    "weaviate-client": ("Vector Databases",), "pymilvus": ("Vector Databases",), "lancedb": ("Vector Databases",), "pgvector": ("Vector Databases",),
    "ragas": ("LLM Evaluation",), "deepeval": ("LLM Evaluation",), "lm-eval": ("LLM Evaluation",), "trulens": ("LLM Evaluation",), "inspect-ai": ("LLM Evaluation",),
    "langfuse": ("Model Monitoring",), "langsmith": ("Model Monitoring",), "evidently": ("Model Monitoring",), "arize-phoenix": ("Model Monitoring",),
    "whylogs": ("Model Monitoring",), "guardrails-ai": ("AI Safety",), "nemoguardrails": ("AI Safety",), "llm-guard": ("AI Safety",),
    "diffusers": ("Diffusion Models", "Generative AI"),
    # NLP
    "spacy": ("spaCy", "Natural Language Processing"), "nltk": ("NLTK", "Natural Language Processing"), "gensim": ("Natural Language Processing",),
    # Vision
    "opencv-python": ("OpenCV", "Computer Vision"), "opencv-python-headless": ("OpenCV", "Computer Vision"), "opencv-contrib-python": ("OpenCV", "Computer Vision"),
    "ultralytics": ("Object Detection", "Computer Vision"), "detectron2": ("Object Detection", "Computer Vision"), "mmdet": ("Object Detection", "Computer Vision"),
    "segmentation-models-pytorch": ("Image Segmentation", "Computer Vision"), "albumentations": ("Computer Vision",), "scikit-image": ("Computer Vision",),
    "open-clip-torch": ("Vision-Language Models",),
    # Speech
    "librosa": ("Audio Signal Processing",), "openai-whisper": ("Speech Recognition",), "faster-whisper": ("Speech Recognition",),
    "whisperx": ("Speech Recognition",), "speechbrain": ("Speech Recognition",), "vosk": ("Speech Recognition",), "tts": ("Text-to-Speech",), "piper-tts": ("Text-to-Speech",),
    # Graphs
    "torch-geometric": ("Graph Neural Networks",), "dgl": ("Graph Neural Networks",), "networkx": ("NetworkX",), "neo4j": ("Neo4j",), "py2neo": ("Neo4j",),
    "rdflib": ("Knowledge Graphs",),
    # RL, simulation, robotics
    "gymnasium": ("Simulation", "Reinforcement Learning"), "gym": ("Simulation", "Reinforcement Learning"), "pettingzoo": ("Simulation", "Reinforcement Learning"),
    "stable-baselines3": ("Reinforcement Learning",), "tianshou": ("Reinforcement Learning",), "mujoco": ("Simulation",), "pybullet": ("Simulation",),
    "rclpy": ("ROS",), "rospy": ("ROS",),
    # Edge, privacy, serving
    "flwr": ("Federated Learning",), "opacus": ("Differential Privacy",), "tensorflow-privacy": ("Differential Privacy",),
    "onnx": ("ONNX",), "onnxruntime": ("ONNX",), "onnxruntime-gpu": ("ONNX",), "tflite-runtime": ("TensorFlow Lite", "On-device ML"),
    "ai-edge-litert": ("TensorFlow Lite", "On-device ML"), "coremltools": ("On-device ML",), "executorch": ("On-device ML",),
    "tensorrt": ("TensorRT",), "tritonclient": ("Triton Inference Server",), "vllm": ("vLLM",), "cupy": ("CUDA",), "pycuda": ("CUDA",),
    # MLOps
    "mlflow": ("MLflow",), "wandb": ("Weights & Biases",), "dvc": ("DVC",), "apache-airflow": ("Apache Airflow",), "kfp": ("Kubeflow",),
    "boto3": ("AWS",), "sagemaker": ("AWS",), "kubernetes": ("Kubernetes",),
    # Web and testing
    "fastapi": ("FastAPI", "REST APIs"), "flask": ("Flask",), "django": ("Django",), "djangorestframework": ("Django", "REST APIs"),
    "streamlit": ("Streamlit",), "gradio": ("Gradio",), "pytest": ("Software Testing",), "pytest-cov": ("Software Testing",), "hypothesis": ("Software Testing",),
    # JavaScript / TypeScript (package.json)
    "next": ("Next.js",), "react": ("React",), "typescript": ("TypeScript",), "@anthropic-ai/sdk": ("Large Language Models",),
    "@google/generative-ai": ("Large Language Models",), "@google/genai": ("Large Language Models",), "ai": ("Large Language Models",),
    "@langchain/core": ("LangChain", "Large Language Models"), "@langchain/openai": ("LangChain", "Large Language Models"),
    "@langchain/langgraph": ("AI Agents", "Large Language Models"), "llamaindex": ("LlamaIndex", "Large Language Models"),
    "@pinecone-database/pinecone": ("Vector Databases",), "jest": ("Software Testing",), "vitest": ("Software Testing",),
    "@playwright/test": ("Software Testing",), "mocha": ("Software Testing",), "express": ("REST APIs", "Node.js"), "fastify": ("REST APIs", "Node.js"),
    "@tensorflow/tfjs": ("TensorFlow", "On-device ML"), "onnxruntime-web": ("ONNX", "On-device ML"),
    "@huggingface/transformers": ("Hugging Face Transformers", "On-device ML"), "@xenova/transformers": ("Hugging Face Transformers", "On-device ML"),
}
# Package families matched by prefix.
PACKAGE_PREFIXES: Tuple[Tuple[str, Tuple[str, ...]], ...] = (
    ("google-cloud-", ("Google Cloud",)), ("azure-", ("Azure",)), ("llama-index-", ("LlamaIndex", "Large Language Models")),
    ("langchain-", ("LangChain", "Large Language Models")), ("@langchain/", ("LangChain", "Large Language Models")), ("@aws-sdk/", ("AWS",)),
)

# Structure flags -> skill they evidence.
STRUCTURE_SKILLS = {"tests": "Software Testing", "ci": "CI/CD", "dockerfile": "Docker", "kubernetes": "Kubernetes", "terraform": "Terraform"}
QUALITY_FLAGS = ("tests", "ci")


def normalise_package(name: str) -> str:
    name = name.strip().strip("'\"").lower()
    if name.startswith("@"):
        return name  # npm scopes keep their slash
    name = re.split(r"[\s\[<>=!~;@(]", name, maxsplit=1)[0]
    return re.sub(r"[_.]+", "-", name)


def skills_for_package(package: str) -> Tuple[str, ...]:
    p = normalise_package(package)
    if p in PACKAGE_SKILLS:
        return PACKAGE_SKILLS[p]
    for prefix, skills in PACKAGE_PREFIXES:
        if p.startswith(prefix):
            return skills
    return ()


# ─── Manifest parsing (no third-party TOML/YAML parser needed for dependency names) ─


def _quoted(block: str) -> List[str]:
    """Quoted strings, each opened and closed by the same quote mark (a marker inside one may use the other kind)."""
    return [a or b for a, b in re.findall(r"\"([^\"]*)\"|'([^']*)'", block) if (a or b)]


def _requirements(text: str) -> Set[str]:
    out = set()
    for line in text.splitlines():
        line = line.split("#", 1)[0].strip()
        if not line or line.startswith(("-", "git+", "http")):
            continue
        out.add(normalise_package(line))
    return out


def _pyproject(text: str) -> Set[str]:
    out: Set[str] = set()
    # PEP 621 dependencies = [ "torch>=2", ... ] and optional-dependencies tables.
    for block in re.findall(r"dependencies\s*=\s*\[(.*?)\]", text, re.S):
        out |= {normalise_package(m) for m in _quoted(block)}
    # Poetry: [tool.poetry.dependencies] name = "^1.0"
    for table in re.findall(r"\[tool\.poetry\.(?:group\.\w+\.)?dependencies\](.*?)(?=\n\[|\Z)", text, re.S):
        out |= {normalise_package(m) for m in re.findall(r"^\s*([A-Za-z0-9_.\-]+)\s*=", table, re.M) if m.lower() != "python"}
    return out


def _environment(text: str) -> Set[str]:
    out = set()
    for m in re.findall(r"^\s*-\s*([A-Za-z0-9_.\-]+)", text, re.M):
        if m.lower() not in ("pip", "python", "conda-forge", "defaults"):
            out.add(normalise_package(m))
    return out


def _setup(text: str) -> Set[str]:
    out = set()
    for block in re.findall(r"install_requires\s*=\s*\[(.*?)\]", text, re.S):
        out |= {normalise_package(m) for m in _quoted(block)}
    for block in re.findall(r"install_requires\s*=\s*\n((?:\s+.+\n?)+)", text):  # setup.cfg
        out |= {normalise_package(line) for line in block.splitlines() if line.strip()}
    return out


def _pipfile(text: str) -> Set[str]:
    out = set()
    for table in re.findall(r"\[(?:dev-)?packages\](.*?)(?=\n\[|\Z)", text, re.S):
        out |= {normalise_package(m) for m in re.findall(r"^\s*([A-Za-z0-9_.\-]+)\s*=", table, re.M)}
    return out


def _package_json(text: str) -> Set[str]:
    try:
        data = json.loads(text)
    except (ValueError, TypeError):
        return set()
    out = set()
    for key in ("dependencies", "devDependencies", "peerDependencies"):
        deps = data.get(key) if isinstance(data, dict) else None
        if isinstance(deps, dict):
            out |= {normalise_package(k) for k in deps}
    return out


PARSERS = {
    "requirements.txt": _requirements, "pyproject.toml": _pyproject, "environment.yml": _environment, "environment.yaml": _environment,
    "setup.py": _setup, "setup.cfg": _setup, "Pipfile": _pipfile, "package.json": _package_json,
}


_PACKAGE_NAME = re.compile(r"^(@[a-z0-9._-]+/)?[a-z0-9][a-z0-9._-]*$")


def parse_manifest(filename: str, text: str) -> List[str]:
    """Package names only: environment markers and other quoted text in a manifest ("python_version > '3' and ...")
    must never become a "package". Found on real repositories (openai/whisper's pyproject.toml)."""
    parser = PARSERS.get(filename)
    return sorted(p for p in (parser(text) if parser else set()) if p and _PACKAGE_NAME.match(p)) if text else []


def structure_from_listing(names: Iterable[str], workflow_files: int = 0) -> Dict[str, Any]:
    """Root-directory names (files and folders, as GitHub lists them) -> structure flags."""
    lower = {n.lower() for n in names}
    test_file = any(re.match(r"(test_.*\.py|.*_test\.py|.*\.(test|spec)\.[jt]sx?)$", n) for n in lower)
    return {
        "tests": bool({"tests", "test", "__tests__", "spec"} & lower) or test_file,
        "ci": workflow_files > 0 or bool({".gitlab-ci.yml", "jenkinsfile", ".circleci", "azure-pipelines.yml"} & lower),
        "dockerfile": any(n == "dockerfile" or n.startswith("dockerfile.") for n in lower) or bool({"docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"} & lower),
        "kubernetes": bool({"k8s", "kubernetes", "helm", "charts", "chart.yaml", "kustomization.yaml"} & lower),
        "terraform": "terraform" in lower or any(n.endswith(".tf") for n in lower),
        "notebooks": sum(1 for n in lower if n.endswith(".ipynb")),
    }


# ─── Stored signals -> evidence ─────────────────────────────────────────────


def evidence_from_signals(signals: Optional[Dict[str, Any]]) -> List[Tuple[str, str, str]]:
    """(skill, depth, label) for one repository. depth is "code" (dependency or structure) or "readme" (named in README)."""
    if not isinstance(signals, dict):
        return []
    out: List[Tuple[str, str, str]] = []
    for filename, packages in sorted((signals.get("manifests") or {}).items()):
        for package in packages or []:
            for skill in skills_for_package(package):
                out.append((skill, "code", f"uses {normalise_package(package)} ({filename})"))
    structure = signals.get("structure") or {}
    labels = {"tests": "has automated tests", "ci": "has CI workflows", "dockerfile": "has a Dockerfile", "kubernetes": "has Kubernetes manifests", "terraform": "has Terraform files"}
    for flag, skill in STRUCTURE_SKILLS.items():
        if structure.get(flag):
            out.append((skill, "code", labels[flag]))
    for skill in (signals.get("readme") or {}).get("skills") or []:
        out.append((str(skill), "readme", "named in the README"))
    return out


def quality_flags(signals: Optional[Dict[str, Any]]) -> List[str]:
    """Engineering-quality signals a repository shows: tests, CI, or a README that documents an evaluation."""
    if not isinstance(signals, dict):
        return []
    # Tests and CI only. A README naming evaluation terms is the student's own wording, not a documented evaluation we can
    # check, so it no longer counts as an engineering signal (it still counts as a mention of Model Evaluation).
    structure = signals.get("structure") or {}
    return [f for f in QUALITY_FLAGS if structure.get(f)]


def was_read(signals: Optional[Dict[str, Any]]) -> bool:
    """True when the repository's files were fetched (so 'not found in its files' means something)."""
    return isinstance(signals, dict) and signals.get("version") in ACCEPTED_VERSIONS and not signals.get("unavailable")


def contribution(signals: Optional[Dict[str, Any]], repo_name: str, login: Optional[str]) -> str:
    """How far the repository's code can be attributed to the student:

      confirmed    GitHub's contributor counts show most commits are theirs (or >= 25% with >= 20 commits)
      owned        it sits under their own account (non-fork), but there are no commit counts to confirm it
      unconfirmed  a collaborator or organisation repository with no commit counts, or the account is unknown

    Commit counts are GitHub's, attributed by account; they show who committed, not who designed the work."""
    c = (signals or {}).get("contribution") if isinstance(signals, dict) else None
    owned = bool(login) and str(repo_name).lower().startswith(f"{str(login).lower()}/")
    if isinstance(c, dict) and isinstance(c.get("total"), int) and c["total"] > 0:
        mine = c.get("commits") or 0
        share = mine / c["total"]
        min_share, min_commits = CONFIRMED_SHARE_MIN_COMMITS
        if share >= CONFIRMED_SHARE or (share >= min_share and mine >= min_commits):
            return "confirmed"
        # Zero linked commits on the student's own repository usually means their git email isn't linked to their GitHub
        # account, not that someone else wrote it: that's unknown, so it stays "owned". A small but non-zero share means
        # others demonstrably did most of the work.
        if owned and mine == 0:
            return "owned"
        return "unconfirmed"
    return "owned" if owned else "unconfirmed"


def login_from_facts(facts: Iterable[Dict[str, Any]]) -> Optional[str]:
    """The student's GitHub login, from the github_url fact the GitHub connector writes."""
    for f in facts:
        if f.get("origin") == "github" and f.get("field_name") == "github_url":
            m = re.match(r"https?://github\.com/([A-Za-z0-9-]+)/?$", str(f.get("normalized_value") or ""))
            if m:
                return m.group(1)
    return None
