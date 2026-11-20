/**
 * Admin modules against the real (test) database: audit log filters, health checks, ticket filters/assignment/replies,
 * failed-email retry, team management and its safeguards.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "vitest" }) }));
class Redirect extends Error {
  constructor(public url: string) {
    super(`REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => ({}), notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Redirect(u); } }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/r2", () => ({ deleteObject: async () => {}, listObjectKeys: async () => [], isR2Configured: () => false, UPLOAD_URL_TTL_SECONDS: 300 }));

const ADMIN = { id: "00000000-0000-4000-8000-0000000000a1", email: "lead@example.test", name: "Lead" };
const perms = vi.hoisted(() => ({ superAdmin: true, list: [] as string[] }));
vi.mock("@/lib/admin", () => ({ requireAdmin: async () => ADMIN, isAdmin: () => true }));
vi.mock("@/lib/admin/rbac", () => {
  const ctx = () => ({ user: ADMIN, role: perms.superAdmin ? "super_admin" : "support_agent", permissions: perms.list, isSuperAdmin: perms.superAdmin });
  const has = (c: { isSuperAdmin: boolean; permissions: string[] }, p: string) => c.isSuperAdmin || c.permissions.includes(p);
  return {
    getAdminContext: async () => ctx(),
    requireOperator: async () => ctx(),
    requireAdminPermission: async (p: string) => {
      if (!has(ctx(), p)) throw new Error("NOT_FOUND");
      return ctx();
    },
    hasPermission: has,
    ROLE_PERMISSIONS: new Proxy({}, { get: () => [] }),
  };
});

const { db } = await import("@/db");
const { adminAuditLogs, adminTeamMembers, emailDeliveries, jobs, supportTickets, users } = await import("@/db/schema");
const { listAdminAudits } = await import("./audit");
const { platformChecks } = await import("./health");
const { listSupportTickets } = await import("./tickets");

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const redirectOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    if (e instanceof Redirect) return decodeURIComponent(e.url);
    throw e;
  }
  throw new Error("expected a redirect");
};
const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

beforeAll(async () => {
  await db.insert(users).values([ADMIN, { id: uid(2), email: "agent@example.test", name: "Agent" }, { id: uid(3), email: "student@example.test", name: "Student" }, { id: uid(4), email: "old@example.test", name: "Old", isAdmin: true }]);
});

describe("Security Audit Logs", () => {
  it("filters by area, administrator, action and date, with a real total", async () => {
    const base = new Date("2026-11-10T12:00:00Z");
    for (let i = 0; i < 60; i++) {
      await db.insert(adminAuditLogs).values({ actorEmail: i % 2 ? "a@example.test" : "b@example.test", action: i % 3 ? "ticket.assign" : "flag.toggle", resource: i % 3 ? "support_tickets" : "feature_flags", createdAt: new Date(base.getTime() + i * 3600_000) });
    }
    const all = await listAdminAudits({ limit: 10 });
    expect(all.total).toBe(60);
    expect(all.logs).toHaveLength(10);
    expect((await listAdminAudits({ resource: "feature_flags" })).total).toBe(20);
    expect((await listAdminAudits({ actorEmail: "a@ex" })).total).toBe(30);
    expect((await listAdminAudits({ action: "flag" })).total).toBe(20);
    expect((await listAdminAudits({ from: "2026-11-11", to: "2026-11-11" })).total).toBe(24);
    expect((await listAdminAudits({ action: "%" })).total).toBe(0); // wildcards are escaped
  });
});

describe("Operational Health", () => {
  it("measures the database and queues; unmeasurable parts are never healthy", async () => {
    let c = await platformChecks();
    const by = (id: string) => c.components.find((x) => x.id === id)!;
    expect(by("database").status).toBe("healthy");
    expect(by("jobs").status).toBe("healthy");
    expect(by("worker").status).toBe("not_monitored");
    expect(by("storage").status).toBe("not_monitored");

    await db.insert(jobs).values({ type: "resume_extract", userId: uid(3), idempotencyKey: "stale", payload: {}, status: "queued", runAt: new Date(Date.now() - 2 * 3600_000) } as never);
    await db.insert(emailDeliveries).values({ recipient: "x@example.test", subject: "x", htmlBody: "x", textBody: "x", status: "failed", attempts: 5, maxAttempts: 5, lastError: "SMTP 550" });
    c = await platformChecks();
    expect(by("jobs").status).toBe("critical");
    expect(by("jobs").summary).toContain("may be down");
    expect(by("email").status).toBe("warning");
    expect(c.overall).toBe("critical");
  });
});

describe("Tickets", () => {
  it("overdue filter and pagination use the whole table", async () => {
    for (let i = 0; i < 30; i++) {
      await db.insert(supportTickets).values({ ticketNumber: `P-${i}`, requesterEmail: `r${i}@example.test`, subject: `s${i}`, status: i < 5 ? "closed" : "open", priority: "medium", resolutionDueAt: new Date(Date.now() + (i % 2 ? -1 : 1) * 3600_000) } as never);
    }
    const p1 = await listSupportTickets({ limit: 25 });
    const p2 = await listSupportTickets({ limit: 25, offset: 25 });
    expect(p1.total).toBe(30);
    expect(p2.tickets).toHaveLength(5);
    // Odd i are past due; only open ones (i >= 5) count: 7, 9, … 29 = 13.
    expect((await listSupportTickets({ overdue: true })).total).toBe(13);
  });

  it("assignment accepts only active admins and is audited", async () => {
    const { assignTicketAction } = await import("@/app/admin/tickets/actions");
    const [t] = await db.select().from(supportTickets).limit(1);
    await db.insert(adminTeamMembers).values({ userId: uid(2), role: "support_agent", isActive: true });
    expect(await assignTicketAction(t!.id, uid(3))).toMatchObject({ ok: false });
    expect(await assignTicketAction(t!.id, uid(2))).toMatchObject({ ok: true });
    expect((await db.select().from(supportTickets).where(eq(supportTickets.id, t!.id)))[0]!.assignedToId).toBe(uid(2));
    expect((await listAdminAudits({ action: "ticket.assign" })).logs[0]!.targetId).toBe(t!.id);
  });

  it("a public reply emails the student who raised the ticket, not the admin", async () => {
    const { postTicketMessageAction } = await import("@/app/admin/tickets/actions");
    const [t] = await db.insert(supportTickets).values({ ticketNumber: "R-1", requesterEmail: "asker@example.test", subject: "help", status: "new", priority: "low" } as never).returning();
    expect(await postTicketMessageAction(t!.id, "Here is the fix", false)).toMatchObject({ ok: true });
    const [mail] = await db.select().from(emailDeliveries).where(sql`${emailDeliveries.subject} like '[R-1]%'`);
    expect(mail!.recipient).toBe("asker@example.test");
    // An internal note sends nothing.
    const before = (await db.select().from(emailDeliveries)).length;
    await postTicketMessageAction(t!.id, "internal", true);
    expect((await db.select().from(emailDeliveries)).length).toBe(before);
  });
});

describe("Delivery Outbox retry", () => {
  it("re-queues a failed email for exactly one more attempt; other statuses are refused", async () => {
    const { retryFailedDeliveryAction } = await import("@/app/admin/emails/actions");
    const [failed] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.status, "failed"));
    expect(await redirectOf(retryFailedDeliveryAction(fd({ id: failed!.id })))).toBe("/admin/emails/deliveries?retry=queued");
    const [after] = await db.select().from(emailDeliveries).where(eq(emailDeliveries.id, failed!.id));
    expect(after).toMatchObject({ status: "queued", attempts: 5, maxAttempts: 6 });
    expect(await redirectOf(retryFailedDeliveryAction(fd({ id: failed!.id })))).toBe("/admin/emails/deliveries?retry=error");
    expect((await listAdminAudits({ action: "email.delivery_retry" })).total).toBe(1);
  });

  it("needs the retry permission", async () => {
    const { retryFailedDeliveryAction } = await import("@/app/admin/emails/actions");
    perms.superAdmin = false;
    perms.list = ["support.tickets.read"];
    await expect(retryFailedDeliveryAction(fd({ id: uid(9) }))).rejects.toThrow("NOT_FOUND");
    perms.superAdmin = true;
    perms.list = [];
  });
});

describe("Admin Team", () => {
  it("adds, changes role, deactivates and reactivates, each audited", async () => {
    const { addTeamMemberAction, updateTeamMemberAction } = await import("@/app/admin/team/actions");
    expect(await redirectOf(addTeamMemberAction(fd({ email: "Student@Example.test", role: "content_editor" })))).toContain("ok:");
    const [m] = await db.select().from(adminTeamMembers).where(eq(adminTeamMembers.userId, uid(3)));
    expect(m).toMatchObject({ role: "content_editor", isActive: true });

    expect(await redirectOf(updateTeamMemberAction(fd({ memberId: m!.id, op: "role", role: "support_admin" })))).toContain("ok:");
    expect(await redirectOf(updateTeamMemberAction(fd({ memberId: m!.id, op: "deactivate" })))).toContain("ok:");
    expect((await db.select().from(adminTeamMembers).where(eq(adminTeamMembers.id, m!.id)))[0]).toMatchObject({ role: "support_admin", isActive: false });
    expect(await redirectOf(updateTeamMemberAction(fd({ memberId: m!.id, op: "activate" })))).toContain("ok:");

    const actions = (await listAdminAudits({ resource: "admin_team_members" })).logs.map((l) => l.action).sort();
    expect(actions).toEqual(["team.member_activate", "team.member_add", "team.member_deactivate", "team.role_change"]);
  });

  it("refuses bad input, duplicates, unknown accounts and changes to your own access", async () => {
    const { addTeamMemberAction, updateTeamMemberAction } = await import("@/app/admin/team/actions");
    expect(await redirectOf(addTeamMemberAction(fd({ email: "student@example.test", role: "owner" })))).toContain("error:");
    expect(await redirectOf(addTeamMemberAction(fd({ email: "nobody@example.test", role: "support_agent" })))).toContain("error:No account");
    expect(await redirectOf(addTeamMemberAction(fd({ email: "student@example.test", role: "support_agent" })))).toContain("error:That account is already");
    expect(await redirectOf(addTeamMemberAction(fd({ email: ADMIN.email, role: "support_agent" })))).toContain("error:You can't change your own access");
    const [self] = await db.insert(adminTeamMembers).values({ userId: ADMIN.id, role: "super_admin" }).returning();
    expect(await redirectOf(updateTeamMemberAction(fd({ memberId: self!.id, op: "deactivate" })))).toContain("error:You can't change your own access");
    expect((await db.select().from(adminTeamMembers).where(eq(adminTeamMembers.id, self!.id)))[0]!.isActive).toBe(true);
  });

  it("management controls render only with team.manage", async () => {
    const { default: Team } = await import("@/app/admin/team/page");
    const withManage = renderToStaticMarkup(await Team());
    expect(withManage).toContain("Add member");
    expect(withManage).toContain("Deactivate");
    perms.superAdmin = false;
    perms.list = ["team.read"];
    const readOnly = renderToStaticMarkup(await Team());
    expect(readOnly).not.toContain("Add member");
    expect(readOnly).not.toContain("Deactivate");
    perms.superAdmin = true;
    perms.list = [];
  });
});
