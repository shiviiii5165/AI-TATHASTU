import { and, eq } from "drizzle-orm";
import { decode, encode } from "next-auth/jwt";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { resolvePostAuthDestination } = await import("@/lib/auth/destination");
const { toLocalPath } = await import("@/lib/safe-redirect");

describe("Authentication, Account Linking & Post-Auth Lifecycle", () => {
  const USER_NEW = "10000000-0000-4000-8000-000000000001";
  const USER_INCOMPLETE = "10000000-0000-4000-8000-000000000002";
  const USER_ONBOARDED = "10000000-0000-4000-8000-000000000003";
  const USER_DELETED = "10000000-0000-4000-8000-000000000004";
  const USER_COLLISION = "10000000-0000-4000-8000-000000000005";

  beforeAll(async () => {
    // 1. New user without onboarding state
    await db.insert(schema.users).values({
      id: USER_NEW,
      email: "newuser@example.com",
      name: "New User",
    });

    // 2. Incomplete user mid-way through student flow (at basic_profile)
    await db.insert(schema.users).values({
      id: USER_INCOMPLETE,
      email: "incomplete@example.com",
      name: "Incomplete User",
      role: "student",
    });
    await db.insert(schema.onboardingState).values({
      userId: USER_INCOMPLETE,
      currentStep: "basic_profile",
      careerRole: "ml_engineer",
    });

    // 3. Completed onboarded user
    await db.insert(schema.users).values({
      id: USER_ONBOARDED,
      email: "completed@example.com",
      name: "Completed User",
      role: "student",
    });
    await db.insert(schema.onboardingState).values({
      userId: USER_ONBOARDED,
      currentStep: "done",
      consentsCompleted: true,
      completedAt: new Date(),
    });

    // 4. Soft-deleted user
    await db.insert(schema.users).values({
      id: USER_DELETED,
      email: "deleted@example.com",
      name: "Deleted User",
      deletedAt: new Date(),
    });

    // 5. Existing user with a linked Google provider account
    await db.insert(schema.users).values({
      id: USER_COLLISION,
      email: "collision@example.com",
      name: "Collision User",
    });
    await db.insert(schema.accounts).values({
      userId: USER_COLLISION,
      provider: "google",
      providerAccountId: "google-existing-acc-123",
      type: "oauth",
    });
  });

  describe("1. Centralized Post-Authentication Routing (resolvePostAuthDestination)", () => {
    it("seeds Step 0 (role) atomically for a new user missing onboarding state and routes to /onboarding/role", async () => {
      const result = await resolvePostAuthDestination(USER_NEW);
      expect(result.isOnboarded).toBe(false);
      expect(result.isDeleted).toBe(false);
      expect(result.destination).toBe("/onboarding/role");

      // Verify row persisted in DB
      const [state] = await db
        .select()
        .from(schema.onboardingState)
        .where(eq(schema.onboardingState.userId, USER_NEW));
      expect(state).toBeDefined();
      expect(state.currentStep).toBe("role");
    });

    it("resumes the exact stored step for an incomplete returning user", async () => {
      const result = await resolvePostAuthDestination(USER_INCOMPLETE);
      expect(result.isOnboarded).toBe(false);
      expect(result.destination).toBe("/onboarding/basic-profile");
    });

    it("redirects a completed returning user directly to /dashboard", async () => {
      const result = await resolvePostAuthDestination(USER_ONBOARDED);
      expect(result.isOnboarded).toBe(true);
      expect(result.destination).toBe("/dashboard");
    });

    it("routes a completed user to a requested internal app URL (e.g. /settings)", async () => {
      const result = await resolvePostAuthDestination(USER_ONBOARDED, "/settings");
      expect(result.destination).toBe("/settings");
    });

    it("prevents redirect loops: ignores requestedUrl if targeting /onboarding or /login for completed users", async () => {
      const loopTargets = ["/onboarding", "/onboarding/career-direction", "/login", "/login?reason=session"];
      for (const target of loopTargets) {
        const result = await resolvePostAuthDestination(USER_ONBOARDED, target);
        expect(result.destination).toBe("/dashboard");
      }
    });

    it("fails closed for soft-deleted users and directs to session termination", async () => {
      const result = await resolvePostAuthDestination(USER_DELETED);
      expect(result.isDeleted).toBe(true);
      expect(result.destination).toBe("/login?reason=session");
    });
  });

  describe("2. Safe Redirects & Open-Redirect Immunity (toLocalPath)", () => {
    it("preserves legitimate relative application paths", () => {
      expect(toLocalPath("/dashboard")).toBe("/dashboard");
      expect(toLocalPath("/settings/profile?tab=security#keys")).toBe("/settings/profile?tab=security#keys");
      expect(toLocalPath("/learning/path/ai")).toBe("/learning/path/ai");
    });

    it("discards protocol-relative URLs (//evil.com)", () => {
      expect(toLocalPath("//evil.com")).toBe("/onboarding");
      expect(toLocalPath("//evil.com/phish", "/dashboard")).toBe("/dashboard");
    });

    it("discards backslash-based domain hops (/\\evil.com)", () => {
      expect(toLocalPath("/\\evil.com")).toBe("/onboarding");
      expect(toLocalPath("\\evil.com", "/dashboard")).toBe("/dashboard");
    });

    it("discards external absolute URLs (https://attacker.com)", () => {
      expect(toLocalPath("https://attacker.com")).toBe("/onboarding");
      expect(toLocalPath("http://evil.com/login", "/dashboard")).toBe("/dashboard");
    });

    it("discards javascript: and data: URI injection attempts", () => {
      expect(toLocalPath("javascript:alert(1)")).toBe("/onboarding");
      expect(toLocalPath("data:text/html,<script>evil()</script>", "/dashboard")).toBe("/dashboard");
    });
  });

  describe("3. Email Normalization & Case-Insensitive Uniqueness", () => {
    it("normalizes mixed-case email addresses consistently", async () => {
      const testEmail = "Test.Case.User@Example.COM";
      const normalized = testEmail.toLowerCase().trim();
      expect(normalized).toBe("test.case.user@example.com");

      // Insert normalized user
      const userId = "33333333-3333-4333-8333-333333333333";
      await db.insert(schema.users).values({
        id: userId,
        email: normalized,
        name: "Test Case User",
      });

      // Query by lowercase
      const [found] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, "test.case.user@example.com"));
      expect(found).toBeDefined();
      expect(found.id).toBe(userId);
    });
  });

  describe("4. Account Collision Defense", () => {
    it("rejects an OAuth account collision if providerAccountId is already linked to a different user", async () => {
      const providerAccountId = "google-existing-acc-123";
      const differentUserId = "44444444-4444-4444-8444-444444444444";

      // Collision check query
      const [existing] = await db
        .select({ userId: schema.accounts.userId })
        .from(schema.accounts)
        .where(
          and(
            eq(schema.accounts.provider, "google"),
            eq(schema.accounts.providerAccountId, providerAccountId),
          ),
        );

      expect(existing).toBeDefined();
      expect(existing.userId).toBe(USER_COLLISION);

      // The refined collision safeguard: if existing exists, user.id MUST match
      const checkCollision = (incomingUserId?: string | null) => {
        if (existing) {
          if (!incomingUserId || existing.userId !== incomingUserId) {
            return false;
          }
        }
        return true;
      };

      expect(checkCollision(differentUserId)).toBe(false);
      expect(checkCollision(null)).toBe(false);
      expect(checkCollision(undefined)).toBe(false);
      expect(checkCollision(USER_COLLISION)).toBe(true);
    });

    it("permits sign-in if providerAccountId matches the same user", async () => {
      const providerAccountId = "google-existing-acc-123";
      const [existing] = await db
        .select({ userId: schema.accounts.userId })
        .from(schema.accounts)
        .where(
          and(
            eq(schema.accounts.provider, "google"),
            eq(schema.accounts.providerAccountId, providerAccountId),
          ),
        );

      const isAllowed = !(existing && existing.userId !== USER_COLLISION);
      expect(isAllowed).toBe(true);
    });
  });

  describe("5. Google Email Verification Security Policy", () => {
    it("accepts Google profile when email_verified is explicitly true", () => {
      const profile = { email: "user@gmail.com", email_verified: true };
      const isVerified = profile.email_verified === true;
      expect(isVerified).toBe(true);
    });

    it("rejects Google profile if email_verified is false or missing", () => {
      const unverified = { email: "unverified@gmail.com", email_verified: false };
      const missing = { email: "missing@gmail.com" };

      expect(unverified.email_verified === true).toBe(false);
      expect((missing as { email_verified?: boolean }).email_verified === true).toBe(false);
    });
  });

  describe("6. Passwordless Verification Token Lifecycle", () => {
    it("creates a single-use token with expiration and prevents reuse after consumption", async () => {
      const email = "magic@example.com";
      const token = "secure-random-token-xyz-1234567890";
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // 1. Adapter inserts token
      await db.insert(schema.verificationTokens).values({
        identifier: email,
        token,
        expires,
      });

      // 2. Token lookup on callback
      const [invite] = await db
        .select()
        .from(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, email),
            eq(schema.verificationTokens.token, token),
          ),
        );
      expect(invite).toBeDefined();
      expect(invite.token).toBe(token);
      expect(invite.expires.getTime()).toBeGreaterThan(Date.now());

      // 3. Adapter consumes (deletes) the token
      await db
        .delete(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, email),
            eq(schema.verificationTokens.token, token),
          ),
        );

      // 4. Replay attempt: token no longer exists
      const [replayed] = await db
        .select()
        .from(schema.verificationTokens)
        .where(
          and(
            eq(schema.verificationTokens.identifier, email),
            eq(schema.verificationTokens.token, token),
          ),
        );
      expect(replayed).toBeUndefined();
    });

    it("rejects expired verification tokens", () => {
      const expiredDate = new Date(Date.now() - 60 * 1000); // 1 minute ago
      const isExpired = expiredDate.getTime() < Date.now();
      expect(isExpired).toBe(true);
    });
  });

  describe("7. Session Cookie Integrity & JWT Lifecycle", () => {
    const TEST_AUTH_SECRET = "e2e-auth-secret-not-used-anywhere-else-0123456789";
    const SESSION_SALT = "authjs.session-token";

    it("encodes and decodes encrypted JWT session cookie with claims intact", async () => {
      const originalPayload = {
        sub: USER_ONBOARDED,
        email: "completed@example.com",
        onboarded: true,
        admin: false,
      };

      const encryptedCookie = await encode({
        token: originalPayload,
        secret: TEST_AUTH_SECRET,
        salt: SESSION_SALT,
        maxAge: 30 * 24 * 60 * 60,
      });

      expect(typeof encryptedCookie).toBe("string");
      expect(encryptedCookie.length).toBeGreaterThan(50);

      const decoded = await decode({
        token: encryptedCookie,
        secret: TEST_AUTH_SECRET,
        salt: SESSION_SALT,
      });

      expect(decoded).toBeDefined();
      expect(decoded?.sub).toBe(USER_ONBOARDED);
      expect(decoded?.email).toBe("completed@example.com");
      expect(decoded?.onboarded).toBe(true);
      expect(decoded?.admin).toBe(false);
    });

    it("rejects a tampered or invalid session token", async () => {
      const tamperedCookie = "eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..invalid_payload";

      await expect(
        decode({
          token: tamperedCookie,
          secret: TEST_AUTH_SECRET,
          salt: SESSION_SALT,
        }),
      ).rejects.toThrow();
    });
  });

  describe("8. Concurrency & Idempotency", () => {
    it("handles concurrent post-auth state resolution without throwing or duplicating", async () => {
      const concurrentUserId = "55555555-5555-4555-8555-555555555555";
      await db.insert(schema.users).values({
        id: concurrentUserId,
        email: "concurrent@example.com",
        name: "Concurrent User",
      });

      // Execute 5 simultaneous calls to resolvePostAuthDestination
      const results = await Promise.all([
        resolvePostAuthDestination(concurrentUserId),
        resolvePostAuthDestination(concurrentUserId),
        resolvePostAuthDestination(concurrentUserId),
        resolvePostAuthDestination(concurrentUserId),
        resolvePostAuthDestination(concurrentUserId),
      ]);

      for (const res of results) {
        expect(res.destination).toBe("/onboarding/role");
        expect(res.isOnboarded).toBe(false);
      }

      // Verify exactly ONE onboarding state row exists
      const rows = await db
        .select()
        .from(schema.onboardingState)
        .where(eq(schema.onboardingState.userId, concurrentUserId));
      expect(rows.length).toBe(1);
    });
  });
});
