// What a user can share with an integrated app, field group by field group.
// Client-safe (no server-only): used by the toggles and the server registry.
import type { IntegrationScope } from "@/db/schema";

export const SCOPE_COPY: { id: IntegrationScope; label: string; detail: string }[] = [
  { id: "skills", label: "Share verified skills", detail: "Skills with their evidence and verification status." },
  { id: "projects", label: "Share projects", detail: "Titles, technologies, links and descriptions." },
  { id: "eris", label: "Share ERIS readiness score", detail: "Your interview-readiness score, target role, top gaps and what you're looking for, so matched people can help. Needs skills." },
  { id: "experience", label: "Share experience", detail: "Organizations, roles, dates and what you did." },
  { id: "education", label: "Share education", detail: "Institutions, degrees, dates and grades." },
  { id: "achievements", label: "Share achievements", detail: "Certifications, publications, awards and coding-profile stats." },
  { id: "activity", label: "Share activity", detail: "Recent GitHub repositories and which sources you've connected." },
];

export const SCOPE_IDS = SCOPE_COPY.map((s) => s.id);
