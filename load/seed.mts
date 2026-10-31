// Seeds synthetic, fully onboarded users into a LOCAL database and writes their
// session cookies for k6. Refuses any database that isn't on this machine.
// Run load/pg-setup.mts first. Usage: node load/seed.mts <users> <sessions> <out.json>
//
// Names carry a unique first word and each person's discoverability, so the journeys can
// assert isolation from responses: "U7 Load Mentor", "U2 Load Student Open" (consented), "U3 Load Student Private".
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { encode } from "next-auth/jwt";
import pg from "pg";

import { E2E_ENV } from "../e2e/support/env.ts";

const [users = "20000", sessionCount = "1200", out = "tokens.json"] = process.argv.slice(2);
const total = Number(users);
const url = new URL(E2E_ENV.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`refusing to seed non-local database ${url.hostname}`);

const db = new pg.Client({ connectionString: E2E_ENV.DATABASE_URL });
await db.connect();
const view = readFileSync(path.join(import.meta.dirname, "../e2e/fixtures/profile-view.json"), "utf8").replaceAll("__NOW__", new Date().toISOString());

const step = async (label: string, statement: string, params: unknown[] = []) => {
  const started = Date.now();
  const { rowCount } = await db.query(statement, params);
  console.log(`${label}: ${rowCount ?? 0} rows, ${Date.now() - started} ms`);
};

// i % 10 = 0 faculty, i % 20 = 5 alumni, the rest students (even i consent to discovery).
await step("users", `
  INSERT INTO users (email, name, email_verified, role, university, department)
  SELECT 'load-' || i || '@example.test',
         'U' || i || CASE WHEN i % 10 = 0 OR i % 20 = 5 THEN ' Load Mentor'
              WHEN i % 2 = 0 THEN ' Load Student Open' ELSE ' Load Student Private' END,
         now(),
         (CASE WHEN i % 10 = 0 THEN 'faculty' WHEN i % 20 = 5 THEN 'alumni' ELSE 'student' END)::user_role,
         'Load Test University ' || (i % 200), 'Computer Science'
    FROM generate_series(0, $1::int - 1) i`, [total]);
await db.query("CREATE TEMP TABLE load_u AS SELECT id, split_part(split_part(email, '@', 1), '-', 2)::int AS i, role FROM users WHERE email LIKE 'load-%@example.test'");
await db.query("CREATE INDEX ON load_u (i)");

await step("onboarding", "INSERT INTO onboarding_state (user_id, current_step) SELECT id, 'done' FROM load_u");
await step("consents", "INSERT INTO consents (user_id, purpose, granted) SELECT id, 'mentor_discovery', i % 2 = 0 FROM load_u WHERE role = 'student'");
await step("profile_views", "INSERT INTO profile_views (user_id, view) SELECT id, $1::jsonb FROM load_u", [view]);
await step("facts", `
  INSERT INTO profile_facts (user_id, field_group, field_name, record_key, extracted_value, normalized_value, origin, confidence, validation_status, confirmation, extraction_method)
  SELECT id, 'skills', 'skill', gen_random_uuid()::text, to_jsonb('skill-' || n), to_jsonb('skill-' || n), 'resume', 0.9, 'validated', 'confirmed', 'rules'
    FROM load_u, generate_series(1, 20) n`);
await step("skills", "INSERT INTO skills (canonical_name, category) SELECT 'load-skill-' || n, 'language' FROM generate_series(1, 500) n ON CONFLICT DO NOTHING");
await step("skill_evidence", `
  INSERT INTO skill_evidence (user_id, skill_id, source, evidence_strength)
  SELECT u.id, s.id, 'resume', 0.7 FROM load_u u
    JOIN LATERAL (SELECT id FROM skills WHERE canonical_name LIKE 'load-skill-%' OFFSET (u.i % 480) LIMIT 8) s ON true`);
await step("repos", `
  INSERT INTO code_repositories (user_id, source, repo_name, url, languages, stars, forks, last_commit_at)
  SELECT id, 'github', 'load-repo-' || n, 'https://github.test/load/' || n, '{"Python": 1000}', n, 0, now() - n * interval '9 days'
    FROM load_u, generate_series(1, 6) n`);
await step("projects", `
  INSERT INTO unified_projects (user_id, canonical_title, technologies)
  SELECT id, 'Load Project ' || n, '{Python}' FROM load_u, generate_series(1, 3) n`);
// Job history: what the claim, status and queue-position queries actually have to skip past.
await step("jobs", `
  INSERT INTO jobs (type, user_id, idempotency_key, status, attempts, run_at, created_at, finished_at)
  SELECT (ARRAY['resume_extract','connector_sync','compute_intelligence'])[1 + n % 3], id, 'load:' || id || ':' || n, 'done', 1,
         now() - n * interval '1 day', now() - n * interval '1 day', now() - n * interval '1 day'
    FROM load_u, generate_series(1, 10) n`);
// Bulk-load first, then build the HNSW index (the outer WHERE makes the subquery run per row).
await db.query("DROP INDEX collaboration_embeddings_vector_idx");
await step("embeddings", `
  INSERT INTO collaboration_embeddings (user_id, profile_summary, embedding)
  SELECT id, 'Synthetic profile', (SELECT array_agg(random() - 0.5) FROM generate_series(1, 768) WHERE u.i IS NOT NULL)::vector
    FROM load_u u`);
await step("hnsw", "CREATE INDEX collaboration_embeddings_vector_idx ON collaboration_embeddings USING hnsw (embedding vector_cosine_ops)");
await step("analyze", "ANALYZE");

// First N users get session cookies; each knows another user's job for ownership probes.
const cookie = "authjs.session-token";
const { rows } = await db.query<{ id: string; i: number; role: string; email: string; job: string }>(`
  SELECT u.id, u.i, u.role, 'load-' || u.i || '@example.test' AS email,
         (SELECT j.id FROM jobs j WHERE j.user_id = u.id LIMIT 1) AS job
    FROM load_u u WHERE u.i < $1 ORDER BY u.i`, [Number(sessionCount)]);
const sessions = await Promise.all(
  rows.map(async (r, n) => ({
    id: r.id,
    role: r.role,
    name: `U${r.i} ` + (r.role === "student" ? (r.i % 2 === 0 ? "Load Student Open" : "Load Student Private") : "Load Mentor"),
    otherUsersJob: rows[(n + 1) % rows.length].job,
    cookie: await encode({ token: { sub: r.id, email: r.email, onboarded: true, admin: false }, secret: E2E_ENV.AUTH_SECRET, salt: cookie, maxAge: 12 * 60 * 60 }),
  })),
);
writeFileSync(out, JSON.stringify(sessions));
await db.end();
console.log(`seeded ${total} users; ${sessions.length} sessions -> ${out} (run ${randomUUID().slice(0, 8)})`);
