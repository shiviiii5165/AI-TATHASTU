# Career competency coverage: all 20 directions

Source of truth: `worker/intelligence/config.py` (`ROLE_SKILLS`, `ROLE_PROJECT_CONTEXT`). Weight → expected level: ≥0.9 Proficient (50), ≥0.6 Working (25), otherwise Foundational (10). Priority: ≥0.8 High, ≥0.6 Medium, otherwise Low. Tested by `worker/tests/test_career_coverage.py`: every role has ≥6 canonical skills, all 20 frameworks are distinct, and roadmaps differ by role.

| # | Role (id) | Core competencies (weight ≥0.9) | Specialist / supporting |
|---|---|---|---|
| 1 | ML Engineer (`ml_engineer`) | Python, Machine Learning | scikit-learn, PyTorch, SQL, Docker, MLflow, Statistics, AWS, Git |
| 2 | Data Scientist | Python, Statistics, SQL, Pandas | ML, scikit-learn, Matplotlib, Tableau, Time Series |
| 3 | Deep Learning Engineer | Python, Deep Learning, PyTorch | CUDA, CNNs, Transformers, TensorFlow, Linear Algebra |
| 4 | Generative AI Engineer | Python, LLMs, RAG | Prompting, Fine-tuning, Vector DBs, PyTorch, LangChain, FastAPI, Docker |
| 5 | LLM Application Engineer | Python, LLMs, RAG, Prompt Engineering | LangChain, REST APIs, FastAPI, Vector DBs, **LLM Evaluation**, TypeScript |
| 6 | LLM Model Engineer | Python, LLMs, Fine-tuning, PyTorch, Transformers | HF Transformers, **Distributed Training**, CUDA, **Model Quantization**, **LLM Evaluation** |
| 7 | MLOps Engineer | Python, Docker, Kubernetes, CI/CD | MLflow, AWS, Linux, Terraform, Airflow |
| 8 | LLMOps Engineer | Python, LLMs, Docker, Kubernetes | CI/CD, **LLM Evaluation**, vLLM, **Model Quantization**, Triton, W&B |
| 9 | AI Agent Engineer | Python, LLMs, **AI Agents**, Prompt Engineering | LangChain, RAG, REST APIs, **LLM Evaluation**, FastAPI, Vector DBs |
| 10 | NLP Engineer | Python, NLP, HF Transformers | PyTorch, LLMs, spaCy, Fine-tuning |
| 11 | Computer Vision Engineer | Python, Computer Vision, OpenCV | PyTorch, CNNs, Object Detection, Segmentation |
| 12 | Multimodal AI Engineer | Python, Deep Learning, **Vision-Language Models**, PyTorch, CV | Transformers, NLP, HF Transformers, **Audio Signal Processing** |
| 13 | Speech AI Engineer | Python, **Speech Recognition**, Deep Learning, **Audio Signal Processing**, PyTorch | **Text-to-Speech**, Transformers, HF Transformers, NumPy |
| 14 | Reinforcement Learning Engineer | Python, Reinforcement Learning | PyTorch, Probability, Simulation, Deep Learning |
| 15 | Robotics Engineer (`robotics_ai_engineer`) | Python, C++, ROS | CV, RL, Simulation, Linux |
| 16 | Graph AI Engineer | Python, **Graph Neural Networks**, Deep Learning | PyTorch, **Knowledge Graphs**, Linear Algebra, DSA, **NetworkX**, Recommender Systems, **Neo4j** |
| 17 | AI Infrastructure Engineer | Kubernetes, Docker, Linux | CUDA, **Distributed Training**, Terraform, AWS, Triton, TensorRT, GCP |
| 18 | AI Evaluation & Safety Engineer | Python, **LLM Evaluation**, **AI Safety**, Statistics, LLMs | ML, Probability, Prompting, Pandas, W&B |
| 19 | Edge & Federated AI Engineer | Python, **On-device ML**, **Federated Learning** | **Model Quantization**, Deep Learning, ONNX, C++, **TensorFlow Lite**, **Differential Privacy**, PyTorch, TensorRT |
| 20 | AI Research Engineer / Applied AI Scientist (`ai_researcher`) | Python, Deep Learning, PyTorch | Linear Algebra, Probability, Statistics, Transformers, JAX |

**Bold** = canonical skill added in this pass. The full list added to `skills_catalog.CATALOG` is Speech Recognition, Text-to-Speech, Audio Signal Processing, Graph Neural Networks, Knowledge Graphs, NetworkX, Neo4j, Federated Learning, Differential Privacy, TensorFlow Lite, On-device ML, Model Quantization, Distributed Training, LLM Evaluation, AI Safety, AI Agents and Vision-Language Models. Each has aliases (for example asr, tts, gnn, ragas, tflite, tinyml, langgraph, vlm), ontology relations in `skill_graph.py` and prerequisites in `career_engine.PREREQUISITES`.

Retired roles (`ai_engineer`, `ai_product_founder`, `still_exploring`) keep their frameworks, so saved preferences still compute.

These weights are product judgement, written down so they can be challenged. They are not market data. No new courses were added: the learning catalogue has no checked course for most specialist skills, so those recommendations say "learn by building".
