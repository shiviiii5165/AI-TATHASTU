// Client-safe: imported by both the DAL and client components.
//
// Each persona has its own six-step flow. The last three steps (resume,
// connect sources, review) are shared and sit at the same positions in every
// flow, so their pages and the "04 / 06" headers don't depend on the persona.
// Before a persona is chosen the user is on "role" (Step 0, /onboarding/role).

import type { Persona } from "@/db/schema";

const STEP_DEFS = {
  // Student
  career_direction: { slug: "career-direction", label: "Career direction" },
  priorities: { slug: "priorities", label: "Priorities" },
  basic_profile: { slug: "basic-profile", label: "Basic profile" },
  // Faculty / mentor
  faculty_profile: { slug: "faculty-profile", label: "Faculty profile" },
  research_expertise: { slug: "research-expertise", label: "Research & expertise" },
  mentorship: { slug: "mentorship", label: "Mentorship" },
  // Alumni
  alumni_profile: { slug: "alumni-profile", label: "Alumni profile" },
  professional_profile: { slug: "professional-profile", label: "Work" },
  give_back: { slug: "give-back", label: "Give back" },
  // Shared
  resume: { slug: "resume", label: "Resume" },
  connectors: { slug: "connect-sources", label: "Connect sources" },
  review: { slug: "review-consent", label: "Review & consent" },
} as const;

export type WizardStep = keyof typeof STEP_DEFS;
export type OnboardingStep = WizardStep | "role" | "done";

const SHARED_TAIL = ["resume", "connectors", "review"] as const satisfies WizardStep[];

export const FLOWS: Record<Persona, readonly WizardStep[]> = {
  student: ["career_direction", "priorities", "basic_profile", ...SHARED_TAIL],
  faculty: ["faculty_profile", "research_expertise", "mentorship", ...SHARED_TAIL],
  alumni: ["alumni_profile", "professional_profile", "give_back", ...SHARED_TAIL],
};

export const FLOW_LENGTH = 6;

export type StepView = { id: WizardStep; slug: string; label: string };

export const flowSteps = (persona: Persona): StepView[] => FLOWS[persona].map((id) => ({ id, ...STEP_DEFS[id] }));

export const stepLabel = (step: WizardStep) => STEP_DEFS[step].label;


/** Position in the persona's flow: -1 for "role" (or a step from another flow), FLOW_LENGTH for "done". */
export function stepIndex(step: OnboardingStep, persona: Persona): number {
  if (step === "done") return FLOW_LENGTH;
  if (step === "role") return -1;
  return FLOWS[persona].indexOf(step);
}

/** Position of a step in whichever flow contains it (every step sits at one position). */
export function stepPosition(step: WizardStep): number {
  for (const flow of Object.values(FLOWS)) {
    const i = flow.indexOf(step);
    if (i >= 0) return i;
  }
  return 0;
}

export function stepHref(step: OnboardingStep): string {
  if (step === "done") return "/dashboard";
  if (step === "role") return "/onboarding/role";
  return `/onboarding/${STEP_DEFS[step].slug}`;
}

export const firstStep = (persona: Persona): WizardStep => FLOWS[persona][0];

export function nextStep(step: WizardStep, persona: Persona): OnboardingStep {
  return FLOWS[persona][stepIndex(step, persona) + 1] ?? "done";
}

/** The step before this one; the first step goes back to the persona choice. */
export function previousStep(step: WizardStep, persona: Persona): WizardStep | "role" {
  return FLOWS[persona][stepIndex(step, persona) - 1] ?? "role";
}
