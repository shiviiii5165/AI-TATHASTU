// Operator tool for cross-app profile sync (Collaborate, Avsar). Everything is a DRY RUN unless --apply is given.
//
//   npx tsx --conditions=react-server scripts/integration-sync.ts report
//   npx tsx --conditions=react-server scripts/integration-sync.ts backfill  --client avasar [--limit 3] [--users id,id] [--apply] [--send]
//   npx tsx --conditions=react-server scripts/integration-sync.ts repair    --client collaborate [--limit 50] [--users id,id] [--apply] [--send]
//   npx tsx --conditions=react-server scripts/integration-sync.ts policy-v2 --client collaborate [--apply]
//
// backfill   links users who never made a choice for the app (consent policy v2: profile on, Career Intelligence off,
//            source "backfill") and queues auto_provision. Oldest accounts first. Resumable: re-running skips everyone
//            who now has a choice, so an interrupted run just continues.
// repair     re-sends linked users the app has no confirmed profile for (src/lib/integrations/repair.ts). No consent change.
// policy-v2  turns Career Intelligence (eris, activity) OFF on consents created by the earlier automatic provisioning,
//            which shared everything. Only rows the user never set themselves (no source recorded, an auto_provision
//            event exists, and the user never changed the toggles). Reduces sharing only.
// --send     after --apply, sends exactly the queued rows of the selected users now (claims them one by one; other
//            users' rows are never touched). Without it they go out with the next scheduled dispatch.
//
// DATABASE_URL comes from the environment only. A remote host needs AIT_APPROVED_WRITE_HOST=<that host> for this run,
// even for a dry run (it lists users). Prints counts and masked ids only.
import { assertWriteAllowed, hostOf } from "./lib/db-target.mjs";

type Client = "collaborate" | "avasar";
const args = process.argv.slice(2);
const command = args[0];
const opt = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);
const apply = has("apply");
const send = has("send");
const client = opt("client") as Client | undefined;
const limit = Math.min(Math.max(Number(opt("limit") ?? 50) || 50, 1), 500);
const users = opt("users")?.split(",").map((s) => s.trim()).filter(Boolean);
const mask = (id: string) => `${id.slice(0, 8)}…`;

