// Re-issues session cookies for already-seeded users (they expire after 12 hours).
// LOCAL database only. Usage: node load/mint-tokens.mts <sessions> <out.json>
import { writeFileSync } from "node:fs";

import { encode } from "next-auth/jwt";
import pg from "pg";

import { E2E_ENV } from "../e2e/support/env.ts";

const [sessionCount = "1200", out = "tokens.json"] = process.argv.slice(2);
if (!["127.0.0.1", "localhost"].includes(new URL(E2E_ENV.DATABASE_URL).hostname)) throw new Error("refusing non-local database");
const db = new pg.Client({ connectionString: E2E_ENV.DATABASE_URL });
await db.connect();
const { rows } = await db.query<{ id: string; email: string; name: string; role: string; job: string }>(`
  SELECT u.id, u.email, u.name, u.role,
         (SELECT j.id FROM jobs j WHERE j.user_id = u.id LIMIT 1) AS job
    FROM users u WHERE u.email LIKE 'load-%@example.test'
   ORDER BY split_part(split_part(u.email, '@', 1), '-', 2)::int LIMIT $1`, [Number(sessionCount)]);
const salt = "authjs.session-token";
const sessions = await Promise.all(rows.map(async (r, n) => ({
  id: r.id, role: r.role, name: r.name, otherUsersJob: rows[(n + 1) % rows.length].job,
  cookie: await encode({ token: { sub: r.id, email: r.email, onboarded: true, admin: false }, secret: E2E_ENV.AUTH_SECRET, salt, maxAge: 12 * 60 * 60 }),
})));
writeFileSync(out, JSON.stringify(sessions));
await db.end();
console.log(`${sessions.length} sessions -> ${out}`);
