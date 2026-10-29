import { Mail, Newspaper, Send, Users } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { newsletterCampaigns, newsletterSubscribers } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { desc } from "drizzle-orm";

export const metadata = {
  title: "Newsletter & Campaigns · Admin Control Center",
  robots: { index: false },
};

export default async function AdminNewsletterPage() {
  await requireAdmin();
  await requireAdminPermission("newsletter.manage");

  const subscribers = await db
    .select()
    .from(newsletterSubscribers)
    .orderBy(desc(newsletterSubscribers.subscribedAt))
    .limit(50);

  const campaigns = await db
    .select()
    .from(newsletterCampaigns)
    .orderBy(desc(newsletterCampaigns.createdAt));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Newspaper className="size-6 text-primary" />
          <span>Newsletter Campaigns & Subscriber Directory</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Consent-tracked marketing audience, campaign scheduling, and unsubscribe compliance.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground">Active Subscribers</span>
          <div className="text-2xl font-bold text-foreground mt-1">{subscribers.length}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Double opt-in & footer consent sources</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground">Campaigns Sent</span>
          <div className="text-2xl font-bold text-foreground mt-1">{campaigns.length}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Marketing broadcasts</p>
        </div>
      </div>

      {/* Subscribers Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Subscriber Directory ({subscribers.length})
          </h2>
        </div>

        {subscribers.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No newsletter subscribers yet. Submissions from the public landing page footer will appear here.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Subscribed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-accent/40 font-mono text-[11px]">
                    <td className="py-3 px-4 font-sans font-semibold text-foreground">{sub.email}</td>
                    <td className="py-3 px-4 text-muted-foreground">{sub.name || "—"}</td>
                    <td className="py-3 px-4 text-muted-foreground">{sub.consentSource}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 capitalize">
                        {sub.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {new Date(sub.subscribedAt).toLocaleDateString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

