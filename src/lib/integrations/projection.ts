import "server-only";

import { createHash } from "node:crypto";

import type { IntegrationClientId, IntegrationConsent, IntegrationScope } from "@/db/schema";
import { effectiveScopes } from "@/lib/integrations/consent";
import { careerRoleLabel } from "@/lib/onboarding/catalog";
import { dateRange, type Fact, type ProfileData } from "@/lib/profile/unified";

/**
 * ProfessionalProjectionV1: what an integrated app may know about a user.
 * Eight sections: identity, education, skills, projects, experience,
 * achievements, activity, privacy. A section the user hasn't shared is null
 * and listed in privacy.masked; the ERIS score (inside skills) has its own
 * consent, and individual projects can be hidden. Phone numbers and raw
 * resume text are never included. Documented in docs/integration-guide.md.
 */

export const PROJECTION_SCHEMA = "ProfessionalProjectionV1";

/** Stable across recomputes (unified_projects ids are not). */
export const projectKey = (title: string) =>
  `p_${createHash("sha256").update(title.trim().toLowerCase()).digest("hex").slice(0, 16)}`;

type Group = Record<string, Fact>;

function groupEntries(facts: Fact[], group: string): { origins: string[]; fields: Group }[] {
  const byKey = new Map<string, { origins: string[]; fields: Group }>();
  for (const f of facts.filter((f) => f.group === group)) {
    const key = `${f.origin}:${f.recordKey ?? f.id}`;
    const e = byKey.get(key) ?? { origins: [], fields: {} };
    e.fields[f.field] = f;
    if (!e.origins.includes(f.origin)) e.origins.push(f.origin);
    byKey.set(key, e);
  }
  return [...byKey.values()];
}

const v = (g: Group, field: string) => g[field]?.value ?? null;

