// Client-safe consent copy. Bump CONSENT_POLICY_VERSION whenever the wording
// or what a purpose covers changes; every consents row records the version
// the user actually saw.

import type { ConsentPurpose } from "@/db/schema";

export const CONSENT_POLICY_VERSION = "2026-11-10";

/**
 * From this policy version the external_ai text discloses its full scope: resume reading, portfolio analysis,
 * GitHub repository metadata analysis and AI-assisted people matching. Earlier grants disclosed resume reading
 * only. The worker enforces it (worker/db.py EXTERNAL_AI_FULL_SCOPE_SINCE, same value): until the user accepts the
 * updated text once, an earlier grant keeps covering resume reading and nothing else.
 *
 * Change this only when a genuinely new processing purpose is added; a wording change alone bumps
 * CONSENT_POLICY_VERSION and must not re-ask anyone.
 */
export const EXTERNAL_AI_FULL_SCOPE_SINCE = "2026-11-10";

/** ISO-date versions compare as strings. An unknown or malformed version doesn't cover anything. */
export function coversVersion(recorded: string | null | undefined, required: string): boolean {
  return typeof recorded === "string" && /^\d{4}-\d{2}-\d{2}$/.test(recorded) && recorded >= required;
}

/**
 * The one-time updated-consent request: only for someone whose current answer is a grant given before the full
 * scope was disclosed. Never for a withdrawal, a missing answer, or a grant under the current scope, so once the
 * user answers (either way) it doesn't come back.
 */
export function needsExternalAiScopeUpdate(latest: { granted: boolean | null; policyVersion: string | null } | null | undefined): boolean {
  return Boolean(latest?.granted) && !coversVersion(latest!.policyVersion, EXTERNAL_AI_FULL_SCOPE_SINCE);
}

export const CONSENT_ITEMS: {
  purpose: ConsentPurpose;
  title: string;
  body: string;
  without: string;
}[] = [
  {
    purpose: "external_ai",
    title: "Use AI services to read my resume",
    body: "We first read your resume ourselves. Where something is missed, the relevant part of your resume is sent to an outside AI service (Groq, Google Gemini or OpenRouter) to fill the gap. If the file can't be read as text, such as a scan or photo, images of its pages are sent instead. Nothing is added to your profile until you review and confirm it. The same permission lets these services read a portfolio site you connect, assess your public GitHub repositories from their names, descriptions, languages and topics, and match you with people using a short summary of your role, skills, project titles and goals.",
    without: "Without this, we read your resume without outside AI. Some details may be missed, and you can add them yourself.",
  },
  {
    purpose: "linkedin_scrape",
    title: "Read my public LinkedIn profile",
    body: "If you connect public LinkedIn profiles for enrichment, we fetch public details through our scraping provider (Apify). We never log in as you or use your cookies.",
    without: "Without this, LinkedIn is limited to verified identity, name, email and photo from official LinkedIn OAuth.",
  },
  {
    purpose: "mentor_discovery",
    title: "Let mentors and alumni find me",
    body: "Faculty and alumni whose expertise or work fits your goals can see your name, university, target role and top skills, so they can offer mentoring or referrals. Students only: faculty and alumni are always findable.",
    without: "Without this, you're still matched, but no mentor or alum sees you until you turn it on.",
  },
  {
    purpose: "analytics",
    title: "Share usage analytics",
    body: "Which pages and features you use, so we can see where onboarding is confusing and fix it.",
    without: "Optional. Saying no changes nothing about your profile or dashboard.",
  },
];

export type ConsentChoices = Record<ConsentPurpose, boolean>;
export const CONSENT_PURPOSES = CONSENT_ITEMS.map((c) => c.purpose);

/**
 * Resume step: the external_ai checkbox, its one-line summary and its "Read more" section.
 * It restates the external_ai item above in more detail; keep the two in step, and both in step
 * with the worker: resume/extract.py (rules always; outside AI only with this consent; results unconfirmed
 * until reviewed; consent is read when a job starts and re-checked before saving, so revoking mid-run
 * discards the AI results), connectors/portfolio.py (LLM pass on the page text), intelligence/repo_scorer.py
 * (repository metadata only) and intelligence/collaboration.py (embedding of role, skills, project titles, goals).
 */
export const RESUME_AI_CONSENT = {
  label: "Allow AI-assisted reading of my resume",
  summary: "We can use AI to pull your education, experience, projects and skills from your resume, so you don't have to type them. You check everything before it's saved.",
  details: [
    {
      term: "What we extract",
      text: "Your name and contact details, education, work experience, projects, skills, certifications, publications and achievements.",
    },
    {
      term: "Why we need it",
      text: "To fill in your profile, which your skills, career roadmap and recommendations are built from.",
    },
    {
      term: "Who processes your resume",
      text: "We read your resume ourselves first. Where we miss something, the relevant part of your resume is sent to an outside AI service: Groq, Google Gemini or OpenRouter (which passes it to the AI model it selects). If the file can't be read as text, such as a scan or photo, images of its pages are sent instead. These services process it under their own terms.",
    },
    {
      term: "What else this covers",
      text: "The same permission lets these services read a portfolio site you connect, assess your public GitHub repositories from their names, descriptions, languages and topics (not their code), and match you with people using a short summary of your role, skills, project titles and goals.",
    },
    {
      term: "What is saved",
      text: "Nothing is added to your profile automatically. You review what was found and choose what to keep.",
    },
    {
      term: "If you don't allow it",
      text: "You can still upload your resume. We'll read it without outside AI, which may miss some details; you can add those yourself.",
    },
    {
      term: "Changing your mind",
      text: "You can withdraw permission at any time in Settings, under Privacy. From then on, uploads, portfolio syncs and profile updates are processed without outside AI services. Processing that has already started may finish with them; for a resume being read at that moment, the AI results are discarded and not added to your profile.",
    },
  ],
  manageHref: "/settings/privacy",
} as const;
