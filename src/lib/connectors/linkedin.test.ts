import { and, eq } from "drizzle-orm";
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
const { importLinkedInProfileFacts, linkedinConfig } = await import("@/lib/connectors/linkedin");
const { disconnectSource } = await import("@/lib/connectors/connections");
const { sourceById } = await import("@/lib/connectors/sources");

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

describe("LinkedIn OAuth and Profile Facts Integration", () => {
  beforeAll(async () => {
    await db.insert(schema.users).values([
      { id: USER_A, name: "Alice Smith", email: "alice@example.com" },
      { id: USER_B, name: "Bob Jones", email: "bob@example.com" },
    ]);
  });

  describe("source catalog definition", () => {
    it("defines LinkedIn as official OAuth with linkedin_signin flow", () => {
      const source = sourceById("linkedin");
      expect(source).toBeDefined();
      expect(source?.accessMethod).toBe("oauth");
      expect(source?.connect).toBe("linkedin_signin");
      expect(source?.origins).toContain("linkedin_oidc");
    });
  });

  describe("linkedinConfig", () => {
    it("reads credentials from LINKEDIN_CLIENT_ID or AUTH_LINKEDIN_ID", () => {
      process.env.LINKEDIN_CLIENT_ID = "test-id";
      process.env.LINKEDIN_CLIENT_SECRET = "test-secret";
      const conf = linkedinConfig();
      expect(conf).toEqual({ clientId: "test-id", clientSecret: "test-secret" });
    });
  });

  describe("importLinkedInProfileFacts", () => {
    it("inserts verified OIDC profile facts with origin linkedin_oidc", async () => {
      await importLinkedInProfileFacts({
        userId: USER_A,
        providerAccountId: "li-sub-123",
        name: "Alice Smith",
        email: "alice.smith@linkedin-verified.com",
        picture: "https://media.licdn.com/dms/image/avatar.jpg",
      });

      const facts = await db
        .select()
        .from(schema.profileFacts)
        .where(and(eq(schema.profileFacts.userId, USER_A), eq(schema.profileFacts.origin, "linkedin_oidc")));

      expect(facts.length).toBe(4);

      const byField = new Map(facts.map((f) => [f.fieldName, f]));

      const nameFact = byField.get("full_name")!;
      expect(nameFact.extractedValue).toBe("Alice Smith");
      expect(nameFact.validationStatus).toBe("validated");
      expect(nameFact.confirmation).toBe("confirmed");
      expect(nameFact.confidence).toBe(1.0);
      expect(nameFact.sourceEvidence).toContain("LinkedIn");

      const emailFact = byField.get("email")!;
      expect(emailFact.extractedValue).toBe("alice.smith@linkedin-verified.com");
      expect(emailFact.fieldGroup).toBe("contact");

      const picFact = byField.get("avatar_url")!;
      expect(picFact.extractedValue).toBe("https://media.licdn.com/dms/image/avatar.jpg");

      const idFact = byField.get("linkedin_id")!;
      expect(idFact.extractedValue).toBe("li-sub-123");

      // Verify user avatar was backfilled
      const [userRow] = await db.select().from(schema.users).where(eq(schema.users.id, USER_A));
      expect(userRow.image).toBe("https://media.licdn.com/dms/image/avatar.jpg");
    });

    it("is idempotent: re-importing replaces facts without duplicate records", async () => {
      await importLinkedInProfileFacts({
        userId: USER_A,
        providerAccountId: "li-sub-123",
        name: "Alice S. Updated",
        email: "alice.updated@example.com",
        picture: "https://media.licdn.com/dms/image/avatar2.jpg",
      });

      const facts = await db
        .select()
        .from(schema.profileFacts)
        .where(and(eq(schema.profileFacts.userId, USER_A), eq(schema.profileFacts.origin, "linkedin_oidc")));

      expect(facts.length).toBe(4);
      const nameFact = facts.find((f) => f.fieldName === "full_name");
      expect(nameFact?.extractedValue).toBe("Alice S. Updated");
    });
  });

  describe("duplicate account linking protection", () => {
    it("enforces database uniqueness on (provider, provider_account_id)", async () => {
      // Link to USER_A
      await db.insert(schema.accounts).values({
        userId: USER_A,
        type: "oidc",
        provider: "linkedin",
        providerAccountId: "li-unique-999",
      });

      // Attempting to link the same LinkedIn account to USER_B must reject via primary key constraint
      await expect(
        db.insert(schema.accounts).values({
          userId: USER_B,
          type: "oidc",
          provider: "linkedin",
          providerAccountId: "li-unique-999",
        }),
      ).rejects.toThrow();
    });
  });

  describe("disconnectSource clean-up", () => {
    it("deletes connections, auth_accounts link, and verified profile facts on disconnect", async () => {
      // Setup connection row and auth_account
      await db.insert(schema.connections).values({
        userId: USER_A,
        sourceId: "linkedin",
        accessMethod: "oauth",
        status: "connected",
      });

      // Disconnect
      await disconnectSource(USER_A, "linkedin");

      // Verify connection row is removed
      const [conn] = await db
        .select()
        .from(schema.connections)
        .where(and(eq(schema.connections.userId, USER_A), eq(schema.connections.sourceId, "linkedin")));
      expect(conn).toBeUndefined();

      // Verify auth_account link is removed
      const [acc] = await db
        .select()
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, USER_A), eq(schema.accounts.provider, "linkedin")));
      expect(acc).toBeUndefined();

      // Verify profile facts for linkedin_oidc are removed
      const facts = await db
        .select()
        .from(schema.profileFacts)
        .where(and(eq(schema.profileFacts.userId, USER_A), eq(schema.profileFacts.origin, "linkedin_oidc")));
      expect(facts.length).toBe(0);
    });
  });
});
