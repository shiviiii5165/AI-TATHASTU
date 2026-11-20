import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Integration: the real service against PGlite with every migration applied (including 0034's SQL functions).
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/dal", () => ({ getCurrentUser: async () => null, getApiOnboardedUser: async () => ({ ok: false, status: 401, error: "x" }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { collabApplications, collabCreatorVerifications, collabMembers, collabMessages, collabNotifications, collabPosts, collabReports, collabThreads, users } = schema;
const svc = await import("./service");
const { runLifecycle } = await import("./lifecycle");
const mod = await import("./moderation");

type U = typeof users.$inferSelect;
let n = 0;
async function user(extra: Partial<typeof users.$inferInsert> = {}): Promise<U> {
  n++;
  const [u] = await db.insert(users).values({ email: `u${n}-${Date.now()}@example.com`, name: `User ${n}`, ...extra }).returning();
  return u;
}

const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const base = (over: Record<string, unknown> = {}) => ({
  category: "project",
  title: "Campus food waste tracker",
  summary: "An app that helps hostels cut food waste.",
  problem: "Mess halls throw away a lot of food.",
  stage: "planning",
  roles: [{ title: "Frontend developer", count: 2, skills: ["React", "TypeScript"] }],
  mode: "remote",
  deadline: future(30),
  ...over,
});

async function published(owner: U, over: Record<string, unknown> = {}) {
  const r = await svc.createPost(owner, base({ title: `Project ${++n} for testing`, ...over }), true);
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.id;
}
async function applied(applicant: U, postId: string) {
  const r = await svc.apply(applicant, postId, { intro: "Hi, I build React apps.", motivation: "I care about food waste.", skills: ["react"] });
  if (!r.ok) throw new Error(JSON.stringify(r));
  return r.id;
}

beforeAll(() => {
  vi.stubEnv("ADMIN_EMAILS", "root@example.com");
});

describe("migration 0034", () => {
  it("installs the atomic SQL functions (the test DB loader ignores syntax errors, so check they exist)", async () => {
    const { rows } = await db.execute(sql`select proname from pg_proc where proname like 'collab_%' order by proname`);
    expect((rows as { proname: string }[]).map((r) => r.proname)).toEqual(["collab_apply", "collab_decide_application", "collab_end_membership"]);
  });
});

describe("creating and publishing", () => {
  it("publishes a valid post at once for a student, as Student-led, with capacity from its roles", async () => {
    const owner = await user();
    const id = await published(owner);
    const [p] = await db.select().from(collabPosts).where(eq(collabPosts.id, id));
    expect(p).toMatchObject({ status: "recruiting", creatorType: "student", capacity: 2, ownerId: owner.id });
    expect(p.skills).toEqual(["react", "typescript"]);
  });

  it("explains every missing field and stores nothing", async () => {
    const owner = await user();
    const r = await svc.createPost(owner, { category: "hackathon", title: "", roles: [] }, true);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.fields!)).toEqual(expect.arrayContaining(["title", "summary", "roles"]));
    expect(await db.select().from(collabPosts).where(eq(collabPosts.ownerId, owner.id))).toHaveLength(0);
  });

  it("requires category-specific details (a hackathon needs its event)", async () => {
    const r = await svc.createPost(await user(), base({ category: "hackathon" }), true);
    expect(!r.ok && r.fields?.["details.event"]).toBeTruthy();
    const ok = await svc.createPost(await user(), base({ category: "hackathon", details: { event: "Smart India Hackathon", junk: "dropped" } }), true);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect((await db.select().from(collabPosts).where(eq(collabPosts.id, ok.id)))[0].details).toEqual({ event: "Smart India Hackathon" });
  });

  it("ignores owner, status, creator type and counts sent by the client (mass assignment)", async () => {
    const owner = await user();
    const victim = await user();
    const r = await svc.createPost(owner, base({ ownerId: victim.id, status: "completed", creatorType: "faculty", capacity: 50, members: 9 }), false);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [p] = await db.select().from(collabPosts).where(eq(collabPosts.id, r.id));
    expect(p).toMatchObject({ ownerId: owner.id, status: "draft", creatorType: "student", capacity: 2 });
  });

  it("rejects javascript: and data: links", async () => {
    const r = await svc.createPost(await user(), base({ links: ["javascript:alert(1)"] }), true);
    expect(!r.ok && r.fields?.["links.0"]).toBeTruthy();
    const r2 = await svc.createPost(await user(), base({ links: ["data:text/html,<script>x</script>"] }), true);
    expect(r2.ok).toBe(false);
  });

  it("refuses a duplicate open post from the same owner", async () => {
    const owner = await user();
    expect((await svc.createPost(owner, base(), true)).ok).toBe(true);
    const again = await svc.createPost(owner, base({ title: "  CAMPUS food-waste tracker " }), true);
    expect(again).toMatchObject({ ok: false, status: 409 });
  });

  it("refuses to publish with a past deadline", async () => {
    const r = await svc.createPost(await user(), base({ deadline: "2020-01-01" }), true);
    expect(!r.ok && r.fields?.deadline).toBeTruthy();
  });
});

