// Prints the research source coverage report from the database in DATABASE_URL (read-only).
//
//   npm run opportunities:coverage
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

async function main() {
  const { db } = await import("../src/db");
  const { coverageReport } = await import("../src/lib/opportunities/coverage");
  const r = await coverageReport(db as unknown as Parameters<typeof coverageReport>[0]);
  console.log(`Sources registered ${r.totals.sourcesRegistered} · approved ${r.totals.sourcesApproved} · enabled ${r.totals.sourcesEnabled}`);
  console.log(`Verified active opportunities ${r.totals.verifiedActiveOpportunities} · needs review ${r.totals.needsReview}\n`);
  for (const s of r.sources) {
    console.log(`${s.id.padEnd(32)} ${s.termsStatus.padEnd(19)} ${(s.enabled ? "enabled" : "disabled").padEnd(9)} ${s.health.padEnd(13)} active=${s.active} review=${s.needsReview} closed=${s.closedOrExpired} withdrawn=${s.withdrawn} filtered=${s.filteredLastRefresh ?? "-"}${s.lastError ? ` error=${s.lastError}` : ""}`);
  }
  console.log(`\nExamined and not collected: ${r.rejectedSources.length}`);
  for (const x of r.rejectedSources) console.log(`  - ${x.name}: ${x.reason}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("coverage failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
