import "server-only";

import { and, count, desc, eq, ilike, inArray, isNull, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import {
  COLLAB_CATEGORIES,
  COLLAB_STATUSES,
  collabApplications,
  collabCreatorVerifications,
  collabMembers,
  collabMessages,
  collabModerationActions,
  collabPosts,
  collabReports,
  collabThreads,
  users,
  type CollabStatus,
  type User,
} from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin/audit";

import { creatorTypeFor } from "./rules";
import { memberCountSql, notify, postHref } from "./service";

/**
 * Administrative moderation. Every function here is called only from src/app/admin/collaborations/actions.ts, which
 * checks the permission first. Every change records a moderation action (kept with the post) and an admin audit
 * entry, with the operator and their reason. Moderators never act as the owner: they cannot accept applicants or
 * post in team conversations.
 */
export type ModResult = { ok: true; message?: string } | { ok: false; error: string };

async function record(actor: User, action: string, postId: string | null, reason: string, extra: { fromOwnerId?: string | null; toOwnerId?: string | null; details?: Record<string, unknown> } = {}) {
  await db.insert(collabModerationActions).values({ postId, actorId: actor.id, actorEmail: actor.email ?? "unknown", action, reason, fromOwnerId: extra.fromOwnerId ?? null, toOwnerId: extra.toOwnerId ?? null, details: extra.details ?? {} });
  await recordAdminAudit({ actorId: actor.id, actorEmail: actor.email ?? "unknown", action: `collaboration.${action}`, resource: "collaborations", targetId: postId ?? undefined, details: { reason, ...extra.details } });
}

export type AdminListFilters = { q?: string; status?: string; category?: string; creator?: string; review?: string; page?: number };

export async function adminListPosts(f: AdminListFilters) {
  const where: SQL[] = [];
  if (f.status && (COLLAB_STATUSES as readonly string[]).includes(f.status)) where.push(eq(collabPosts.status, f.status as CollabStatus));
  if (f.category && (COLLAB_CATEGORIES as readonly string[]).includes(f.category)) where.push(eq(collabPosts.category, f.category as (typeof COLLAB_CATEGORIES)[number]));
  if (f.creator) where.push(eq(collabPosts.creatorType, f.creator as never));
  if (f.review === "1") where.push(eq(collabPosts.needsOwnerReview, true));
  if (f.q) where.push(ilike(collabPosts.title, `%${f.q.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`));
  const page = Math.max(1, f.page ?? 1);
  const owner = alias(users, "owner");
  const clause = where.length ? and(...where) : undefined;
  const openReports = db.select({ postId: collabReports.postId, n: count().as("n") }).from(collabReports).where(eq(collabReports.status, "open")).groupBy(collabReports.postId).as("open_reports");
  const [rows, [total]] = await Promise.all([
    db
      .select({ post: collabPosts, members: memberCountSql, ownerName: owner.name, ownerEmail: owner.email, reports: openReports.n })
      .from(collabPosts)
      .leftJoin(owner, eq(owner.id, collabPosts.ownerId))
      .leftJoin(openReports, eq(openReports.postId, collabPosts.id))
      .where(clause)
      .orderBy(desc(collabPosts.updatedAt))
      .limit(50)
      .offset((page - 1) * 50),
    db.select({ n: count() }).from(collabPosts).where(clause),
  ]);
  return { rows, total: total.n, page };
}

export async function adminPostDetail(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const owner = alias(users, "owner");
  const [row] = await db.select({ post: collabPosts, members: memberCountSql, ownerName: owner.name, ownerEmail: owner.email, ownerDeleted: owner.deletedAt }).from(collabPosts).leftJoin(owner, eq(owner.id, collabPosts.ownerId)).where(eq(collabPosts.id, id));
  if (!row) return null;
  const reporter = alias(users, "reporter");
  const [members, history, reports, apps] = await Promise.all([
    db.select({ id: collabMembers.id, userId: collabMembers.userId, name: users.name, email: users.email, kind: collabMembers.kind, role: collabMembers.role, status: collabMembers.status, joinedAt: collabMembers.joinedAt }).from(collabMembers).innerJoin(users, eq(users.id, collabMembers.userId)).where(eq(collabMembers.postId, id)).orderBy(collabMembers.joinedAt),
    db.select().from(collabModerationActions).where(eq(collabModerationActions.postId, id)).orderBy(desc(collabModerationActions.createdAt)).limit(100),
    db.select({ report: collabReports, reporterEmail: reporter.email }).from(collabReports).leftJoin(reporter, eq(reporter.id, collabReports.reporterId)).where(eq(collabReports.postId, id)).orderBy(desc(collabReports.createdAt)).limit(100),
    db.select({ status: collabApplications.status, n: count() }).from(collabApplications).where(eq(collabApplications.postId, id)).groupBy(collabApplications.status),
  ]);
  return { ...row, members, history, reports, applications: Object.fromEntries(apps.map((a) => [a.status, a.n])) };
}

export async function adminOpenReports() {
  const reporter = alias(users, "reporter");
  return db
    .select({ report: collabReports, reporterEmail: reporter.email, postTitle: collabPosts.title, postStatus: collabPosts.status })
    .from(collabReports)
    .leftJoin(reporter, eq(reporter.id, collabReports.reporterId))
    .leftJoin(collabPosts, eq(collabPosts.id, collabReports.postId))
    .where(eq(collabReports.status, "open"))
    .orderBy(desc(collabReports.createdAt))
    .limit(100);
}

/** A reported message or thread, for the investigating moderator (with the access that permission implies). */
export async function adminReportContext(reportId: string) {
  const [r] = await db.select().from(collabReports).where(eq(collabReports.id, reportId));
  if (!r) return null;
  let threadId: string | null = r.targetType === "thread" ? r.targetId : null;
  if (r.targetType === "message") {
    const [m] = await db.select({ threadId: collabMessages.threadId }).from(collabMessages).where(eq(collabMessages.id, r.targetId));
    threadId = m?.threadId ?? null;
  }
  if (!threadId) return { report: r, messages: [] };
  const messages = await db
    .select({ id: collabMessages.id, body: collabMessages.body, senderEmail: users.email, hiddenAt: collabMessages.hiddenAt, createdAt: collabMessages.createdAt })
    .from(collabMessages)
    .leftJoin(users, eq(users.id, collabMessages.senderId))
    .where(eq(collabMessages.threadId, threadId))
    .orderBy(desc(collabMessages.createdAt))
    .limit(50);
  return { report: r, messages: messages.reverse() };
}

async function participants(postId: string) {
  const rows = await db.select({ userId: collabMembers.userId }).from(collabMembers).where(and(eq(collabMembers.postId, postId), eq(collabMembers.status, "active")));
  return rows.map((r) => r.userId);
}

export async function suspendPost(actor: User, postId: string, reason: string): Promise<ModResult> {
  const [p] = await db.select().from(collabPosts).where(eq(collabPosts.id, postId));
  if (!p) return { ok: false, error: "Collaboration not found." };
  if (p.status === "suspended") return { ok: false, error: "Already suspended." };
  const done = await db.update(collabPosts).set({ status: "suspended", statusBeforeSuspension: p.status, updatedAt: new Date() }).where(and(eq(collabPosts.id, postId), eq(collabPosts.status, p.status))).returning({ id: collabPosts.id });
  if (!done.length) return { ok: false, error: "The collaboration changed meanwhile. Reload and try again." };
  await record(actor, "suspend", postId, reason, { details: { from: p.status } });
  if (p.ownerId) await notify([{ userId: p.ownerId, kind: "post_suspended", postId, title: `“${p.title}” was suspended by moderators`, body: "It's hidden from everyone else. Contact support if you think this is a mistake.", href: postHref(postId) }]);
  return { ok: true };
}

/** Removal: suspended for good (it can't be restored), with all history kept for investigation. */
export async function removePost(actor: User, postId: string, reason: string): Promise<ModResult> {
  const [p] = await db.select().from(collabPosts).where(eq(collabPosts.id, postId));
  if (!p) return { ok: false, error: "Collaboration not found." };
  await db.batch([
    db.update(collabPosts).set({ status: "suspended", statusBeforeSuspension: null, updatedAt: new Date() }).where(eq(collabPosts.id, postId)),
    db.update(collabApplications).set({ status: "rejected", decidedAt: new Date() }).where(and(eq(collabApplications.postId, postId), eq(collabApplications.status, "pending"))),
    db.update(collabThreads).set({ lockedAt: new Date() }).where(and(eq(collabThreads.postId, postId), isNull(collabThreads.lockedAt))),
  ] as never);
  await record(actor, "remove", postId, reason, { details: { from: p.status } });
  const people = await participants(postId);
  await notify(people.map((userId) => ({ userId, kind: "post_removed", postId, title: `“${p.title}” was removed by moderators`, body: "Its conversation is now read-only." })));
  return { ok: true };
}

export async function restorePost(actor: User, postId: string, reason: string): Promise<ModResult> {
  const [p] = await db.select().from(collabPosts).where(eq(collabPosts.id, postId));
  if (!p || p.status !== "suspended") return { ok: false, error: "Only suspended collaborations can be restored." };
  if (!p.statusBeforeSuspension) return { ok: false, error: "This collaboration was removed and can't be restored." };
  await db.update(collabPosts).set({ status: p.statusBeforeSuspension, statusBeforeSuspension: null, updatedAt: new Date() }).where(and(eq(collabPosts.id, postId), eq(collabPosts.status, "suspended")));
  await record(actor, "restore", postId, reason, { details: { to: p.statusBeforeSuspension } });
  if (p.ownerId) await notify([{ userId: p.ownerId, kind: "post_restored", postId, title: `“${p.title}” was restored`, href: postHref(postId) }]);
  return { ok: true };
}

export async function resolveReport(actor: User, reportId: string, outcome: "actioned" | "dismissed", note: string): Promise<ModResult> {
  const done = await db.update(collabReports).set({ status: outcome, resolution: note, resolvedBy: actor.id, resolvedAt: new Date() }).where(and(eq(collabReports.id, reportId), eq(collabReports.status, "open"))).returning({ postId: collabReports.postId });
  if (!done.length) return { ok: false, error: "This report was already resolved." };
  await record(actor, `report_${outcome}`, done[0].postId, note, { details: { reportId } });
  return { ok: true };
}

export async function hideMessage(actor: User, messageId: string, reason: string): Promise<ModResult> {
  const [m] = await db.select({ threadId: collabMessages.threadId, postId: collabThreads.postId }).from(collabMessages).innerJoin(collabThreads, eq(collabThreads.id, collabMessages.threadId)).where(eq(collabMessages.id, messageId));
  if (!m) return { ok: false, error: "Message not found." };
  await db.update(collabMessages).set({ hiddenAt: new Date(), hiddenBy: actor.id }).where(eq(collabMessages.id, messageId));
  await record(actor, "hide_message", m.postId, reason, { details: { messageId } });
  return { ok: true };
}

/**
 * Ownership transfer after an administrator has verified the situation. The successor must be an active member
 * of the team (someone already trusted with it). The old owner's membership ends, the successor's becomes the
 * owner's, the creator label is recomputed for the successor, and everyone on the team is told.
 */
export async function transferOwnership(actor: User, postId: string, successorMemberId: string, reason: string): Promise<ModResult> {
  const [p] = await db.select().from(collabPosts).where(eq(collabPosts.id, postId));
  if (!p) return { ok: false, error: "Collaboration not found." };
  const [m] = await db.select({ userId: collabMembers.userId }).from(collabMembers).where(and(eq(collabMembers.id, successorMemberId), eq(collabMembers.postId, postId), eq(collabMembers.kind, "member"), eq(collabMembers.status, "active")));
  if (!m) return { ok: false, error: "The successor must be an active member of this team." };
  const [successor] = await db.select().from(users).where(eq(users.id, m.userId));
  if (!successor || successor.deletedAt) return { ok: false, error: "The successor's account isn't active." };
  const [verification] = await db.select({ kind: collabCreatorVerifications.kind }).from(collabCreatorVerifications).where(and(eq(collabCreatorVerifications.userId, successor.id), isNull(collabCreatorVerifications.revokedAt)));
  const creatorType = creatorTypeFor({ isOperator: false, verification: verification?.kind ?? null, persona: successor.role });
  const now = new Date();
  await db.batch([
    db.update(collabPosts).set({ ownerId: successor.id, creatorType, needsOwnerReview: false, ownerReviewReason: null, ownerActiveAt: now, updatedAt: now }).where(eq(collabPosts.id, postId)),
    db.update(collabMembers).set({ status: "removed", endedAt: now, endedBy: actor.id }).where(and(eq(collabMembers.postId, postId), eq(collabMembers.kind, "owner"), eq(collabMembers.status, "active"))),
    db.update(collabMembers).set({ kind: "owner" }).where(and(eq(collabMembers.postId, postId), eq(collabMembers.userId, successor.id), eq(collabMembers.status, "active"))),
  ] as never);
  await record(actor, "transfer_ownership", postId, reason, { fromOwnerId: p.ownerId, toOwnerId: successor.id });
  const people = await participants(postId);
  await notify([
    ...people.map((userId) => ({ userId, kind: "owner_changed", postId, title: userId === successor.id ? `You now own “${p.title}”` : `“${p.title}” has a new owner`, body: "An administrator transferred ownership after review.", href: postHref(postId) })),
    ...(p.ownerId ? [{ userId: p.ownerId, kind: "owner_changed", postId, title: `Ownership of “${p.title}” was transferred`, body: "An administrator transferred it after review." }] : []),
  ]);
  return { ok: true };
}

export async function clearOwnerReview(actor: User, postId: string, reason: string): Promise<ModResult> {
  const done = await db.update(collabPosts).set({ needsOwnerReview: false, ownerReviewReason: null, ownerActiveAt: new Date() }).where(and(eq(collabPosts.id, postId), eq(collabPosts.needsOwnerReview, true))).returning({ id: collabPosts.id });
  if (!done.length) return { ok: false, error: "This collaboration isn't flagged." };
  await record(actor, "clear_owner_review", postId, reason);
  return { ok: true };
}

export async function listVerifications() {
  return db
    .select({ userId: collabCreatorVerifications.userId, kind: collabCreatorVerifications.kind, note: collabCreatorVerifications.note, verifiedAt: collabCreatorVerifications.verifiedAt, revokedAt: collabCreatorVerifications.revokedAt, name: users.name, email: users.email })
    .from(collabCreatorVerifications)
    .innerJoin(users, eq(users.id, collabCreatorVerifications.userId))
    .orderBy(desc(collabCreatorVerifications.verifiedAt))
    .limit(200);
}

/** Grants faculty/alumni publishing status to an existing account, found by email. Applies to their future posts and labels. */
export async function verifyCreator(actor: User, email: string, kind: "faculty" | "alumni", note: string): Promise<ModResult> {
  const [u] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
  if (!u || u.deletedAt) return { ok: false, error: "No active account has that email." };
  await db
    .insert(collabCreatorVerifications)
    .values({ userId: u.id, kind, note, verifiedBy: actor.id })
    .onConflictDoUpdate({ target: collabCreatorVerifications.userId, set: { kind, note, verifiedBy: actor.id, verifiedAt: new Date(), revokedAt: null } });
  // Their open posts take the verified label too.
  await db.update(collabPosts).set({ creatorType: kind }).where(and(eq(collabPosts.ownerId, u.id), inArray(collabPosts.creatorType, ["student", "community"])));
  await record(actor, "verify_creator", null, note, { details: { userId: u.id, kind } });
  return { ok: true };
}

export async function revokeCreator(actor: User, userId: string, reason: string): Promise<ModResult> {
  const done = await db.update(collabCreatorVerifications).set({ revokedAt: new Date() }).where(and(eq(collabCreatorVerifications.userId, userId), isNull(collabCreatorVerifications.revokedAt))).returning({ userId: collabCreatorVerifications.userId });
  if (!done.length) return { ok: false, error: "No active verification for this account." };
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (u) await db.update(collabPosts).set({ creatorType: creatorTypeFor({ isOperator: false, verification: null, persona: u.role }) }).where(and(eq(collabPosts.ownerId, userId), inArray(collabPosts.creatorType, ["faculty", "alumni"])));
  await record(actor, "revoke_creator", null, reason, { details: { userId } });
  return { ok: true };
}
