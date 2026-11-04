// The backfill once wrote invented roadmaps and default skill graphs for real users.
// These tests hold the line: scripts only queue jobs, and only against an allowed database.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { createTestDb } from "@/test/db";

import { assertTestIsolation, assertWriteAllowed } from "../../scripts/lib/db-target.mjs";
import { enqueueIntelligence } from "../../scripts/lib/enqueue-intelligence.mjs";

const SCRIPTS = path.resolve(__dirname, "../../scripts");
const REMOTE = "postgres://u:secret-password@ep-example.us-east-2.aws.neon.tech/db";
const LOCAL = "postgres://postgres:postgres@127.0.0.1:55432/ait_test";
const WORKER_ONLY_TABLES = "roadmaps|profile_views|eris_scores|github_scores|collaboration_embeddings|skill_evidence|unified_projects";

function scriptFiles(dir = SCRIPTS): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return scriptFiles(full);
    return /\.(ts|mts|mjs|js|cjs|py)$/.test(name) ? [full] : [];
  });
}

describe("no script writes intelligence itself", () => {
  it.each(scriptFiles().map((f) => [path.relative(SCRIPTS, f), f]))("%s", (_name, file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(new RegExp(`(INSERT\\s+INTO|UPDATE|DELETE\\s+FROM)\\s+"?(${WORKER_ONLY_TABLES})\\b`, "i"));
  });

  it("the backfill has no generators, and reads no .env file", () => {
    const source = readFileSync(path.join(SCRIPTS, "backfill-independent-intelligence.ts"), "utf8");
    expect(source).not.toMatch(/generateRoadmap|DEFAULT_SKILL_GRAPH|computeProfileVector|Publish 2 papers|dotenv|loadEnvConfig/);
  });
});

describe("every write script checks its target", () => {
  it.each(["migrate-http.mjs", "flags.mjs", "embed-learning-resources-http.mjs", "seed-academic.ts", "migrate-academic.ts", "backfill-matches.ts", "backfill-independent-intelligence.ts"])("%s", (name) => {
    expect(readFileSync(path.join(SCRIPTS, name), "utf8")).toContain("assertWriteAllowed");
  });
});

describe("database target rules", () => {
  it("writes to this machine go through", () => {
    expect(assertWriteAllowed(LOCAL, {})).toBe(LOCAL);
    expect(assertWriteAllowed("postgres://u:p@localhost/db", {})).toContain("localhost");
  });

  it("refuses a remote write by default, naming the host and not the password", () => {
    expect(() => assertWriteAllowed(REMOTE, {})).toThrow(/ep-example/);
    expect(() => assertWriteAllowed(REMOTE, {})).not.toThrow(/secret-password/);
  });

  it("isn't fooled by an approval for another host, or by a local-looking name", () => {
    expect(() => assertWriteAllowed(REMOTE, { AIT_APPROVED_WRITE_HOST: "other.neon.tech" })).toThrow(/Refusing/);
    expect(() => assertWriteAllowed("postgres://u:p@127.0.0.1.evil.example/db", {})).toThrow(/Refusing/);
    expect(() => assertWriteAllowed("postgres://127.0.0.1:p@ep-example.neon.tech/db", {})).toThrow(/Refusing/);
  });

  it("allows a remote write only with that exact host named", () => {
    const host = "ep-example.us-east-2.aws.neon.tech";
    expect(assertWriteAllowed(REMOTE, { AIT_APPROVED_WRITE_HOST: host })).toBe(REMOTE);
  });

  it("a test or CI run can't reach a remote database, even approved", () => {
    const host = "ep-example.us-east-2.aws.neon.tech";
    for (const env of [{ CI: "true" }, { NODE_ENV: "test" }, { VITEST: "true" }]) {
      expect(() => assertWriteAllowed(REMOTE, { ...env, AIT_APPROVED_WRITE_HOST: host })).toThrow(/test or CI/);
      expect(() => assertTestIsolation(REMOTE, env)).toThrow(/test or CI/);
    }
  });

  it("refuses when no target is set", () => {
    expect(() => assertWriteAllowed(undefined, {})).toThrow(/No database URL/);
  });
});

describe("enqueueIntelligence", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let query: (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

  const count = async (table: string) => Number(((await query(`SELECT count(*) AS n FROM ${table}`, []))[0] as { n: string }).n);

  beforeAll(async () => {
    db = await createTestDb();
    query = async (text, params) => (await db.$client.query(text, params)).rows as Record<string, unknown>[];
    await db.execute(sql`
      INSERT INTO users (id, email, deleted_at) VALUES
        ('00000000-0000-4000-8000-000000000001', 'done@example.com', NULL),
        ('00000000-0000-4000-8000-000000000002', 'midway@example.com', NULL),
        ('00000000-0000-4000-8000-000000000003', 'deleted@example.com', now()),
        ('00000000-0000-4000-8000-000000000004', 'running@example.com', NULL)`);
    await db.execute(sql`
      INSERT INTO onboarding_state (user_id, current_step) VALUES
        ('00000000-0000-4000-8000-000000000001', 'done'),
        ('00000000-0000-4000-8000-000000000002', 'resume'),
        ('00000000-0000-4000-8000-000000000003', 'done'),
        ('00000000-0000-4000-8000-000000000004', 'done')`);
    await db.execute(sql`
      INSERT INTO jobs (type, user_id, idempotency_key, status) VALUES
        ('compute_intelligence', '00000000-0000-4000-8000-000000000004', 'existing', 'running')`);
  }, 60_000);

  it("a dry run writes nothing", async () => {
    const before = await count("jobs");
    expect(await enqueueIntelligence(query)).toEqual({ pending: 1, queued: 0 });
    expect(await count("jobs")).toBe(before);
  });

  it("queues only finished, live users without a job, and touches no other table", async () => {
    expect(await enqueueIntelligence(query, { apply: true })).toEqual({ pending: 1, queued: 1 });
    const [job] = await query("SELECT user_id, type, status FROM jobs WHERE idempotency_key <> 'existing'", []);
    expect(job).toEqual({ user_id: "00000000-0000-4000-8000-000000000001", type: "compute_intelligence", status: "queued" });
    for (const table of WORKER_ONLY_TABLES.split("|")) expect(await count(table), table).toBe(0);
  });

  it("re-running queues nothing new, even after the job finished", async () => {
    expect(await enqueueIntelligence(query, { apply: true })).toEqual({ pending: 0, queued: 0 });
    await query("UPDATE jobs SET status = 'done' WHERE idempotency_key <> 'existing'", []);
    expect((await enqueueIntelligence(query, { apply: true })).queued).toBe(0);
  });
});
