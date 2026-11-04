// Test-side helpers: direct access to the E2E database, a signed-in session
// without OAuth, and a stand-in for the Python worker.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import pg from "pg";

import { E2E_ENV } from "./env";

// Shared by every spec in the worker process; idle clients let the process exit.
export const sql = new pg.Pool({ connectionString: E2E_ENV.DATABASE_URL, max: 2, allowExitOnIdle: true });

const one = async <T>(text: string, params: unknown[] = []) => (await sql.query(text, params)).rows[0] as T | undefined;

// ─── Users and sessions ─────────────────────────────────────────────────────

export type TestUser = { id: string; email: string; name: string };

/** What Auth.js's adapter + createUser event write on a first sign-in. */
export async function createUser(name = "Asha Rao", step = "career_direction", email?: string): Promise<TestUser> {
  const user = { id: randomUUID(), email: email ?? `e2e-${randomUUID().slice(0, 8)}@example.com`, name };
  await sql.query("INSERT INTO users (id, email, name, email_verified) VALUES ($1, $2, $3, now())", [
    user.id, user.email, step === "career_direction" ? null : name,
  ]);
  await sql.query("INSERT INTO onboarding_state (user_id, current_step) VALUES ($1, $2)", [user.id, step]);
  return user;
}

/**
 * Signs the browser in by setting the same encrypted JWT cookie Auth.js
 * issues after OAuth (salt = cookie name, secret = AUTH_SECRET). The app's
 * own jwt/session callbacks then run on it unchanged.
 */
export async function signIn(context: BrowserContext, user: TestUser, { onboarded = false } = {}) {
  const name = "authjs.session-token"; // http://localhost, so no __Secure- prefix
  const value = await encode({
    token: { sub: user.id, email: user.email, onboarded, authTime: Math.floor(Date.now() / 1000) },
    secret: E2E_ENV.AUTH_SECRET,
    salt: name,
    maxAge: 60 * 60,
  });
  await context.addCookies([{ name, value, url: E2E_ENV.AUTH_URL, httpOnly: true, sameSite: "Lax" }]);
}

export const onboarding = (userId: string) =>
  one<{ current_step: string; career_role: string | null; priorities: string[] }>(
    "SELECT current_step, career_role, priorities FROM onboarding_state WHERE user_id = $1",
    [userId],
  );

export const countRows = async (text: string, params: unknown[]) =>
  Number((await one<{ n: string }>(text, params))?.n ?? 0);

// ─── Mock resume ────────────────────────────────────────────────────────────

