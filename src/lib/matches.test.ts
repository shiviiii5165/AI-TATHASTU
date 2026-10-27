import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

const { db } = await import("@/db");
const { consents, matches, users } = await import("@/db/schema");
const { matchesForMentor } = await import("@/lib/matches");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const MENTOR = id(1);
const S = { granted: id(2), denied: id(3), missing: id(4), revoked: id(5), deleted: id(6) };

beforeAll(async () => {
  await db.insert(users).values([
    { id: MENTOR, name: "Prof. Rao", role: "faculty" },
    { id: S.granted, name: "Granted", role: "student" },
    { id: S.denied, name: "Denied", role: "student" },
    { id: S.missing, name: "Missing", role: "student" },
    { id: S.revoked, name: "Revoked", role: "student" },
    { id: S.deleted, name: "Deleted", role: "student", deletedAt: new Date() },
  ]);
  const at = (m: number) => new Date(Date.UTC(2026, 9, 1, 12, m));
  await db.insert(consents).values([
    { userId: S.granted, purpose: "mentor_discovery", granted: true, createdAt: at(0) },
    { userId: S.denied, purpose: "mentor_discovery", granted: false, createdAt: at(0) },
    { userId: S.revoked, purpose: "mentor_discovery", granted: true, createdAt: at(0) },
    { userId: S.revoked, purpose: "mentor_discovery", granted: false, createdAt: at(5) },
    { userId: S.deleted, purpose: "mentor_discovery", granted: true, createdAt: at(0) },
  ]);
  await db.insert(matches).values(
    Object.values(S).map((studentId, i) => ({ studentId, mentorId: MENTOR, kind: "faculty" as const, score: 0.9 - i * 0.1, reasons: ["Python"] })),
  );
});

describe("matchesForMentor", () => {
  it("shows only students whose latest mentor_discovery consent is granted", async () => {
    const { visible } = await matchesForMentor(MENTOR);
    expect(visible.map((v) => v.name)).toEqual(["Granted"]);
  });

  it("counts, but never shows, denied, missing and revoked students; ignores deleted accounts", async () => {
    const { hidden } = await matchesForMentor(MENTOR);
    expect(hidden).toBe(3);
  });
});
