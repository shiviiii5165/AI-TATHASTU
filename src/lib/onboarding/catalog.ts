// Client-safe catalogue data for the onboarding wizard.

/**
 * The 20 career directions offered in onboarding ("What do you want to do?").
 * Ids are stable storage keys: existing ids are reused where the direction is the same
 * (e.g. ml_engineer, robotics_ai_engineer, ai_researcher), so saved choices and the worker's
 * role-keyed intelligence (worker/intelligence/config.py) keep working.
 * `keywords` only widen search; they are never shown.
 */
export const CAREER_ROLES = [
  { id: "ml_engineer", label: "ML Engineer", blurb: "Builds, trains and ships machine learning models into products", keywords: "machine learning ml models training deployment scikit-learn" },
  { id: "data_scientist", label: "Data Scientist", blurb: "Analyses data, runs experiments and builds predictive models", keywords: "analytics statistics sql pandas insights" },
  { id: "deep_learning_engineer", label: "Deep Learning Engineer", blurb: "Designs and trains neural networks with PyTorch or TensorFlow", keywords: "neural networks pytorch tensorflow cuda" },
  { id: "generative_ai_engineer", label: "Generative AI Engineer", blurb: "Works with generative models, RAG, generation pipelines and model integration", keywords: "genai rag diffusion embeddings generation" },
  { id: "llm_application_engineer", label: "LLM Application Engineer", blurb: "Builds LLM-powered apps: APIs, tools and orchestration", keywords: "llm apps rag chatbots langchain api prompt tools" },
  { id: "llm_model_engineer", label: "LLM Model Engineer", blurb: "Trains, fine-tunes, optimises and serves language models", keywords: "fine-tuning pretraining lora quantization inference" },
  { id: "mlops_engineer", label: "MLOps Engineer", blurb: "Deploys, monitors and runs ML pipelines reliably", keywords: "deployment monitoring docker kubernetes ci/cd mlflow" },
  { id: "llmops_engineer", label: "LLMOps Engineer", blurb: "Deploys LLMs and owns evaluation, observability and reliability", keywords: "llm deployment evaluation observability tracing" },
  { id: "ai_agent_engineer", label: "AI Agent Engineer", blurb: "Builds agent workflows: tool use, planning and orchestration", keywords: "agents agentic tools planning multi-agent langgraph" },
  { id: "nlp_engineer", label: "Natural Language Processing (NLP) Engineer", blurb: "Builds systems that understand and generate text", keywords: "nlp language text transformers hugging face" },
  { id: "computer_vision_engineer", label: "Computer Vision Engineer", blurb: "Builds models for images and video", keywords: "cv vision images video opencv detection" },
  { id: "multimodal_ai_engineer", label: "Multimodal AI Engineer", blurb: "Builds models that combine text, images, audio and video", keywords: "multimodal vision-language vlm clip" },
  { id: "speech_ai_engineer", label: "Speech AI Engineer", blurb: "Builds speech recognition, synthesis and voice systems", keywords: "speech asr tts voice audio whisper" },
  { id: "rl_engineer", label: "Reinforcement Learning Engineer", blurb: "Trains agents that learn from rewards and environments", keywords: "rl reinforcement rewards policy gym" },
  { id: "robotics_ai_engineer", label: "Robotics Engineer", blurb: "Brings AI to robots: perception, control and ROS", keywords: "robotics ros control perception embedded" },
  { id: "graph_ai_engineer", label: "Graph AI Engineer", blurb: "Builds graph neural networks and knowledge-graph systems", keywords: "graph gnn knowledge graph networkx" },
  { id: "ai_infrastructure_engineer", label: "AI Infrastructure Engineer", blurb: "Runs GPU clusters, distributed training and model serving", keywords: "infrastructure gpu distributed serving cloud kubernetes" },
  { id: "ai_evaluation_safety_engineer", label: "AI Evaluation & Safety Engineer", blurb: "Tests models for quality, bias, robustness and safety", keywords: "evaluation safety alignment red teaming benchmarks" },
  { id: "edge_federated_ai_engineer", label: "Edge & Federated AI Engineer", blurb: "Runs AI on devices and trains models privately across them", keywords: "edge on-device tinyml federated privacy mobile" },
  { id: "ai_researcher", label: "AI Research Engineer / Applied AI Scientist", blurb: "Turns research ideas into experiments, papers and prototypes", keywords: "research papers experiments scientist" },
] as const;

/**
 * Retired directions: no longer offered, but still valid so existing saved choices load, validate
 * and display unchanged (never silently rewritten).
 */
export const RETIRED_CAREER_ROLES = [
  { id: "ai_engineer", label: "AI Engineer", blurb: "Build AI features", keywords: "" },
  { id: "ai_product_founder", label: "AI Product Builder", blurb: "Build AI products", keywords: "" },
  { id: "still_exploring", label: "Still exploring", blurb: "Help me choose", keywords: "" },
] as const;

export const ALL_CAREER_ROLES = [...CAREER_ROLES, ...RETIRED_CAREER_ROLES] as const;

export type CareerRoleId = (typeof ALL_CAREER_ROLES)[number]["id"];
/** Every id that may be stored (offered + retired). */
export const CAREER_ROLE_IDS = ALL_CAREER_ROLES.map((r) => r.id) as [CareerRoleId, ...CareerRoleId[]];

/** Display label for any stored role id (offered or retired); unknown ids are returned as-is. */
export const careerRoleLabel = (id: string | null | undefined) =>
  id ? (ALL_CAREER_ROLES.find((r) => r.id === id)?.label ?? id) : null;

/** Case-insensitive search over label, description and keywords. */
export function searchCareerRoles(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [...CAREER_ROLES];
  const terms = q.split(/\s+/);
  return CAREER_ROLES.filter((r) => {
    const hay = `${r.label} ${r.blurb} ${r.keywords}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

// Ids match the `requiredIntent` values used by the widget registry.
export const PRIORITIES = [
  { id: "learn_ai_ml", label: "Learn AI & ML", blurb: "Structured learning paths and skill gaps", module: "Learn" },
  { id: "avasar_jobs", label: "Internships & Jobs", blurb: "Roles that fit your profile", module: "Avasar" },
  { id: "people_mentors", label: "People & Mentors", blurb: "Mentors and peers in your field", module: "Collaborate" },
  { id: "collaborate", label: "Collaborate", blurb: "Join teams and open projects", module: "Collaborate" },
  { id: "build_projects", label: "Build Projects", blurb: "Portfolio projects matched to your goal", module: "Projects" },
  { id: "research_events", label: "Research & Events", blurb: "Papers, conferences, competitions", module: "Meet" },
] as const;

export type PriorityId = (typeof PRIORITIES)[number]["id"];
export const PRIORITY_IDS = PRIORITIES.map((p) => p.id) as [PriorityId, ...PriorityId[]];
export const MAX_PRIORITIES = 3;
