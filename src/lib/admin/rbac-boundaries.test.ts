import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Every admin action against every role, through the real guards and a real database.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
const session = vi.hoisted(() => ({ authTime: 0 as number | undefined }));
vi.mock("@/auth", () => ({ auth: async () => ({ authTime: session.authTime, user: {} }) }));
const current = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/dal", async () => {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { eq: equals } = await import("drizzle-orm");
  return { getCurrentUser: async () => (await db.select().from(users).where(equals(users.id, current.id)))[0] };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("@/lib/r2", () => ({ deleteObject: async () => {}, listObjectKeys: async () => [], isR2Configured: () => true, UPLOAD_URL_TTL_SECONDS: 300 }));

const { db } = await import("@/db");
const { ADMIN_ROLES, adminAuditLogs, adminTeamMembers, institutions, users } = await import("@/db/schema");
const rbac = await import("./rbac");
const { requireAdmin } = await import("@/lib/admin");
const students = await import("@/app/admin/students/actions");
const tickets = await import("@/app/admin/tickets/actions");
const emails = await import("@/app/admin/emails/actions");
const aiOps = await import("@/app/admin/ai-ops/actions");
const flags = await import("@/app/admin/flags/actions");
const inst = await import("@/app/admin/institutions/actions");

const UUID = "00000000-0000-4000-8000-00000000abcd";
type Permission = (typeof rbac.ALL_ADMIN_PERMISSIONS)[number];

/** Each protected action with the permission it must demand. Inputs stop early, so a pass changes nothing. */
const ACTIONS: [string, Permission, () => Promise<unknown>][] = [
  ["revokeStudentSessionsAction", "students.sessions.revoke", () => students.revokeStudentSessionsAction(UUID)],
  ["executeStudentDeletionAction", "students.delete.approve", () => students.executeStudentDeletionAction(UUID, " ")],
  ["createTicketAction", "support.tickets.create", () => tickets.createTicketAction(new FormData())],
  ["postTicketMessageAction reply", "support.tickets.reply", () => tickets.postTicketMessageAction(UUID, " ", false)],
  ["postTicketMessageAction note", "support.tickets.note", () => tickets.postTicketMessageAction(UUID, " ", true)],
  ["changeTicketStatusAction", "support.tickets.close", () => tickets.changeTicketStatusAction(UUID, "closed")],
  ["assignTicketAction", "support.tickets.assign", () => tickets.assignTicketAction(UUID, null)],
  ["saveTemplateVersionAction", "email.templates.publish", () => emails.saveTemplateVersionAction(UUID, "s", "s", "h", "t", null, "n")],
  ["sendTestEmailAction", "email.send.test", () => emails.sendTestEmailAction("s", "not-an-address", "s", "h", "t")],
  ["triggerOutboxDeliveryAction", "email.delivery.retry", () => emails.triggerOutboxDeliveryAction()],
  ["updateBudgetPolicyAction", "ai.budgets.manage", () => aiOps.updateBudgetPolicyAction(new FormData())],
  ["toggleFlagAction", "flags.manage", () => flags.toggleFlagAction(new FormData())],
  ["approveInstitution", "institutions.manage", () => inst.approveInstitution("not-a-uuid")],
  ["mergeInstitution", "institutions.manage", () => inst.mergeInstitution("not-a-uuid", "x")],
  ["rejectInstitution", "institutions.manage", () => inst.rejectInstitution("not-a-uuid")],
];

const isDenied = (error: unknown) => String((error as { digest?: string }).digest ?? "").includes("HTTP_ERROR_FALLBACK;404");
const outcome = async (run: () => Promise<unknown>) => {
  try {
    await run();
    return "allowed";
  } catch (error) {
    return isDenied(error) ? "denied" : "allowed"; // a later failure is past the guard
  }
};

