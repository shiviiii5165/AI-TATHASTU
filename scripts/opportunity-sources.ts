// Registers the research source catalogue (src/lib/opportunities/catalogue.ts) in opportunity_sources.
//
//   npm run opportunities:sources                                  # register/update every source; never enables
//   npm run opportunities:sources -- --approve <id> --by "<name>"  # owner approval: terms_status=approved, enabled
//   npm run opportunities:sources -- --reject <id> --by "<name>"   # owner decision: rejected and disabled
//
// Approval is per source and recorded (approved_by, approved_at). Requires migration 0030. Writes go through
// the same remote-write guard as migrations (AIT_APPROVED_WRITE_HOST must name the target host).
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};

async function main() {
  const approve = arg("--approve");
  const reject = arg("--reject");
  const by = arg("--by");
  if ((approve || reject) && !by) throw new Error('--approve / --reject need --by "<who decided>"');
  const { assertWriteAllowed } = await import("./lib/db-target.mjs");
  assertWriteAllowed(process.env.DATABASE_URL);
  const { eq } = await import("drizzle-orm");
  const { db } = await import("../src/db");
  const { opportunitySources } = await import("../src/db/schema");
  const { RESEARCH_SOURCES } = await import("../src/lib/opportunities/catalogue");
  const now = new Date();

  for (const s of RESEARCH_SOURCES) {
    const values = {
      id: s.id,
      name: s.name,
      organization: s.organization,
      country: s.country,
      institutionType: s.institutionType,
      kind: s.kind,
      url: s.url,
      adapter: s.adapter ?? null,
      includePattern: s.includePattern ?? null,
      withdrawOnAbsence: s.withdrawOnAbsence,
      autoVerify: s.autoVerify,
      minFetchIntervalMinutes: s.minFetchIntervalMinutes,
      termsUrl: s.termsUrl,
      termsEvidence: s.termsEvidence,
      termsNote: s.note,
    };
    const { id: _id, ...update } = values;
    // A registration never changes an owner decision (terms_status / enabled stay as the owner set them).
    await db.insert(opportunitySources).values({ ...values, termsStatus: s.termsStatus === "rejected" ? "rejected" : "needs_human_review", enabled: false }).onConflictDoUpdate({ target: opportunitySources.id, set: update });
  }

  if (approve || reject) {
    const id = (approve ?? reject)!;
    if (!RESEARCH_SOURCES.some((s) => s.id === id)) throw new Error(`Unknown source id: ${id}`);
    await db
      .update(opportunitySources)
      .set(approve ? { termsStatus: "approved", termsReviewedAt: now, approvedBy: by!, approvedAt: now, enabled: true } : { termsStatus: "rejected", enabled: false, approvedBy: by!, approvedAt: now })
      .where(eq(opportunitySources.id, id));
  }

  const rows = await db.select({ id: opportunitySources.id, status: opportunitySources.termsStatus, enabled: opportunitySources.enabled }).from(opportunitySources);
  for (const r of rows) console.log(`${r.id.padEnd(32)} ${r.status.padEnd(20)} ${r.enabled ? "ENABLED" : "disabled"}`);
  process.exit(0);
}

main().catch((e) => {
  console.error("opportunity sources failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
