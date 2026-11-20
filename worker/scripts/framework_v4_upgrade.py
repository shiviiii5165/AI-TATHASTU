"""One-off, reviewable transformation: role_frameworks.json 2026.11-draft.3 -> 2026.11-draft.4 (workstream C).

Run once from worker/: `python scripts/framework_v4_upgrade.py`. Idempotent (re-running changes nothing).
Every addition below is justified by a source that was fetched and read on 2026-11-20 (see VERIFICATION); anything
that could not be verified is recorded under `openQuestions` instead of being added.
"""

from __future__ import annotations

import json
from pathlib import Path

PATH = Path(__file__).resolve().parent.parent / "intelligence" / "frameworks" / "role_frameworks.json"
AUDIT_DATE = "2026-11-20"

DOMAINS = {
    "math_foundations": ("Mathematical foundations", "The mathematics models are built and judged with."),
    "programming": ("Programming and software engineering", "Writing, testing, versioning and exposing code."),
    "data": ("Data", "Getting, cleaning, shaping and presenting data."),
    "ml_modelling": ("Machine learning and experimentation", "Classical models, evaluation and experimental method."),
    "deep_learning": ("Deep learning", "Neural networks, their frameworks and how they are trained."),
    "llm_genai": ("LLMs and generative AI", "Language and generative models and the applications built on them."),
    "perception": ("Perception: vision, language and speech", "Models for images, video, text and audio."),
    "decision_control": ("Decision-making and control", "Agents that act: reinforcement learning, robotics and control."),
    "graphs": ("Graphs", "Graph-structured data, graph learning and knowledge graphs."),
    "production": ("Production systems", "Deploying, operating and scaling models in production."),
    "edge_privacy": ("Edge and privacy-preserving AI", "On-device inference and training without centralising data."),
    "evaluation_safety": ("Evaluation, safety and security", "Showing a model or LLM system is good, safe and secure."),
}

DOMAIN_OF = {
    "math_foundations": ["Linear Algebra", "Probability", "Statistics", "Calculus and Optimization"],
    "programming": ["Python", "C++", "TypeScript", "Bash", "Data Structures and Algorithms", "Git", "Software Testing", "REST APIs", "FastAPI", "Next.js", "Linux"],
    "data": ["SQL", "Pandas", "NumPy", "Data Preparation", "Data Visualization", "Matplotlib", "Tableau", "Apache Airflow"],
    "ml_modelling": ["Machine Learning", "scikit-learn", "Model Evaluation", "Experimental Design", "Time Series Analysis", "Recommender Systems"],
    "deep_learning": ["Deep Learning", "PyTorch", "TensorFlow", "JAX", "CUDA", "Convolutional Neural Networks", "Transformers (architecture)",
                      "Hugging Face Transformers", "Weights & Biases", "Distributed Training", "Fine-tuning"],
    "llm_genai": ["Large Language Models", "Generative AI", "Prompt Engineering", "Embeddings", "Retrieval-Augmented Generation", "Vector Databases",
                  "LangChain", "LlamaIndex", "AI Agents", "Diffusion Models"],
    "perception": ["Computer Vision", "OpenCV", "Object Detection", "Image Segmentation", "Vision-Language Models", "Natural Language Processing",
                   "spaCy", "Speech Recognition", "Text-to-Speech", "Audio Signal Processing"],
    "decision_control": ["Reinforcement Learning", "Simulation", "Control Systems", "ROS", "Motion Planning", "Robot Localization"],
    "graphs": ["Graph Neural Networks", "Knowledge Graphs", "NetworkX", "Neo4j"],
    "production": ["Model Deployment", "Model Monitoring", "Observability", "Docker", "Kubernetes", "CI/CD", "MLflow", "Terraform", "AWS", "Google Cloud",
                   "vLLM", "Triton Inference Server", "TensorRT", "ONNX", "Model Quantization"],
    "edge_privacy": ["On-device ML", "TensorFlow Lite", "Federated Learning", "Differential Privacy"],
    "evaluation_safety": ["LLM Evaluation", "AI Safety", "LLM Application Security"],
}