describe("creator labels come only from trusted records", () => {
  it("a self-declared faculty persona is not Faculty-led", async () => {
    const id = await published(await user({ role: "faculty" }));
    expect((await db.select().from(collabPosts).where(eq(collabPosts.id, id)))[0].creatorType).toBe("community");
  });

  it("an operator-granted verification is", async () => {
    const f = await user({ role: "faculty" });
    await db.insert(collabCreatorVerifications).values({ userId: f.id, kind: "faculty" });
    const id = await published(f);
    const r = await svc.getPostForViewer(id, null);
    expect(r.ok && r.post.creator).toMatchObject({ type: "faculty", label: "Faculty-led", verified: true });
  });

  it("a revoked verification no longer counts", async () => {
    const f = await user({ role: "alumni" });
    await db.insert(collabCreatorVerifications).values({ userId: f.id, kind: "alumni", revokedAt: new Date() });
    const id = await published(f);
    expect((await db.select().from(collabPosts).where(eq(collabPosts.id, id)))[0].creatorType).toBe("community");
  });

  it("an ADMIN_EMAILS operator posts as the AI Tathastu team", async () => {
    const id = await published(await user({ email: "root@example.com" }));
    expect((await db.select().from(collabPosts).where(eq(collabPosts.id, id)))[0].creatorType).toBe("admin");
  });
});

describe("public visibility", () => {
  it("lists published posts for visitors with only public fields", async () => {
    const owner = await user({ name: "Asha Rao", university: "Private University", city: "Pune" });
    const id = await published(owner, { title: "Unique quantum lab notebook" });
    const list = await svc.listPublic({ q: "quantum", sort: "newest", page: 1 });
    const item = list.items.find((i) => i.id === id)!;
    expect(item.creator.name).toBe("Asha Rao");
    const text = JSON.stringify(list);
    for (const secret of [owner.id, owner.email!, "Private University", "ownerId", "contentHash", "needsOwnerReview", "statusBeforeSuspension"]) expect(text).not.toContain(secret);
  });

  it("hides drafts and suspended posts from everyone but their owner", async () => {
    const owner = await user();
    const draft = await svc.createPost(owner, base({ title: "A hidden draft idea" }), false);
    if (!draft.ok) throw new Error();
    expect(await svc.getPostForViewer(draft.id, null)).toMatchObject({ ok: false, status: 404 });
    expect(await svc.getPostForViewer(draft.id, (await user()).id)).toMatchObject({ ok: false, status: 404 });
    expect((await svc.getPostForViewer(draft.id, owner.id)).ok).toBe(true);
    const list = await svc.listPublic({ q: "hidden draft", sort: "newest", page: 1 });
    expect(list.items.map((i) => i.id)).not.toContain(draft.id);
  });

  it("filters by category, skill, mode and open positions", async () => {
    const owner = await user();
    const id = await published(owner, { category: "research", details: { field: "NLP" }, roles: [{ title: "Annotator", count: 1, skills: ["Linguistics"] }], mode: "hybrid", location: "Delhi" });
    const hits = await svc.listPublic({ category: "research", skill: "linguistics", mode: "hybrid", open: "1", sort: "newest", page: 1 });
    expect(hits.items.map((i) => i.id)).toContain(id);
    const miss = await svc.listPublic({ category: "hackathon", skill: "linguistics", sort: "newest", page: 1 });
    expect(miss.items.map((i) => i.id)).not.toContain(id);
  });
});

