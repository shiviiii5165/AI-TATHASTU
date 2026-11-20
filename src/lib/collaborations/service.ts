import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  collabApplications,
  collabBlocks,
  collabCreatorVerifications,
  collabMembers,
  collabMessages,
  collabNotifications,
  collabPosts,
  collabReads,
  collabReports,
  collabThreads,
  type CollabPost,
  type CollabStatus,
  users,
  type User,
} from "@/db/schema";
import { getAdminContext } from "@/lib/admin/rbac";
import { hitRateLimit } from "@/lib/rate-limit";

import { publicPost, type PublicPost } from "./public";
import { canRenew, creatorTypeFor, DISCOVERABLE, isOwnerAction, nextStatus, PUBLICLY_VISIBLE, type OwnerAction } from "./rules";
import { applicationInput, contentHash, enquiryInput, fieldErrors, looksLikeSpam, messageInput, postInput, publishProblems, reportInput, type ListQuery } from "./validation";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; status: 400 | 401 | 403 | 404 | 409 | 429; error: string; fields?: Record<string, string> };

const fail = (status: 400 | 401 | 403 | 404 | 409 | 429, error: string, fields?: Record<string, string>) => ({ ok: false as const, status, error, fields });
const NOT_FOUND = fail(404, "This collaboration doesn't exist or isn't available.");
const today = () => new Date().toISOString().slice(0, 10);
const jsonText = (v: unknown) => JSON.stringify(v ?? []);
const textArray = (list: string[]) => sql`(select coalesce(array_agg(x), '{}'::text[]) from jsonb_array_elements_text(${jsonText(list)}::jsonb) as x)`;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/** Active non-owner members of a post: the only source of team size. */
// Qualified by hand: Drizzle renders a single-table select's columns unqualified, and a bare "id" here would bind
// to the subquery's own collab_members.id.
export const memberCountSql = sql<number>`(select count(*)::int from collab_members m where m.post_id = "collab_posts"."id" and m.kind = 'member' and m.status = 'active')`;

async function limited(key: string, limit: number, windowSeconds: number) {
  const r = await hitRateLimit(key, { limit, windowSeconds });
  return r.ok ? null : fail(429, "You're doing that too often. Please wait a little and try again.");
}

export async function notify(rows: { userId: string; kind: string; postId?: string | null; title: string; body?: string; href?: string }[]) {
  const unique = rows.filter((r, i) => r.userId && rows.findIndex((o) => o.userId === r.userId) === i);
  if (!unique.length) return;
  try {
    await db.insert(collabNotifications).values(unique.map((r) => ({ userId: r.userId, kind: r.kind, postId: r.postId ?? null, title: r.title.slice(0, 160), body: (r.body ?? "").slice(0, 300), href: r.href ?? null })));
  } catch (err) {
    // A notification failure must never undo or block the action it reports.
    console.error("[collaborations] notification failed:", err instanceof Error ? err.name : err);
  }
}

const postHref = (id: string) => `/opportunities?cat=collaborations&post=${id}`;

async function loadPost(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select({ post: collabPosts, members: memberCountSql }).from(collabPosts).where(eq(collabPosts.id, id));
  return row ?? null;
}

async function ownerNames(ids: (string | null)[]) {
  const list = Array.from(new Set(ids.filter((v): v is string => !!v)));
  if (!list.length) return new Map<string, string | null>();
  const rows = await db.select({ id: users.id, name: users.name, deletedAt: users.deletedAt }).from(users).where(inArray(users.id, list));
  return new Map(rows.map((r) => [r.id, r.deletedAt ? null : r.name]));
}

// ─── Discover (public) ──────────────────────────────────────────────────────

export const PAGE_SIZE = 12;

