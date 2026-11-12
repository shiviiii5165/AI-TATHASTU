/**
 * Deadline reminders for saved research opportunities. Only for saves where the student opted in
 * (opportunity_saves.remind), only for listings still verified and active, once per save, within 72 hours
 * of a deadline the source actually published. Uses the existing email sender (system profile); when email
 * isn't configured nothing is sent and nothing is marked as sent.
 */
import { and, eq, gt, isNotNull, isNull, lte } from "drizzle-orm";

import { opportunities, opportunitySaves, users } from "@/db/schema";

import type { OppDb } from "./ingest";

const WINDOW_MS = 72 * 3600_000;
const APP_URL = (process.env.AUTH_URL || "https://www.aitathastu.com").replace(/\/$/, "");

export type ReminderSender = (to: string, email: { subject: string; html: string; text: string }) => Promise<void>;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendDeadlineReminders(db: OppDb, opts: { now?: Date; send?: ReminderSender | null } = {}) {
  const now = opts.now ?? new Date();
  let send = opts.send;
  if (send === undefined) {
    const { isEmailConfigured, sendEmail } = await import("@/lib/email");
    send = isEmailConfigured("system") ? async (to, email) => void (await sendEmail({ profile: "system", to, email })) : null;
  }
  if (!send) return { due: 0, sent: 0, skipped: "email_not_configured" as const };

  const due = await db
    .select({ userId: opportunitySaves.userId, opportunityId: opportunitySaves.opportunityId, email: users.email, title: opportunities.title, organization: opportunities.organization, deadline: opportunities.deadline, deadlineAt: opportunities.deadlineAt })
    .from(opportunitySaves)
    .innerJoin(opportunities, eq(opportunities.id, opportunitySaves.opportunityId))
    .innerJoin(users, eq(users.id, opportunitySaves.userId))
    .where(
      and(
        eq(opportunitySaves.remind, true),
        isNull(opportunitySaves.remindedAt),
        eq(opportunities.status, "active"),
        isNotNull(opportunities.deadlineAt),
        gt(opportunities.deadlineAt, now),
        lte(opportunities.deadlineAt, new Date(now.getTime() + WINDOW_MS)),
        isNotNull(users.email),
      ),
    )
    .limit(200);

  let sent = 0;
  for (const d of due) {
    const link = `${APP_URL}/opportunities/${d.opportunityId}`;
    const subject = `Deadline soon: ${d.title}`;
    const text = `${d.title} (${d.organization}) closes ${d.deadline ?? "soon"}, as published by the source.\n\nOpen it on AI Tathastu: ${link}\n\nYou asked for this reminder when you saved the opportunity. AI Tathastu doesn't submit applications; apply through the official link on the opportunity page.`;
    const html = `<p><strong>${esc(d.title)}</strong> (${esc(d.organization)}) closes <strong>${esc(d.deadline ?? "soon")}</strong>, as published by the source.</p><p><a href="${link}">Open it on AI Tathastu</a></p><p style="color:#617493">You asked for this reminder when you saved the opportunity. AI Tathastu doesn't submit applications; apply through the official link on the opportunity page.</p>`;
    try {
      await send(d.email!, { subject, html, text });
      await db.update(opportunitySaves).set({ remindedAt: now }).where(and(eq(opportunitySaves.userId, d.userId), eq(opportunitySaves.opportunityId, d.opportunityId)));
      sent++;
    } catch {
      /* not marked: retried on the next pass */
    }
  }
  return { due: due.length, sent };
}
