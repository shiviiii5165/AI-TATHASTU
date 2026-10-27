// Client-safe catalogue data for the onboarding wizard.

export const CAREER_ROLES = [
  { id: "generative_ai_engineer", label: "Generative AI Engineer", blurb: "LLM apps, RAG, agents, fine-tuning" },
  { id: "ml_engineer", label: "ML Engineer", blurb: "Training, serving and scaling models" },
  { id: "ai_engineer", label: "AI Engineer", blurb: "Shipping AI features into products" },
  { id: "ai_researcher", label: "AI Researcher", blurb: "Papers, experiments, new methods" },
  { id: "data_scientist", label: "Data Scientist", blurb: "Statistics, analysis, modelling" },
  { id: "deep_learning_engineer", label: "Deep Learning Engineer", blurb: "Architectures, training at scale" },
  { id: "mlops_engineer", label: "MLOps Engineer", blurb: "Pipelines, infra, monitoring" },
  { id: "nlp_engineer", label: "NLP Engineer", blurb: "Language models, text, speech" },
  { id: "computer_vision_engineer", label: "Computer Vision Engineer", blurb: "Images, video, 3D perception" },
  { id: "robotics_ai_engineer", label: "Robotics & AI Engineer", blurb: "Control, perception, embodied AI" },
  { id: "rl_engineer", label: "RL Engineer", blurb: "Agents, rewards, simulation" },
  { id: "ai_product_founder", label: "AI Product Builder / Founder", blurb: "Building an AI product or company" },
  { id: "still_exploring", label: "Still Exploring", blurb: "Not sure yet, show me the options" },
] as const;

export type CareerRoleId = (typeof CAREER_ROLES)[number]["id"];
export const CAREER_ROLE_IDS = CAREER_ROLES.map((r) => r.id) as [CareerRoleId, ...CareerRoleId[]];

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
