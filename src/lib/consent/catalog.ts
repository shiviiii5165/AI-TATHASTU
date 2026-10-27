// Client-safe consent copy. Bump CONSENT_POLICY_VERSION whenever the wording
// or what a purpose covers changes; every consents row records the version
// the user actually saw.

import type { ConsentPurpose } from "@/db/schema";

export const CONSENT_POLICY_VERSION = "2026-10-23";

export const CONSENT_ITEMS: {
  purpose: ConsentPurpose;
  title: string;
  body: string;
  without: string;
}[] = [
  {
    purpose: "external_ai",
    title: "Use AI services to read my resume",
    body: "When our own parser can't find a field, we send the relevant section of your resume text to AI providers (Groq, Google Gemini or OpenRouter) to recover it. If the file can't be read as text (a scan, a photo, or unusual fonts), we send images of its pages instead. You review every result before it's saved to your profile.",
    without: "Without this, we use rule-based extraction only, which can miss fields you'll then add by hand.",
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
