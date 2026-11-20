// What AI Tathastu shares with each connected app, field group by field group (consent policy v4: all of it).
// Client-safe (no server-only): used by the toggles and the server registry.
import type { IntegrationClientId, IntegrationScope } from "@/db/schema";

/** `apps`: shown and stored only for these apps (absent: every app). */
export const SCOPE_COPY: { id: IntegrationScope; label: string; detail: string; apps?: IntegrationClientId[] }[] = [
  {
    id: "discovery",
    label: "Public Collaborate profile",
    detail:
      "Your Collaborate profile is public: other members can find you in Discover People and People You May Know (here and on Collaborate) and send you a connection request. Your email and contact details are never shown publicly.",
    apps: ["collaborate"],
  },
  { id: "skills", label: "Share verified skills", detail: "Skills with their evidence and verification status." },
  { id: "projects", label: "Share projects", detail: "Titles, technologies, links and descriptions." },
  { id: "eris", label: "Share ERIS readiness score", detail: "Career Intelligence. Your interview-readiness score, target role, top gaps and what you're looking for, so matched people can help. Needs skills." },
  { id: "experience", label: "Share experience", detail: "Organizations, roles, dates and what you did." },
  { id: "education", label: "Share education", detail: "Institutions, degrees, dates and grades." },
  { id: "achievements", label: "Share achievements", detail: "Certifications, publications, awards and coding-profile stats." },
  { id: "activity", label: "Share activity", detail: "Career Intelligence. Recent GitHub repositories and which sources you've connected." },
];

export const SCOPE_IDS = SCOPE_COPY.map((s) => s.id);

/** The choices that apply to one app (its toggles, its stored consent). */
export const scopesForApp = (app: IntegrationClientId | undefined) => SCOPE_COPY.filter((s) => !s.apps || !app || s.apps.includes(app));
