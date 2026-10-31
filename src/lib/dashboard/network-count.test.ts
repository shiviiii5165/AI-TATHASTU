import { randomUUID } from "node:crypto";

import { count, eq } from "drizzle-orm";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: null as never, selects: 0, fail: false }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  state.db = (await createTestDb()) as never;
  const db = new Proxy(state.db as object, {
    get(target, prop, receiver) {
      if (prop === "select") {
        state.selects++;
        if (state.fail) throw new Error("db down");
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return { db };
});

import { collaborationEmbeddings, consents, users } from "@/db/schema";
import { discoverableBy } from "@/lib/discovery";

import { discoverableCount, resetDiscoverableCount } from "./network-count";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const raw = () => state.db as any;

async function person(role: "student" | "faculty" | "alumni", opts: { consent?: boolean; embedded?: boolean; deleted?: boolean } = {}) {
  const id = randomUUID();
  await raw().insert(users).values({ id, email: `${id}@x.test`, role, deletedAt: opts.deleted ? new Date() : null });
  if (opts.consent !== undefined) await raw().insert(consents).values({ userId: id, purpose: "mentor_discovery", granted: opts.consent });
  if (opts.embedded !== false) await raw().insert(collaborationEmbeddings).values({ userId: id });
  return { id, role };
}

// The per-request query this cache replaced: the truth to compare with.
async function exact(viewer: { id: string; role: "student" | "faculty" | "alumni" }) {
  const [row] = await raw()
    .select({ n: count() })
    .from(collaborationEmbeddings)
    .innerJoin(users, eq(users.id, collaborationEmbeddings.userId))
    .where(discoverableBy(viewer));
  return row.n as number;
}

let student: Awaited<ReturnType<typeof person>>;
let mentor: Awaited<ReturnType<typeof person>>;
let mentorNoEmbedding: Awaited<ReturnType<typeof person>>;

beforeAll(async () => {
  await import("@/db");
  student = await person("student", { consent: true });
  mentor = await person("faculty");
  mentorNoEmbedding = await person("alumni", { embedded: false });
  await person("alumni");
  await person("faculty", { deleted: true });
  await person("student", { consent: true });
  await person("student", { consent: false });
  await person("student");
});
beforeEach(() => {
  resetDiscoverableCount();
  state.selects = 0;
  state.fail = false;
});
afterEach(() => vi.useRealTimers());

describe("discoverableCount", () => {
  it("equals the per-viewer query for every kind of viewer", async () => {
    for (const viewer of [student, mentor, mentorNoEmbedding]) {
      resetDiscoverableCount();
      expect(await discoverableCount(viewer)).toBe(await exact(viewer));
    }
  });

  it("gives different audiences different numbers: a student's count never includes students", async () => {
    expect(await discoverableCount(student)).toBeLessThan(await discoverableCount(mentorNoEmbedding));
  });

  it("many concurrent dashboards run one count query, and later ones run none", async () => {
    await Promise.all(Array.from({ length: 50 }, () => discoverableCount(student)));
    expect(state.selects).toBe(1);
    await discoverableCount(student);
    expect(state.selects).toBe(1);
  });

  it("reflects a change once the window has passed, and not before", async () => {
    const before = await discoverableCount(student);
    const added = await person("faculty");
    expect(await discoverableCount(student)).toBe(before);
    vi.useFakeTimers({ now: Date.now() + 5 * 60_000 + 1 });
    expect(await discoverableCount(student)).toBe(before + 1);
    vi.useRealTimers();
    await raw().delete(users).where(eq(users.id, added.id));
  });

  it("keeps the last known count through an outage, and fails honestly without one", async () => {
    const known = await discoverableCount(student);
    vi.useFakeTimers({ now: Date.now() + 6 * 60_000 });
    state.fail = true;
    expect(await discoverableCount(student)).toBe(known);
    vi.useRealTimers();
    resetDiscoverableCount();
    await expect(discoverableCount(student)).rejects.toThrow();
  });
});