# A tool is evidence of the engineering capability it is used for, never the whole of it. Display/traceability only:
# scoring still treats each competency separately, so knowing Docker never marks Model Deployment as met.
REALISES = {
    "PyTorch": "Deep Learning", "TensorFlow": "Deep Learning", "JAX": "Deep Learning",
    "scikit-learn": "Machine Learning", "Hugging Face Transformers": "Transformers (architecture)",
    "OpenCV": "Computer Vision", "spaCy": "Natural Language Processing",
    "LangChain": "Retrieval-Augmented Generation", "LlamaIndex": "Retrieval-Augmented Generation",
    "Docker": "Model Deployment", "Kubernetes": "Model Deployment", "vLLM": "Model Deployment",
    "Triton Inference Server": "Model Deployment", "TensorRT": "Model Deployment", "ONNX": "Model Deployment",
    "MLflow": "Experimental Design", "Weights & Biases": "Experimental Design",
    "Pandas": "Data Preparation", "NumPy": "Data Preparation", "Apache Airflow": "Data Preparation",
    "Matplotlib": "Data Visualization", "Tableau": "Data Visualization",
    "Neo4j": "Knowledge Graphs", "TensorFlow Lite": "On-device ML", "FastAPI": "REST APIs",
}

EVIDENCE = {"establishes": ["repository", "platform", "assessment", "project", "experience"], "supportingOnly": ["certification", "course", "claim"]}

NEW_COMPETENCIES = {
    "Calculus and Optimization": {
        "category": "math", "prerequisites": [],
        "description": "Derivatives, gradients and the chain rule, and the optimisation methods (gradient descent and its variants) that train models.",
        "demonstration": "A from-scratch gradient descent or backpropagation checked against automatic differentiation, or a documented study of optimiser behaviour (learning rate, schedule, convergence).",
        "levelCriteria": {
            "Foundational": "Computes derivatives and gradients and explains what gradient descent does.",
            "Working": "Implements gradient descent for a simple model and diagnoses divergence or slow convergence with guidance.",
            "Proficient": "Derives gradients for a new layer or loss, verifies them numerically, and chooses and tunes optimisers with justification.",
            "Advanced": "Analyses training dynamics (conditioning, schedules, stability) and designs optimisation strategies for large or unusual models.",
        },
        "sources": ["d2l-reference"],
    },
    "LLM Application Security": {
        "category": "ai", "prerequisites": ["Large Language Models"],
        "description": "Defending LLM applications against the risks catalogued by OWASP: prompt injection, improper output handling, excessive agency, data leakage and unsafe tool use.",
        "demonstration": "An LLM application with documented threat model and tested defences: injection tests, output validation before use, least-privilege tools and a record of what was found.",
        "levelCriteria": {
            "Foundational": "Names the main LLM application risks and recognises prompt injection.",
            "Working": "Adds input and output validation and restricts tool permissions in an application, with guidance.",
            "Proficient": "Threat-models an LLM application against the OWASP LLM Top 10 and tests the defences independently.",
            "Advanced": "Designs layered defences for agentic systems, runs adversarial testing and sets security requirements for others.",
        },
        "sources": ["owasp-llm-top10"],
    },
    "Observability": {
        "category": "devops", "prerequisites": ["Linux"],
        "description": "Instrumenting services with traces, metrics and logs so their behaviour in production can be understood and debugged.",
        "demonstration": "A deployed service instrumented with traces, metrics and logs (for example OpenTelemetry) and a documented investigation that used them.",
        "levelCriteria": {
            "Foundational": "Explains the difference between traces, metrics and logs.",
            "Working": "Adds logging and basic metrics to a service with guidance.",
            "Proficient": "Instruments a service end to end, builds dashboards and alerts, and uses traces to find a real problem.",
            "Advanced": "Designs observability for distributed AI systems, including cost, latency and quality signals, and defines service-level objectives.",
        },
        "sources": ["otel-observability"],
    },
    "Motion Planning": {
        "category": "engineering", "prerequisites": ["Data Structures and Algorithms"],
        "description": "Computing collision-free paths and trajectories for a robot and handing them to its controllers.",
        "demonstration": "A planner (for example Nav2 or MoveIt, or a sampling or search-based planner you wrote) running in simulation or on a robot, with its behaviour documented.",
        "levelCriteria": {
            "Foundational": "Explains configuration space and search-based versus sampling-based planning.",
            "Working": "Configures an existing planner (for example a Nav2 planner) for a robot in simulation with guidance.",
            "Proficient": "Implements or tunes planners independently, handles obstacles and kinematic constraints, and evaluates path quality.",
            "Advanced": "Designs planning for complex or dynamic environments and integrates it with control and perception under real-time limits.",
        },
        "sources": ["onet-robotics", "nav2-docs"],
    },
    "Robot Localization": {
        "category": "engineering", "prerequisites": ["Probability"],
        "description": "Estimating a robot's pose from sensor data: filtering, sensor fusion, localisation in a map and SLAM.",
        "demonstration": "A robot or simulation that localises with a probabilistic method (for example AMCL, an extended Kalman filter or SLAM), with error measured against ground truth.",
        "levelCriteria": {
            "Foundational": "Explains why odometry drifts and what a filter adds.",
            "Working": "Runs and configures an existing localisation stack (for example AMCL in Nav2) in simulation with guidance.",
            "Proficient": "Fuses several sensors, tunes the filter and measures localisation error independently.",
            "Advanced": "Designs localisation or SLAM for difficult conditions and diagnoses failure modes on real hardware.",
        },
        "sources": ["nav2-docs"],
    },
}

