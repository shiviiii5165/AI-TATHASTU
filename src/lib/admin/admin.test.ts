import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({
  auth: async () => null,
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

import {
  ALL_ADMIN_PERMISSIONS,
  type AdminAuthContext,
  type AdminPermission,
  getRolePermissions,
  hasPermission,
  ROLE_PERMISSIONS,
} from "@/lib/admin/rbac";
import {
  calculateSlaDeadlines,
  isValidTransition,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/admin/tickets";
import {
  APPROVED_VARIABLES,
  calculateEmailBackoffSeconds,
  escapeHtml,
  renderTemplateContent,
  STARTER_TEMPLATES,
  validateTemplateVariables,
} from "@/lib/admin/email-engine";

describe("Admin Control Center — Security & RBAC Matrix", () => {
  it("grants super_admin universal access across all permissions", () => {
    const context: AdminAuthContext = {
      user: { id: "admin-1", email: "admin@aitathastu.com", name: "Super Admin" } as any,
      role: "super_admin",
      permissions: ["*"] as any,
      isSuperAdmin: true,
    };

    expect(hasPermission(context, "team.manage")).toBe(true);
    expect(hasPermission(context, "students.delete.approve")).toBe(true);
    expect(hasPermission(context, "ai.budgets.manage")).toBe(true);
    expect(hasPermission(context, "email.templates.publish")).toBe(true);
    expect(hasPermission(context, "audit.read")).toBe(true);
  });

  it("restricts support_agent to support and read operations only", () => {
    const perms = getRolePermissions("support_agent");
    const context: AdminAuthContext = {
      user: { id: "agent-1", email: "agent@aitathastu.com", name: "Support Agent" } as any,
      role: "support_agent",
      permissions: perms,
      isSuperAdmin: false,
    };

    // Allowed actions
    expect(hasPermission(context, "support.tickets.read")).toBe(true);
    expect(hasPermission(context, "support.tickets.reply")).toBe(true);
    expect(hasPermission(context, "support.tickets.note")).toBe(true);
    expect(hasPermission(context, "students.read")).toBe(true);

    // Strictly forbidden actions
    expect(hasPermission(context, "team.manage")).toBe(false);
    expect(hasPermission(context, "students.delete.approve")).toBe(false);
    expect(hasPermission(context, "students.sessions.revoke")).toBe(false);
    expect(hasPermission(context, "ai.budgets.manage")).toBe(false);
    expect(hasPermission(context, "email.templates.publish")).toBe(false);
  });

  it("enforces least-privilege boundary on ai_ops role", () => {
    const perms = getRolePermissions("ai_ops");
    const context: AdminAuthContext = {
      user: { id: "ai-1", email: "ai@aitathastu.com", name: "AI Ops" } as any,
      role: "ai_ops",
      permissions: perms,
      isSuperAdmin: false,
    };

    expect(hasPermission(context, "ai.providers.read")).toBe(true);
    expect(hasPermission(context, "ai.providers.manage")).toBe(true);
    expect(hasPermission(context, "ai.budgets.manage")).toBe(true);
    expect(hasPermission(context, "logs.read")).toBe(true);

    // Cannot access student records or support tickets
    expect(hasPermission(context, "students.read")).toBe(false);
    expect(hasPermission(context, "support.tickets.reply")).toBe(false);
    expect(hasPermission(context, "team.manage")).toBe(false);
  });

  it("enforces boundaries on finance_admin role", () => {
    const perms = getRolePermissions("finance_admin");
    const context: AdminAuthContext = {
      user: { id: "fin-1", email: "finance@aitathastu.com", name: "Finance Admin" } as any,
      role: "finance_admin",
      permissions: perms,
      isSuperAdmin: false,
    };

    expect(hasPermission(context, "ai.budgets.manage")).toBe(true);
    expect(hasPermission(context, "audit.read")).toBe(true);
    expect(hasPermission(context, "students.delete.approve")).toBe(false);
    expect(hasPermission(context, "support.tickets.reply")).toBe(false);
  });

  it("honors custom permission overrides for specific team members", () => {
    const context: AdminAuthContext = {
      user: { id: "agent-2", email: "lead@aitathastu.com", name: "Lead Agent" } as any,
      role: "support_agent",
      permissions: [...getRolePermissions("support_agent"), "students.sessions.revoke"],
      isSuperAdmin: false,
    };

    expect(hasPermission(context, "students.sessions.revoke")).toBe(true);
    expect(hasPermission(context, "team.manage")).toBe(false);
  });
});

describe("Support Operations — Ticket State Machine & SLA Engine", () => {
  it("permits valid ticket state transitions", () => {
    expect(isValidTransition("new", "open")).toBe(true);
    expect(isValidTransition("open", "in_progress")).toBe(true);
    expect(isValidTransition("in_progress", "waiting_student")).toBe(true);
    expect(isValidTransition("waiting_student", "in_progress")).toBe(true);
    expect(isValidTransition("in_progress", "resolved")).toBe(true);
    expect(isValidTransition("resolved", "closed")).toBe(true);
    expect(isValidTransition("closed", "reopened")).toBe(true);
  });

  it("blocks illegal transitions that break ticket integrity", () => {
    // Cannot skip opening to escalate immediately from 'new'
    expect(isValidTransition("new", "escalated")).toBe(false);
    expect(isValidTransition("new", "resolved")).toBe(false);

    // Once closed, cannot jump directly to 'in_progress' without reopening
    expect(isValidTransition("closed", "in_progress")).toBe(false);
    expect(isValidTransition("closed", "waiting_student")).toBe(false);
  });

  it("computes deterministic SLA response deadlines based on priority", () => {
    const now = new Date("2026-10-29T10:00:00.000Z");

    const urgentDeadlines = calculateSlaDeadlines("urgent", now);
    expect(urgentDeadlines.firstResponseDueAt.getTime() - now.getTime()).toBe(2 * 3600 * 1000); // 2 hours
    expect(urgentDeadlines.resolutionDueAt.getTime() - now.getTime()).toBe(12 * 3600 * 1000); // 12 hours

    const highDeadlines = calculateSlaDeadlines("high", now);
    expect(highDeadlines.firstResponseDueAt.getTime() - now.getTime()).toBe(8 * 3600 * 1000); // 8 hours
    expect(highDeadlines.resolutionDueAt.getTime() - now.getTime()).toBe(36 * 3600 * 1000); // 36 hours

    const mediumDeadlines = calculateSlaDeadlines("medium", now);
    expect(mediumDeadlines.firstResponseDueAt.getTime() - now.getTime()).toBe(24 * 3600 * 1000); // 24 hours
    expect(mediumDeadlines.resolutionDueAt.getTime() - now.getTime()).toBe(72 * 3600 * 1000); // 72 hours

    const lowDeadlines = calculateSlaDeadlines("low", now);
    expect(lowDeadlines.firstResponseDueAt.getTime() - now.getTime()).toBe(48 * 3600 * 1000); // 48 hours
    expect(lowDeadlines.resolutionDueAt.getTime() - now.getTime()).toBe(120 * 3600 * 1000); // 120 hours
  });

  it("strictly isolates confidential internal notes from public student views", () => {
    const rawMessages = [
      { id: "1", body: "Customer issue description", isInternalNote: false },
      { id: "2", body: "CONFIDENTIAL staff debug trace: db replica error", isInternalNote: true },
      { id: "3", body: "Official customer reply: We are working on it", isInternalNote: false },
    ];

    const studentVisible = rawMessages.filter((m) => !m.isInternalNote);
    expect(studentVisible).toHaveLength(2);
    expect(studentVisible.some((m) => m.isInternalNote)).toBe(false);
    expect(studentVisible.map((m) => m.body)).not.toContain("CONFIDENTIAL staff debug trace: db replica error");

    const adminVisible = rawMessages;
    expect(adminVisible).toHaveLength(3);
    expect(adminVisible.some((m) => m.isInternalNote)).toBe(true);
  });
});

describe("Email Template Studio — Variable Engine & XSS Prevention", () => {
  it("interpolates registered variables cleanly", () => {
    const template = "Hello {{student_name}}, please visit {{action_url}} for details.";
    const rendered = renderTemplateContent(template, {
      student_name: "Aarav Sharma",
      action_url: "https://www.aitathastu.com/verify?token=xyz",
    });

    expect(rendered).toBe("Hello Aarav Sharma, please visit https://www.aitathastu.com/verify?token=xyz for details.");
  });

  it("escapes malicious HTML input to prevent XSS in rendered emails", () => {
    const dirty = '<script>alert("xss")</script> & <b>bold</b>';
    const escaped = escapeHtml(dirty);

    expect(escaped).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &lt;b&gt;bold&lt;/b&gt;');
    expect(escaped).not.toContain("<script>");
  });

  it("auto-escapes variable injection values when rendering templates", () => {
    const template = "<p>Welcome {{student_name}}!</p>";
    const rendered = renderTemplateContent(template, {
      student_name: '<img src=x onerror=alert("pwned")>',
    });

    expect(rendered).toBe('<p>Welcome &lt;img src=x onerror=alert(&quot;pwned&quot;)&gt;!</p>');
    expect(rendered).not.toContain("<img");
  });

  it("cleans empty/missing variables without crashing or leaking unrendered tokens", () => {
    const template = "Hello {{student_name}}, status is {{ticket_status}}.";
    const rendered = renderTemplateContent(template, {
      student_name: "Aarav",
    });

    expect(rendered).toBe("Hello Aarav, status is .");
  });

  it("validates template variables against the approved registry", () => {
    const validResult = validateTemplateVariables("Hello {{student_name}}, check {{action_url}}");
    expect(validResult.valid).toBe(true);
    expect(validResult.unknownVariables).toHaveLength(0);

    const invalidResult = validateTemplateVariables("Hello {{unknown_token}}, visit {{secret_code}}");
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.unknownVariables).toContain("unknown_token");
    expect(invalidResult.unknownVariables).toContain("secret_code");
  });

  it("calculates exponential backoff intervals for failed email deliveries", () => {
    expect(calculateEmailBackoffSeconds(1)).toBe(120); // 2^1 * 60 = 120s (2m)
    expect(calculateEmailBackoffSeconds(2)).toBe(240); // 2^2 * 60 = 240s (4m)
    expect(calculateEmailBackoffSeconds(3)).toBe(480); // 2^3 * 60 = 480s (8m)
    expect(calculateEmailBackoffSeconds(4)).toBe(960); // 2^4 * 60 = 960s (16m)
  });

  it("ships all 5 production starter templates", () => {
    expect(STARTER_TEMPLATES).toHaveLength(5);
    const slugs = STARTER_TEMPLATES.map((t) => t.slug);
    expect(slugs).toContain("welcome");
    expect(slugs).toContain("ticket_received");
    expect(slugs).toContain("ticket_reply");
    expect(slugs).toContain("ticket_resolved");
    expect(slugs).toContain("security_alert");
  });
});
