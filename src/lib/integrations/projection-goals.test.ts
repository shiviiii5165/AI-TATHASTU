import { describe, expect, it } from "vitest";

import { toProfessionalProjectionV1 } from "./projection";

// A minimal ProfileData: only what the projection reads.
const profile = {
  user: { id: "u1", email: "s@x.test", name: "Stu", role: "student", image: null },
  state: { careerRole: "ml_engineer", careerRoleOther: null, priorities: ["collaborate", "people_mentors"] },
  identity: {},
  education: [],
  experience: [],
  projects: [],
  facts: [],
  repos: [],
  skills: [
    { name: "Python", category: "language", evidenceStrength: 0.8, verificationStatus: "verified", sources: ["github"] },
    { name: "Docker", category: "mlops", evidenceStrength: 0.3, verificationStatus: "claimed", sources: ["resume"] },
  ],
  view: {
    computedAt: "2026-11-01T00:00:00Z",
    erisScore: null,
    intelligence: {
      skills: [
        { name: "Python", proficiency: 62.4, level: "Proficient" },
        { name: "Docker", proficiency: null, level: "Not assessed" },
      ],
      roles: [
        {
          role: "ml_engineer",
          assessed: true,
          open: [
            { skill: "PyTorch", priority: "High", state: "missing", expectedLevel: "Working" },
            { skill: "MLflow", priority: "Low", state: "unverified", expectedLevel: "Foundational" },
          ],
        },
      ],
    },
  },
} as unknown as Parameters<typeof toProfessionalProjectionV1>[0];

const consent = (scopes: Record<string, boolean>) => ({ scopes, hiddenProjects: [], updatedAt: new Date("2026-11-01T00:00:00Z") }) as never;

describe("ProfessionalProjectionV1 additive fields", () => {
  it("sends engine proficiency and level only where the engine assessed the skill", () => {
    const p = toProfessionalProjectionV1(profile, "collaborate", consent({ skills: true }));
    expect(p.skills!.items[0]).toMatchObject({ name: "Python", proficiency: 62, level: "Proficient", verificationStatus: "verified" });
    expect(p.skills!.items[1]).toMatchObject({ name: "Docker", proficiency: null, level: null, verified: false });
  });

  it("shares goals (target role, open needs, intents) only under the eris scope", () => {
    const withGoals = toProfessionalProjectionV1(profile, "collaborate", consent({ skills: true, eris: true }));
    expect(withGoals.goals).toEqual({
      targetRole: { id: "ml_engineer", label: "ML Engineer" },
      needs: [
        { skill: "PyTorch", priority: "High", state: "missing", expectedLevel: "Working" },
        { skill: "MLflow", priority: "Low", state: "unverified", expectedLevel: "Foundational" },
      ],
      assessed: true,
      collaborationIntents: ["collaborate", "people_mentors"],
    });
    const without = toProfessionalProjectionV1(profile, "collaborate", consent({ skills: true }));
    expect(without.goals).toBeNull();
    expect(without.privacy.masked).toContain("goals");
  });

  it("never sends needs when the engine couldn't assess the role", () => {
    const sparse = { ...profile, view: { ...profile.view!, intelligence: { skills: [], roles: [{ role: "ml_engineer", assessed: false, open: [] }] } } } as unknown as typeof profile;
    const p = toProfessionalProjectionV1(sparse, "collaborate", consent({ eris: true }));
    expect(p.goals).toMatchObject({ needs: [], assessed: false });
  });
});
