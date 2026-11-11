// Controlled refresh of research opportunities from the curated source registry.
//
//   npm run opportunities:refresh            # .env.local (or the environment)
//
// For each ENABLED, terms-reviewed feed source in opportunity_sources: respects its
// min_fetch_interval_minutes and robots.txt, fetches once, dedupes, withdraws entries the source
// no longer lists. Then applies the lifecycle (expired deadlines, stale verification).
// Nothing is fetched from an unregistered or disabled source; failures leave listings intact.
// Prints counts and short error codes only (no payloads). Intended for a scheduled job (e.g. every 6h).
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { opportunitySources } = await import("../src/db/schema");
  const { applyLifecycle, refreshSource } = await import("../src/lib/opportunities/ingest");
  type Db = Parameters<typeof refreshSource>[0];

  const sources = await db.select().from(opportunitySources).where(eq(opportunitySources.enabled, true));
  let failed = 0;
  for (const s of sources) {
    const r = await refreshSource(db as unknown as Db, s);
    if (r.status === "failed") failed++;
    console.log(`${s.id.padEnd(32)} ${r.status}${"reason" in r ? ` (${r.reason})` : ""}${"error" in r ? ` ${r.error}` : ""}${r.status === "ok" ? ` seen=${r.seen} new=${r.inserted} updated=${r.updated} withdrawn=${r.withdrawn} dup=${r.duplicates}` : ""}`);
  }
  const lc = await applyLifecycle(db as unknown as Db);
  console.log(`lifecycle expired=${lc.expired} stale=${lc.stale}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("opportunities refresh failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