export function toProfessionalProjectionV1(
  p: ProfileData,
  clientId: IntegrationClientId,
  consent: Pick<IntegrationConsent, "scopes" | "hiddenProjects" | "updatedAt"> | null,
  now = new Date(),
) {
  const scopes = effectiveScopes(consent);
  const hidden = new Set(consent?.hiddenProjects ?? []);
  const shared = (s: IntegrationScope) => scopes[s];
  const best = (field: string) => p.identity[field]?.best.value ?? null;
  const role = p.state?.careerRole ?? null;

  const identity = {
    id: p.user.id,
    email: p.user.email,
    name: best("full_name") ?? p.user.name,
    headline: best("headline"),
    avatarUrl: p.user.image ?? null,
    careerRole: role ? { id: role, label: careerRoleLabel(role) ?? role } : null,
    careerRoleOther: p.state?.careerRoleOther ?? null,
    location: { city: p.user.city ?? null, country: p.user.country ?? null },
    university: p.user.university ?? null,
    persona: p.user.role,
    // Faculty: department and title. Alumni: current role and class year.
    department: p.user.department ?? null,
    academicTitle: p.user.academicTitle ?? null,
    company: p.user.company ?? null,
    jobTitle: p.user.jobTitle ?? null,
    graduationYear: p.user.graduationYear ?? null,
  };

  const education = shared("education")
    ? p.education.map((e) => ({
        institution: e.fields.institution?.value ?? null,
        degree: e.fields.degree?.value ?? null,
        fieldOfStudy: e.fields.field_of_study?.value ?? null,
        dates: dateRange(e),
        grade: e.fields.grade?.value ?? null,
        sources: e.origins,
      }))
    : null;

  const eris = p.view?.erisScore;
  // The intelligence engine's assessment, by skill name. Absent or unassessed → null, never a default.
  const intelligence = p.view?.intelligence;
  const assessed = new Map((intelligence?.skills ?? []).map((s) => [s.name.toLowerCase(), s]));
  const skills = shared("skills")
    ? {
        items: p.skills.map((s) => {
          const a = assessed.get(s.name.toLowerCase());
          return {
            name: s.name,
            category: s.category,
            evidenceStrength: s.evidenceStrength,
            verified: s.verificationStatus === "verified",
            verificationStatus: s.verificationStatus,
            sources: s.sources,
            // Additive (contract v1, optional): 0-100 from demonstrated evidence, or null when not assessed.
            proficiency: a && a.proficiency !== null ? Math.round(a.proficiency) : null,
            level: a && a.proficiency !== null ? a.level : null,
          };
        }),
        erisReadiness:
          shared("eris") && eris && eris.overall !== null
            ? { score: eris.overall, role, byRole: eris.byRole, gaps: eris.gaps, computedAt: p.view?.computedAt ?? null }
            : null,
      }
    : null;

  const visibleProjects = p.projects.filter((pr) => !hidden.has(projectKey(pr.title)));
  const projects = shared("projects")
    ? visibleProjects.map((pr) => ({
        key: projectKey(pr.title),
        title: pr.title,
        description: pr.descriptions[0] ?? null,
        technologies: pr.technologies,
        links: pr.links,
        status: pr.status,
        sources: pr.origins,
      }))
    : null;

  const experience = shared("experience")
    ? p.experience.map((e) => ({
        organization: e.fields.organization?.value ?? null,
        role: e.fields.role?.value ?? null,
        dates: dateRange(e),
        description: e.fields.description?.value ?? null,
        sources: e.origins,
      }))
    : null;

  const achievements = shared("achievements")
    ? [
        ...groupEntries(p.facts, "achievements").map((e) => ({
          type: "achievement" as const,
          title: v(e.fields, "title"),
          issuer: null,
          date: v(e.fields, "date"),
          description: v(e.fields, "description"),
          url: null,
          sources: e.origins,
        })),
        ...groupEntries(p.facts, "certifications").map((e) => ({
          type: "certification" as const,
          title: v(e.fields, "name"),
          issuer: v(e.fields, "issuer"),
          date: v(e.fields, "date"),
          description: null,
          url: null,
          sources: e.origins,
        })),
        ...groupEntries(p.facts, "publications").map((e) => ({
          type: "publication" as const,
          title: v(e.fields, "title"),
          issuer: v(e.fields, "venue"),
          date: v(e.fields, "date"),
          description: null,
          url: v(e.fields, "url"),
          sources: e.origins,
        })),
      ].filter((a) => a.title)
    : null;

  const activity = shared("activity")
    ? {
        connectedSources: [...new Set(p.facts.map((f) => f.origin))].filter((o) => o !== "user_entered" && o !== "resume"),
        github: {
          repositories: p.repos.length,
          recent: [...p.repos]
            .filter((r) => r.lastCommitAt)
            .sort((a, b) => b.lastCommitAt!.getTime() - a.lastCommitAt!.getTime())
            .slice(0, 5)
            .map((r) => ({
              name: r.repoName,
              url: r.url,
              stars: r.stars,
              languages: Object.keys(r.languages),
              lastCommitAt: r.lastCommitAt!.toISOString(),
            })),
        },
        profileUpdatedAt: p.view?.computedAt ?? null,
      }
    : null;

  // Goals (additive, contract v1, optional): the target role, what it still needs from the user's
  // evidence, and what they came to the platform for. Shared under the "eris" scope, whose consent
  // copy covers "target role and top gaps". Lets Collaborate find people who can help with them.
  const primary = intelligence?.roles?.[0];
  const goals = shared("eris")
    ? {
        targetRole: role ? { id: role, label: careerRoleLabel(role) ?? role } : null,
        needs: primary?.assessed
          ? primary.open.slice(0, 12).map((r) => ({ skill: r.skill, priority: r.priority, state: r.state, expectedLevel: r.expectedLevel }))
          : [],
        assessed: Boolean(primary?.assessed),
        collaborationIntents: [...(p.state?.priorities ?? [])],
      }
    : null;

  const sections = { education, skills, projects, experience, achievements, activity, goals };
  const masked = [
    ...Object.entries(sections).filter(([, s]) => s === null).map(([k]) => k),
    ...(skills && !skills.erisReadiness && !shared("eris") ? ["skills.erisReadiness"] : []),
  ];

  return {
    schema: PROJECTION_SCHEMA,
    version: 1,
    audience: clientId,
    generatedAt: now.toISOString(),
    identity,
    ...sections,
    privacy: {
      scopes,
      masked,
      hiddenProjects: shared("projects") ? p.projects.length - visibleProjects.length : 0,
      consentUpdatedAt: consent?.updatedAt?.toISOString() ?? null,
    },
  };
}

export type ProfessionalProjectionV1 = ReturnType<typeof toProfessionalProjectionV1>;
