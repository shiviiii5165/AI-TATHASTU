// Operator tool for cross-app profile sync (Collaborate, Avsar). Everything is a DRY RUN unless --apply is given.
//
//   npx tsx --conditions=react-server scripts/integration-sync.ts report
//   npx tsx --conditions=react-server scripts/integration-sync.ts backfill  --client avasar [--limit 3] [--users id,id] [--apply] [--send]
//   npx tsx --conditions=react-server scripts/integration-sync.ts repair    --client collaborate [--limit 50] [--users id,id] [--apply] [--send]
//   npx tsx --conditions=react-server scripts/integration-sync.ts reconcile --client avasar
//
// reconcile  read-only: every account in one bucket (deleted, eligible, already synced, in flight, onboarding
//            incomplete, failed, conflict, unconfirmed). Counts only. Also printed before and after every backfill.
//            Retry failed / unconfirmed users with `repair`.
// backfill   consent policy v4: links every active account not yet on policy v4 for the app (everything shared, source
//            "backfill") and queues auto_provision, which creates the profile in the app or updates it. Oldest first.
//            Resumable: accounts already on policy v4 are skipped, so an interrupted run just continues.
// repair     re-sends linked users the app has no confirmed profile for (src/lib/integrations/repair.ts). No consent change.
// --send     after --apply, sends exactly the queued rows of the selected users now (claims them one by one; other
//            users' rows are never touched; onboarded users only). Without it they go out with the next scheduled dispatch.
// --dispatch after --apply, sends every due row now, as the daily job does (all users, onboarded or not).
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
  if (!["report", "backfill", "repair", "reconcile"].includes(command ?? "")) {
    console.error("Usage: report | backfill | repair | reconcile  (see the header of this file)");
    process.exit(2);
  }
  if (command !== "report" && client !== "collaborate" && client !== "avasar") throw new Error("--client collaborate|avasar is required.");
  if (users?.some((u) => !/^[0-9a-f-]{36}$/i.test(u))) throw new Error("--users takes AI Tathastu user ids (uuid), comma-separated.");
  const url = assertWriteAllowed(process.env.DATABASE_URL);
  console.log(`target: ${hostOf(url)} · ${command} · ${apply ? "APPLY" : "dry run"}`);

  // Imported after the target check: these modules connect to DATABASE_URL on import.
  const { autoProvision, pendingProvisionUsers } = await import("@/lib/integrations/auto-provision");
  const { repairMissingProfiles } = await import("@/lib/integrations/repair");
  const { appSyncSummaries } = await import("@/lib/integrations/sync-admin");
  const { dispatchSelectedProfileUpdates, SELECTED_DISPATCH_MAX } = await import("@/lib/integrations/webhooks");
  const { backfillReport } = await import("@/lib/integrations/backfill-report");
  const printReport = async (label: string) => console.log(`${label}: ${JSON.stringify(await backfillReport(client!))}`);

  if (command === "reconcile") return printReport("reconciliation");

  const sendNow = async (ids: string[]) => {
    if (has("dispatch") && apply) {
      // Everyone's due rows, as the daily job sends them (includes users who haven't finished onboarding).
      const { dispatchWebhooks } = await import("@/lib/integrations/webhooks");
      const total = { delivered: 0, retrying: 0, failed: 0 };
      for (let i = 0; i < 20; i++) {
        const r = await dispatchWebhooks(100);
        total.delivered += r.delivered;
        total.retrying += r.retrying;
        total.failed += r.failed;
        if (r.delivered + r.retrying + r.failed === 0) break;
      }
      console.log(`dispatched: ${JSON.stringify(total)}`);
      return;
    }
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
    await printReport("preview");
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
    await printReport("reconciliation");
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
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
