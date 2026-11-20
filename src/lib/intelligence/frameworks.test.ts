import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

// Framework governance (workstream D) against PGlite with every migration, including 0035's immutable tables.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

const { db } = await import("@/db");
const { users } = await import("@/db/schema");
const fw = await import("./frameworks");

describe("framework registry", () => {
  it("has a usable profile for every current role: several domains, required competencies, sources", () => {
    const roles = fw.roleSummaries();
    expect(roles).toHaveLength(20);
    for (const r of roles) {
      expect(r.domains, r.id).toBeGreaterThanOrEqual(3);
      expect(r.required, r.id).toBeGreaterThan(0);
      expect(r.references, r.id).toBeGreaterThan(0);
      const p = fw.roleProfile(r.id)!;
      expect(p.byDomain.flatMap((d) => d.rows).every((row) => row.careerLevels?.junior === row.expectedLevel), r.id).toBe(true);
    }
  });

  it("refuses unknown or retired roles", () => {
    expect(fw.roleProfile("ai_engineer")).toBeNull();
    expect(fw.roleProfile("nope")).toBeNull();
  });

  it("records every source's link check and the content checks behind new competencies", () => {
    const refs = fw.FRAMEWORK.provenance.references;
    expect(refs.every((r) => r.linkCheck?.at)).toBe(true);
    for (const [name, c] of Object.entries(fw.FRAMEWORK.competencies)) {
      for (const src of (c as { sources?: string[] }).sources ?? []) {
        expect(refs.find((r) => r.id === src)?.contentCheck, `${name} cites ${src}`).toBeTruthy();
      }
    }
  });
});

describe("reviews and history storage", () => {
  it("stores a review and never lets it be edited", async () => {
    const [u] = await db.insert(users).values({ email: "reviewer@example.com" }).returning();
    expect(await fw.recordReview({ version: fw.FRAMEWORK.frameworkVersion, role: "ml_engineer", questionId: null, decision: "approved", note: "Checked against the cited exam guides.", reviewerId: u.id, reviewerEmail: u.email! })).toEqual({ ok: true });
    const rows = await fw.reviewsFor(fw.FRAMEWORK.frameworkVersion);
    expect(rows?.[0]).toMatchObject({ role: "ml_engineer", decision: "approved", reviewerEmail: "reviewer@example.com" });
    const refused = await db.execute(sql`update framework_reviews set note = 'edited'`).then(() => null, (e: Error & { cause?: Error }) => e);
    expect(String(refused?.cause?.message ?? refused?.message)).toMatch(/immutable/);
  });

  it("deleting a reviewer's or student's account still works, and keeps the review record", async () => {
    const [u] = await db.insert(users).values({ email: "leaving-reviewer@example.com" }).returning();
    await fw.recordReview({ version: fw.FRAMEWORK.frameworkVersion, role: null, questionId: null, decision: "changes_requested", note: "Weights need sources.", reviewerId: u.id, reviewerEmail: u.email! });
    await db.execute(sql`insert into intelligence_snapshots (user_id, computed_at, engine_version, fingerprint, summary) values (${u.id}, now(), 5, 'x', '{}'::jsonb)`);
    await db.execute(sql`delete from users where id = ${u.id}`);
    const { rows: kept } = await db.execute(sql`select reviewer_email from framework_reviews where reviewer_email = 'leaving-reviewer@example.com'`);
    expect(kept).toHaveLength(1);
    const { rows: history } = await db.execute(sql`select 1 from intelligence_snapshots where user_id = ${u.id}`);
    expect(history).toHaveLength(0);
  });

  it("reports assessment quality from the snapshot history without naming students", async () => {
    const [u] = await db.insert(users).values({ email: "student@example.com" }).returning();
    await db.execute(sql`insert into intelligence_snapshots (user_id, computed_at, engine_version, framework_version, fingerprint, summary, changes)
      values (${u.id}, now(), 5, '2026.11-draft.4', 'abc', ${JSON.stringify({ roles: [{ role: "ml_engineer", state: "developing" }] })}::jsonb, ${JSON.stringify({ methodologyChanged: true, evidenceChanged: false })}::jsonb)`);
    const q = await fw.assessmentQuality();
    expect(q!.byVersion).toEqual([expect.objectContaining({ engine: 5, framework: "2026.11-draft.4", n: 1, methodologyOnly: 1 })]);
    expect(q!.latestStates).toEqual([{ role: "ml_engineer", state: "developing", n: 1 }]);
    expect(JSON.stringify(q)).not.toContain(u.id);
  });
});