let next = 1;
async function newUser(extra: Partial<typeof users.$inferInsert> = {}) {
  const id = `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
  await db.insert(users).values({ id, email: `${id}@example.com`, ...extra });
  return id;
}
async function member(role: (typeof ADMIN_ROLES)[number], extra: Partial<typeof users.$inferInsert> = {}, memberExtra: Partial<typeof adminTeamMembers.$inferInsert> = {}) {
  const id = await newUser(extra);
  await db.insert(adminTeamMembers).values({ userId: id, role, ...memberExtra });
  return id;
}
const contextOf = async (id: string) => rbac.getAdminContext((await db.select().from(users).where(eq(users.id, id)))[0]);

beforeAll(() => {
  vi.stubEnv("ADMIN_EMAILS", "root@example.com");
});

beforeEach(() => {
  session.authTime = Math.floor(Date.now() / 1000);
});

describe.each(ADMIN_ROLES)("role %s", (role) => {
  it.each(ACTIONS)("%s needs %s", async (_name, permission, run) => {
    current.id = await member(role);
    const expected = rbac.ROLE_PERMISSIONS[role].includes(permission) ? "allowed" : "denied";
    expect(await outcome(run)).toBe(expected);
  });

  it("gets exactly its listed permissions", async () => {
    const ctx = await contextOf(await member(role));
    for (const permission of rbac.ALL_ADMIN_PERMISSIONS) {
      expect(rbac.hasPermission(ctx!, permission)).toBe(rbac.ROLE_PERMISSIONS[role].includes(permission));
    }
  });
});

describe("the role-permission matrix", () => {
  it("is what we reviewed: changes here are deliberate", () => {
    const sensitive: Record<string, string[]> = {
      "students.delete.approve": ["super_admin"],
      "students.sessions.revoke": ["super_admin"],
      "team.manage": ["super_admin"],
      "flags.manage": ["super_admin"],
      "email.templates.publish": ["super_admin"],
      "email.send.test": ["super_admin"],
      "institutions.manage": ["super_admin", "support_admin"],
      "audit.read": ["super_admin", "finance_admin", "security_auditor"],
      "ai.budgets.manage": ["super_admin", "ai_ops", "finance_admin"],
    };
    for (const [permission, roles] of Object.entries(sensitive)) {
      const holders = ADMIN_ROLES.filter((r) => (rbac.ROLE_PERMISSIONS[r] as readonly string[]).includes(permission));
      expect(holders, permission).toEqual(roles);
    }
  });

  it("only lists permissions that exist, and super_admin holds them all", () => {
    for (const role of ADMIN_ROLES) for (const p of rbac.ROLE_PERMISSIONS[role]) expect(rbac.ALL_ADMIN_PERMISSIONS).toContain(p);
    expect([...rbac.ROLE_PERMISSIONS.super_admin].sort()).toEqual([...rbac.ALL_ADMIN_PERMISSIONS].sort());
  });
});

describe("who is an operator", () => {
  it("a normal user is not, and gets 404 from every action", async () => {
    current.id = await newUser();
    expect(await contextOf(current.id)).toBeNull();
    for (const [, , run] of ACTIONS) expect(await outcome(run)).toBe("denied");
  });

  it("ADMIN_EMAILS is always super_admin, even with a lesser or inactive row, however it's cased", async () => {
    const id = await member("support_agent", { email: "Root@Example.com" }, { isActive: false });
    expect(await contextOf(id)).toMatchObject({ role: "super_admin", isSuperAdmin: true });
  });

  it("users.is_admin alone is super_admin", async () => {
    expect(await contextOf(await newUser({ isAdmin: true }))).toMatchObject({ role: "super_admin", isSuperAdmin: true });
  });

  it("a lesser role really limits an is_admin user: the original finding", async () => {
    current.id = await member("support_agent", { isAdmin: true });
    expect(await contextOf(current.id)).toMatchObject({ role: "support_agent", isSuperAdmin: false });
    expect(await outcome(() => flags.toggleFlagAction(new FormData()))).toBe("denied");
    expect(await outcome(() => students.revokeStudentSessionsAction(UUID))).toBe("denied");
  });

  it("deactivating removes access at the next request, whatever the session says", async () => {
    current.id = await member("super_admin");
    expect(await outcome(() => flags.toggleFlagAction(new FormData()))).toBe("allowed");
    await db.update(adminTeamMembers).set({ isActive: false }).where(eq(adminTeamMembers.userId, current.id));
    expect(await outcome(() => flags.toggleFlagAction(new FormData()))).toBe("denied");
  });

  it("an inactive row also removes is_admin", async () => {
    expect(await contextOf(await member("super_admin", { isAdmin: true }, { isActive: false }))).toBeNull();
  });

  it("a role change applies at the next request", async () => {
    current.id = await member("super_admin");
    await db.update(adminTeamMembers).set({ role: "support_agent" }).where(eq(adminTeamMembers.userId, current.id));
    expect(await outcome(() => flags.toggleFlagAction(new FormData()))).toBe("denied");
  });

  it("custom permissions add what they name and nothing unknown", async () => {
    const id = await member("support_agent", {}, { customPermissions: ["flags.manage", "everything", "*"] });
    const ctx = await contextOf(id);
    expect(rbac.hasPermission(ctx!, "flags.manage")).toBe(true);
    expect(rbac.hasPermission(ctx!, "team.manage")).toBe(false);
    expect(ctx!.permissions).not.toContain("*");
  });

  it("team-only members can get in through requireAdmin", async () => {
    current.id = await member("content_editor");
    expect((await requireAdmin()).id).toBe(current.id);
  });
});

describe("admin session lifetime", () => {
  const isRedirect = (error: unknown) => String((error as { digest?: string }).digest ?? "").includes("NEXT_REDIRECT");

  it("sends a day-old session, or one from before the claim, to sign in again", async () => {
    current.id = await newUser({ isAdmin: true });
    for (const stale of [Math.floor(Date.now() / 1000) - 25 * 3600, undefined]) {
      session.authTime = stale;
      await expect(rbac.requireAdminPermission("flags.manage")).rejects.toSatisfy(isRedirect);
    }
  });

  it("doesn't tell a non-operator that /admin exists", async () => {
    current.id = await newUser();
    session.authTime = undefined;
    await expect(rbac.requireAdminPermission("flags.manage")).rejects.toSatisfy(isDenied);
  });
});

describe("institution actions", () => {
  it("record who did what", async () => {
    current.id = await member("support_admin");
    const [row] = await db.insert(institutions).values({ canonicalName: "Test Institute", verificationStatus: "pending", countryCode: "IN", source: "user" } as never).returning();
    expect(await inst.approveInstitution(row.id)).toEqual({ ok: true });
    const [audit] = await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.targetId, row.id));
    expect(audit).toMatchObject({ action: "institution.approve", actorId: current.id, resource: "institutions" });
  });
});

describe("every admin surface is guarded in the source", () => {
  const root = path.resolve(import.meta.dirname, "../../app/admin");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = path.join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  const relative = (file: string) => path.relative(root, file).replaceAll("\\", "/");

  it("each page checks a specific permission, apart from the overview, which limits itself", () => {
    const pages = walk(root).filter((f) => f.endsWith("page.tsx") && relative(f) !== "page.tsx");
    expect(pages.length).toBeGreaterThan(15);
    for (const page of pages) expect(readFileSync(page, "utf8"), relative(page)).toMatch(/requireAdminPermission\("[\w.]+"\)/);
  });

  it("each exported action checks a permission first", () => {
    const files = walk(root).filter((f) => f.endsWith("actions.ts"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const bodies = source.split(/^export async function /m).slice(1);
      expect(bodies.length, relative(file)).toBeGreaterThan(0);
      for (const body of bodies) expect(body, `${relative(file)}: ${body.slice(0, 40)}`).toMatch(/requireAdminPermission\(|await operator\(\)/);
    }
  });

  it("the table above covers every exported action", () => {
    const exported = walk(root)
      .filter((f) => f.endsWith("actions.ts"))
      .flatMap((f) => [...readFileSync(f, "utf8").matchAll(/^export async function (\w+)/gm)].map((m) => m[1]));
    const covered = ACTIONS.map(([name]) => name.split(" ")[0]);
    for (const name of exported) expect(covered, name).toContain(name);
  });
});
