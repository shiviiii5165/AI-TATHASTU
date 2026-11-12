"""Canonical skills: the resume lexicon *and* the seed for skills/skill_aliases.

Each entry: (canonical name, category, aliases, ambiguous). Ambiguous names
("Go", "R", "Spark") are common English words, so the resume lexicon only
matches them inside a Skills section.

`category` groups skills for display. `KIND` (below) says what a skill *is*, so a programming language, a
framework, a concept and a practical capability are never confused: Python is a language, PyTorch a framework,
Model Evaluation a capability. Career roles are not skills and never appear here.

Aliases include GitHub's linguist language names ("Dockerfile", "HCL", "PLpgSQL"), which GitHub reports for
repositories; without them each would become a separate, meaningless skill.
"""

from __future__ import annotations

import re
from typing import Dict, List, Tuple

Entry = Tuple[str, str, List[str], bool]

CATALOG: List[Entry] = [
    # Languages
    ("Python", "language", ["py", "python3"], False),
    ("Java", "language", [], False),
    ("JavaScript", "language", ["js", "ecmascript"], False),
    ("TypeScript", "language", ["ts"], False),
    ("C", "language", [], True),
    ("C++", "language", ["cpp"], False),
    ("C#", "language", ["csharp"], False),
    ("Go", "language", ["golang"], True),
    ("Rust", "language", [], True),
    ("Kotlin", "language", [], False),
    ("Swift", "language", [], True),
    ("R", "language", [], True),
    ("Julia", "language", [], True),
    ("Scala", "language", [], False),
    ("MATLAB", "language", [], False),
    ("SQL", "language", ["plpgsql", "pl/pgsql", "tsql", "t-sql", "plsql", "pl/sql"], False),
    ("Bash", "language", ["shell", "shell scripting"], False),
    ("CUDA", "language", [], False),
    ("HTML", "language", ["html5"], False),
    ("CSS", "language", ["css3", "scss", "sass"], False),
    ("Jupyter Notebook", "tool", ["jupyter", "jupyter notebooks"], False),
    # ML / DL frameworks
    ("PyTorch", "ml_framework", ["torch"], False),
    ("TensorFlow", "ml_framework", ["tf", "tensorflow2"], False),
    ("Keras", "ml_framework", [], False),
    ("JAX", "ml_framework", [], False),
    ("scikit-learn", "ml_framework", ["sklearn", "scikit learn"], False),
    ("XGBoost", "ml_framework", [], False),
    ("LightGBM", "ml_framework", [], False),
    ("Hugging Face Transformers", "ml_framework", ["transformers", "huggingface", "hugging face"], False),
    ("LangChain", "llm", [], False),
    ("LlamaIndex", "llm", ["llama index", "llama_index"], False),
    ("OpenCV", "cv", ["cv2"], False),
    ("spaCy", "nlp", [], False),
    ("NLTK", "nlp", [], False),
    ("Pandas", "data", [], False),
    ("NumPy", "data", [], False),
    ("SciPy", "data", [], False),
    ("Matplotlib", "data", [], False),
    ("Seaborn", "data", [], False),
    ("Plotly", "data", [], False),
    ("Apache Spark", "data", ["spark", "pyspark"], True),
    ("Apache Airflow", "mlops", ["airflow"], False),
    ("Apache Kafka", "data", ["kafka"], False),
    ("dbt", "data", [], True),
    ("Tableau", "data", [], False),
    ("Power BI", "data", ["powerbi"], False),
    # ML concepts
    ("Machine Learning", "concept", ["ml"], False),
    ("Deep Learning", "concept", ["dl"], False),
    ("Natural Language Processing", "concept", ["nlp"], False),
    ("Computer Vision", "concept", ["cv"], False),
    ("Reinforcement Learning", "concept", ["rl"], False),
    ("Large Language Models", "llm", ["llm", "llms"], False),
    ("Retrieval-Augmented Generation", "llm", ["rag"], False),
    ("Prompt Engineering", "llm", [], False),
    ("Fine-tuning", "llm", ["fine tuning", "finetuning", "lora", "qlora", "peft"], False),
    ("Generative AI", "llm", ["genai", "gen ai"], False),
    ("Diffusion Models", "llm", ["diffusion model", "stable diffusion", "diffusers", "text-to-image", "text to image"], False),
    ("Transformers (architecture)", "concept", ["transformer models", "attention mechanism"], False),
    ("Convolutional Neural Networks", "concept", ["cnn", "cnns"], False),
    ("Recurrent Neural Networks", "concept", ["rnn", "rnns", "lstm", "lstms"], False),
    ("Statistics", "concept", ["statistical analysis", "hypothesis testing", "statistical inference", "a/b testing", "statsmodels"], False),
    ("Probability", "concept", [], False),
    ("Linear Algebra", "concept", [], False),
    ("Data Structures and Algorithms", "concept", ["dsa", "data structures", "algorithms"], False),
    ("Time Series Analysis", "concept", ["time series", "forecasting"], False),
    ("Recommender Systems", "concept", ["recommendation systems"], False),
    ("Object Detection", "cv", ["yolo"], False),
    ("Image Segmentation", "cv", ["segmentation"], False),
    ("Vector Databases", "llm", ["vector db", "faiss", "pinecone", "chromadb", "chroma", "weaviate", "milvus", "qdrant"], False),
    # Specialist skills for the 20-direction career catalog (speech, graph, edge/federated, LLM evaluation,
    # agents, multimodal, infrastructure). Ambiguous everyday words are not used as aliases.
    ("Speech Recognition", "speech", ["asr", "automatic speech recognition", "speech-to-text", "speech to text"], False),
    ("Text-to-Speech", "speech", ["tts", "speech synthesis", "text to speech"], False),
    ("Audio Signal Processing", "speech", ["audio processing", "librosa", "torchaudio"], False),
    ("Graph Neural Networks", "graph", ["gnn", "gnns", "graph neural network", "pytorch geometric", "dgl"], False),
    ("Knowledge Graphs", "graph", ["knowledge graph"], False),
    ("NetworkX", "graph", [], False),
    ("Neo4j", "database", ["cypher"], False),
    ("Federated Learning", "edge", ["flower federated learning"], False),
    ("Differential Privacy", "edge", [], False),
    ("TensorFlow Lite", "edge", ["tflite", "tf lite", "litert"], False),
    ("On-device ML", "edge", ["tinyml", "edge ai", "on-device ai", "edge ml", "core ml", "coreml"], False),
    ("Model Quantization", "mlops", ["quantization", "gptq", "awq", "int8 quantization"], False),
    ("Distributed Training", "mlops", ["deepspeed", "fsdp", "horovod", "distributed data parallel"], False),
    ("LLM Evaluation", "llm", ["llm evals", "llm eval", "ragas", "llm-as-a-judge", "deepeval", "lm-evaluation-harness"], False),
    ("AI Safety", "concept", ["ai alignment", "red teaming", "responsible ai"], False),
    ("AI Agents", "llm", ["agentic ai", "llm agents", "langgraph", "autogen", "crewai", "multi-agent systems"], False),
    ("Vision-Language Models", "llm", ["vlm", "vlms", "vision language models", "multimodal llms"], False),
    ("ROS", "robotics", ["robot operating system", "ros2"], False),
    ("Simulation", "robotics", ["gazebo", "mujoco", "isaac sim", "gymnasium", "openai gym"], False),
    ("Control Systems", "robotics", ["control systems", "pid control", "pid controller", "model predictive control", "motion planning"], False),
    # Practical capabilities: what someone can do, shown by work rather than by naming a tool. Aliases are
    # multi-word phrases only, so ordinary prose doesn't trigger them.
    ("Model Evaluation", "concept", ["cross-validation", "cross validation", "confusion matrix", "roc auc", "roc curve", "precision and recall", "evaluation metrics", "error analysis", "model evaluation"], False),
    ("Data Preparation", "data", ["data cleaning", "data preprocessing", "feature engineering", "data wrangling", "data preparation"], False),
    ("Model Deployment", "mlops", ["model deployment", "model serving", "inference api", "deployed the model", "deploy the model"], False),
    ("Model Monitoring", "mlops", ["model monitoring", "data drift", "drift detection", "ml observability", "llm observability", "evidently", "langfuse", "langsmith"], False),
    ("Software Testing", "backend", ["unit testing", "unit tests", "pytest", "integration testing", "integration tests", "test-driven development", "jest", "vitest"], False),
    ("Experimental Design", "concept", ["experimental design", "experiment design", "ablation study", "ablation studies", "paper reproduction", "reproduced the paper"], False),
    ("Data Visualization", "data", ["data visualization", "data visualisation"], False),
    ("Embeddings", "llm", ["text embeddings", "sentence embeddings", "sentence-transformers", "sentence transformers", "embedding model", "embedding models"], False),
    # MLOps / infra
    ("Docker", "mlops", ["dockerfile", "docker compose", "docker-compose"], False),
    ("Kubernetes", "mlops", ["k8s"], False),
    ("MLflow", "mlops", [], False),
    ("Weights & Biases", "mlops", ["wandb", "weights and biases"], False),
    ("DVC", "mlops", [], False),
    ("Kubeflow", "mlops", [], False),
    ("ONNX", "mlops", [], False),
    ("TensorRT", "mlops", [], False),
    ("Triton Inference Server", "mlops", ["triton"], True),
    ("vLLM", "mlops", [], False),
    ("CI/CD", "mlops", ["github actions", "jenkins", "continuous integration"], False),
    ("Terraform", "mlops", ["hcl"], False),
    ("AWS", "cloud", ["amazon web services", "sagemaker", "ec2", "s3"], False),
    ("Google Cloud", "cloud", ["gcp", "google cloud platform", "vertex ai", "bigquery"], False),
    ("Azure", "cloud", ["microsoft azure", "azure ml"], False),
    ("Linux", "tool", ["unix"], False),
    ("Git", "tool", ["github", "gitlab", "version control"], False),
    # Backend / data stores
    ("FastAPI", "backend", [], False),
    ("Flask", "backend", [], False),
    ("Django", "backend", [], False),
    ("Node.js", "backend", ["nodejs", "node"], True),
    ("React", "frontend", ["reactjs", "react.js"], True),
    ("Next.js", "frontend", ["nextjs"], False),
    ("Streamlit", "frontend", [], False),
    ("Gradio", "frontend", [], False),
    ("REST APIs", "backend", ["rest", "restful", "rest api"], False),
    ("GraphQL", "backend", [], False),
    ("PostgreSQL", "database", ["postgres", "psql"], False),
    ("MySQL", "database", [], False),
    ("MongoDB", "database", ["mongo"], False),
    ("Redis", "database", [], False),
    ("Elasticsearch", "database", ["elastic search"], False),
]


