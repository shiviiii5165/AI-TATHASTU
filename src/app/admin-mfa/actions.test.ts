// MFA-02 regression: admin TOTP guessing is bounded per day, not only per 15 minutes. Runs the real
// submitCode against the real Postgres-backed limiter (PGlite); only identity and TOTP are stubbed.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => ({ db: await (await import("@/test/db")).createTestDb() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); }, redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/auth", () => ({ auth: async () => ({ authTime: Math.floor(Date.now() / 1000) }), signOut: async () => {} }));
vi.mock("@/lib/dal", () => ({ getCurrentUser: async () => ({ id: "00000000-0000-4000-8000-00000000a001", email: "op@example.com", sessionVersion: 0 }) }));
vi.mock("@/lib/admin/rbac", () => ({ getAdminContext: async () => ({ role: "super_admin" }) }));
vi.mock("@/lib/admin/audit", () => ({ recordAdminAudit: async () => {} }));
const verify = vi.hoisted(() => vi.fn(async () => false));
vi.mock("@/lib/admin/mfa", () => ({
  beginMfaEnrollment: async () => {},
  getMfaEnrollment: async () => ({ confirmed: true }),
  isMfaKeyConfigured: () => true,
  isRecentAuth: () => true,
  issueRecoveryCodes: async () => [],
  looksLikeRecoveryCode: () => false,
  notifyMfaChange: async () => {},
  redeemRecoveryCode: async () => false,
  setMfaProofCookie: async () => {},
  verifyAdminMfaCode: verify,
}));

const { db } = await import("@/db");
const { rateLimits } = await import("@/db/schema");
const { submitCode } = await import("./actions");

const form = (code: string) => {
  const f = new FormData();
  f.set("code", code);
  return f;
};

describe("admin MFA guessing limits", () => {
  beforeEach(async () => {
    await db.delete(rateLimits);
    verify.mockClear();
  });

  it("refuses a 6th attempt within 15 minutes without verifying it", async () => {
    for (let i = 0; i < 5; i++) expect((await submitCode({}, form("000000"))).error).toMatch(/didn't work/);
    expect((await submitCode({}, form("123456"))).error).toMatch(/Too many attempts\. Try again in 15/);
    expect(verify).toHaveBeenCalledTimes(5);
  });

  it("caps attempts per day even when every 15-minute window is respected", async () => {
    // Simulate earlier windows today: 4 windows x 5 attempts = 20 already spent.
    const day = Math.floor(Date.now() / 1000);
    await db.insert(rateLimits).values({ key: "admin_mfa_day:00000000-0000-4000-8000-00000000a001", windowStart: new Date((day - (day % 86_400)) * 1000), count: 20 });
    const res = await submitCode({}, form("123456"));
    expect(res.error).toMatch(/Too many attempts today/);
    expect(verify, "the code is never checked once the daily cap is reached").not.toHaveBeenCalled();
  });
});