/** A minimal one-page, text-based PDF. Built at runtime: *.pdf is gitignored. */
export function mockResumePdf(lines: string[]): Buffer {
  const text = lines.map((l, i) => `BT /F1 12 Tf 72 ${720 - i * 18} Td (${l.replace(/[()\\]/g, "\\$&")}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = objects.map((obj, i) => {
    const at = Buffer.byteLength(out);
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    return at;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out);
}

// ─── Fake worker ────────────────────────────────────────────────────────────

async function waitForJob(userId: string, type: string, timeoutMs = 30_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const job = await one<{ id: string; payload: Record<string, unknown> }>(
      "SELECT id, payload FROM jobs WHERE user_id = $1 AND type = $2 AND status = 'queued' ORDER BY created_at DESC LIMIT 1",
      [userId, type],
    );
    if (job) return job;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`no queued ${type} job for ${userId} after ${timeoutMs}ms`);
}

const finishJob = (id: string) =>
  sql.query("UPDATE jobs SET status = 'done', attempts = 1, finished_at = now(), locked_by = NULL WHERE id = $1", [id]);

/**
 * Does what worker/connectors does for a connector_sync job: marks the
 * connection synced and the job done. A LinkedIn sync without
 * linkedin_scrape consent parks, as the real worker does.
 */
export async function completeConnectorSync(userId: string, sourceId: string) {
  const job = await waitForJob(userId, "connector_sync");
  if (job.payload.source_id !== sourceId) throw new Error(`expected a ${sourceId} sync, got ${String(job.payload.source_id)}`);
  if (sourceId === "linkedin") {
    const consent = await one<{ granted: boolean }>(
      "SELECT granted FROM consents WHERE user_id = $1 AND purpose = 'linkedin_scrape' ORDER BY created_at DESC LIMIT 1",
      [userId],
    );
    if (!consent?.granted) {
      await sql.query(
        "UPDATE jobs SET status = 'needs_review', last_error = 'waiting for linkedin_scrape consent', finished_at = now() WHERE id = $1",
        [job.id],
      );
      return job;
    }
  }
  await sql.query("UPDATE connections SET status = 'connected', last_sync_at = now() WHERE id = $1", [job.payload.connection_id]);
  await finishJob(job.id);
  return job;
}

/** Plays compute_intelligence with a given view document (persona dashboards). */
export async function completeIntelligenceWithView(userId: string, view: Record<string, unknown>) {
  const job = await waitForJob(userId, "compute_intelligence");
  await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [userId, JSON.stringify(view)]);
  await finishJob(job.id);
}

/** A finished user's computed profile (profile_views + unified projects), as compute_intelligence leaves it. */
export async function seedComputedProfile(userId: string) {
  const view = JSON.parse(
    readFileSync(path.join(__dirname, "../fixtures/profile-view.json"), "utf8").replaceAll("__NOW__", new Date().toISOString()),
  );
  await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [userId, JSON.stringify(view)]);
  for (const p of view.projects as { canonicalTitle: string; technologies: string[] }[]) {
    await sql.query("INSERT INTO unified_projects (user_id, canonical_title, technologies) VALUES ($1, $2, $3)", [
      userId, p.canonicalTitle, p.technologies,
    ]);
  }
}

type MockFact = { group: string; field: string; value: string; confidence: number; record?: string; evidence?: string };

/**
 * Does what worker/resume does for a resume_extract job: writes unconfirmed
 * `resume` facts for the user to review, then marks the job done.
 */
export async function completeResumeExtraction(userId: string, facts: MockFact[]) {
  const job = await waitForJob(userId, "resume_extract");
  for (const f of facts) {
    await sql.query(
      `INSERT INTO profile_facts
         (user_id, field_group, field_name, record_key, extracted_value, normalized_value, source_evidence,
          location, extraction_method, origin, confidence, validation_status, confirmation)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'llm', 'resume', $8, 'validated', 'unconfirmed')`,
      [
        userId, f.group, f.field, f.record ?? null, JSON.stringify(f.value), f.evidence ?? f.value,
        JSON.stringify({ page: 1, bbox: [72, 700, 400, 712] }), f.confidence,
      ],
    );
  }
  await finishJob(job.id);
  return job;
}

/**
 * Does what worker/intelligence does for compute_intelligence: skill graph,
 * ERIS, a synced GitHub connection, and the scored profile_views document
 * (e2e/fixtures/profile-view.json).
 */
export async function completeIntelligence(userId: string) {
  const job = await waitForJob(userId, "compute_intelligence");
  const now = new Date().toISOString();
  const view = JSON.parse(
    readFileSync(path.join(__dirname, "../fixtures/profile-view.json"), "utf8").replaceAll("__NOW__", now),
  );

  for (const s of view.skills as { name: string; category: string; evidenceStrength: number; sources: string[] }[]) {
    const { id } = (await one<{ id: string }>(
      `INSERT INTO skills (canonical_name, category) VALUES ($1, $2)
       ON CONFLICT (canonical_name) DO UPDATE SET category = EXCLUDED.category RETURNING id`,
      [s.name, s.category],
    ))!;
    for (const source of s.sources) {
      await sql.query("INSERT INTO skill_evidence (user_id, skill_id, source, evidence_strength) VALUES ($1, $2, $3, $4)", [
        userId, id, source, s.evidenceStrength,
      ]);
    }
  }

  await sql.query("INSERT INTO eris_scores (user_id, role, score, breakdown_json) VALUES ($1, 'ml_engineer', $2, $3)", [
    userId,
    view.erisScore.overall,
    JSON.stringify({
      components: { technical: 0.72, projects: 0.58, problem_solving: null },
      missing_components: ["problem_solving"],
      skills: [
        { skill: "Kubernetes", readiness: 0.2, weight: 0.8, state: "underdeveloped" },
        { skill: "Docker", readiness: null, weight: 0.7, state: "missing" },
        { skill: "PyTorch", readiness: 0.9, weight: 0.9, state: "met" },
      ],
    }),
  ]);

  await sql.query(
    "INSERT INTO connections (user_id, source_id, access_method, status, last_sync_at) VALUES ($1, 'github', 'oauth', 'connected', now())",
    [userId],
  );
  const repos = [
    { name: "asha/resume-parser", langs: { Python: 52000, Shell: 800 }, stars: 14, days: 2 },
    { name: "asha/mnist-from-scratch", langs: { Python: 9000, "Jupyter Notebook": 30000 }, stars: 3, days: 20 },
  ];
  for (const r of repos) {
    await sql.query(
      `INSERT INTO code_repositories (user_id, source, repo_name, url, languages, stars, last_commit_at)
       VALUES ($1, 'github', $2, $3, $4, $5, now() - ($6 || ' days')::interval)`,
      [userId, r.name, `https://github.com/${r.name}`, JSON.stringify(r.langs), r.stars, r.days],
    );
  }

  await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [userId, JSON.stringify(view)]);
  await finishJob(job.id);
  return view;
}