async function main() {
  if (!["report", "backfill", "repair", "policy-v2"].includes(command ?? "")) {
    console.error("Usage: report | backfill | repair | policy-v2  (see the header of this file)");
    process.exit(2);
  }
  if (command !== "report" && client !== "collaborate" && client !== "avasar") throw new Error("--client collaborate|avasar is required.");
  if (users?.some((u) => !/^[0-9a-f-]{36}$/i.test(u))) throw new Error("--users takes AI Tathastu user ids (uuid), comma-separated.");
  const url = assertWriteAllowed(process.env.DATABASE_URL);
  console.log(`target: ${hostOf(url)} · ${command} · ${apply ? "APPLY" : "dry run"}`);

  // Imported after the target check: these modules connect to DATABASE_URL on import.
  const { sql } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { autoProvision, pendingProvisionUsers } = await import("@/lib/integrations/auto-provision");
  const { saveConsent, CAREER_INTELLIGENCE_SCOPES, effectiveScopes } = await import("@/lib/integrations/consent");
  const { repairMissingProfiles } = await import("@/lib/integrations/repair");
  const { appSyncSummaries } = await import("@/lib/integrations/sync-admin");
  const { dispatchSelectedProfileUpdates, SELECTED_DISPATCH_MAX } = await import("@/lib/integrations/webhooks");

  const sendNow = async (ids: string[]) => {
    if (!send || !apply || !ids.length) return;
    for (let i = 0; i < ids.length; i += SELECTED_DISPATCH_MAX) {
      const r = await dispatchSelectedProfileUpdates(client!, ids.slice(i, i + SELECTED_DISPATCH_MAX), { apply: true });
      for (const x of r.results) console.log(`  sent ${mask(x.userId)} → ${x.outcome}`);
      for (const s of r.skipped) console.log(`  not sent ${mask(s.userId)}: ${s.reason}`);
    }
  };

  if (command === "report") {
    // Settings columns reflect THIS shell's environment, not production's.
    for (const s of await appSyncSummaries()) {
      const { name, eligible, linked, noChoice, byStatus, linkedWithoutStatus, pendingRetries, failedEvents30d, deletionsPending } = s;
      console.log(JSON.stringify({ app: name, eligible, linked, neverChose: noChoice, byStatus, linkedWithoutStatus, pendingRetries, failedEvents30d, deletionsPending }));
      const repair = await repairMissingProfiles(s.clientId, { limit: 500 });
      const causes = repair.candidates.reduce<Record<string, number>>((a, c) => ((a[c.cause] = (a[c.cause] ?? 0) + 1), a), {});
      console.log(`  repair candidates: ${repair.candidates.length} ${JSON.stringify(causes)}`);
    }
    return;
  }

  if (command === "backfill") {
    const all = await pendingProvisionUsers(client!, users ? 100_000 : limit);
    const ids = users ? all.filter((id) => users.includes(id)) : all;
    if (users) for (const u of users.filter((x) => !all.includes(x))) console.log(`  skip ${mask(u)}: already has a choice, deleted, or unknown`);
    console.log(`candidates: ${ids.length}${users ? "" : ` (limit ${limit}, oldest first)`}`);
    for (const id of ids) console.log(`  ${apply ? "provision" : "would provision"} ${mask(id)}`);
    if (!apply) return console.log("Dry run. Re-run with --apply (and --send to deliver these users now).");
    const done: string[] = [];
    for (const id of ids) if (await autoProvision(id, client!, "backfill")) done.push(id);
    console.log(`provisioned: ${done.length}`);
    await sendNow(done);
    return;
  }

  if (command === "repair") {
    const r = await repairMissingProfiles(client!, { apply, limit, userIds: users });
    for (const c of r.candidates) console.log(`  ${apply ? "queued" : "would queue"} ${mask(c.userId)} (${c.cause})`);
    console.log(`candidates: ${r.candidates.length}, queued: ${r.queued}`);
    if (!apply) return console.log("Dry run. Re-run with --apply (and --send to deliver these users now).");
    await sendNow(r.candidates.map((c) => c.userId));
    return;
  }

  // policy-v2
  const { rows } = await db.execute(sql`
    SELECT ic.user_id::text AS user_id, ic.scopes, ic.hidden_projects
      FROM integration_consents ic JOIN users u ON u.id = ic.user_id AND u.deleted_at IS NULL
     WHERE ic.client_id = ${client!} AND ic.source IS NULL
       AND ic.linked_at IS NOT NULL AND ic.revoked_at IS NULL
       AND (ic.scopes->>'eris' = 'true' OR ic.scopes->>'activity' = 'true')
       AND EXISTS (SELECT 1 FROM webhook_outbox w WHERE w.user_id = ic.user_id AND w.client_id = ic.client_id AND w.reason = 'auto_provision')
       AND NOT EXISTS (SELECT 1 FROM webhook_outbox w WHERE w.user_id = ic.user_id AND w.client_id = ic.client_id AND w.reason = 'consent_changed')
     ORDER BY u.created_at`);
  const list = rows as { user_id: string; scopes: Record<string, boolean>; hidden_projects: string[] }[];
  console.log(`automatic consents still sharing Career Intelligence: ${list.length}`);
  for (const r of list) console.log(`  ${apply ? "turn off" : "would turn off"} eris/activity for ${mask(r.user_id)}`);
  if (!apply) return console.log("Dry run. Re-run with --apply.");
  const { enqueueProfileUpdated } = await import("@/lib/integrations/webhooks");
  for (const r of list) {
    const scopes = effectiveScopes({ scopes: r.scopes });
    for (const s of CAREER_INTELLIGENCE_SCOPES) scopes[s] = false;
    await saveConsent(r.user_id, client!, { scopes, hiddenProjects: r.hidden_projects, source: "backfill" });
    // The app hears the narrower consent and drops what it may no longer hold.
    await enqueueProfileUpdated(r.user_id, "consent_changed", client!);
  }
  console.log(`updated: ${list.length}`);
  await sendNow(list.map((r) => r.user_id));
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