# role -> (competency, tier, weight, expectedLevel, evidenceRequirement, rationale). Supporting tier throughout: these
# strengthen an assessment but never hold a role's alignment back, so existing alignment states are unchanged.
ROLE_ADDITIONS = {
    "deep_learning_engineer": [("Calculus and Optimization", "supporting", 0.6, "Working", "described", "Training is optimisation: diagnosing a run needs gradients and optimiser behaviour.")],
    "llm_model_engineer": [("Calculus and Optimization", "supporting", 0.6, "Working", "described", "Pretraining and fine-tuning stability depend on optimiser and schedule choices.")],
    "rl_engineer": [("Calculus and Optimization", "supporting", 0.6, "Working", "described", "Policy-gradient methods are gradient-based optimisation.")],
    "ai_researcher": [("Calculus and Optimization", "supporting", 0.7, "Working", "described", "New methods are usually new losses or optimisation procedures that must be derived.")],
    "ml_engineer": [("Calculus and Optimization", "supporting", 0.4, "Foundational", "described", "Explains why a model trains, diverges or overfits.")],
    "llm_application_engineer": [("LLM Application Security", "supporting", 0.7, "Working", "described", "LLM apps take untrusted input; prompt injection and unsafe output handling are the main risks.")],
    "ai_agent_engineer": [("LLM Application Security", "supporting", 0.7, "Working", "described", "Agents act through tools, so excessive agency and injection have real consequences.")],
    "generative_ai_engineer": [("LLM Application Security", "supporting", 0.5, "Foundational", "described", "Generation pipelines expose the same injection and output-handling risks.")],
    "llmops_engineer": [
        ("LLM Application Security", "supporting", 0.6, "Working", "described", "Operating LLM services includes enforcing guardrails and monitoring abuse."),
        ("Observability", "supporting", 0.7, "Working", "described", "LLMOps runs on traces, metrics and logs of prompts, latency and cost."),
    ],
    "ai_evaluation_safety_engineer": [("LLM Application Security", "supporting", 0.6, "Working", "described", "Security testing of LLM systems is part of safety evaluation.")],
    "mlops_engineer": [("Observability", "supporting", 0.6, "Working", "described", "Model monitoring sits on top of service traces, metrics and logs.")],
    "ai_infrastructure_engineer": [("Observability", "supporting", 0.7, "Working", "described", "Clusters and serving stacks are run through their metrics and traces.")],
    "robotics_ai_engineer": [
        ("Motion Planning", "supporting", 0.7, "Working", "described", "O*NET lists planning robot paths as a Robotics Engineer task; Nav2 makes planners a core part of a ROS 2 robot."),
        ("Robot Localization", "supporting", 0.7, "Working", "described", "A mobile robot must know where it is before it can plan; localisation is a core Nav2 component."),
    ],
}