describe("applications and team", () => {
  it("an owner can't apply to their own post; duplicates and closed posts are refused", async () => {
    const owner = await user();
    const a = await user();
    const id = await published(owner);
    expect(await svc.apply(owner, id, { intro: "x", motivation: "y" })).toMatchObject({ ok: false, status: 409 });
    await applied(a, id);
    expect(await svc.apply(a, id, { intro: "again", motivation: "again" })).toMatchObject({ ok: false, error: expect.stringContaining("pending") });
    expect((await svc.changeStatus(owner, id, "close")).ok).toBe(true);
    expect(await svc.apply(await user(), id, { intro: "x", motivation: "y" })).toMatchObject({ ok: false, status: 409 });
  });

  it("acceptance creates a real membership, opens the team thread and notifies the applicant", async () => {
    const owner = await user();
    const a = await user();
    const id = await published(owner);
    const appId = await applied(a, id);
    expect(await svc.decide(owner, appId, true)).toMatchObject({ ok: true, status: "accepted" });
    const members = await db.select().from(collabMembers).where(eq(collabMembers.postId, id));
    expect(members.map((m) => [m.kind, m.userId]).sort()).toEqual([["member", a.id], ["owner", owner.id]].sort());
    const inbox = await svc.listInbox(a);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ kind: "team", postId: id });
    const notes = await db.select().from(collabNotifications).where(eq(collabNotifications.userId, a.id));
    expect(notes.map((x) => x.kind)).toContain("application_accepted");
  });

  it("only the owner can decide; anyone else is told the request doesn't exist", async () => {
    const owner = await user();
    const a = await user();
    const id = await published(owner);
    const appId = await applied(a, id);
    expect(await svc.decide(a, appId, true)).toMatchObject({ ok: false, status: 404 }); // can't accept themselves
    expect(await svc.decide(await user(), appId, true)).toMatchObject({ ok: false, status: 404 });
    expect(await db.select().from(collabMembers).where(eq(collabMembers.postId, id))).toHaveLength(0);
  });

  it("never exceeds capacity, even with simultaneous acceptances", async () => {
    const owner = await user();
    const id = await published(owner, { roles: [{ title: "Designer", count: 1, skills: [] }] });
    const apps = await Promise.all([await user(), await user(), await user()].map((a) => applied(a, id)));
    const results = await Promise.all(apps.map((appId) => svc.decide(owner, appId, true)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.status === 409)).toBe(true);
    const [p] = await db.select().from(collabPosts).where(eq(collabPosts.id, id));
    expect(p.status).toBe("team_full");
    const active = await db.select().from(collabMembers).where(and(eq(collabMembers.postId, id), eq(collabMembers.kind, "member"), eq(collabMembers.status, "active")));
    expect(active).toHaveLength(1);
  });

  it("a rejected applicant gets no membership and no conversation access", async () => {
    const owner = await user();
    const a = await user();
    const b = await user();
    const id = await published(owner);
    await svc.decide(owner, await applied(b, id), true);
    const appId = await applied(a, id);
    expect(await svc.decide(owner, appId, false)).toMatchObject({ ok: true, status: "rejected" });
    expect(await svc.listInbox(a)).toHaveLength(0);
    const [team] = await db.select().from(collabThreads).where(and(eq(collabThreads.postId, id), eq(collabThreads.kind, "team")));
    expect(await svc.getMessages(a, team.id)).toMatchObject({ ok: false, status: 404 });
    expect(await svc.postMessage(a, team.id, { body: "let me in" })).toMatchObject({ ok: false, status: 404 });
  });

  it("an applicant can withdraw only their own pending request", async () => {
    const owner = await user();
    const a = await user();
    const id = await published(owner);
    const appId = await applied(a, id);
    expect(await svc.withdraw(await user(), appId)).toMatchObject({ ok: false });
    expect(await svc.withdraw(a, appId)).toMatchObject({ ok: true });
    expect(await svc.decide(owner, appId, true)).toMatchObject({ ok: false, status: 409 });
  });

  it("leaving revokes conversation access at once and reopens a full team", async () => {
    const owner = await user();
    const a = await user();
    const id = await published(owner, { roles: [{ title: "Designer", count: 1, skills: [] }] });
    await svc.decide(owner, await applied(a, id), true);
    const [team] = await db.select().from(collabThreads).where(and(eq(collabThreads.postId, id), eq(collabThreads.kind, "team")));
    expect((await svc.postMessage(a, team.id, { body: "hello team" })).ok).toBe(true);
    expect(await svc.endMembership(a, id, null)).toMatchObject({ ok: true, status: "left" });
    expect(await svc.getMessages(a, team.id)).toMatchObject({ ok: false, status: 404 });
    expect((await db.select().from(collabPosts).where(eq(collabPosts.id, id)))[0].status).toBe("recruiting");
    // History is kept for the remaining team.
    const ownerView = await svc.getMessages(owner, team.id);
    expect(ownerView.ok && ownerView.messages.map((m) => m.body)).toEqual(["hello team"]);
  });

  it("only the owner removes members; a member can't remove another", async () => {
    const owner = await user();
    const [a, b] = [await user(), await user()];
    const id = await published(owner);
    await svc.decide(owner, await applied(a, id), true);
    await svc.decide(owner, await applied(b, id), true);
    const roster = await svc.listMembers(a, id);
    const bMember = roster.ok ? roster.members.find((m) => m.name === b.name)! : null;
    expect(await svc.endMembership(a, id, bMember!.id)).toMatchObject({ ok: false, status: 404 });
    expect(await svc.endMembership(owner, id, bMember!.id)).toMatchObject({ ok: true, status: "removed" });
  });

  it("the roster is private to the team", async () => {
    const owner = await user();
    const id = await published(owner);
    expect(await svc.listMembers(await user(), id)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("object-level authorization (IDOR)", () => {
  it("a student can't edit, change the status of, or delete another user's post", async () => {
    const owner = await user();
    const attacker = await user();
    const id = await published(owner);
    expect(await svc.updatePost(attacker, id, base({ title: "Hijacked title here" }))).toMatchObject({ ok: false, status: 404 });
    expect(await svc.changeStatus(attacker, id, "close")).toMatchObject({ ok: false, status: 404 });
    expect(await svc.deleteDraft(attacker, id)).toMatchObject({ ok: false });
    expect(await svc.getOwnPostForEdit(attacker, id)).toMatchObject({ ok: false, status: 404 });
    expect((await db.select().from(collabPosts).where(eq(collabPosts.id, id)))[0]).toMatchObject({ status: "recruiting" });
  });

  it("a stranger can't read or post in an enquiry thread, and malformed ids are just 'not found'", async () => {
    const owner = await user();
    const asker = await user();
    const id = await published(owner);
    const q = await svc.sendEnquiry(asker, id, { body: "Is this open to first-years?" });
    if (!q.ok) throw new Error(JSON.stringify(q));
    expect(await svc.getMessages(await user(), q.threadId)).toMatchObject({ ok: false, status: 404 });
    expect(await svc.getMessages(owner, "' or 1=1 --")).toMatchObject({ ok: false, status: 404 });
    expect(await svc.getPostForViewer("not-a-uuid", null)).toMatchObject({ ok: false, status: 404 });
  });

  it("requests show owners only permitted applicant fields", async () => {
    const owner = await user();
    const a = await user({ name: "Ravi", university: "IIT Test" });
    const id = await published(owner);
    await applied(a, id);
    const { received } = await svc.listRequests(owner);
    const text = JSON.stringify(received);
    expect(text).toContain("Ravi");
    expect(text).not.toContain(a.email!);
    expect(text).not.toContain(a.id);
    // An unrelated user sees nothing of it.
    expect((await svc.listRequests(await user())).received).toHaveLength(0);
  });
});

describe("enquiries", () => {
  it("are limited until the owner replies, and blocked senders are stopped", async () => {
    const owner = await user();
    const asker = await user();
    const id = await published(owner);
    const first = await svc.sendEnquiry(asker, id, { body: "Question one?" });
    if (!first.ok) throw new Error();
    expect((await svc.postMessage(asker, first.threadId, { body: "Question two?" })).ok).toBe(true);
    expect((await svc.postMessage(asker, first.threadId, { body: "Question three?" })).ok).toBe(true);
    expect(await svc.postMessage(asker, first.threadId, { body: "Four?" })).toMatchObject({ ok: false, status: 429 });
    expect((await svc.postMessage(owner, first.threadId, { body: "Yes, it's open." })).ok).toBe(true);
    expect((await svc.postMessage(asker, first.threadId, { body: "Thanks!" })).ok).toBe(true);
    expect(await svc.blockFrom(owner, { threadId: first.threadId })).toMatchObject({ ok: true });
    expect(await svc.postMessage(asker, first.threadId, { body: "Hello?" })).toMatchObject({ ok: false, status: 403 });
    expect(await svc.apply(asker, id, { intro: "x", motivation: "y" })).toMatchObject({ ok: false, status: 403 });
  });

  it("the owner can't enquire on their own post, and inbox shows unread counts", async () => {
    const owner = await user();
    const asker = await user();
    const id = await published(owner);
    expect(await svc.sendEnquiry(owner, id, { body: "me?" })).toMatchObject({ ok: false, status: 409 });
    await svc.sendEnquiry(asker, id, { body: "Do you need a designer?" });
    const inbox = await svc.listInbox(owner);
    expect(inbox[0]).toMatchObject({ kind: "enquiry", unread: 1, with: asker.name });
    await svc.getMessages(owner, inbox[0].id);
    expect((await svc.listInbox(owner))[0].unread).toBe(0);
  });
});

describe("lifecycle", () => {
  const age = async (id: string, days: number) => {
    const at = new Date(Date.now() - days * 86_400_000);
    await db.update(collabPosts).set({ publishedAt: at, renewedAt: at }).where(eq(collabPosts.id, id));
  };

  it("reminds on day 45 and 55 once each, expires on day 60, and keeps history", async () => {
    const owner = await user();
    const id = await published(owner);
    await age(id, 46);
    await runLifecycle();
    await runLifecycle();
    const reminders = await db.select().from(collabNotifications).where(and(eq(collabNotifications.postId, id), eq(collabNotifications.kind, "renewal_reminder")));
    expect(reminders).toHaveLength(1);
    await age(id, 61);
    await runLifecycle();
    const [p] = await db.select().from(collabPosts).where(eq(collabPosts.id, id));
    expect(p.status).toBe("expired");
    expect((await svc.listPublic({ sort: "newest", page: 1, q: p.title })).items.map((i) => i.id)).not.toContain(id);
    expect(await svc.apply(await user(), id, { intro: "x", motivation: "y" })).toMatchObject({ ok: false, status: 409 });
    expect(await svc.changeStatus(owner, id, "renew")).toMatchObject({ ok: true, status: "recruiting" });
    expect((await db.select().from(collabPosts).where(eq(collabPosts.id, id)))[0]).toMatchObject({ reminderStage: 0, status: "recruiting" });
  });

  it("flags a team whose owner account was deleted, and an admin transfers it to a member", async () => {
    const owner = await user();
    const a = await user();
    const admin = await user({ email: "root@example.com".replace("root", `root${n}`) });
    const id = await published(owner);
    await svc.decide(owner, await applied(a, id), true);
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, owner.id));
    expect((await runLifecycle()).flagged).toBeGreaterThanOrEqual(1);
    const [flagged] = await db.select().from(collabPosts).where(eq(collabPosts.id, id));
    expect(flagged).toMatchObject({ needsOwnerReview: true, ownerReviewReason: "owner_account_deleted", status: "recruiting" });

    const detail = await mod.adminPostDetail(id);
    const successor = detail!.members.find((m) => m.userId === a.id)!;
    expect(await mod.transferOwnership(admin, id, successor.id, "Owner left; member verified by email")).toEqual({ ok: true });
    const [after] = await db.select().from(collabPosts).where(eq(collabPosts.id, id));
    expect(after).toMatchObject({ ownerId: a.id, needsOwnerReview: false });
    const history = await mod.adminPostDetail(id);
    expect(history!.history[0]).toMatchObject({ action: "transfer_ownership", fromOwnerId: owner.id, toOwnerId: a.id, actorId: admin.id });
    // The new owner can now decide applications; the old one can't.
    const appId = await applied(await user(), id);
    expect(await svc.decide(owner, appId, true)).toMatchObject({ ok: false, status: 404 });
    expect((await svc.decide(a, appId, true)).ok).toBe(true);
  });

  it("transfer refuses someone who isn't an active member", async () => {
    const owner = await user();
    const id = await published(owner);
    expect(await mod.transferOwnership(await user(), id, "00000000-0000-4000-8000-000000000000", "x")).toMatchObject({ ok: false });
  });
});

describe("moderation and reports", () => {
  it("suspension hides a post, blocks applications and edits, and restore brings it back", async () => {
    const owner = await user();
    const admin = await user();
    const id = await published(owner);
    expect(await mod.suspendPost(admin, id, "Reported as fraud")).toEqual({ ok: true });
    expect(await svc.getPostForViewer(id, null)).toMatchObject({ ok: false, status: 404 });
    expect(await svc.apply(await user(), id, { intro: "x", motivation: "y" })).toMatchObject({ ok: false, status: 409 });
    expect(await svc.updatePost(owner, id, base())).toMatchObject({ ok: false, status: 409 });
    expect(await svc.changeStatus(owner, id, "resume")).toMatchObject({ ok: false, status: 409 });
    expect(await mod.restorePost(admin, id, "False alarm")).toEqual({ ok: true });
    expect((await db.select().from(collabPosts).where(eq(collabPosts.id, id)))[0].status).toBe("recruiting");
  });

  it("a removed post can't be restored", async () => {
    const id = await published(await user());
    const admin = await user();
    await mod.removePost(admin, id, "Scam");
    expect(await mod.restorePost(admin, id, "oops")).toMatchObject({ ok: false });
  });

  it("users can report only what they can see, once", async () => {
    const owner = await user();
    const reporter = await user();
    const id = await published(owner);
    expect(await svc.report(reporter, { targetType: "post", targetId: id, reason: "spam" })).toEqual({ ok: true });
    expect(await svc.report(reporter, { targetType: "post", targetId: id, reason: "spam" })).toMatchObject({ ok: false, status: 409 });
    const q = await svc.sendEnquiry(await user(), id, { body: "hello?" });
    if (!q.ok) throw new Error();
    // A thread the reporter isn't part of reads as not found.
    expect(await svc.report(reporter, { targetType: "thread", targetId: q.threadId, reason: "harassment" })).toMatchObject({ ok: false, status: 404 });
    expect(await db.select().from(collabReports).where(eq(collabReports.postId, id))).toHaveLength(1);
  });

  it("hidden messages are not delivered to participants", async () => {
    const owner = await user();
    const asker = await user();
    const id = await published(owner);
    const q = await svc.sendEnquiry(asker, id, { body: "rude message" });
    if (!q.ok) throw new Error();
    const [m] = await db.select().from(collabMessages).where(eq(collabMessages.threadId, q.threadId));
    await mod.hideMessage(await user(), m.id, "Abusive");
    const view = await svc.getMessages(owner, q.threadId);
    expect(view.ok && view.messages[0]).toMatchObject({ body: null, hidden: true });
  });
});

describe("applications count from records, not clients", () => {
  it("member counts reflect accepted memberships only", async () => {
    const owner = await user();
    const id = await published(owner);
    await applied(await user(), id);
    const r = await svc.getPostForViewer(id, null);
    expect(r.ok && r.post).toMatchObject({ members: 0, openPositions: 2 });
    const apps = await db.select().from(collabApplications).where(eq(collabApplications.postId, id));
    expect(await svc.decide(owner, apps[0].id, true)).toMatchObject({ ok: true });
    const r2 = await svc.getPostForViewer(id, null);
    expect(r2.ok && r2.post).toMatchObject({ members: 1, openPositions: 1 });
    const mine = await svc.listMine(owner);
    expect(mine.owned.find((p) => p.id === id)).toMatchObject({ members: 1, pendingRequests: 0 });
    await applied(await user(), id);
    expect((await svc.listMine(owner)).owned.find((p) => p.id === id)).toMatchObject({ pendingRequests: 1 });
    expect((await svc.listPublic({ open: "1", sort: "open", page: 1, q: (r2.ok && r2.post.title) || "" })).items[0]).toMatchObject({ id, openPositions: 1 });
  });
});
