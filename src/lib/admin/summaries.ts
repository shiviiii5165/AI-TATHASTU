import "server-only";

import { inArray, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { emailDeliveries, newsletterCampaigns, newsletterSubscribers, supportTickets } from "@/db/schema";

/**
 * Admin counts computed with database aggregation over the whole table, never from the handful of rows a page
 * happens to display. Read-only: nothing here writes.
 */

/** A ticket is open until it is resolved or closed. */
export const CLOSED_TICKET_STATUSES = ["resolved", "closed"] as const;

export async function ticketQueueSummary() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      open: sql<number>`(count(*) filter (where ${notInArray(supportTickets.status, [...CLOSED_TICKET_STATUSES])}))::int`,
      urgentOrHighOpen: sql<number>`(count(*) filter (where ${notInArray(supportTickets.status, [...CLOSED_TICKET_STATUSES])} and ${inArray(supportTickets.priority, ["urgent", "high"])}))::int`,
    })
    .from(supportTickets);
  return { total: row?.total ?? 0, open: row?.open ?? 0, urgentOrHighOpen: row?.urgentOrHighOpen ?? 0 };
}

/** Delivery counts by status across the whole outbox (the page still lists only the latest rows). */
export async function deliveryStatusCounts() {
  const rows = await db
    .select({ status: emailDeliveries.status, n: sql<number>`count(*)::int` })
    .from(emailDeliveries)
    .groupBy(emailDeliveries.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  const total = rows.reduce((s, r) => s + r.n, 0);
  return { queued: by.queued ?? 0, delivered: by.delivered ?? 0, failed: by.failed ?? 0, total, byStatus: by };
}

/** Subscribers by their real status, and campaigns that were actually sent (drafts and scheduled excluded). */
export async function newsletterSummary() {
  const [subs, camps] = await Promise.all([
    db.select({ status: newsletterSubscribers.status, n: sql<number>`count(*)::int` }).from(newsletterSubscribers).groupBy(newsletterSubscribers.status),
    db.select({ status: newsletterCampaigns.status, n: sql<number>`count(*)::int` }).from(newsletterCampaigns).groupBy(newsletterCampaigns.status),
  ]);
  const subscribers = Object.fromEntries(subs.map((r) => [r.status, r.n])) as Record<string, number>;
  const campaigns = Object.fromEntries(camps.map((r) => [r.status, r.n])) as Record<string, number>;
  return {
    subscribed: subscribers.subscribed ?? 0,
    subscribersTotal: subs.reduce((s, r) => s + r.n, 0),
    subscribersByStatus: subscribers,
    campaignsSent: campaigns.sent ?? 0,
    campaignsTotal: camps.reduce((s, r) => s + r.n, 0),
    campaignsByStatus: campaigns,
  };
}

/** Team membership counts from each member's real isActive flag. */
export function teamSummary(members: { isActive: boolean }[]) {
  const active = members.filter((m) => m.isActive).length;
  return { total: members.length, active, inactive: members.length - active };
}

/** An audit IP exactly as recorded, or "Unknown". Never a placeholder address. */
export const displayIp = (ip: string | null | undefined) => (ip && ip.trim() ? ip.trim() : "Unknown");

/**
 * Date and time in India Standard Time, labelled. Fixed zone so the same record reads the same on every server
 * (the host may run in UTC); never an unlabelled local time.
 */
export const fullTimestamp = (d: Date | string) =>
  `${new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" })} IST`;

/** Neutral status for a component that has no real check connected yet. */
export const NOT_MONITORED = { label: "Not monitored", detail: "No health check is connected for this component yet." } as const;

const STATUS_TONE: Record<string, string> = {
  subscribed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  unsubscribed: "bg-muted text-muted-foreground",
  bounced: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};
/** Badge colour for a subscriber status; unknown values stay neutral rather than green. */
export const subscriberTone = (status: string) => STATUS_TONE[status] ?? "bg-muted text-muted-foreground";
