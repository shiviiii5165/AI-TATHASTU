import { afterEach, describe, expect, it, vi } from "vitest";

import { adminEmails, isAdminEmail } from "./admin-emails";

describe("Admin Email Environment Configuration (adminEmails / isAdminEmail)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails closed and returns an empty list when ADMIN_EMAILS is unset (no hardcoded credentials)", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(adminEmails()).toEqual([]);
    expect(isAdminEmail("720anant@gmail.com")).toBe(false);
    expect(isAdminEmail("admin@aitathastu.com")).toBe(false);
  });

  it("parses comma-separated values, trims whitespace, and lowercases emails", () => {
    vi.stubEnv("ADMIN_EMAILS", " admin@aitathastu.com, 720anant@gmail.com , SUPPORT@example.com ");
    expect(adminEmails()).toEqual([
      "admin@aitathastu.com",
      "720anant@gmail.com",
      "support@example.com",
    ]);

    expect(isAdminEmail("Admin@AITathastu.com")).toBe(true);
    expect(isAdminEmail("720anant@gmail.com")).toBe(true);
    expect(isAdminEmail("support@example.com")).toBe(true);
    expect(isAdminEmail("other@example.com")).toBe(false);
  });

  it("handles null, undefined, empty, or malformed email inputs safely without throwing", () => {
    vi.stubEnv("ADMIN_EMAILS", "admin@aitathastu.com");
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail("   ")).toBe(false);
  });
});