CAPABILITIES = {
    "Model Evaluation", "Data Preparation", "Model Deployment", "Model Monitoring", "Software Testing", "Experimental Design",
    "Data Visualization", "Prompt Engineering", "Fine-tuning", "Retrieval-Augmented Generation", "Distributed Training",
    "Model Quantization", "LLM Evaluation", "Time Series Analysis", "CI/CD", "Simulation",
}
CONCEPT_CATEGORIES = {"concept"}
PLATFORMS = {"AWS", "Google Cloud", "Azure", "Linux", "Kubernetes"}
TOOLS = {"Git", "Docker", "Jupyter Notebook", "MLflow", "Weights & Biases", "DVC", "Tableau", "Power BI", "Terraform", "Apache Airflow", "Apache Kafka", "Neo4j", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Triton Inference Server", "vLLM", "TensorRT", "ONNX", "Kubeflow", "Streamlit", "Gradio", "ROS"}


def kind_of(canonical: str) -> str:
    """What a skill is: language, framework, tool, platform, concept or capability. 'unknown' for skills outside the catalogue."""
    entry = next((e for e in CATALOG if e[0] == canonical), None)
    if entry is None:
        return "unknown"
    if canonical in CAPABILITIES:
        return "capability"
    if canonical in PLATFORMS:
        return "platform"
    if canonical in TOOLS:
        return "tool"
    category = entry[1]
    if category == "language":
        return "language"
    if category in CONCEPT_CATEGORIES or canonical in {"Large Language Models", "Generative AI", "Vector Databases", "AI Agents", "Vision-Language Models",
                                                        "Graph Neural Networks", "Knowledge Graphs", "Federated Learning", "Differential Privacy", "On-device ML",
                                                        "Speech Recognition", "Text-to-Speech", "Audio Signal Processing", "Object Detection", "Image Segmentation",
                                                        "Embeddings", "Control Systems", "AI Safety", "REST APIs", "Diffusion Models"}:
        return "concept"
    return "framework"


KIND: Dict[str, str] = {name: kind_of(name) for name, _c, _a, _amb in CATALOG}


def alias_key(name: str) -> str:
    """Normalization used for skill_aliases.alias and every lookup."""
    key = name.strip().lower()
    key = key.replace("&", " and ")
    key = re.sub(r"[\s_]+", " ", key)
    return key.strip(" .,;:")


def alias_map() -> Dict[str, str]:
    """alias_key → canonical name, including each canonical name itself. A canonical name always wins over another
    skill's alias; between aliases, the first entry wins (the same rule skills.seed writes to the database)."""
    out: Dict[str, str] = {alias_key(canonical): canonical for canonical, _c, _a, _amb in CATALOG}
    for canonical, _cat, aliases, _amb in CATALOG:
        for a in aliases:
            out.setdefault(alias_key(a), canonical)
    return out


def category_of(canonical: str) -> str:
    for name, cat, _a, _amb in CATALOG:
        if name == canonical:
            return cat
    return "other"