export async function listPublic(q: ListQuery): Promise<{ items: PublicPost[]; page: number; hasMore: boolean }> {
  const where: SQL[] = [inArray(collabPosts.status, [...DISCOVERABLE])];
  if (q.category) where.push(eq(collabPosts.category, q.category));
  if (q.creator) where.push(eq(collabPosts.creatorType, q.creator));
  if (q.mode) where.push(eq(collabPosts.mode, q.mode));
  if (q.stage) where.push(eq(collabPosts.stage, q.stage));
  if (q.skill) where.push(sql`${collabPosts.skills} @> ${textArray([q.skill.toLowerCase()])}`);
  if (q.open) where.push(and(eq(collabPosts.status, "recruiting"), sql`${memberCountSql} < ${collabPosts.capacity}`)!);
  if (q.q) {
    const like = `%${q.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    where.push(or(sql`${collabPosts.search} @@ plainto_tsquery('simple', ${q.q})`, sql`${collabPosts.title} ilike ${like}`)!);
  }
  const order =
    q.sort === "deadline"
      ? [sql`${collabPosts.deadline} asc nulls last`, desc(collabPosts.publishedAt)]
      : q.sort === "open"
        ? [sql`(${collabPosts.capacity} - ${memberCountSql}) desc`, desc(collabPosts.publishedAt)]
        : [desc(collabPosts.publishedAt), desc(collabPosts.id)];
  const rows = await db
    .select({ post: collabPosts, members: memberCountSql })
    .from(collabPosts)
    .where(and(...where))
    .orderBy(...order)
    .limit(PAGE_SIZE + 1)
    .offset((q.page - 1) * PAGE_SIZE);
  const names = await ownerNames(rows.map((r) => r.post.ownerId));
  return {
    items: rows.slice(0, PAGE_SIZE).map((r) => publicPost(r.post, r.members, r.post.ownerId ? names.get(r.post.ownerId) ?? null : null)),
    page: q.page,
    hasMore: rows.length > PAGE_SIZE,
  };
}

export type Viewer = {
  isOwner: boolean;
  membership: "owner" | "member" | null;
  application: { id: string; status: string } | null;
  enquiryThreadId: string | null;
  teamThreadId: string | null;
  canApply: boolean;
  blocked: boolean;
};

/** One post for anyone: public fields, plus the viewer's own relationship to it when signed in. Drafts and suspended posts are visible only to their owner. */
export async function getPostForViewer(id: string, viewerId: string | null): Promise<Result<{ post: PublicPost; viewer: Viewer | null; ownerView: { problems: Record<string, string> } | null }>> {
  const row = await loadPost(id);
  if (!row) return NOT_FOUND;
  const isOwner = !!viewerId && row.post.ownerId === viewerId;
  if (!isOwner && !PUBLICLY_VISIBLE.includes(row.post.status)) return NOT_FOUND;
  const names = await ownerNames([row.post.ownerId]);
  const post = publicPost(row.post, row.members, row.post.ownerId ? names.get(row.post.ownerId) ?? null : null, { includeStatusNote: isOwner });
  if (!viewerId) return { ok: true, post, viewer: null, ownerView: null };

  const [[member], [app], [enquiry], [team], [block]] = await Promise.all([
    db.select({ kind: collabMembers.kind }).from(collabMembers).where(and(eq(collabMembers.postId, id), eq(collabMembers.userId, viewerId), eq(collabMembers.status, "active"))),
    db.select({ id: collabApplications.id, status: collabApplications.status }).from(collabApplications).where(and(eq(collabApplications.postId, id), eq(collabApplications.applicantId, viewerId))).orderBy(desc(collabApplications.createdAt)).limit(1),
    db.select({ id: collabThreads.id }).from(collabThreads).where(and(eq(collabThreads.postId, id), eq(collabThreads.kind, "enquiry"), eq(collabThreads.enquirerId, viewerId))),
    db.select({ id: collabThreads.id }).from(collabThreads).where(and(eq(collabThreads.postId, id), eq(collabThreads.kind, "team"))),
    row.post.ownerId ? db.select({ x: collabBlocks.ownerId }).from(collabBlocks).where(and(eq(collabBlocks.ownerId, row.post.ownerId), eq(collabBlocks.blockedId, viewerId))) : Promise.resolve([]),
  ]);
  const membership = isOwner ? "owner" : member ? member.kind : null;
  const canApply = !isOwner && !membership && !block && app?.status !== "pending" && row.post.status === "recruiting" && row.members < row.post.capacity && (!row.post.deadline || row.post.deadline >= today());
  return {
    ok: true,
    post,
    viewer: {
      isOwner,
      membership,
      application: app ?? null,
      enquiryThreadId: enquiry?.id ?? null,
      teamThreadId: membership ? team?.id ?? null : null,
      canApply,
      blocked: !!block,
    },
    ownerView: isOwner ? { problems: publishProblems(row.post, today()) } : null,
  };
}

/** The editable fields of one's own post (the form needs them all). */
export async function getOwnPostForEdit(user: User, id: string): Promise<Result<{ post: CollabPost }>> {
  const row = await loadPost(id);
  if (!row || row.post.ownerId !== user.id) return NOT_FOUND;
  return { ok: true, post: row.post };
}

// ─── Create, edit, lifecycle (owner) ────────────────────────────────────────

const OPEN_STATUSES: CollabStatus[] = ["draft", "recruiting", "paused", "team_full", "in_progress"];
const MAX_OPEN_POSTS = 10;

async function creatorType(user: User) {
  const [verification] = await db
    .select({ kind: collabCreatorVerifications.kind })
    .from(collabCreatorVerifications)
    .where(and(eq(collabCreatorVerifications.userId, user.id), isNull(collabCreatorVerifications.revokedAt)));
  const operator = await getAdminContext(user).catch(() => null);
  return creatorTypeFor({ isOperator: !!operator, verification: verification?.kind ?? null, persona: user.role });
}

export async function createPost(user: User, body: unknown, publish: boolean): Promise<Result<{ id: string; status: CollabStatus }>> {
  const parsed = postInput.safeParse(body);
  if (!parsed.success) return fail(400, "Please fix the highlighted fields.", fieldErrors(parsed.error));
  const v = parsed.data;
  if (publish) {
    const problems = publishProblems(v, today());
    if (Object.keys(problems).length) return fail(400, "Please fix the highlighted fields.", problems);
  }
  if (looksLikeSpam(v.title, v.summary, v.problem, v.objectives)) return fail(400, "This looks like spam. Remove repeated text or extra links and try again.");
  const tooMany = await limited(`collab:create:${user.id}`, 10, 86_400);
  if (tooMany) return tooMany;

  const hash = contentHash(v);
  const [[open], [dupe]] = await Promise.all([
    db.select({ n: count() }).from(collabPosts).where(and(eq(collabPosts.ownerId, user.id), inArray(collabPosts.status, OPEN_STATUSES))),
    db.select({ id: collabPosts.id }).from(collabPosts).where(and(eq(collabPosts.ownerId, user.id), eq(collabPosts.contentHash, hash), inArray(collabPosts.status, OPEN_STATUSES))).limit(1),
  ]);
  if (dupe) return fail(409, "You already have a collaboration with this title and description. Edit that one instead.");
  if (open.n >= MAX_OPEN_POSTS) return fail(409, `You can have at most ${MAX_OPEN_POSTS} open collaborations. Close or complete one first.`);

  const now = new Date();
  const status: CollabStatus = publish ? "recruiting" : "draft";
  const [row] = await db
    .insert(collabPosts)
    .values({
      ownerId: user.id,
      creatorType: await creatorType(user),
      category: v.category,
      status,
      title: v.title,
      summary: v.summary,
      problem: v.problem,
      objectives: v.objectives,
      outcome: v.outcome,
      stage: v.stage,
      roles: v.roles,
      skills: v.skills,
      capacity: v.capacity,
      experience: v.experience,
      commitment: v.commitment,
      duration: v.duration,
      mode: v.mode,
      location: v.location,
      startDate: v.startDate,
      deadline: v.deadline,
      links: v.links,
      details: v.details,
      contentHash: hash,
      publishedAt: publish ? now : null,
      ownerActiveAt: now,
    })
    .returning({ id: collabPosts.id, status: collabPosts.status });
  return { ok: true, id: row.id, status: row.status };
}

export async function updatePost(user: User, id: string, body: unknown): Promise<Result<{ id: string }>> {
  const row = await loadPost(id);
  if (!row || row.post.ownerId !== user.id) return NOT_FOUND;
  if (row.post.status === "suspended") return fail(409, "This collaboration is suspended by moderators and can't be edited.");
  const parsed = postInput.safeParse(body);
  if (!parsed.success) return fail(400, "Please fix the highlighted fields.", fieldErrors(parsed.error));
  const v = parsed.data;
  if (v.capacity < row.members) return fail(400, "Please fix the highlighted fields.", { roles: `You already have ${row.members} members. Keep at least that many positions.` });
  if (row.post.status !== "draft") {
    const problems = publishProblems(v, today());
    if (Object.keys(problems).length) return fail(400, "Please fix the highlighted fields.", problems);
  }
  if (looksLikeSpam(v.title, v.summary, v.problem, v.objectives)) return fail(400, "This looks like spam. Remove repeated text or extra links and try again.");
  const tooMany = await limited(`collab:edit:${user.id}`, 60, 3600);
  if (tooMany) return tooMany;

  // A post filled to its new capacity becomes a full team; one with room again starts recruiting.
  const status = row.post.status === "recruiting" && row.members >= v.capacity ? "team_full" : row.post.status === "team_full" && row.members < v.capacity ? "recruiting" : row.post.status;
  const updated = await db
    .update(collabPosts)
    .set({
      category: v.category,
      title: v.title,
      summary: v.summary,
      problem: v.problem,
      objectives: v.objectives,
      outcome: v.outcome,
      stage: v.stage,
      roles: v.roles,
      skills: v.skills,
      capacity: v.capacity,
      experience: v.experience,
      commitment: v.commitment,
      duration: v.duration,
      mode: v.mode,
      location: v.location,
      startDate: v.startDate,
      deadline: v.deadline,
      links: v.links,
      details: v.details,
      contentHash: contentHash(v),
      status,
      updatedAt: new Date(),
      ownerActiveAt: new Date(),
    })
    // Owner and status re-checked in the write itself: a moderator's suspension can't be overwritten by a racing edit.
    .where(and(eq(collabPosts.id, id), eq(collabPosts.ownerId, user.id), eq(collabPosts.status, row.post.status)))
    .returning({ id: collabPosts.id });
  if (!updated.length) return fail(409, "This collaboration changed while you were editing. Reload and try again.");
  return { ok: true, id };
}

export async function deleteDraft(user: User, id: string): Promise<Result> {
  const gone = await db.delete(collabPosts).where(and(eq(collabPosts.id, id), eq(collabPosts.ownerId, user.id), eq(collabPosts.status, "draft"))).returning({ id: collabPosts.id });
  return gone.length ? { ok: true } : fail(404, "Only your own drafts can be deleted. Close a published collaboration instead.");
}

export async function changeStatus(user: User, id: string, action: unknown): Promise<Result<{ status: CollabStatus }>> {
  if (!isOwnerAction(action)) return fail(400, "Unknown action.");
  const row = await loadPost(id);
  if (!row || row.post.ownerId !== user.id) return NOT_FOUND;
  const p = row.post;
  if (p.status === "suspended") return fail(409, "This collaboration is suspended by moderators.");
  const to = nextStatus(p.status, action, row.members, p.capacity);
  if (!to) return fail(409, `You can't ${action} a collaboration that is ${p.status.replace("_", " ")}.`);
  if (action === "publish" || action === "reopen") {
    const problems = publishProblems(p, today());
    if (Object.keys(problems).length) return fail(400, "Update the collaboration before publishing.", problems);
  }
  if (action === "renew" && !canRenew(p, today())) return fail(409, "The application deadline has passed. Edit the deadline, then renew.");
  if (action === "publish") {
    const [dupe] = await db.select({ id: collabPosts.id }).from(collabPosts).where(and(eq(collabPosts.ownerId, user.id), eq(collabPosts.contentHash, p.contentHash ?? ""), ne(collabPosts.id, id), inArray(collabPosts.status, ["recruiting", "paused", "team_full", "in_progress"]))).limit(1);
    if (dupe) return fail(409, "You already have a published collaboration with this title and description.");
  }

  const now = new Date();
  const restartClock = action === "publish" || action === "renew" || action === "reopen" || action === "resume";
  const updated = await db
    .update(collabPosts)
    .set({
      status: to,
      updatedAt: now,
      ownerActiveAt: now,
      ...(action === "publish" ? { publishedAt: now } : {}),
      ...(restartClock ? { renewedAt: now, reminderStage: 0, expiredAt: null } : {}),
    })
    .where(and(eq(collabPosts.id, id), eq(collabPosts.ownerId, user.id), eq(collabPosts.status, p.status)))
    .returning({ status: collabPosts.status });
  if (!updated.length) return fail(409, "This collaboration changed meanwhile. Reload and try again.");

  // A closed or completed collaboration answers its pending applicants instead of leaving them waiting.
  if (to === "closed" || to === "completed") {
    const answered = await db
      .update(collabApplications)
      .set({ status: "rejected", decidedAt: now, decidedBy: user.id })
      .where(and(eq(collabApplications.postId, id), eq(collabApplications.status, "pending")))
      .returning({ applicantId: collabApplications.applicantId });
    const members = await db.select({ userId: collabMembers.userId }).from(collabMembers).where(and(eq(collabMembers.postId, id), eq(collabMembers.kind, "member"), eq(collabMembers.status, "active")));
    await notify([
      ...answered.map((a) => ({ userId: a.applicantId, kind: "application_closed", postId: id, title: `“${p.title}” is no longer recruiting`, body: "Your pending request was closed.", href: postHref(id) })),
      ...members.map((m) => ({ userId: m.userId, kind: `post_${to}`, postId: id, title: `“${p.title}” was marked ${to}`, href: postHref(id) })),
    ]);
  }
  return { ok: true, status: to };
}

// ─── Applications and team ──────────────────────────────────────────────────

const APPLY_ERRORS: Record<string, [400 | 403 | 404 | 409, string]> = {
  not_found: [404, NOT_FOUND.error],
  own_post: [409, "You can't apply to your own collaboration."],
  not_recruiting: [409, "This collaboration isn't accepting applications."],
  deadline_passed: [409, "The application deadline has passed."],
  blocked: [403, "You can't apply to this collaboration."],
  already_member: [409, "You're already on this team."],
  duplicate: [409, "You already have a pending request for this collaboration."],
  full: [409, "This team is full."],
};

export async function apply(user: User, postId: string, body: unknown): Promise<Result<{ id: string }>> {
  const parsed = applicationInput.safeParse(body);
  if (!parsed.success) return fail(400, "Please fix the highlighted fields.", fieldErrors(parsed.error));
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return NOT_FOUND;
  const v = parsed.data;
  if (looksLikeSpam(v.intro, v.motivation)) return fail(400, "This looks like spam. Remove repeated text or extra links and try again.");
  const tooMany = await limited(`collab:apply:${user.id}`, 20, 86_400);
  if (tooMany) return tooMany;

  const { rows } = await db.execute(
    sql`select collab_apply(${postId}::uuid, ${user.id}::uuid, ${v.role}, ${v.intro}, ${textArray(v.skills)}, ${v.motivation}, ${jsonText(v.links)}::jsonb) as r`,
  );
  const r = String((rows[0] as { r: string }).r);
  if (r.startsWith("!")) {
    const [status, error] = APPLY_ERRORS[r.slice(1)] ?? [409, "This request couldn't be sent."];
    return fail(status, error);
  }
  const [post] = await db.select({ ownerId: collabPosts.ownerId, title: collabPosts.title }).from(collabPosts).where(eq(collabPosts.id, postId));
  if (post?.ownerId) await notify([{ userId: post.ownerId, kind: "application_received", postId, title: `New request to join “${post.title}”`, body: `${user.name || "A member"} would like to join${v.role ? ` as ${v.role}` : ""}.`, href: "/opportunities?cat=collaborations&view=requests" }]);
  return { ok: true, id: r };
}

export async function decide(user: User, applicationId: string, accept: boolean): Promise<Result<{ status: "accepted" | "rejected" }>> {
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return NOT_FOUND;
  const tooMany = await limited(`collab:decide:${user.id}`, 120, 3600);
  if (tooMany) return tooMany;
  const { rows } = await db.execute(sql`select collab_decide_application(${applicationId}::uuid, ${user.id}::uuid, ${accept}) as r`);
  const r = String((rows[0] as { r: string }).r);
  const errors: Record<string, [404 | 409, string]> = {
    "!not_found": [404, "This request doesn't exist."],
    "!forbidden": [404, "This request doesn't exist."], // never confirm someone else's request exists
    "!not_pending": [409, "This request was already answered or withdrawn."],
    "!not_recruiting": [409, "This collaboration isn't recruiting, so new members can't be added."],
    "!full": [409, "Your team is already full. Increase the positions or remove a member first."],
  };
  if (errors[r]) return fail(...errors[r]);
  const [app] = await db
    .select({ applicantId: collabApplications.applicantId, postId: collabApplications.postId, title: collabPosts.title })
    .from(collabApplications)
    .innerJoin(collabPosts, eq(collabPosts.id, collabApplications.postId))
    .where(eq(collabApplications.id, applicationId));
  if (app) {
    await notify([
      r === "accepted"
        ? { userId: app.applicantId, kind: "application_accepted", postId: app.postId, title: `You're on the team for “${app.title}”`, body: "Your team conversation is open in Inbox.", href: "/opportunities?cat=collaborations&view=inbox" }
        : { userId: app.applicantId, kind: "application_rejected", postId: app.postId, title: `Update on “${app.title}”`, body: "The owner didn't accept your request this time.", href: "/opportunities?cat=collaborations&view=requests" },
    ]);
  }
  return { ok: true, status: r as "accepted" | "rejected" };
}

export async function withdraw(user: User, applicationId: string): Promise<Result> {
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return NOT_FOUND;
  const done = await db
    .update(collabApplications)
    .set({ status: "withdrawn", decidedAt: new Date(), decidedBy: user.id })
    .where(and(eq(collabApplications.id, applicationId), eq(collabApplications.applicantId, user.id), eq(collabApplications.status, "pending")))
    .returning({ id: collabApplications.id });
  return done.length ? { ok: true } : fail(409, "Only your own pending requests can be withdrawn.");
}

/** Leaving (member = the user) or removing a member (by the owner), identified by membership id so user ids stay private. */
export async function endMembership(user: User, postId: string, memberId: string | null): Promise<Result<{ status: "left" | "removed" }>> {
  if (!/^[0-9a-f-]{36}$/i.test(postId) || (memberId && !/^[0-9a-f-]{36}$/i.test(memberId))) return NOT_FOUND;
  let memberUserId = user.id;
  if (memberId) {
    const [m] = await db.select({ userId: collabMembers.userId }).from(collabMembers).where(and(eq(collabMembers.id, memberId), eq(collabMembers.postId, postId)));
    if (!m) return NOT_FOUND;
    memberUserId = m.userId;
  }
  const { rows } = await db.execute(sql`select collab_end_membership(${postId}::uuid, ${memberUserId}::uuid, ${user.id}::uuid) as r`);
  const r = String((rows[0] as { r: string }).r);
  if (r === "!forbidden" || r === "!not_found") return fail(404, "That membership doesn't exist.");
  const [post] = await db.select({ ownerId: collabPosts.ownerId, title: collabPosts.title }).from(collabPosts).where(eq(collabPosts.id, postId));
  if (post) {
    await notify([
      r === "left"
        ? { userId: post.ownerId ?? "", kind: "member_left", postId, title: `A member left “${post.title}”`, body: `${user.name || "A member"} left the team.`, href: postHref(postId) }
        : { userId: memberUserId, kind: "member_removed", postId, title: `You're no longer on “${post.title}”`, body: "The owner removed you from the team.", href: "/opportunities?cat=collaborations&view=mine" },
    ]);
  }
  return { ok: true, status: r as "left" | "removed" };
}

/** Team roster: for active members and the owner only. Names and roles; never emails. */
export async function listMembers(user: User, postId: string): Promise<Result<{ members: { id: string; name: string; role: string | null; kind: string; joinedAt: string; isYou: boolean }[] }>> {
  const row = await loadPost(postId);
  if (!row) return NOT_FOUND;
  const isOwner = row.post.ownerId === user.id;
  const [mine] = await db.select({ id: collabMembers.id }).from(collabMembers).where(and(eq(collabMembers.postId, postId), eq(collabMembers.userId, user.id), eq(collabMembers.status, "active")));
  if (!isOwner && !mine) return NOT_FOUND;
  const rows = await db
    .select({ id: collabMembers.id, userId: collabMembers.userId, name: users.name, role: collabMembers.role, kind: collabMembers.kind, joinedAt: collabMembers.joinedAt })
    .from(collabMembers)
    .innerJoin(users, eq(users.id, collabMembers.userId))
    .where(and(eq(collabMembers.postId, postId), eq(collabMembers.status, "active")))
    .orderBy(asc(collabMembers.joinedAt));
  return { ok: true, members: rows.map((m) => ({ id: m.id, name: m.name || "AI Tathastu member", role: m.role, kind: m.kind, joinedAt: m.joinedAt.toISOString(), isYou: m.userId === user.id })) };
}

// ─── My Collaborations and Requests ─────────────────────────────────────────

export async function listMine(user: User) {
  const [owned, joined] = await Promise.all([
    db.select({ post: collabPosts, members: memberCountSql, pending: sql<number>`(select count(*)::int from collab_applications a where a.post_id = "collab_posts"."id" and a.status = 'pending')` }).from(collabPosts).where(eq(collabPosts.ownerId, user.id)).orderBy(desc(collabPosts.updatedAt)).limit(100),
    db
      .select({ post: collabPosts, members: memberCountSql, role: collabMembers.role })
      .from(collabMembers)
      .innerJoin(collabPosts, eq(collabPosts.id, collabMembers.postId))
      .where(and(eq(collabMembers.userId, user.id), eq(collabMembers.kind, "member"), eq(collabMembers.status, "active")))
      .orderBy(desc(collabMembers.joinedAt))
      .limit(100),
  ]);
  const names = await ownerNames(joined.map((j) => j.post.ownerId));
  return {
    owned: owned.map((o) => ({ ...publicPost(o.post, o.members, user.name, { includeStatusNote: true }), pendingRequests: o.pending })),
    joined: joined.map((j) => ({ ...publicPost(j.post, j.members, j.post.ownerId ? names.get(j.post.ownerId) ?? null : null), yourRole: j.role })),
  };
}

export async function listRequests(user: User) {
  const [received, sent] = await Promise.all([
    db
      .select({
        id: collabApplications.id,
        postId: collabApplications.postId,
        postTitle: collabPosts.title,
        role: collabApplications.role,
        intro: collabApplications.intro,
        motivation: collabApplications.motivation,
        skills: collabApplications.skills,
        links: collabApplications.links,
        status: collabApplications.status,
        createdAt: collabApplications.createdAt,
        decidedAt: collabApplications.decidedAt,
        // What the owner may see of an applicant: name and stated academic context. No email, phone or ids.
        name: users.name,
        university: users.university,
        persona: users.role,
      })
      .from(collabApplications)
      .innerJoin(collabPosts, eq(collabPosts.id, collabApplications.postId))
      .innerJoin(users, eq(users.id, collabApplications.applicantId))
      .where(eq(collabPosts.ownerId, user.id))
      .orderBy(sql`case when ${collabApplications.status} = 'pending' then 0 else 1 end`, desc(collabApplications.createdAt))
      .limit(200),
    db
      .select({ id: collabApplications.id, postId: collabApplications.postId, postTitle: collabPosts.title, postStatus: collabPosts.status, role: collabApplications.role, status: collabApplications.status, createdAt: collabApplications.createdAt, decidedAt: collabApplications.decidedAt })
      .from(collabApplications)
      .innerJoin(collabPosts, eq(collabPosts.id, collabApplications.postId))
      .where(eq(collabApplications.applicantId, user.id))
      .orderBy(desc(collabApplications.createdAt))
      .limit(200),
  ]);
  return {
    received: received.map((r) => ({ ...r, name: r.name || "AI Tathastu member", createdAt: r.createdAt.toISOString(), decidedAt: r.decidedAt?.toISOString() ?? null })),
    sent: sent.map((s) => ({ ...s, postStatus: s.postStatus === "suspended" ? "unavailable" : s.postStatus, createdAt: s.createdAt.toISOString(), decidedAt: s.decidedAt?.toISOString() ?? null })),
  };
}

// ─── Enquiries, team threads and Inbox ──────────────────────────────────────

/** Before the owner answers, an enquirer may send at most this many messages in a row. */
export const ENQUIRY_UNANSWERED_LIMIT = 3;

type Access = { thread: typeof collabThreads.$inferSelect; post: CollabPost; role: "owner" | "member" | "enquirer" };

/**
 * Who may open a thread, decided from current records on every call: a team thread needs an active membership
 * (so leaving or removal revokes access at once; rejected applicants never had one); an enquiry thread belongs to
 * its enquirer and the post's current owner. Anything else reads as not found.
 */
async function threadAccess(userId: string, threadId: string): Promise<Access | null> {
  if (!/^[0-9a-f-]{36}$/i.test(threadId)) return null;
  const [row] = await db.select({ thread: collabThreads, post: collabPosts }).from(collabThreads).innerJoin(collabPosts, eq(collabPosts.id, collabThreads.postId)).where(eq(collabThreads.id, threadId));
  if (!row) return null;
  if (row.thread.kind === "enquiry") {
    if (row.thread.enquirerId === userId) return { ...row, role: "enquirer" };
    if (row.post.ownerId === userId) return { ...row, role: "owner" };
    return null;
  }
  const [m] = await db.select({ kind: collabMembers.kind }).from(collabMembers).where(and(eq(collabMembers.postId, row.post.id), eq(collabMembers.userId, userId), eq(collabMembers.status, "active")));
  if (m) return { ...row, role: m.kind };
  return null;
}

export async function sendEnquiry(user: User, postId: string, body: unknown): Promise<Result<{ threadId: string }>> {
  const parsed = enquiryInput.safeParse(body);
  if (!parsed.success) return fail(400, "Please fix the highlighted fields.", fieldErrors(parsed.error));
  const row = await loadPost(postId);
  if (!row || !["recruiting", "paused", "team_full"].includes(row.post.status) || !row.post.ownerId) return fail(404, "Questions can only be sent to collaborations that are open.");
  if (row.post.ownerId === user.id) return fail(409, "This is your own collaboration.");
  const [[member], [block]] = await Promise.all([
    db.select({ id: collabMembers.id }).from(collabMembers).where(and(eq(collabMembers.postId, postId), eq(collabMembers.userId, user.id), eq(collabMembers.status, "active"))),
    db.select({ x: collabBlocks.ownerId }).from(collabBlocks).where(and(eq(collabBlocks.ownerId, row.post.ownerId), eq(collabBlocks.blockedId, user.id))),
  ]);
  if (member) return fail(409, "You're on this team: use the team conversation in Inbox.");
  if (block) return fail(403, "You can't send questions to this collaboration.");
  const tooMany = await limited(`collab:enquiry:${user.id}`, 10, 3600);
  if (tooMany) return tooMany;

  await db.insert(collabThreads).values({ postId, kind: "enquiry", enquirerId: user.id }).onConflictDoNothing();
  const [thread] = await db.select().from(collabThreads).where(and(eq(collabThreads.postId, postId), eq(collabThreads.kind, "enquiry"), eq(collabThreads.enquirerId, user.id)));
  const sent = await postMessage(user, thread.id, { body: parsed.data.body });
  return sent.ok ? { ok: true, threadId: thread.id } : sent;
}

export async function postMessage(user: User, threadId: string, body: unknown): Promise<Result<{ id: string }>> {
  const parsed = messageInput.safeParse(body);
  if (!parsed.success) return fail(400, "Please fix the highlighted fields.", fieldErrors(parsed.error));
  const access = await threadAccess(user.id, threadId);
  if (!access) return fail(404, "This conversation doesn't exist.");
  if (access.thread.lockedAt) return fail(403, "This conversation is closed.");
  if (access.post.status === "suspended") return fail(403, "This collaboration is suspended, so its conversations are read-only.");
  const tooMany = await limited(`collab:msg:${user.id}`, 30, 60);
  if (tooMany) return tooMany;

  if (access.role === "enquirer") {
    // Enquiries stay short: at most N unanswered messages, and none once the owner has blocked the sender.
    const [block] = access.post.ownerId ? await db.select({ x: collabBlocks.ownerId }).from(collabBlocks).where(and(eq(collabBlocks.ownerId, access.post.ownerId), eq(collabBlocks.blockedId, user.id))) : [];
    if (block) return fail(403, "You can't send questions to this collaboration.");
    const recent = await db.select({ senderId: collabMessages.senderId }).from(collabMessages).where(eq(collabMessages.threadId, threadId)).orderBy(desc(collabMessages.createdAt)).limit(ENQUIRY_UNANSWERED_LIMIT);
    if (recent.length >= ENQUIRY_UNANSWERED_LIMIT && recent.every((m) => m.senderId === user.id)) {
      return fail(429, "Wait for the owner to reply before sending more questions.");
    }
  }

  const now = new Date();
  const [msg] = await db.insert(collabMessages).values({ threadId, senderId: user.id, body: parsed.data.body }).returning({ id: collabMessages.id });
  await db.batch([
    db.update(collabThreads).set({ lastMessageAt: now }).where(eq(collabThreads.id, threadId)),
    db.insert(collabReads).values({ threadId, userId: user.id, lastReadAt: now }).onConflictDoUpdate({ target: [collabReads.threadId, collabReads.userId], set: { lastReadAt: now } }),
    ...(access.role === "owner" ? [db.update(collabPosts).set({ ownerActiveAt: now }).where(eq(collabPosts.id, access.post.id))] : []),
  ] as never);
  if (access.thread.kind === "enquiry") {
    const to = access.role === "enquirer" ? access.post.ownerId : access.thread.enquirerId;
    if (to) await notify([{ userId: to, kind: "enquiry_message", postId: access.post.id, title: access.role === "enquirer" ? `New question about “${access.post.title}”` : `Reply about “${access.post.title}”`, href: `/opportunities?cat=collaborations&view=inbox&thread=${threadId}` }]);
  }
  return { ok: true, id: msg.id };
}

export async function getMessages(user: User, threadId: string) {
  const access = await threadAccess(user.id, threadId);
  if (!access) return fail(404, "This conversation doesn't exist.");
  const rows = await db
    .select({ id: collabMessages.id, senderId: collabMessages.senderId, name: users.name, body: collabMessages.body, hiddenAt: collabMessages.hiddenAt, createdAt: collabMessages.createdAt })
    .from(collabMessages)
    .leftJoin(users, eq(users.id, collabMessages.senderId))
    .where(eq(collabMessages.threadId, threadId))
    .orderBy(desc(collabMessages.createdAt))
    .limit(100);
  const now = new Date();
  await db.insert(collabReads).values({ threadId, userId: user.id, lastReadAt: now }).onConflictDoUpdate({ target: [collabReads.threadId, collabReads.userId], set: { lastReadAt: now } });
  return {
    ok: true as const,
    thread: { id: threadId, kind: access.thread.kind, postId: access.post.id, postTitle: access.post.title, locked: !!access.thread.lockedAt || access.post.status === "suspended", role: access.role },
    messages: rows.reverse().map((m) => ({
      id: m.id,
      mine: m.senderId === user.id,
      name: m.senderId === user.id ? "You" : m.name || "Former member",
      body: m.hiddenAt ? null : m.body,
      hidden: !!m.hiddenAt,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/** Every conversation the user can open now, newest first, with unread counts. */
export async function listInbox(user: User) {
  const { rows } = await db.execute(sql`
    select t.id, t.kind, t.post_id, p.title as post_title, t.last_message_at, t.locked_at, p.status as post_status,
      case when t.kind = 'enquiry' and p.owner_id = ${user.id}::uuid then 'owner' when t.kind = 'enquiry' then 'enquirer' else 'member' end as role,
      (select u.name from users u where u.id = t.enquirer_id) as enquirer_name,
      (select count(*)::int from collab_messages m where m.thread_id = t.id and m.sender_id is distinct from ${user.id}::uuid
         and m.created_at > coalesce((select r.last_read_at from collab_reads r where r.thread_id = t.id and r.user_id = ${user.id}::uuid), 'epoch'::timestamptz)) as unread,
      (select m.body from collab_messages m where m.thread_id = t.id and m.hidden_at is null order by m.created_at desc limit 1) as preview
    from collab_threads t join collab_posts p on p.id = t.post_id
    where (t.kind = 'team' and exists (select 1 from collab_members cm where cm.post_id = t.post_id and cm.user_id = ${user.id}::uuid and cm.status = 'active'))
       or (t.kind = 'enquiry' and (t.enquirer_id = ${user.id}::uuid or (p.owner_id = ${user.id}::uuid and t.last_message_at is not null)))
    order by t.last_message_at desc nulls last
    limit 100`);
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    kind: r.kind as "team" | "enquiry",
    postId: String(r.post_id),
    postTitle: String(r.post_title),
    role: r.role as string,
    // An owner sees who is asking; an enquirer just sees the post.
    with: r.kind === "enquiry" && r.role === "owner" ? String(r.enquirer_name || "AI Tathastu member") : null,
    lastMessageAt: iso(r.last_message_at),
    locked: !!r.locked_at || r.post_status === "suspended",
    unread: Number(r.unread ?? 0),
    preview: r.preview ? String(r.preview).slice(0, 140) : null,
  }));
}

// ─── Safety: blocks and reports ─────────────────────────────────────────────

/** An owner blocks the person behind one of their enquiry threads or applications. Their enquiries lock and pending requests close. */
export async function blockFrom(user: User, ref: { threadId?: string; applicationId?: string }): Promise<Result> {
  let target: string | null = null;
  if (ref.threadId) {
    const access = await threadAccess(user.id, ref.threadId);
    if (access?.role === "owner" && access.thread.kind === "enquiry") target = access.thread.enquirerId;
  } else if (ref.applicationId && /^[0-9a-f-]{36}$/i.test(ref.applicationId)) {
    const [a] = await db.select({ applicantId: collabApplications.applicantId }).from(collabApplications).innerJoin(collabPosts, eq(collabPosts.id, collabApplications.postId)).where(and(eq(collabApplications.id, ref.applicationId), eq(collabPosts.ownerId, user.id)));
    target = a?.applicantId ?? null;
  }
  if (!target || target === user.id) return fail(404, "Nothing to block here.");
  const owned = db.select({ id: collabPosts.id }).from(collabPosts).where(eq(collabPosts.ownerId, user.id));
  await db.batch([
    db.insert(collabBlocks).values({ ownerId: user.id, blockedId: target }).onConflictDoNothing(),
    db.update(collabThreads).set({ lockedAt: new Date() }).where(and(eq(collabThreads.kind, "enquiry"), eq(collabThreads.enquirerId, target), inArray(collabThreads.postId, owned))),
    db.update(collabApplications).set({ status: "rejected", decidedAt: new Date(), decidedBy: user.id }).where(and(eq(collabApplications.applicantId, target), eq(collabApplications.status, "pending"), inArray(collabApplications.postId, owned))),
  ] as never);
  return { ok: true };
}

export async function report(user: User, body: unknown): Promise<Result> {
  const parsed = reportInput.safeParse(body);
  if (!parsed.success) return fail(400, "Please fix the highlighted fields.", fieldErrors(parsed.error));
  const v = parsed.data;
  // Only what the reporter can actually see can be reported: a public post, or a message/thread they can open.
  let postId: string | null = null;
  if (v.targetType === "post") {
    const row = await loadPost(v.targetId);
    if (!row || !PUBLICLY_VISIBLE.includes(row.post.status)) return NOT_FOUND;
    postId = row.post.id;
  } else {
    let threadId = v.targetId;
    if (v.targetType === "message") {
      const [m] = await db.select({ threadId: collabMessages.threadId }).from(collabMessages).where(eq(collabMessages.id, v.targetId));
      if (!m) return NOT_FOUND;
      threadId = m.threadId;
    }
    const access = await threadAccess(user.id, threadId);
    if (!access) return NOT_FOUND;
    postId = access.post.id;
  }
  const tooMany = await limited(`collab:report:${user.id}`, 10, 86_400);
  if (tooMany) return tooMany;
  const inserted = await db.insert(collabReports).values({ reporterId: user.id, targetType: v.targetType, targetId: v.targetId, postId, reason: v.reason, details: v.details }).onConflictDoNothing().returning({ id: collabReports.id });
  return inserted.length ? { ok: true } : fail(409, "You've already reported this. Our moderators will review it.");
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function listNotifications(user: User) {
  const rows = await db.select().from(collabNotifications).where(eq(collabNotifications.userId, user.id)).orderBy(desc(collabNotifications.createdAt)).limit(30);
  return rows.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, href: n.href, read: !!n.readAt, createdAt: n.createdAt.toISOString() }));
}

export async function markNotificationsRead(user: User) {
  await db.update(collabNotifications).set({ readAt: new Date() }).where(and(eq(collabNotifications.userId, user.id), isNull(collabNotifications.readAt)));
}

/** Badge counts for the hub tabs. */
export async function counts(user: User) {
  const [[pending], inbox, [unreadNotes]] = await Promise.all([
    db.select({ n: count() }).from(collabApplications).innerJoin(collabPosts, eq(collabPosts.id, collabApplications.postId)).where(and(eq(collabPosts.ownerId, user.id), eq(collabApplications.status, "pending"))),
    listInbox(user),
    db.select({ n: count() }).from(collabNotifications).where(and(eq(collabNotifications.userId, user.id), isNull(collabNotifications.readAt))),
  ]);
  return { requests: pending.n, inbox: inbox.reduce((n, t) => n + t.unread, 0), notifications: unreadNotes.n };
}

// Re-exported for the lifecycle job and admin module.
export { postHref, loadPost, ownerNames };
export type { OwnerAction };
