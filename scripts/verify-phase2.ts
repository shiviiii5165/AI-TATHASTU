// Checks that compute_intelligence (Phase 2) produced its outputs for a user:
//
//   npm run verify:phase2 -- <user-id | email>
//
// Uses DATABASE_URL (from the environment, else .env.local): Neon over HTTPS,
// or node-postgres for a localhost URL (the E2E stack). Read-only.
// Exit code 0 when every check passes, 1 when any fails, 2 on usage errors.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import { assertTestIsolation } from "./lib/db-target.mjs";

type Query = (text: string, params: unknown[]) => Promise<Record<string, unknown>[]>;

const MIN_WIDGETS = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function connect(url: string): Promise<{ query: Query; close: () => Promise<void> }> {
  if (/^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    return { query: async (text, params) => (await pool.query(text, params)).rows, close: () => pool.end() };
  }
  const sql = neon(url);
  return { query: (text, params) => sql.query(text, params), close: async () => {} };
}

async function main() {
  const who = process.argv[2];
  if (!who) {
    console.error("usage: npm run verify:phase2 -- <user-id | email>");
    return 2;
  }
  if (!process.env.DATABASE_URL) config({ path: ".env.local", quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set (environment or .env.local).");
    return 2;
  }

  const { query, close } = await connect(assertTestIsolation(url));
  try {
    const [user] = await query(
      UUID.test(who) ? "SELECT id FROM users WHERE id = $1" : "SELECT id FROM users WHERE lower(email) = lower($1)",
      [who],
    );
    if (!user) {
      console.error(`No user ${who}.`);
      return 1;
    }
    const userId = String(user.id);

    const [view] = await query("SELECT view, updated_at FROM profile_views WHERE user_id = $1", [userId]);
    const widgets = (view?.view as { widgets?: { id: string }[] } | undefined)?.widgets;
    // `skills` is the shared catalogue; a user's skills are the ones with evidence rows for them.
    const [skills] = await query(
      "SELECT count(DISTINCT s.id)::int AS n FROM skill_evidence e JOIN skills s ON s.id = e.skill_id WHERE e.user_id = $1",
      [userId],
    );
    const eris = await query("SELECT role, score FROM eris_scores WHERE user_id = $1 ORDER BY score DESC", [userId]);

    const checks = [
      { name: "profile_views row exists", ok: Boolean(view), detail: view ? `updated ${String(view.updated_at)}` : "missing" },
      {
        name: `view has at least ${MIN_WIDGETS} widgets`,
        ok: Array.isArray(widgets) && widgets.length >= MIN_WIDGETS,
        detail: Array.isArray(widgets) ? `${widgets.length}: ${widgets.map((w) => w.id).join(", ")}` : "no widgets array",
      },
      { name: "skills linked to user", ok: Number(skills?.n) > 0, detail: `${skills?.n ?? 0} skills via skill_evidence` },
      {
        name: "eris_scores rows exist",
        ok: eris.length > 0,
        detail: eris.length ? eris.map((r) => `${r.role}=${Math.round(Number(r.score) * 100)}`).join(", ") : "none",
      },
    ];

    console.log(`Phase 2 verification for ${userId}`);
    for (const c of checks) console.log(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name.padEnd(30)} ${c.detail}`);
    const failed = checks.filter((c) => !c.ok).length;
    console.log(failed ? `${failed} of ${checks.length} checks failed.` : "PASS: all checks passed.");
    return failed ? 1 : 0;
  } finally {
    await close();
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
