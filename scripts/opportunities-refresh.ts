// Research-opportunity refresh, same code path as the scheduled endpoint
// (/api/internal/opportunities/refresh): every enabled, due source (interval, backoff and lease
// respected; failures isolated), then lifecycle (deadlines, stale verification) and link checks.
//
//   npm run opportunities:refresh            # .env.local (or the environment)
//
// Prints counts and short error codes only.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { assertWriteAllowed } = await import("./lib/db-target.mjs");
  assertWriteAllowed(process.env.DATABASE_URL);
  const { db } = await import("../src/db");
  const { refreshDueSources } = await import("../src/lib/opportunities/ingest");
  const r = await refreshDueSources(db as unknown as Parameters<typeof refreshDueSources>[0]);
  for (const [id, o] of Object.entries(r.results)) {
    console.log(`${id.padEnd(32)} ${o.status}${"reason" in o ? ` (${o.reason})` : ""}${"error" in o ? ` ${o.error}` : ""}${o.status === "ok" ? ` seen=${o.seen} new=${o.inserted} updated=${o.updated} withdrawn=${o.withdrawn} dup=${o.duplicates}` : ""}`);
  }
  console.log(`lifecycle expired=${r.lifecycle.expired} stale=${r.lifecycle.stale} · links checked=${r.links.checked} broken=${r.links.broken}`);
  process.exit(Object.values(r.results).some((o) => o.status === "failed") ? 1 : 0);
}

main().catch((e) => {
  console.error("opportunities refresh failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
