// Client-safe catalogue data for the onboarding wizard.

export const CAREER_ROLES = [
  { id: "generative_ai_engineer", label: "Generative AI", blurb: "LLMs and AI apps" },
  { id: "ml_engineer", label: "ML Engineer", blurb: "Train and deploy models" },
  { id: "ai_engineer", label: "AI Engineer", blurb: "Build AI features" },
  { id: "ai_researcher", label: "AI Research", blurb: "Explore new methods" },
  { id: "data_scientist", label: "Data Scientist", blurb: "Find insights in data" },
  { id: "deep_learning_engineer", label: "Deep Learning", blurb: "Neural networks" },
  { id: "mlops_engineer", label: "MLOps", blurb: "Deploy and monitor models" },
  { id: "nlp_engineer", label: "NLP Engineer", blurb: "Language and text" },
  { id: "computer_vision_engineer", label: "Computer Vision", blurb: "Images and video" },
  { id: "robotics_ai_engineer", label: "Robotics", blurb: "AI in the physical world" },
  { id: "rl_engineer", label: "RL Engineer", blurb: "Agents and rewards" },
  { id: "ai_product_founder", label: "AI Product Builder", blurb: "Build AI products" },
  { id: "still_exploring", label: "Still exploring", blurb: "Help me choose" },
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
