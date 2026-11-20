import { sql } from "drizzle-orm";

import { Card, Kpi, SLOT } from "@/components/admin/intelligence/charts";
import { db } from "@/db";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { ECOSYSTEM } from "@/lib/intelligence/ecosystem";
import { RepairProfilesForm } from "@/components/admin/intelligence/repair-profiles-form";
import { appSyncSummaries } from "@/lib/integrations/sync-admin";

export default async function EcosystemPage() {
  await requireAdminPermission("intelligence.read");
  const { rows } = await db.execute(sql`
    SELECT client_id AS client, count(*) FILTER (WHERE linked_at IS NOT NULL AND revoked_at IS NULL) AS linked,
           count(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked
    FROM integration_consents ic JOIN users u ON u.id = ic.user_id AND u.role = 'student' AND u.deleted_at IS NULL
    GROUP BY client_id`);
  const stats = new Map((rows as { client: string; linked: number; revoked: number }[]).map((r) => [r.client, r]));
  const sync = await appSyncSummaries();

  return (
    <div className="space-y-6">
      <Card
        title="Profile sync"
        subtitle="Automatic private profiles in Collaborate and Avsar. 'Synced' counts only profiles the app confirmed; a delivery the app ignored or refused is counted where it belongs. All accounts, not just students."
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-2 px-4">App</th>
                <th className="py-2 px-4">Settings</th>
                <th className="py-2 px-4">Active accounts</th>
                <th className="py-2 px-4">Linked</th>
                <th className="py-2 px-4">Synced</th>
                <th className="py-2 px-4">Pending</th>
                <th className="py-2 px-4">Missing</th>
                <th className="py-2 px-4">Conflicts</th>
                <th className="py-2 px-4">Failed</th>
                <th className="py-2 px-4">Never chose (backfill)</th>
                <th className="py-2 px-4">Deletions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sync.map((s) => (
                <tr key={s.clientId} className="align-top">
                  <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap">{s.name}</td>
                  <td className="py-3 px-4 text-muted-foreground">
                    Signup {s.signupProvisioning ? "on" : "off"} · weekly backfill {s.backfillJob ? "on" : "off"} · sync {s.webhookConfigured ? "configured" : "not configured"}
                  </td>
                  <td className="py-3 px-4 font-mono">{s.eligible}</td>
                  <td className="py-3 px-4 font-mono">{s.linked}</td>
                  <td className="py-3 px-4 font-mono">{s.byStatus.synced ?? 0}</td>
                  <td className="py-3 px-4 font-mono">
                    {s.byStatus.pending ?? 0}
                    {s.pendingRetries ? <span className="text-muted-foreground"> ({s.pendingRetries} retrying)</span> : null}
                  </td>
                  <td className="py-3 px-4 font-mono">{(s.byStatus.missing ?? 0) + s.linkedWithoutStatus}</td>
                  <td className="py-3 px-4 font-mono">
                    {(s.byStatus.conflict ?? 0) + (s.byStatus.review ?? 0)}
                    {s.byStatus.review ? <span className="text-muted-foreground"> ({s.byStatus.review} need review)</span> : null}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {s.byStatus.failed ?? 0}
                    <span className="text-muted-foreground"> ({s.failedEvents30d} events, 30d)</span>
                  </td>
                  <td className="py-3 px-4 font-mono">{s.noChoice}</td>
                  <td className="py-3 px-4 font-mono">
                    {s.deletionsConfirmed30d} confirmed{s.deletionsPending ? `, ${s.deletionsPending} pending` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-2">
          {sync.map((s) => (
            <RepairProfilesForm key={s.clientId} clientId={s.clientId} name={s.name} disabled={!s.webhookConfigured} />
          ))}
          <p className="text-xs text-muted-foreground">
            Repair re-sends linked users the app has no confirmed profile for. It never changes anyone&apos;s consent. Backfilling users who never chose
            is an operator step with a dry run (scripts/integration-sync.ts). Every action here is recorded in the audit log.
          </p>
        </div>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Products" value={String(ECOSYSTEM.length)} color={SLOT(0)} />
        <Kpi label="Sign in with AI Tathastu" value={String(ECOSYSTEM.filter((p) => p.clientId).length)} sub="Read the consented profile" color={SLOT(2)} />
        <Kpi label="Send data back" value={String(ECOSYSTEM.filter((p) => p.sendsDataBack && p.id !== "ai_tathastu").length)} sub="Inbound contracts in place" color={SLOT(1)} />
        <Kpi label="Not integrated" value={String(ECOSYSTEM.filter((p) => !p.integrated).length)} sub="No data contract yet" color={SLOT(7)} />
      </div>
      <Card title="Integration status" subtitle="From the integration code and consent records, not from assumptions. Products show no metrics until they share data under a consented contract.">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase tracking-wider text-[10px]">
              <tr><th className="py-2 px-4">Product</th><th className="py-2 px-4">Today</th><th className="py-2 px-4">Students linked</th><th className="py-2 px-4">Data back to AI Tathastu</th><th className="py-2 px-4">Needed to add its evidence</th></tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {ECOSYSTEM.map((p, i) => {
                const st = p.clientId ? stats.get(p.clientId) : undefined;
                return (
                  <tr key={p.id} className="align-top">
                    <td className="py-3 px-4 font-semibold text-foreground whitespace-nowrap"><span className="inline-block size-2.5 rounded-full mr-2" style={{ background: SLOT(i) }} />{p.name}</td>
                    <td className="py-3 px-4 text-muted-foreground max-w-sm">{p.flow}</td>
                    <td className="py-3 px-4 font-mono text-foreground">{p.clientId ? `${Number(st?.linked ?? 0)}${Number(st?.revoked ?? 0) ? ` (${st!.revoked} revoked)` : ""}` : "—"}</td>
                    <td className="py-3 px-4">{p.sendsDataBack ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Yes</span> : <span className="text-muted-foreground">No</span>}</td>
                    <td className="py-3 px-4 text-muted-foreground max-w-sm">{p.needed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
