import { randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
const cookieJar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => cookieJar.set(name, value),
  }),
}));
const redirected = vi.hoisted(() => vi.fn((path: string) => {
  throw new Error(`redirect:${path}`);
}));
vi.mock("next/navigation", () => ({ redirect: redirected }));

process.env.CONNECTOR_TOKEN_KEY = randomBytes(32).toString("base64");
process.env.AUTH_SECRET = "auth-secret-auth-secret-auth-secret-1234";
process.env.ADMIN_MFA_SECRET = "mfa-secret-mfa-secret-mfa-secret-mfa-1234";

const { db } = await import("@/db");
const { adminAuditLogs, adminMfa, adminMfaRecoveryCodes, users } = await import("@/db/schema");
const mfa = await import("./mfa");
const { decodeTotpSecret, hotp } = await import("./totp");

const USER = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const RECOVERING = "00000000-0000-4000-8000-000000000003";
const codeFor = async (userId: string) => {
  const enrollment = await mfa.getMfaEnrollment(userId);
  return hotp(decodeTotpSecret(enrollment!.secret), Math.floor(Date.now() / 30000));
};
const operator = (id: string, version = 0) => ({ id, email: `${id}@example.com`, sessionVersion: version });

beforeAll(async () => {
  await db.insert(users).values([
    { id: USER, name: "Operator", email: "op@example.com" },
    { id: OTHER, name: "Other", email: "other@example.com" },
    { id: RECOVERING, name: "Recovering", email: "rec@example.com" },
  ]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  cookieJar.clear();
});

describe("admin MFA enrollment and verification", () => {
  it("has nothing to verify before enrollment", async () => {
    expect(await mfa.verifyAdminMfaCode(USER, "123456")).toBe(false);
  });

  it("stays unconfirmed after a wrong code", async () => {
    await mfa.beginMfaEnrollment(USER);
    const code = await codeFor(USER);
    const wrong = code === "000000" ? "000001" : "000000";
    expect(await mfa.verifyAdminMfaCode(USER, wrong)).toBe(false);
    expect((await mfa.getMfaEnrollment(USER))?.confirmed).toBe(false);
  });

  it("confirms on the right code, then refuses to accept it twice", async () => {
    const code = await codeFor(USER);
    expect(await mfa.verifyAdminMfaCode(USER, code)).toBe(true);
    expect((await mfa.getMfaEnrollment(USER))?.confirmed).toBe(true);
    expect(await mfa.verifyAdminMfaCode(USER, code)).toBe(false);
  });

  it("lets only one of two racing confirmations use a code", async () => {
    await mfa.beginMfaEnrollment(OTHER);
    const code = await codeFor(OTHER);
    const results = await Promise.all([mfa.verifyAdminMfaCode(OTHER, code), mfa.verifyAdminMfaCode(OTHER, code)]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it("does not replace a confirmed secret when enrollment is started again", async () => {
    const before = (await mfa.getMfaEnrollment(USER))?.secret;
    await mfa.beginMfaEnrollment(USER);
    expect((await mfa.getMfaEnrollment(USER))?.secret).toBe(before);
  });

  it("keeps a fresh unconfirmed secret, and replaces an abandoned one", async () => {
    await mfa.beginMfaEnrollment(RECOVERING);
    const first = (await mfa.getMfaEnrollment(RECOVERING))?.secret;
    await mfa.beginMfaEnrollment(RECOVERING);
    expect((await mfa.getMfaEnrollment(RECOVERING))?.secret).toBe(first);

    await db.update(adminMfa).set({ createdAt: sql`now() - interval '1 hour'` }).where(eq(adminMfa.userId, RECOVERING));
    await mfa.beginMfaEnrollment(RECOVERING);
    expect((await mfa.getMfaEnrollment(RECOVERING))?.secret).not.toBe(first);
  });
});

describe("recent authentication gate", () => {
  const now = 1_800_000_000_000;

  it("accepts a sign-in from minutes ago", () => {
    expect(mfa.isRecentAuth(now / 1000 - 60, now)).toBe(true);
  });

  it("refuses a long-lived session, so a stolen one can't claim enrollment", () => {
    expect(mfa.isRecentAuth(now / 1000 - 3600, now)).toBe(false);
  });

  it("refuses a token from before the claim existed", () => {
    expect(mfa.isRecentAuth(undefined, now)).toBe(false);
  });
});

describe("recovery codes", () => {
  it("issues one set once, stored only as hashes", async () => {
    const codes = await mfa.issueRecoveryCodes(USER);
    expect(codes).toHaveLength(10);
    const stored = await db.select().from(adminMfaRecoveryCodes).where(eq(adminMfaRecoveryCodes.userId, USER));
    expect(stored).toHaveLength(10);
    for (const code of codes) expect(stored.map((s) => s.codeHash)).not.toContain(code);
    expect(await mfa.issueRecoveryCodes(USER)).toEqual([]);
  });

  it("doesn't issue codes before the enrollment is confirmed", async () => {
    await db.delete(adminMfa).where(eq(adminMfa.userId, RECOVERING));
    await mfa.beginMfaEnrollment(RECOVERING);
    expect(await mfa.issueRecoveryCodes(RECOVERING)).toEqual([]);
  });

  it("issues a single set to racing confirmations", async () => {
    await mfa.verifyAdminMfaCode(RECOVERING, await codeFor(RECOVERING));
    const results = await Promise.all([mfa.issueRecoveryCodes(RECOVERING), mfa.issueRecoveryCodes(RECOVERING)]);
    expect(results.filter((r) => r.length > 0)).toHaveLength(1);
  });

  it("rejects another user's code", async () => {
    const [mine] = await mfa.issueRecoveryCodes(OTHER);
    expect(mine).toBeDefined();
    expect(await mfa.redeemRecoveryCode(operator(USER), mine)).toBe(false);
    expect((await mfa.getMfaEnrollment(USER))?.confirmed).toBe(true);
  });

  it("works once, removes the authenticator, ends sessions and audits", async () => {
    await db.delete(adminMfaRecoveryCodes).where(eq(adminMfaRecoveryCodes.userId, OTHER));
    await db.update(adminMfa).set({ recoveryIssuedAt: null }).where(eq(adminMfa.userId, OTHER));
    const [code] = await mfa.issueRecoveryCodes(OTHER);
    const [before] = await db.select().from(users).where(eq(users.id, OTHER));

    const results = await Promise.all([mfa.redeemRecoveryCode(operator(OTHER), code), mfa.redeemRecoveryCode(operator(OTHER), code)]);
    expect(results.filter(Boolean)).toHaveLength(1);

    expect(await mfa.getMfaEnrollment(OTHER)).toBeNull();
    expect(await mfa.hasUnusedRecoveryCodes(OTHER)).toBe(false);
    const [after] = await db.select().from(users).where(eq(users.id, OTHER));
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    const audits = await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.action, "admin.mfa_recovery_used"));
    expect(audits).toHaveLength(1);
  });

  it("recognises codes however they're typed", () => {
    expect(mfa.looksLikeRecoveryCode("abcd-efgh-2345-6723")).toBe(true);
    expect(mfa.looksLikeRecoveryCode("123456")).toBe(false);
  });
});

describe("the proof cookie", () => {
  const passes = async (user = operator(USER)) => {
    vi.stubEnv("ADMIN_MFA_REQUIRED", "1");
    try {
      await mfa.requireAdminMfa(user);
      return true;
    } catch (error) {
      if (String(error).includes("redirect:/admin-mfa")) return false;
      throw error;
    }
  };

  it("is required once the flag is on", async () => {
    expect(await passes()).toBe(false);
  });

  it("passes after a verified code, for that user and session version only", async () => {
    await mfa.setMfaProofCookie(operator(USER));
    expect(await passes()).toBe(true);
    expect(await passes(operator(OTHER))).toBe(false);
    expect(await passes(operator(USER, 1))).toBe(false);
  });

  it("isn't signed with AUTH_SECRET: that key forges nothing here", async () => {
    await mfa.setMfaProofCookie(operator(USER));
    vi.stubEnv("ADMIN_MFA_SECRET", process.env.AUTH_SECRET!);
    expect(mfa.isMfaKeyConfigured()).toBe(false);
    expect(await passes()).toBe(false); // Fails closed when the key is unusable.
  });

  it("refuses to sign without a key", async () => {
    vi.stubEnv("ADMIN_MFA_SECRET", "short");
    await expect(mfa.setMfaProofCookie(operator(USER))).rejects.toThrow("ADMIN_MFA_SECRET");
  });

  it("keeps working through a key rotation, then stops once the old key is removed", async () => {
    await mfa.setMfaProofCookie(operator(USER));
    const old = process.env.ADMIN_MFA_SECRET!;
    vi.stubEnv("ADMIN_MFA_SECRET", "rotated-secret-rotated-secret-rotated-12");
    vi.stubEnv("ADMIN_MFA_SECRET_PREVIOUS", old);
    expect(await passes()).toBe(true);
    vi.stubEnv("ADMIN_MFA_SECRET_PREVIOUS", "");
    expect(await passes()).toBe(false);
  });
});
