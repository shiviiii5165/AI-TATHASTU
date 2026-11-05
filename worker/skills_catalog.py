"""Canonical skills: the resume lexicon *and* the seed for skills/skill_aliases.

Each entry: (canonical name, category, aliases, ambiguous). Ambiguous names
("Go", "R", "Spark") are common English words, so the resume lexicon only
matches them inside a Skills section.
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
    ("SQL", "language", [], False),
    ("Bash", "language", ["shell", "shell scripting"], False),
    ("CUDA", "language", [], False),
    ("HTML", "language", ["html5"], False),
    ("CSS", "language", ["css3"], False),
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
    ("Transformers (architecture)", "concept", ["transformer models", "attention mechanism"], False),
    ("Convolutional Neural Networks", "concept", ["cnn", "cnns"], False),
    ("Recurrent Neural Networks", "concept", ["rnn", "rnns", "lstm", "lstms"], False),
    ("Statistics", "concept", ["statistical analysis"], False),
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
    ("Simulation", "robotics", ["gazebo", "mujoco", "isaac sim"], False),
    # MLOps / infra
    ("Docker", "mlops", [], False),
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
    ("Terraform", "mlops", [], False),
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


def alias_key(name: str) -> str:
    """Normalization used for skill_aliases.alias and every lookup."""
    key = name.strip().lower()
    key = key.replace("&", " and ")
    key = re.sub(r"[\s_]+", " ", key)
    return key.strip(" .,;:")


def alias_map() -> Dict[str, str]:
    """alias_key → canonical name, including each canonical name itself."""
    out: Dict[str, str] = {}
    for canonical, _cat, aliases, _amb in CATALOG:
        out[alias_key(canonical)] = canonical
        for a in aliases:
            out.setdefault(alias_key(a), canonical)
    return out


def category_of(canonical: str) -> str:
    for name, cat, _a, _amb in CATALOG:
        if name == canonical:
            return cat
    return "other"