NEW_REFERENCES = [{
    "id": "nav2-docs", "title": "Nav2 documentation", "publisher": "Open Navigation / ROS 2 Navigation project", "kind": "official documentation",
    "url": "https://docs.nav2.org/", "checkedAt": AUDIT_DATE,
    "informs": "Robotics Engineer: localisation (AMCL), planners and controllers in a ROS 2 navigation stack",
}]
ROLE_REFERENCE_ADDITIONS = {"robotics_ai_engineer": ["nav2-docs"]}

# What was read on the audit date, per reference (link reachability for all; content for those that justify additions).
UNREACHABLE = {"cs224n-ref", "cs224w-ref", "slp3-ref", "stanford-cs197", "grl-book-ref"}
VERIFICATION = {
    "d2l-reference": "Page contains Optimization, Calculus and Automatic Differentiation sections.",
    "owasp-llm-top10": "Lists Prompt Injection, Improper Output Handling and Excessive Agency.",
    "otel-observability": "Describes traces, metrics and logs as the signals of observability.",
    "onet-robotics": "Details page task: \"Plan mobile robot paths and teach path plans to robots.\" Kinematics and navigation not found in the visible text.",
    "nav2-docs": "\"It provides perception, planning, control, localization, visualization, behaviors\"; configuration for AMCL, Smac and NavFn planners, DWB controller.",
    "google-pmle": "Landing page reachable; the phrase \"feature engineering\" was not found on it, and the exam-guide PDF could not be parsed.",
}

OPEN_QUESTIONS = [
    {"id": "robotics-kinematics", "roles": ["robotics_ai_engineer"], "question": "Should Robot Kinematics (forward/inverse kinematics, dynamics) be a required competency?",
     "status": "unverified", "note": "Widely taught, but the sources we could read on 2026-11-20 did not state it (Modern Robotics site reset the connection; ROS tf2 page returned an access-denial page; O*NET visible text had no kinematics). Not added until a source is read."},
    {"id": "feature-engineering", "roles": ["ml_engineer", "data_scientist"], "question": "Split Feature Engineering out of Data Preparation?",
     "status": "unverified", "note": "Neither the Google PMLE page nor the AWS MLA page stated it in readable text. It stays an alias of Data Preparation."},
    {"id": "causal-inference", "roles": ["data_scientist"], "question": "Add causal inference to Data Scientist?",
     "status": "unsupported", "note": "Not present in O*NET Data Scientists (15-2051.00) text read on 2026-11-20."},
    {"id": "federated-tier", "roles": ["edge_federated_ai_engineer"], "question": "Federated Learning is only a specialisation although the role is named Edge & Federated.",
     "status": "disputed", "note": "Kept as a specialisation: edge deployment is the common entry path; federated training is the narrower track. Needs reviewer decision."},
    {"id": "cv-geometry", "roles": ["computer_vision_engineer"], "question": "Add camera geometry / 3D vision?",
     "status": "unverified", "note": "No current reference read for it; CS231N (cited) could not be reached from the audit network."},
    {"id": "unreachable-references", "roles": [], "question": "Five cited references could not be fetched from the audit network on 2026-11-20.",
     "status": "unverified", "note": ", ".join(sorted(UNREACHABLE)) + ". Kept (they were checked on 2026-11-12) but must be re-checked by a reviewer."},
]

