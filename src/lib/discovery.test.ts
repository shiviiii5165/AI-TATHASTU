import { beforeAll, describe, expect, it } from "vitest";

import { consents, users, type Persona } from "@/db/schema";
import { discoverableBy } from "@/lib/discovery";
import { createTestDb } from "@/test/db";

type Db = Awaited<ReturnType<typeof createTestDb>>;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const P = {
  viewerStudent: id(1),
  viewerFaculty: id(2),
  faculty: id(3),
  alumni: id(4),
  granted: id(5), // student, mentor_discovery granted
  denied: id(6), // student, explicitly denied
  missing: id(7), // student, never answered
  revoked: id(8), // student, granted then revoked
  regranted: id(9), // student, revoked then granted again
  deletedFaculty: id(10),
};

let db: Db;

async function visibleTo(viewer: { id: string; role: Persona }) {
  const rows = await db.select({ id: users.id }).from(users).where(discoverableBy(viewer));
  return new Set(rows.map((r) => r.id));
}

beforeAll(async () => {
  db = await createTestDb();
  const u = (uid: string, role: Persona, extra: Partial<typeof users.$inferInsert> = {}) => ({ id: uid, role, name: uid, ...extra });
  await db.insert(users).values([
    u(P.viewerStudent, "student"),
    u(P.viewerFaculty, "faculty"),
    u(P.faculty, "faculty"),
    u(P.alumni, "alumni"),
    u(P.granted, "student"),
    u(P.denied, "student"),
    u(P.missing, "student"),
    u(P.revoked, "student"),
    u(P.regranted, "student"),
    u(P.deletedFaculty, "faculty", { deletedAt: new Date() }),
  ]);
  const at = (minutes: number) => new Date(Date.UTC(2026, 9, 1, 12, minutes));
  const c = (userId: string, granted: boolean, minutes: number) => ({
    userId,
    purpose: "mentor_discovery" as const,
    granted,
    createdAt: at(minutes),
  });
  await db.insert(consents).values([
    c(P.granted, true, 0),
    c(P.denied, false, 0),
    c(P.revoked, true, 0),
    c(P.revoked, false, 5),
    c(P.regranted, false, 0),
    c(P.regranted, true, 5),
    // A different purpose must not count as mentor_discovery.
    { userId: P.missing, purpose: "external_ai" as const, granted: true, createdAt: at(0) },
  ]);
});

describe("discoverableBy", () => {
  it("lets students see faculty and alumni only, never other students", async () => {
    const seen = await visibleTo({ id: P.viewerStudent, role: "student" });
    expect(seen).toEqual(new Set([P.viewerFaculty, P.faculty, P.alumni]));
  });

  it("lets faculty see mentors plus students whose latest mentor_discovery consent is granted", async () => {
    const seen = await visibleTo({ id: P.viewerFaculty, role: "faculty" });
    expect(seen.has(P.faculty)).toBe(true);
    expect(seen.has(P.alumni)).toBe(true);
    expect(seen.has(P.granted)).toBe(true);
    expect(seen.has(P.regranted)).toBe(true);
  });

  it("hides students who denied, never answered, or revoked consent", async () => {
    const seen = await visibleTo({ id: P.viewerFaculty, role: "faculty" });
    expect(seen.has(P.denied)).toBe(false);
    expect(seen.has(P.missing)).toBe(false);
    expect(seen.has(P.revoked)).toBe(false);
  });

  it("applies the same student rules to alumni viewers", async () => {
    const seen = await visibleTo({ id: P.alumni, role: "alumni" });
    expect(seen.has(P.granted)).toBe(true);
    expect(seen.has(P.revoked)).toBe(false);
    expect(seen.has(P.alumni)).toBe(false); // never the viewer
  });

  it("never returns deleted accounts or the viewer", async () => {
    for (const viewer of [
      { id: P.viewerStudent, role: "student" as const },
      { id: P.viewerFaculty, role: "faculty" as const },
    ]) {
      const seen = await visibleTo(viewer);
      expect(seen.has(P.deletedFaculty)).toBe(false);
      expect(seen.has(viewer.id)).toBe(false);
    }
  });
});

describe("member discovery opt-in (Show me in Collaborate discovery), peers: true", () => {
  const Q = { optedIn: id(21), optedOff: id(22), optedRevoked: id(23), optedNoLink: id(24), optedDeleted: id(25), viewerOptedIn: id(26) };

  beforeAll(async () => {
    const { integrationConsents } = await import("@/db/schema");
    await db.insert(users).values([
      { id: Q.optedIn, role: "student", name: "in" },
      { id: Q.optedOff, role: "student", name: "off" },
      { id: Q.optedRevoked, role: "student", name: "revoked" },
      { id: Q.optedNoLink, role: "student", name: "nolink" },
      { id: Q.optedDeleted, role: "student", name: "deleted", deletedAt: new Date() },
      { id: Q.viewerOptedIn, role: "student", name: "viewer" },
    ]);
    const now = new Date();
    await db.insert(integrationConsents).values([
      { userId: Q.optedIn, clientId: "collaborate", scopes: { discovery: true }, linkedAt: now },
      { userId: Q.optedOff, clientId: "collaborate", scopes: { discovery: false }, linkedAt: now },
      { userId: Q.optedRevoked, clientId: "collaborate", scopes: { discovery: true }, linkedAt: now, revokedAt: now },
      { userId: Q.optedNoLink, clientId: "collaborate", scopes: { discovery: true } },
      { userId: Q.optedDeleted, clientId: "collaborate", scopes: { discovery: true }, linkedAt: now },
      { userId: Q.viewerOptedIn, clientId: "collaborate", scopes: { discovery: true }, linkedAt: now },
      // The same choice on another app means nothing.
      { userId: P.missing, clientId: "avasar", scopes: { discovery: true }, linkedAt: now },
    ]);
  });

  const visiblePeers = async (viewer: { id: string; role: Persona }) => {
    const rows = await db.select({ id: users.id }).from(users).where(discoverableBy(viewer, { peers: true }));
    return new Set(rows.map((r) => r.id));
  };

  it("open profiles: a student sees every active member, consent choices no longer matter", async () => {
    const seen = await visiblePeers({ id: P.viewerStudent, role: "student" });
    for (const shown of [Q.optedIn, Q.optedOff, Q.optedRevoked, Q.optedNoLink, P.faculty, P.missing, P.denied]) expect(seen.has(shown)).toBe(true);
    expect(seen.has(Q.optedDeleted)).toBe(false);
    expect(seen.has(P.deletedFaculty)).toBe(false);
  });

  it("never the viewer themself", async () => {
    expect((await visiblePeers({ id: Q.viewerOptedIn, role: "student" })).has(Q.viewerOptedIn)).toBe(false);
  });

  it("mentors see every active member too", async () => {
    const seen = await visiblePeers({ id: P.viewerFaculty, role: "faculty" });
    expect(seen.has(Q.optedOff)).toBe(true);
    expect(seen.has(P.denied)).toBe(true);
    expect(seen.has(P.viewerFaculty)).toBe(false);
  });
  it("without peers: true (search, Yora) the mentor_discovery rules still apply", async () => {
    const seen = await visibleTo({ id: P.viewerStudent, role: "student" });
    expect(seen.has(Q.optedIn)).toBe(false);
  });
});
