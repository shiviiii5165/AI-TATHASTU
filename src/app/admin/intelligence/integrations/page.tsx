import { sql } from "drizzle-orm";

import { Card, Kpi, SLOT } from "@/components/admin/intelligence/charts";
import { db } from "@/db";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { ECOSYSTEM } from "@/lib/intelligence/ecosystem";

export default async function EcosystemPage() {
  await requireAdminPermission("intelligence.read");
  const { rows } = await db.execute(sql`
    SELECT client_id AS client, count(*) FILTER (WHERE linked_at IS NOT NULL AND revoked_at IS NULL) AS linked,
           count(*) FILTER (WHERE revoked_at IS NOT NULL) AS revoked
    FROM integration_consents ic JOIN users u ON u.id = ic.user_id AND u.role = 'student' AND u.deleted_at IS NULL
    GROUP BY client_id`);
  const stats = new Map((rows as { client: string; linked: number; revoked: number }[]).map((r) => [r.client, r]));

  return (
    <div className="space-y-6">
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
