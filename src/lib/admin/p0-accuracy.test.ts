/**
 * Admin OS Phase 1 (P0): counts come from the whole table, no fabricated statuses or fallback values,
 * and opening an admin page never writes to the database.
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => ({ push() {}, refresh() {} }), notFound: () => { throw new Error("NOT_FOUND"); }, redirect: () => { throw new Error("REDIRECT"); } }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/components/theme-toggle-button", () => ({ ThemeToggleButton: () => null }));
vi.mock("@/lib/r2", () => ({ deleteObject: async () => {}, listObjectKeys: async () => [], isR2Configured: () => false, UPLOAD_URL_TTL_SECONDS: 300 }));
const ADMIN = { id: "00000000-0000-4000-8000-000000000001", email: "ops@example.test", name: "Ops" };
vi.mock("@/lib/admin", () => ({ requireAdmin: async () => ADMIN, isAdmin: () => true }));
vi.mock("@/lib/admin/rbac", async () => {
  const ctx = { user: ADMIN, role: "super_admin", permissions: [], isSuperAdmin: true };
  return { getAdminContext: async () => ctx, requireAdminPermission: async () => ctx, requireOperator: async () => ctx, hasPermission: () => true, ROLE_PERMISSIONS: new Proxy({}, { get: () => [] }) };
});

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { adminAuditLogs, adminTeamMembers, emailDeliveries, newsletterCampaigns, newsletterSubscribers, supportTickets, users } = schema;
const summaries = await import("./summaries");

const html = async (page: () => Promise<ReactElement>) => renderToStaticMarkup(await page());
const count = async (table: string) => Number(((await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${table}`))).rows[0] as { n: number }).n);
const WRITE_TABLES = ["email_templates", "email_template_versions", "knowledge_base_articles", "cms_announcements", "admin_audit_logs"];

let n = 0;
const ticket = (status: string, priority: string) =>
  db.insert(supportTickets).values({ ticketNumber: `T-${++n}`, requesterEmail: `r${n}@example.test`, subject: `s${n}`, status: status as never, priority: priority as never });

beforeAll(async () => {
  await db.insert(users).values(ADMIN);
});

describe("ticket counts", () => {
  it("open excludes resolved and closed, across all tickets, and urgent/high counts only open ones", async () => {
    // 8 tickets: more than the five the Overview lists.
    for (const [s, p] of [["new", "urgent"], ["open", "high"], ["in_progress", "low"], ["waiting_student", "medium"], ["escalated", "urgent"], ["reopened", "low"], ["resolved", "urgent"], ["closed", "high"]] as const) await ticket(s, p);
    expect(await summaries.ticketQueueSummary()).toEqual({ total: 8, open: 6, urgentOrHighOpen: 3 });
  });

  it("the Overview shows those whole-table counts, not counts from its five listed rows", async () => {
    const { default: Overview } = await import("@/app/admin/page");
    const out = await html(Overview);
    expect(out).toMatch(/Open tickets<\/div><div[^>]*>6</);
    expect(out).toContain("3 open urgent/high priority");
    expect(out).not.toContain("across all personas");
  });
});

describe("delivery counts", () => {
  it("are aggregated over the whole outbox, not the latest 50 rows", async () => {
    const rows = [
      ...Array.from({ length: 60 }, (_, i) => ({ status: "delivered", i })),
      ...Array.from({ length: 4 }, (_, i) => ({ status: "failed", i })),
      ...Array.from({ length: 3 }, (_, i) => ({ status: "queued", i })),
    ];
    await db.insert(emailDeliveries).values(rows.map((r, i) => ({ recipient: `d${i}@example.test`, subject: "x", htmlBody: "x", textBody: "x", status: r.status })));
    const c = await summaries.deliveryStatusCounts();
    expect(c).toMatchObject({ queued: 3, delivered: 60, failed: 4, total: 67 });

    const { default: Deliveries } = await import("@/app/admin/emails/deliveries/page");
    const out = await html(Deliveries);
    expect(out).toContain(">60<");
    expect(out).toContain("Totals cover all 67 deliveries");
    expect(out).toContain("The table shows the latest 50");
  });
});

describe("admin team status", () => {
  it("shows inactive members as inactive and counts them separately", async () => {
    const u2 = "00000000-0000-4000-8000-000000000002";
    const u3 = "00000000-0000-4000-8000-000000000003";
    await db.insert(users).values([{ id: u2, email: "a@example.test", name: "A" }, { id: u3, email: "b@example.test", name: "B" }]);
    await db.insert(adminTeamMembers).values([{ userId: u2, role: "support_agent", isActive: true }, { userId: u3, role: "ai_ops", isActive: false }]);
    expect(summaries.teamSummary([{ isActive: true }, { isActive: false }])).toEqual({ total: 2, active: 1, inactive: 1 });

    const { default: Team } = await import("@/app/admin/team/page");
    const out = await html(Team);
    expect(out).toContain("Staff Members (2) · 1 active · 1 inactive");
    expect(out).toContain(">Inactive<");
  });
});

describe("audit IP", () => {
  it("a missing IP shows Unknown, never a placeholder address", async () => {
    expect(summaries.displayIp(null)).toBe("Unknown");
    expect(summaries.displayIp("  ")).toBe("Unknown");
    expect(summaries.displayIp("203.0.113.9")).toBe("203.0.113.9");
    await db.insert(adminAuditLogs).values({ actorEmail: "ops@example.test", action: "test.action", resource: "x", ipAddress: null });

    const { default: Logs } = await import("@/app/admin/logs/page");
    const out = await renderToStaticMarkup(await Logs({ searchParams: Promise.resolve({}) }));
    expect(out).toContain("test.action");
    expect(out).toContain(">Unknown<");
    expect(out).not.toContain("127.0.0.1");
  });
});

describe("newsletter", () => {
  it("counts subscribers by real status and only sent campaigns", async () => {
    await db.insert(newsletterSubscribers).values([
      { email: "s1@example.test", status: "subscribed", consentSource: "footer" },
      { email: "s2@example.test", status: "subscribed", consentSource: "footer" },
      { email: "s3@example.test", status: "unsubscribed", consentSource: "footer" },
      { email: "s4@example.test", status: "bounced", consentSource: "footer" },
    ]);
    await db.insert(newsletterCampaigns).values([
      { title: "c1", subject: "c1", htmlContent: "x", status: "sent" },
      { title: "c2", subject: "c2", htmlContent: "x", status: "draft" },
      { title: "c3", subject: "c3", htmlContent: "x", status: "scheduled" },
    ]);
    const s = await summaries.newsletterSummary();
    expect(s).toMatchObject({ subscribed: 2, subscribersTotal: 4, campaignsSent: 1, campaignsTotal: 3 });

    const { default: Newsletter } = await import("@/app/admin/newsletter/page");
    const out = await html(Newsletter);
    expect(out).toMatch(/data-testid="subscribed-count"[^>]*>2</);
    expect(out).toMatch(/data-testid="campaigns-sent"[^>]*>1</);
    // An unsubscribed or bounced row is not painted green.
    expect(summaries.subscriberTone("unsubscribed")).not.toContain("emerald");
    expect(summaries.subscriberTone("bounced")).not.toContain("emerald");
  });
});

describe("page views are read-only", () => {
  it("rendering Overview, Knowledge Base and CMS writes nothing", async () => {
    const before = Object.fromEntries(await Promise.all(WRITE_TABLES.map(async (t) => [t, await count(t)] as const)));
    const pages = await Promise.all([import("@/app/admin/page"), import("@/app/admin/kb/page"), import("@/app/admin/cms/page")]);
    for (const p of pages) await html(p.default);
    const after = Object.fromEntries(await Promise.all(WRITE_TABLES.map(async (t) => [t, await count(t)] as const)));
    expect(after).toEqual(before);
  });

  it("Knowledge Base and CMS say they are not live on the student site", async () => {
    for (const mod of [await import("@/app/admin/kb/page"), await import("@/app/admin/cms/page")]) {
      const out = await html(mod.default);
      expect(out).toContain("Not live on the student site.");
    }
  });
});

describe("honest status", () => {
  it("automation rules are labelled not implemented, never active", async () => {
    const { default: Automation } = await import("@/app/admin/automation/page");
    const out = await html(Automation);
    expect(out).toContain("Not implemented.");
    expect(out).not.toContain(">Active<");
    expect(out).not.toContain("Active Automation Policies");
  });

  it("no component is called healthy without a check", async () => {
    const { default: System } = await import("@/app/admin/system/page");
    const sys = await html(System);
    for (const fake of ["Connected &amp; Healthy", "Neon Serverless", "Active (FastAPI)", ">Operational<"]) expect(sys).not.toContain(fake);
    // Real checks now exist (database, queues, email…); the worker service and storage still have none.
    expect(sys).toMatch(/Background worker service<\/h3>[\s\S]*?Not monitored/);
    expect(sys).toMatch(/File storage<\/h3>[\s\S]*?Not monitored/);

    const { default: Overview } = await import("@/app/admin/page");
    const ov = await html(Overview);
    expect(ov).not.toContain("100% OK");
    expect(ov).toMatch(/data-testid="operational-status"[\s\S]*Not monitored/);

    const { AdminShell } = await import("@/components/admin/admin-shell");
    const shell = renderToStaticMarkup(createElement(AdminShell, { userEmail: "ops@example.test", role: "super_admin" } as Parameters<typeof AdminShell>[0], null));
    expect(shell).toContain("Status: not monitored");
    expect(shell).not.toMatch(/>Healthy</);
  });

  it("email branding does not claim SPF/DKIM verification", async () => {
    const { default: Settings } = await import("@/app/admin/emails/settings/page");
    const out = await html(Settings);
    expect(out).toContain("Domain authentication (SPF/DKIM): not checked.");
    expect(out).not.toContain("and SPF/DKIM verification");
  });
});
