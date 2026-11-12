// E2E ONLY: fills the throwaway E2E database (e2e/support/stack.mts, a local PGlite) with REAL research
// opportunities: registers the catalogue, approves a few sources IN THAT TEST DATABASE ONLY (not an owner
// approval), then runs the real refresh and document extraction against the live official sources.
//
//   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55433/postgres node --conditions=react-server --import tsx scripts/e2e-seed-research.ts
//
// Refuses any database that is not on this machine.
const E2E_SOURCES = ["iitkgp-sric-project-positions", "iitr-project-jobs", "iith-postdoc-jrf-srf", "mpi-cbg-open-positions"];

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost):/.test(url)) throw new Error("Refusing: e2e seeding only runs against a local database.");
  const { db } = await import("../src/db");
  const { opportunitySources } = await import("../src/db/schema");
  const { RESEARCH_SOURCES } = await import("../src/lib/opportunities/catalogue");
  const { refreshDueSources } = await import("../src/lib/opportunities/ingest");
  const { runExtraction } = await import("../src/lib/opportunities/extract");
  type Db = Parameters<typeof refreshDueSources>[0];
  const now = new Date();
  for (const s of RESEARCH_SOURCES) {
    const approve = E2E_SOURCES.includes(s.id);
    await db.insert(opportunitySources).values({
      id: s.id, name: s.name, organization: s.organization, country: s.country, institutionType: s.institutionType, kind: s.kind, url: s.url,
      adapter: s.adapter ?? null, includePattern: s.includePattern ?? null, withdrawOnAbsence: s.withdrawOnAbsence, autoVerify: s.autoVerify,
      minFetchIntervalMinutes: s.minFetchIntervalMinutes, termsUrl: s.termsUrl, termsEvidence: s.termsEvidence, termsNote: s.note,
      termsStatus: approve ? "approved" : "needs_human_review", termsReviewedAt: approve ? now : null, approvedBy: approve ? "E2E TEST DATABASE ONLY" : null, approvedAt: approve ? now : null, enabled: approve,
    }).onConflictDoNothing();
  }
  const r = await refreshDueSources(db as unknown as Db, { linkCheckLimit: 0, extractLimit: 0, skipReminders: true });
  for (const [id, o] of Object.entries(r.results)) console.log(`${id.padEnd(30)} ${JSON.stringify(o)}`);
  console.log("extraction", JSON.stringify(await runExtraction(db as unknown as Db, { limit: 60 })));
  process.exit(0);
}

main().catch((e) => {
  console.error("e2e seed failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
