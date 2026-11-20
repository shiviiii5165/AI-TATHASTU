import "server-only";

import { and, eq, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { collabMembers, collabPosts, users } from "@/db/schema";

import { DAY_MS, EXPIRY_TRACKED, lifecycleStep, OWNER_INACTIVE_DAYS, REMINDER_DAYS } from "./rules";
import { notify, postHref } from "./service";

const BATCH = 500;

/**
 * The daily lifecycle run (POST /api/internal/collaborations/lifecycle, cron-authenticated):
 *  1. Inactivity: renewal reminders on days 45 and 55, expiry on day 60. Expired posts leave Discover and stop
 *     taking applications; nothing is deleted (members, requests and messages stay) and the owner can renew.
 *  2. Owner recovery: active collaborations whose owner was deleted or hasn't managed them for OWNER_INACTIVE_DAYS
 *     are flagged for an administrator. Nothing is transferred or closed automatically.
 * Each step is a conditional UPDATE, so overlapping runs can't send a reminder twice or expire a renewed post.
 */
export async function runLifecycle(now = new Date()) {
  const result = { reminded: 0, expired: 0, flagged: 0 };
  const firstReminder = new Date(now.getTime() - REMINDER_DAYS[0] * DAY_MS);

  const due = await db
    .select()
    .from(collabPosts)
    .where(and(inArray(collabPosts.status, [...EXPIRY_TRACKED]), lt(sql`coalesce(${collabPosts.renewedAt}, ${collabPosts.publishedAt}, ${collabPosts.createdAt})`, firstReminder)))
    .limit(BATCH);

  for (const p of due) {
    const step = lifecycleStep(p, now);
    if (!step) continue;
    if (step.kind === "expire") {
      const done = await db
        .update(collabPosts)
        .set({ status: "expired", expiredAt: now, updatedAt: now })
        .where(and(eq(collabPosts.id, p.id), eq(collabPosts.status, p.status), sql`${collabPosts.renewedAt} is not distinct from ${p.renewedAt}`))
        .returning({ id: collabPosts.id });
      if (done.length) {
        result.expired++;
        if (p.ownerId) await notify([{ userId: p.ownerId, kind: "post_expired", postId: p.id, title: `“${p.title}” expired after 60 days without a renewal`, body: "It's hidden from Discover. Your team and history are kept. Renew it to recruit again.", href: postHref(p.id) }]);
      }
    } else {
      const done = await db
        .update(collabPosts)
        .set({ reminderStage: step.stage })
        .where(and(eq(collabPosts.id, p.id), lt(collabPosts.reminderStage, step.stage), sql`${collabPosts.renewedAt} is not distinct from ${p.renewedAt}`))
        .returning({ id: collabPosts.id });
      if (done.length) {
        result.reminded++;
        if (p.ownerId) await notify([{ userId: p.ownerId, kind: "renewal_reminder", postId: p.id, title: `Renew “${p.title}” to keep it listed`, body: `It expires in ${step.daysLeft} day${step.daysLeft === 1 ? "" : "s"} unless you renew it.`, href: postHref(p.id) }]);
      }
    }
  }

  // Owner recovery: only collaborations that still matter to someone (active statuses).
  const inactiveSince = new Date(now.getTime() - OWNER_INACTIVE_DAYS * DAY_MS);
  const orphaned = await db
    .select({ id: collabPosts.id, title: collabPosts.title, ownerId: collabPosts.ownerId, ownerDeleted: users.deletedAt, ownerActiveAt: collabPosts.ownerActiveAt })
    .from(collabPosts)
    .leftJoin(users, eq(users.id, collabPosts.ownerId))
    .where(
      and(
        eq(collabPosts.needsOwnerReview, false),
        inArray(collabPosts.status, ["recruiting", "paused", "team_full", "in_progress"]),
        or(isNull(collabPosts.ownerId), isNotNull(users.deletedAt), lt(collabPosts.ownerActiveAt, inactiveSince)),
      ),
    )
    .limit(BATCH);
  for (const p of orphaned) {
    const reason = !p.ownerId ? "owner_account_deleted" : p.ownerDeleted ? "owner_account_deleted" : "owner_inactive";
    // Inactive owners of posts with no team aren't stranding anyone: the 60-day expiry already handles those.
    if (reason === "owner_inactive") {
      const [m] = await db.select({ id: collabMembers.id }).from(collabMembers).where(and(eq(collabMembers.postId, p.id), eq(collabMembers.kind, "member"), eq(collabMembers.status, "active"))).limit(1);
      if (!m) continue;
    }
    const done = await db.update(collabPosts).set({ needsOwnerReview: true, ownerReviewReason: reason }).where(and(eq(collabPosts.id, p.id), eq(collabPosts.needsOwnerReview, false))).returning({ id: collabPosts.id });
    if (done.length) result.flagged++;
  }
  return result;
}
