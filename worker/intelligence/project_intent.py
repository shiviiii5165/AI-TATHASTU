"""What the student says they want to build, turned into the skills that project needs.

Deterministic and explainable: a fixed set of phrase rules, each naming the capability it implies and why. Every
requirement carries the exact words from the student's description that triggered it, so the student can see (and
correct) how we read them. No LLM, no network: nothing about the student leaves the system, and the same text
always gives the same result.

What this can't do: understand a description the rules don't cover, judge whether the project is feasible, or know
the student's constraints. A description with no recognisable capability is reported as "too vague" with prompts,
not guessed at. Skills the student names explicitly ("using PyTorch") are always included.

Career requirements and project requirements are kept apart: a project can need skills the chosen career doesn't
require, and the career can require skills the project doesn't touch. The engine reports both, and the overlap.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

# 2: uncertain readings (a single ambiguous word) are "possible", kept out of the plan and asked about instead;
#    product/scale/domain rules apply only alongside an AI capability; tighter agent and research patterns; audio and screenshots.
INTENT_VERSION = 2
MAX_CHARS = 1200

# Rules that name an AI capability. Rules about the product around it (a website, scale, a domain) only apply alongside one:
# "a website for my shop" is not an AI project, and we shouldn't plan one.
AI_RULES = ("assistant", "generation", "documents", "rag", "agent", "image_generation", "vision", "detection", "segmentation", "multimodal",
            "speech", "audio", "tts", "prediction", "forecasting", "recommendation", "text_understanding", "edge", "federated", "robotics", "rl",
            "graphs", "custom_model", "research", "serving", "analytics")


@dataclass(frozen=True)
class Rule:
    id: str
    label: str
    pattern: str
    core: Tuple[str, ...] = ()
    supporting: Tuple[str, ...] = ()
    why: str = ""
    when_any: Tuple[str, ...] = ()  # only applies if one of these other rules also matched
    unless_any: Tuple[str, ...] = ()
    # Words that on their own are too ambiguous to plan on. If every phrase that matched is one of these, the reading is
    # "possible": shown with `question`, never added to the plan until the student says more.
    weak: Tuple[str, ...] = ()
    question: str = ""


RULES: Tuple[Rule, ...] = (
    Rule("assistant", "A conversational assistant", r"\b(chat ?bots?|voice assistants?|assistants?|question[- ]answering|q ?& ?a\b|answers? (\w+ )?(questions|queries)|ask (it )?questions|chat with|talk to|tutor(ing)? bot|copilot)",
         core=("Large Language Models", "Prompt Engineering"), supporting=("LLM Evaluation",),
         why="Conversational answers come from a language model, steered by prompts and checked by evaluation.",
         weak=("assistant", "assistants"), question="Should it hold a conversation and answer questions, or does 'assistant' mean a tool that helps in another way?"),
    Rule("generation", "Generates or transforms text", r"\b(generat(e|es|ing|ion) (text|content|answers|reports|questions|quizzes|emails|code|summaries)|summari[sz](e|es|ing|ation)|summar(y|ies)|rewrit(e|es|ing)|translat(e|es|ing|ion)|draft(s|ing)? (emails|replies|documents))",
         core=("Large Language Models", "Prompt Engineering"), supporting=("Generative AI", "LLM Evaluation"),
         why="Generating or transforming text is done with language models; output quality has to be measured."),
    Rule("documents", "Works over documents or search", r"\b(documents?|pdfs?|notes|knowledge ?base|wiki|research papers|papers|manuals?|policies|textbooks?|syllabus|lecture|semantic search|search (through|over|across)|retriev\w*|internal data|company data)",
         core=("Embeddings", "Vector Databases"), supporting=(),
         why="Finding the right passages in a document collection needs embeddings and a vector index.",
         weak=("documents", "document", "notes", "lecture", "papers", "manual", "manuals", "wiki"),
         question="Does it need to search or answer from a specific collection of documents? Which ones, and roughly how many?"),
    Rule("rag", "Answers grounded in your documents", r"\b(documents?|pdfs?|notes|knowledge ?base|wiki|papers|manuals?|policies|textbooks?|syllabus|lecture|internal data|company data|sources?|citations?)",
         core=("Retrieval-Augmented Generation",), when_any=("assistant", "generation"),
         why="An assistant that answers from specific documents needs retrieval-augmented generation, or it will make things up.",
         weak=("notes", "lecture", "papers", "source", "sources", "document", "documents"),
         question="Should its answers come from your own documents (and cite them), or from the model's general knowledge?"),
    Rule("agent", "Takes actions or automates tasks", r"\b((ai|llm|autonomous|coding|software|research|web|browser|personal|support) agents?|agents? (that|which|to) (can )?(plan|act|book|browse|edit|run|open|use|call|complete|automate)|agentic|automat(e|es|ing|ion)( of)? (tasks|workflows?|processes|my|the|emails?|bookings?)|takes? actions?|tool[- ]?use|uses? tools|multi[- ]step|book(s|ing)? (flights|tickets|appointments|meetings)|schedul(e|es|ing) (meetings|appointments)|browse the web|fill(s|ing)? (in )?forms)",
         core=("AI Agents", "Large Language Models", "Prompt Engineering"), supporting=("REST APIs", "LLM Evaluation", "AI Safety"),
         why="Software that plans and takes actions is an agent: it needs tool integration, evaluation of failures and limits on what it may do."),
    Rule("image_generation", "Generates images or media", r"\b(generat(e|es|ing|ion)( of)? (images?|art|pictures?|avatars?|logos?|designs?|videos?)|image generation|text[- ]to[- ](image|video)|stable diffusion|diffusion models?)",
         core=("Diffusion Models", "Generative AI"), supporting=("Deep Learning", "PyTorch"),
         why="Image and media generation is done with diffusion models."),
    Rule("vision", "Understands images or video", r"\b(images?|photos?|pictures?|cameras?|videos?|webcam|screenshots?|scanned|x[- ]rays?|mri|ct scans?|satellite|drone footage|cctv|visual|handwrit\w*|ocr)",
         core=("Computer Vision", "Deep Learning"), supporting=("Convolutional Neural Networks", "OpenCV", "Data Preparation", "PyTorch"),
         why="Understanding images or video is computer vision, which today means deep learning on labelled visual data.", unless_any=("image_generation",)),
    Rule("detection", "Finds or tracks objects", r"\b(detect\w*|recogni[sz]\w*|identif(y|ies|ying)|count(s|ing)? (people|objects|cars|vehicles|cells)|track(s|ing)? (objects|people|vehicles|players)|locat(e|es|ing) (objects|items))",
         core=("Object Detection",), when_any=("vision",),
         why="Finding and locating things in images is object detection."),
    Rule("segmentation", "Outlines regions in images", r"\b(segment\w*|outlin(e|es|ing)|masks?|pixel[- ]level|boundar(y|ies) of)",
         core=("Image Segmentation",), when_any=("vision",),
         why="Marking exact regions in an image is image segmentation."),
    Rule("multimodal", "Combines images and text", r"\b(multimodal|images? and text|describ(e|es|ing) (images|photos|pictures)|caption\w*|visual question|reads? (images|screenshots|diagrams)|looks? at (screenshots|images|photos|my screen|the screen)|explains? (what's in )?(images|photos|screenshots))",
         core=("Vision-Language Models",), supporting=("Large Language Models",),
         why="Reasoning over images and text together needs a vision-language model."),
    Rule("speech", "Understands speech", r"\b(speech|voice assistants?|voice|spoken|podcasts?|transcri\w*|dictation|call recordings?|meetings? recordings?|accents?|voice commands?)",
         core=("Speech Recognition", "Audio Signal Processing"), supporting=("Deep Learning",),
         why="Turning speech into text needs speech recognition built on audio processing.",
         weak=("voice",), question="Should it listen to people speaking, speak its answers aloud, or both?"),
    Rule("audio", "Works with sound", r"\b(audio|sounds?|songs?|music|recordings?|noise|acoustic)",
         core=("Audio Signal Processing",), supporting=("Deep Learning",),
         why="Analysing sound starts with audio signal processing (spectrograms and features), whatever the model on top."),
    Rule("tts", "Speaks back", r"\b(text[- ]to[- ]speech|reads? (it )?(aloud|out loud)|speaks?\b|talks? back|voice (output|responses?|replies)|by voice|out loud|narrat\w*)",
         core=("Text-to-Speech",), supporting=("Audio Signal Processing",),
         why="Producing natural speech is text-to-speech synthesis."),
    Rule("prediction", "Predicts or classifies from data", r"\b(predict\w*|classif(y|ies|ying|ication)|churn|fraud|risk scor\w*|credit scor\w*|price prediction|estimat(e|es|ing) (prices|risk|demand)|diagnos\w*|anomal\w*)",
         core=("Machine Learning", "Model Evaluation", "Data Preparation"), supporting=("Statistics", "scikit-learn"),
         why="Predicting or classifying from data is machine learning: the data has to be prepared and the model evaluated honestly."),
    Rule("forecasting", "Forecasts values over time", r"\b(forecast\w*|time[- ]series|over time|demand planning|sales (trends|forecast)|stock prices?|stocks?|trad(e|es|ing)|sensor (data|readings)|energy (use|consumption))",
         core=("Time Series Analysis",), supporting=("Statistics", "Data Preparation"),
         why="Predicting values over time is time series forecasting.",
         weak=("stock", "stocks", "trade", "trades", "trading"), question="Should it forecast prices, learn a trading strategy from rewards, or both? From what data?"),
    Rule("recommendation", "Recommends or personalises", r"\b(recommend\w*|personali[sz]\w*|suggest(s|ing)? (products|courses|movies|songs|jobs|books|articles|content)|match(es|ing)? (students|users|people|candidates))",
         core=("Recommender Systems",), supporting=("Machine Learning", "Embeddings", "Model Evaluation"),
         why="Suggesting items to people is a recommender system."),
    Rule("analytics", "Analyses data and reports insight", r"\b(dashboards?|analy[sz](e|es|ing|is) (data|sales|trends|performance|results|survey)|insights?|kpis?|visuali[sz]\w*|business intelligence|reporting)",
         core=("Data Visualization",), supporting=("SQL", "Pandas", "Statistics"),
         why="Turning data into insight others can act on needs analysis and clear visualisation."),
    Rule("text_understanding", "Understands or extracts from text", r"\b(sentiment|classif(y|ies|ying) (text|emails|reviews|tweets|messages|tickets)|extract(s|ing)? (names|entities|information|data|skills|fields) from|named entit\w*|spam|parse resumes?|resume pars\w*|text classification|keyword extraction|topic model\w*)",
         core=("Natural Language Processing",), supporting=("Hugging Face Transformers", "Data Preparation", "Model Evaluation"),
         why="Understanding or extracting from text is natural language processing."),
    Rule("product", "A product people will use", r"\b(web ?apps?|websites?|web application|platform|mobile app|saas|portal|browser extension|for (students|users|customers|teachers|doctors|farmers|businesses)|users can|people can)",
         core=("Model Deployment",), supporting=("REST APIs", "Software Testing"),
         why="If other people will use it, the model has to be deployed behind something they can reach, and tested.", when_any=AI_RULES),
    Rule("web_frontend", "Has a web interface", r"\b(web ?apps?|websites?|web application|front[- ]?end|dashboard|browser extension|portal)",
         supporting=("TypeScript",), why="A web interface is usually built in TypeScript or JavaScript.", when_any=AI_RULES),
    Rule("edge", "Runs on devices or offline", r"\b(mobile|phones?|android|ios|offline|on[- ]device|edge devices?|raspberry pi|arduino|jetson|microcontrollers?|embedded|wearables?|iot)",
         core=("On-device ML", "Model Quantization"), supporting=("ONNX", "TensorFlow Lite"),
         why="Running on a device means shrinking the model and using an on-device runtime."),
    Rule("privacy", "Handles private or sensitive data", r"\b(privacy|private data|federated|patient data|hospital data|medical records|sensitive data|without sharing (data|their data)|personal data|gdpr)",
         supporting=("Differential Privacy", "AI Safety"), why="Sensitive data needs privacy protection and care about what the system reveals.", when_any=AI_RULES),
    Rule("federated", "Trains across devices or organisations", r"\b(federated|across (devices|hospitals|phones|organi[sz]ations) without|decentrali[sz]ed training)",
         core=("Federated Learning",), supporting=("Differential Privacy",),
         why="Training without collecting the data centrally is federated learning."),
    Rule("robotics", "Controls a robot or vehicle", r"\b(robots?|robotic|drones?|rovers?|robot arms?|manipulators?|autonomous (car|vehicle|navigation|driving)|self[- ]driving|navigat(e|es|ion))",
         core=("ROS", "Control Systems", "Simulation"), supporting=("Computer Vision", "C++", "Linux"),
         why="Robots need control, simulation for safe testing, and usually ROS to connect it all."),
    Rule("rl", "Learns by trial and reward", r"\b(reinforcement learning|plays? (games?|chess|go)|game[- ]playing|rewards?|learns? (by|from) (trial|experience|interaction)|trading bot|trades? (stocks? )?automatically)",
         core=("Reinforcement Learning", "Simulation"), supporting=("Probability", "Deep Learning"),
         why="Learning from reward is reinforcement learning, trained in a simulated environment first."),
    Rule("graphs", "Reasons over connected data", r"\b(knowledge graphs?|social networks?|graph neural|molecul\w*|citation networks?|relationships? between (people|entities|users|concepts)|graph databases?|link prediction)",
         core=("Knowledge Graphs", "Graph Neural Networks"), supporting=("NetworkX", "Neo4j"),
         why="Data where the connections matter is modelled as a graph."),
    Rule("custom_model", "Trains or adapts its own model", r"\b(fine[- ]?tun\w*|train (my|our|a|its) own (model|llm|language model)|custom (model|llm)|domain[- ]specific (model|llm)|small language models?|own model)",
         core=("Fine-tuning",), supporting=("PyTorch", "Hugging Face Transformers", "LLM Evaluation"),
         why="Adapting a model to your data is fine-tuning, which needs training tooling and evaluation."),
    Rule("scale", "Must be reliable at scale", r"\b(scal(e|able|ing)|production|thousands of|millions of|real[- ]time|low latency|high availability|reliab\w*)",
         core=("Model Deployment",), supporting=("Docker", "Model Monitoring", "CI/CD"),
         why="Running reliably for many users needs deployment, containers, monitoring and automated releases.", when_any=AI_RULES),
    Rule("safety", "Must be safe, fair or trustworthy", r"\b(safe(ty|ly)?|bias(ed)?|fair(ness)?|harmful|toxic\w*|hallucinat\w*|trustworth\w*|accurate answers|red[- ]team\w*|guardrails?|misinformation)",
         core=("AI Safety", "LLM Evaluation"), supporting=("Model Evaluation",),
         why="Safety and accuracy claims have to be tested, not assumed.", when_any=AI_RULES),
    Rule("high_stakes", "High-stakes domain", r"\b(medical|health\w*|patients?|clinical|legal|law firms?|financ\w*|banking|insurance|loans?|hiring|recruit\w*)",
         core=("Model Evaluation",), supporting=("AI Safety",),
         why="Mistakes in this domain affect people seriously, so evaluation and safety checks matter more than usual.", when_any=AI_RULES),
    # Doing research, not a product about research ("a research assistant", "research papers" are not a research contribution).
    Rule("research", "A research contribution", r"\b((my|our|original|a) research (project|question|paper|contribution|study)|novel|state[- ]of[- ]the[- ]art|benchmarks?|publish|reproduc\w* (a |the )?paper|new (method|architecture|algorithm))",
         core=("Experimental Design",), supporting=("Model Evaluation", "Statistics"),
         why="A research claim needs controlled experiments, baselines and honest statistics."),
    Rule("serving", "Serves models efficiently", r"\b(gpu clusters?|inference servers?|serv(e|ing) (llms?|models)|throughput|batch inference|model serving)",
         core=("Model Deployment",), supporting=("Docker", "Kubernetes", "vLLM"),
         why="Serving models efficiently is an infrastructure problem: containers, orchestration and a serving engine."),
)

_COMPILED = [(r, re.compile(r.pattern, re.I)) for r in RULES]

PROMPTS = (
    "Who will use it, and what problem does it solve for them?",
    "What goes in (text, images, audio, tables, documents) and what comes out?",
    "Will it run as a website, an app, on a device, or as a script for yourself?",
)


def _clean(text: Optional[str]) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()[:MAX_CHARS]


def analyse(text: Optional[str], lexicon_scan: Callable[[str], List[str]], known: Callable[[str], bool], source: str = "profile") -> Dict[str, Any]:
    """Project requirements from the student's own description. `known` says whether a skill is a framework competency."""
    clean = _clean(text)
    base = {"version": INTENT_VERSION, "text": clean or None, "source": source if clean else None,
            "method": "Phrase rules over your own description (no AI). Each skill lists the words that led to it, so you can check our reading.",
            "prompts": list(PROMPTS)}
    if not clean:
        return {**base, "status": "none", "matched": [], "requirements": []}

    hits: Dict[str, List[str]] = {}
    for rule, pattern in _COMPILED:
        found = sorted({m.group(0).strip().lower() for m in pattern.finditer(clean)})
        if found:
            hits[rule.id] = found
    # A rule matched only by its ambiguous words is a possible reading, not a fact. Conditions (when_any) count only clear readings.
    weak_only = {r.id for r in RULES if r.id in hits and r.weak and all(h in r.weak for h in hits[r.id])}
    clear_hits = {rid for rid in hits if rid not in weak_only}

    def applies(r: Rule, pool: set) -> bool:
        return r.id in hits and (not r.when_any or any(w in pool for w in r.when_any)) and not any(u in hits for u in r.unless_any)

    applied = [r for r in RULES if r.id in clear_hits and applies(r, clear_hits)]
    possible_rules = [r for r in RULES if r.id in weak_only and applies(r, set(hits))]

    reqs: Dict[str, Dict[str, Any]] = {}
    possible: Dict[str, Dict[str, Any]] = {}

    def add(skill: str, importance: str, why: str, trigger: str, rule_id: str, into: Optional[Dict[str, Dict[str, Any]]] = None) -> None:
        if not known(skill):
            return
        target = reqs if into is None else into
        row = target.setdefault(skill, {"skill": skill, "importance": importance, "reasons": [], "triggers": [], "rules": []})
        if importance == "core":
            row["importance"] = "core"
        if why and why not in row["reasons"]:
            row["reasons"].append(why)
        if trigger and trigger not in row["triggers"]:
            row["triggers"].append(trigger)
        if rule_id not in row["rules"]:
            row["rules"].append(rule_id)

    for rule in applied:
        phrase = hits[rule.id][0]
        for skill in rule.core:
            add(skill, "core", rule.why, phrase, rule.id)
        for skill in rule.supporting:
            add(skill, "supporting", rule.why, phrase, rule.id)
    named = [s for s in lexicon_scan(clean) if known(s)]
    for skill in named:
        add(skill, "core", "You named it in your description.", skill, "named")
    # A possible reading that would add nothing new (its core skills are already clear) isn't worth a question.
    possible_rules = [r for r in possible_rules if not all(s in reqs or not known(s) for s in r.core)]
    for rule in possible_rules:
        for skill in (*rule.core, *rule.supporting):
            if skill not in reqs:
                add(skill, "core" if skill in rule.core else "supporting", rule.why, hits[rule.id][0], rule.id, into=possible)

    def finish(rows: Dict[str, Dict[str, Any]], certainty: Optional[str] = None) -> List[Dict[str, Any]]:
        out = sorted(rows.values(), key=lambda r: (r["importance"] != "core", -len(r["rules"]), r["skill"]))
        for r in out:
            r["why"] = " ".join(r.pop("reasons"))
            r["certainty"] = certainty or ("named" if r["rules"] == ["named"] else "clear")
        return out

    matched = [{"rule": r.id, "label": r.label, "phrases": hits[r.id][:3]} for r in applied]
    questions = [r.question for r in possible_rules if r.question]
    possible_rows = finish(possible, "possible")
    if not reqs:
        return {**base, "status": "too_vague", "matched": matched, "requirements": [], "possible": possible_rows, "questions": questions,
                "reason": ("We're not sure what this project needs yet. Answer the questions below and we'll plan for it."
                           if questions else "We couldn't tell from this description what the project needs technically. A sentence or two on the questions below helps.")}
    return {**base, "status": "analysed", "matched": matched, "requirements": finish(reqs), "possible": possible_rows, "questions": questions}


def closest_roles(requirements: Sequence[Dict[str, Any]], frameworks: Dict[str, Any], roles: Sequence[str], top: int = 3) -> List[Dict[str, Any]]:
    """Which career frameworks the project's core skills overlap with most: information for the student, never a decision."""
    core = {r["skill"] for r in requirements if r["importance"] == "core"}
    if not core:
        return []
    out = []
    for role in roles:
        f = frameworks.get(role)
        if not f:
            continue
        names = {q.competency for q in f.requirements}
        required = {q.competency for q in f.requirements if q.required}
        overlap = core & names
        if overlap:
            out.append({"role": role, "label": f.label, "overlap": sorted(overlap), "coreCovered": len(overlap), "core": len(core),
                        "requiredOverlap": len(core & required)})
    out.sort(key=lambda r: (-r["coreCovered"], -r["requiredOverlap"], r["label"]))
    return out[:top]