CAREER_LEVELS = {
    "basis": "derived",
    "rule": ("Junior is the role's entry target (the competency's expectedLevel, which the engine assesses against). Intermediate raises "
             "required competencies one level and supporting ones weighted 0.6 or more one level. Senior raises required competencies "
             "to Advanced and supporting ones one level above junior, capped at Proficient. Specialisation tracks are not raised."),
    "status": "derived_unreviewed",
    "note": "A written rule, not a researched expectation per competency. Overrides belong in a requirement's own careerLevels field.",
}


def main() -> None:
    data = json.loads(PATH.read_text(encoding="utf-8"))
    comps = data["competencies"]
    comps.update({k: {kk: vv for kk, vv in v.items()} | {"acceptedEvidence": EVIDENCE} for k, v in NEW_COMPETENCIES.items() if k not in comps})

    assigned = {c: d for d, cs in DOMAIN_OF.items() for c in cs}
    missing = sorted(set(comps) - set(assigned))
    unknown = sorted(set(assigned) - set(comps))
    if missing or unknown:
        raise SystemExit(f"domain map incomplete: missing={missing} unknown={unknown}")
    for name, c in comps.items():
        c["domain"] = assigned[name]
        if name in REALISES:
            c["realises"] = REALISES[name]

    data["domains"] = {k: {"label": l, "description": d} for k, (l, d) in DOMAINS.items()}
    data["careerLevels"] = CAREER_LEVELS
    data["openQuestions"] = OPEN_QUESTIONS

    refs = data["provenance"]["references"]
    have = {r["id"] for r in refs}
    refs.extend(r for r in NEW_REFERENCES if r["id"] not in have)
    for r in refs:
        r["linkCheck"] = {"at": AUDIT_DATE, "result": "unreachable_from_audit_network" if r["id"] in UNREACHABLE else "reachable"}
        if r["id"] in VERIFICATION:
            r["contentCheck"] = {"at": AUDIT_DATE, "finding": VERIFICATION[r["id"]]}

    for role, adds in ROLE_ADDITIONS.items():
        f = data["roles"][role]
        present = {c["competency"] for c in f["competencies"]}
        for comp, tier, weight, level, ev, why in adds:
            if comp not in present:
                f["competencies"].append({"competency": comp, "tier": tier, "weight": weight, "expectedLevel": level, "evidenceRequirement": ev, "rationale": why})
    for role, ids in ROLE_REFERENCE_ADDITIONS.items():
        f = data["roles"][role]
        f["references"] = f["references"] + [i for i in ids if i not in f["references"]]

    data["frameworkVersion"] = "2026.11-draft.4"
    data["provenance"]["changes"] = data["provenance"].get("changes", []) + ([] if any(c.get("version") == "2026.11-draft.4" for c in data["provenance"].get("changes", [])) else [{
        "version": "2026.11-draft.4", "at": AUDIT_DATE,
        "summary": "Competency domains; tool-to-capability links; career-level rule; five source-verified competencies (Calculus and Optimization, "
                   "LLM Application Security, Observability, Motion Planning, Robot Localization) added at supporting tier; 'motion planning' no "
                   "longer counts as Control Systems evidence; link and content checks recorded per reference; open questions listed.",
    }])
    PATH.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    stamp_career_levels()
    print("ok", data["frameworkVersion"], len(comps), "competencies")


def stamp_career_levels() -> None:
    """Writes each requirement's junior/intermediate/senior targets (by the careerLevels rule) into the JSON, so the web
    admin reads the same values the worker uses instead of re-implementing the rule. Re-run after any requirement change."""
    import sys
    sys.path.insert(0, str(PATH.parent.parent.parent))
    from intelligence.frameworks import _req, career_levels  # loaded after the file above is written

    data = json.loads(PATH.read_text(encoding="utf-8"))
    for f in data["roles"].values():
        for c in f["competencies"]:
            c["careerLevels"] = career_levels(_req({k: v for k, v in c.items() if k != "careerLevels"}))
    PATH.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
