// Re-sends AI Tathastu profiles to Collaborate for linked, onboarded users whose Collaborate copy is
// older than their profile (the worker's profile-updated callback failed silently in production).
//
//   npx tsx scripts/collaborate-sync-reconcile.ts           # dry run: per-user report, no writes
//   npx tsx scripts/collaborate-sync-reconcile.ts --apply   # queues profile.updated (reason "reconcile")
//
// --apply on a remote database also needs AIT_APPROVED_WRITE_HOST=<that exact host> (scripts/lib/db-target.mjs).
// It only inserts webhook_outbox rows. Delivery happens through the app's normal dispatcher, which
// builds each payload at send time with the user's CURRENT consent and sections:
//   the daily cron (03:17 UTC), or POST /api/internal/webhooks/dispatch with Bearer INTERNAL_API_SECRET.
// Safe to re-run: users with a pending row are skipped, and the outbox allows one pending row per user.
//
// Selection mirrors findStaleProfileSyncs() in src/lib/integrations/reconcile.ts (kept in step by its tests).
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import { assertTestIsolation, assertWriteAllowed } from "./lib/db-target.mjs";

type Row = Record<string, unknown>;

async function connect(url: string) {
  const host = new URL(url).hostname;
  if (/\.neon\.tech$/i.test(host)) {
    const sql = neon(url);
    return { query: (t: string, p: unknown[] = []) => sql.query(t, p) as Promise<Row[]>, close: async () => {} };
  }
  // Local Postgres or Supabase (verified against Supabase's root CA; never unverified TLS).
  const { default: pg } = await import("pg");
  const { SUPABASE_ROOT_CA } = await import("../src/db/supabase-ca");
  const local = /^(localhost|127\.0\.0\.1)$/.test(host);
  const u = new URL(url);
  u.searchParams.delete("sslmode");
  const pool = new pg.Pool({
    connectionString: u.toString(),
    max: 1,
    ssl: local ? false : { rejectUnauthorized: true, servername: host, ...(/\.supabase\.(com|co)$/i.test(host) ? { ca: SUPABASE_ROOT_CA } : {}) },
  });
  return { query: async (t: string, p: unknown[] = []) => (await pool.query(t, p)).rows as Row[], close: () => pool.end() };
}

const REPORT = `
  SELECT u.id, u.role, o.current_step, o.completed_at,
         ic.client_id IS NOT NULL AS has_consent,
         (ic.linked_at IS NOT NULL AND ic.revoked_at IS NULL) AS linked,
         ic.revoked_at IS NOT NULL AS revoked,
         (SELECT max(j.finished_at) FROM jobs j WHERE j.user_id = u.id AND j.type = 'compute_intelligence' AND j.status = 'done') AS last_computed_at,
         (SELECT max(w.created_at) FROM webhook_outbox w WHERE w.user_id = u.id AND w.client_id = 'collaborate'
             AND w.event = 'profile.updated' AND w.status = 'delivered') AS last_delivered_queued_at,
         (SELECT max(f.created_at) FROM webhook_outbox f WHERE f.user_id = u.id AND f.client_id = 'collaborate'
             AND f.event = 'profile.updated' AND f.status = 'failed') AS last_failed_at,
         EXISTS (SELECT 1 FROM webhook_outbox p WHERE p.user_id = u.id AND p.client_id = 'collaborate'
             AND p.event = 'profile.updated' AND p.status IN ('pending', 'sending')) AS in_flight,
         (SELECT count(*) FROM webhook_outbox f WHERE f.user_id = u.id AND f.client_id = 'collaborate' AND f.status = 'failed')::int AS failed
    FROM users u
    LEFT JOIN onboarding_state o ON o.user_id = u.id
    LEFT JOIN integration_consents ic ON ic.user_id = u.id AND ic.client_id = 'collaborate'
   WHERE u.deleted_at IS NULL
   ORDER BY u.created_at`;

const t = (v: unknown) => (v == null ? null : new Date(String(v)));

function classify(r: Row): { action: "queue" | "in_flight" | "up_to_date" | "excluded"; why: string } {
  if (!r.has_consent) return { action: "excluded", why: "no Collaborate consent row" };
  if (r.revoked) return { action: "excluded", why: "user disconnected Collaborate" };
  if (!r.linked) return { action: "excluded", why: "Collaborate not linked" };
  if (r.current_step !== "done") return { action: "excluded", why: `onboarding incomplete (${r.current_step ?? "not started"})` };
  if (r.in_flight) return { action: "in_flight", why: "profile.updated already pending" };
  // "sent" is when the last delivered row was QUEUED: its payload was built after that, never before.
  const computed = t(r.last_computed_at), sent = t(r.last_delivered_queued_at), onboarded = t(r.completed_at), failed = t(r.last_failed_at);
  if (!sent) return { action: "queue", why: "never delivered" };
  if (computed && computed > sent) return { action: "queue", why: "recomputed since last delivery" };
  if (onboarded && onboarded > sent) return { action: "queue", why: "onboarded since last delivery" };
  if (failed && failed > sent) return { action: "queue", why: "failed since last delivery" };
  return { action: "up_to_date", why: "Collaborate copy is current" };
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) config({ path: ".env.local", quiet: true });
  const url = (apply ? assertWriteAllowed : assertTestIsolation)(process.env.DATABASE_URL);
  const { query, close } = await connect(url);
  try {
    const rows = await query(REPORT);
    const report = rows.map((r) => ({ user: String(r.id).slice(0, 8), role: r.role, step: r.current_step, failed: r.failed, ...classify(r) }));
    console.table(report);
    const count = (a: string) => report.filter((r) => r.action === a).length;
    console.log({
      users: rows.length,
      onboarded: rows.filter((r) => r.current_step === "done").length,
      linked: rows.filter((r) => r.linked).length,
      toQueue: count("queue"),
      alreadyInFlight: count("in_flight"),
      upToDate: count("up_to_date"),
      excluded: count("excluded"),
    });
    if (!apply) return console.log("Dry run: nothing written. Re-run with --apply (and AIT_APPROVED_WRITE_HOST) to queue.");

    const ids = rows.filter((r) => classify(r).action === "queue").map((r) => String(r.id));
    let queued = 0;
    for (const id of ids) {
      const res = await query(
        `INSERT INTO webhook_outbox (client_id, user_id, event, reason)
         SELECT 'collaborate', $1::uuid, 'profile.updated', 'reconcile'
          WHERE EXISTS (SELECT 1 FROM integration_consents ic WHERE ic.user_id = $1::uuid AND ic.client_id = 'collaborate'
                          AND ic.linked_at IS NOT NULL AND ic.revoked_at IS NULL)
         ON CONFLICT DO NOTHING RETURNING id`,
        [id],
      );
      queued += res.length;
    }
    console.log(`Queued ${queued} of ${ids.length}. They go out on the next dispatch (daily cron, or POST /api/internal/webhooks/dispatch).`);
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
