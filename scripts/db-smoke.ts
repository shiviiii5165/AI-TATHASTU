// Read-only smoke test of the app's own database code against whatever DATABASE_URL points at.
//   DATABASE_URL=... npx tsx --conditions=react-server scripts/db-smoke.ts
// Runs typed Drizzle queries, raw SQL, the profile loader and the pgvector people search. Writes nothing.
import { count, sql } from "drizzle-orm";

async function main() {
  const host = new URL(process.env.DATABASE_URL ?? "").hostname;
  const { db } = await import("../src/db");
  const schema = await import("../src/db/schema");
  const started = Date.now();
  const checks: [string, () => Promise<unknown>][] = [
    ["typed select (users count)", async () => (await db.select({ n: count() }).from(schema.users))[0].n],
    ["raw SQL with lateral join (stale profile syncs)", async () => {
      const { findStaleProfileSyncs } = await import("../src/lib/integrations/reconcile");
      return (await findStaleProfileSyncs("collaborate")).length;
    }],
    ["profile loader (one onboarded user)", async () => {
      const [u] = await db.execute(sql`select u.id from users u join onboarding_state o on o.user_id = u.id where o.current_step = 'done' and u.deleted_at is null limit 1`).then((r) => r.rows as { id: string }[]);
      const { loadProfile } = await import("../src/lib/profile/unified");
      const p = await loadProfile(u.id);
      return `${Object.keys(p ?? {}).length} profile sections`;
    }],
    ["pgvector cosine search", async () => {
      const r = await db.execute(sql`select count(*)::int n from (select a.user_id from collaboration_embeddings a, collaboration_embeddings b
        where a.embedding is not null and b.embedding is not null order by a.embedding <=> b.embedding limit 5) x`);
      return (r.rows[0] as { n: number }).n;
    }],
    ["hit_sliding_limit function exists", async () => (await db.execute(sql`select count(*)::int n from pg_proc where proname = 'hit_sliding_limit'`)).rows[0]],
  ];
  console.log(`database host: ${host}`);
  let failed = 0;
  for (const [name, fn] of checks) {
    try { console.log(`  OK   ${name}: ${JSON.stringify(await fn())}`); } catch (e) { failed++; console.log(`  FAIL ${name}: ${e instanceof Error ? e.message : e}`); }
  }
  console.log(`${checks.length - failed}/${checks.length} passed in ${Date.now() - started} ms`);
  process.exit(failed ? 1 : 0);
}

main();
