/**
 * "People you may know" on real Postgres with pgvector (PGlite has no vector type): opted-in peers appear, people
 * without an embedding are still listed after ranked ones, nobody appears twice, the viewer never appears, and the
 * default (search, Yora, the People page) is unchanged. Needs TEST_POSTGRES_URL (npm run test:pg).
 */
import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createPoolDb } = await import("@/test/real-postgres");
  return { db: createPoolDb() };
});

const { resetAndMigrate } = await import("@/test/real-postgres");
const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { similarPeople } = await import("@/lib/people");

const vec = (x: number) => Array.from({ length: 768 }, (_, i) => (i === 0 ? x : i === 1 ? 1 - x : 0));
const ids: Record<string, string> = {};

beforeAll(async () => {
  await resetAndMigrate();
  const mk = async (key: string, role: "student" | "faculty", opts: { emb?: number; discovery?: boolean; uni?: string; deleted?: boolean } = {}) => {
    const id = randomUUID();
    ids[key] = id;
    await db.insert(schema.users).values({ id, role, name: key, email: `${key}-${id.slice(0, 6)}@example.com`, university: opts.uni ?? null, deletedAt: opts.deleted ? new Date() : null });
    if (opts.emb !== undefined) await db.insert(schema.collaborationEmbeddings).values({ userId: id, profileSummary: `${role}. Skills: Python.`, embedding: vec(opts.emb) });
    if (opts.discovery !== undefined) await db.insert(schema.integrationConsents).values({ userId: id, clientId: "collaborate", scopes: { discovery: opts.discovery }, linkedAt: new Date() });
  };
  await mk("viewer", "student", { emb: 0.9, discovery: true, uni: "LPU" });
  await mk("viewerNoEmb", "student", { uni: "LPU" });
  await mk("mentor", "faculty", { emb: 0.5, uni: "LPU" });
  await mk("peerClose", "student", { emb: 0.88, discovery: true });
  await mk("peerNoEmb", "student", { discovery: true, uni: "LPU" });
  await mk("peerPrivate", "student", { emb: 0.89, discovery: false });
  await mk("peerDeleted", "student", { emb: 0.9, discovery: true, deleted: true });
});

describe("similarPeople on real Postgres", () => {
  it("peers + includeUnmatched (open profiles): every active member, ranked first, then people without an embedding; no deleted, self or duplicates", async () => {
    const got = await similarPeople({ id: ids.viewer, role: "student" }, 10, { peers: true, includeUnmatched: true });
    const names = got.map((p) => p.name);
    expect(names.slice(0, 3)).toEqual(["peerPrivate", "peerClose", "mentor"]); // ranked by similarity
    expect(new Set(names.slice(3))).toEqual(new Set(["peerNoEmb", "viewerNoEmb"])); // no embedding yet: after
    expect(got.find((p) => p.name === "peerNoEmb")!.similarity).toBeNull();
    expect(new Set(names).size).toBe(names.length);
  });

  it("a viewer without an embedding still gets suggestions (same university first)", async () => {
    const got = await similarPeople({ id: ids.viewerNoEmb, role: "student" }, 10, { peers: true, includeUnmatched: true });
    expect(got.length).toBeGreaterThanOrEqual(3);
    expect(got.every((p) => p.similarity === null)).toBe(true);
    expect(["viewer", "mentor", "peerNoEmb"]).toContain(got[0].name); // all at LPU, ranked before peerClose
    expect(new Set(got.slice(-2).map((p) => p.name))).toEqual(new Set(["peerClose", "peerPrivate"])); // not at LPU: last
    expect(got.map((p) => p.name)).not.toContain("viewerNoEmb");
  });

  it("default behaviour is unchanged: mentors only, ranked only", async () => {
    const got = await similarPeople({ id: ids.viewer, role: "student" }, 10);
    expect(got.map((p) => p.name)).toEqual(["mentor"]);
  });
});
