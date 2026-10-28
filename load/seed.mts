// Seeds synthetic, fully onboarded users into the throwaway e2e stack and
// writes their session cookies for k6. Refuses any database that isn't the
// local stack. Usage: node load/seed.mts <users> <out.json>
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { encode } from "next-auth/jwt";
import pg from "pg";

import { E2E_ENV } from "../e2e/support/env.ts";

const [count = "1200", out = "tokens.json"] = process.argv.slice(2);
const url = new URL(E2E_ENV.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`refusing to seed non-local database ${url.hostname}`);

const sql = new pg.Pool({ connectionString: E2E_ENV.DATABASE_URL, max: 4 });
const view = readFileSync(path.join(import.meta.dirname, "../e2e/fixtures/profile-view.json"), "utf8").replaceAll(
  "__NOW__",
  new Date().toISOString(),
);
const cookie = "authjs.session-token";
const sessions: { id: string; cookie: string }[] = [];

for (let i = 0; i < Number(count); i++) {
  const id = randomUUID();
  const role = i % 10 === 0 ? "faculty" : "student"; // ~10% mentors
  await sql.query(
    "INSERT INTO users (id, email, name, email_verified, role, university, department) VALUES ($1, $2, $3, now(), $4, 'Load Test University', 'Computer Science')",
    [id, `load-${i}@example.test`, `Load User ${i}`, role],
  );
  await sql.query("INSERT INTO onboarding_state (user_id, current_step) VALUES ($1, 'done')", [id]);
  // Half the users opt in to discovery, so People results are consent-filtered for real.
  await sql.query("INSERT INTO consents (user_id, purpose, granted) VALUES ($1, 'mentor_discovery', $2)", [id, i % 2 === 0]);
  await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [id, view]);
  const value = await encode({ token: { sub: id, email: `load-${i}@example.test`, onboarded: true }, secret: E2E_ENV.AUTH_SECRET, salt: cookie, maxAge: 6 * 60 * 60 });
  sessions.push({ id, cookie: value });
}
writeFileSync(out, JSON.stringify(sessions));
await sql.end();
console.log(`seeded ${sessions.length} users -> ${out}`);
