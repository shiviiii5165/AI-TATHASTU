import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ sessionUserId: "00000000-0000-4000-8000-00000000000a" as string | null }));

vi.mock("@/auth", () => ({
  auth: async () => (state.sessionUserId ? { user: { id: state.sessionUserId, name: "Dr. Ananya" } } : null),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

// pgvector isn't available in PGlite; discovery rules are covered in src/lib/discovery.test.ts.
const people = vi.hoisted(() => ({ result: [] as unknown[], lastViewer: null as unknown }));
vi.mock("@/lib/people", () => ({
  similarPeople: async (viewer: unknown) => {
    people.lastViewer = viewer;
    return people.result;
  },
}));

const { db } = await import("@/db");
const { users } = await import("@/db/schema");
const { eq } = await import("drizzle-orm");
const { parseIntent, POST } = await import("./route");

await db.insert(users).values({ id: "00000000-0000-4000-8000-00000000000a", name: "Dr. Ananya", role: "faculty" });

describe("Deterministic Yora Intent Router", () => {
  describe("parseIntent", () => {
    it("identifies opportunities keywords", () => {
      expect(parseIntent("Find me an internship")).toBe("opportunities");
      expect(parseIntent("Are there any jobs available?")).toBe("opportunities");
      expect(parseIntent("What research opportunities exist?")).toBe("opportunities");
      expect(parseIntent("Show me work openings and grants")).toBe("opportunities");
    });

    it("identifies people keywords", () => {
      expect(parseIntent("Connect with peer researchers")).toBe("people");
      expect(parseIntent("Who can I network or mentor with?")).toBe("people");
      expect(parseIntent("Show my collaboration matches")).toBe("people");
      expect(parseIntent("Who should I know in this field?")).toBe("people");
    });

    it("identifies roadmap keywords", () => {
      expect(parseIntent("What is my career roadmap?")).toBe("roadmap");
      expect(parseIntent("What are my next milestones?")).toBe("roadmap");
      expect(parseIntent("What is my career plan?")).toBe("roadmap");
      expect(parseIntent("What stage am I in?")).toBe("roadmap");
    });

    it("identifies skills keywords", () => {
      expect(parseIntent("What are my biggest skill gaps?")).toBe("skills");
      expect(parseIntent("What course should I learn next?")).toBe("skills");
      expect(parseIntent("Recommend a course to study")).toBe("skills");
    });

    it("identifies profile keywords", () => {
      expect(parseIntent("Check my profile completeness and stats")).toBe("profile");
      expect(parseIntent("Show my resume summary")).toBe("profile");
      expect(parseIntent("What is my profile score?")).toBe("profile");
    });

    it("identifies hello greetings", () => {
      expect(parseIntent("hello")).toBe("hello");
      expect(parseIntent("hi Yora!")).toBe("hello");
      expect(parseIntent("hey there")).toBe("hello");
      expect(parseIntent("good morning")).toBe("hello");
    });

    it("returns fallback for unknown queries", () => {
      expect(parseIntent("Tell me about the history of the roman empire")).toBe("fallback");
      expect(parseIntent("What is the weather today?")).toBe("fallback");
    });
  });

  describe("POST /api/yora/chat", () => {
    const userId = "00000000-0000-4000-8000-00000000000a";

    beforeEach(async () => {
      state.sessionUserId = userId;
    });

    it("returns 401 when unauthenticated", async () => {
      state.sessionUserId = null;
      const req = new Request("http://localhost/api/yora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("returns 400 when message is empty", async () => {
      const req = new Request("http://localhost/api/yora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "   " }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("handles hello intent", async () => {
      const req = new Request("http://localhost/api/yora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "hello" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.response).toContain("I'm Yora, your AI career companion");
    });

    it("handles fallback intent", async () => {
      const req = new Request("http://localhost/api/yora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "random unrelated topic" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.response).toContain("I'm still learning! Please try asking about 'opportunities', 'my roadmap', 'skill gaps', or 'people to connect with'.");
    });

    it("handles roadmap intent with database data", async () => {
      const req = new Request("http://localhost/api/yora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "What is my career roadmap?" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.response).toMatch(/Your current stage is .*\. Your next short-term milestone is: .*/);
    });

    it("handles opportunities intent with database data", async () => {
      const req = new Request("http://localhost/api/yora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Find me an internship" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.response).toContain("Here are some opportunities matching your profile");
    });

    const ask = (message: string) =>
      POST(
        new Request("http://localhost/api/yora/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        }),
      );

    it("people intent reports the real similarity of a discoverable match", async () => {
      people.result = [
        { id: "p1", name: "Ravi Kumar", role: "student", department: null, institution: null, summary: "Graph neural networks.", similarity: 0.634 },
      ];
      const res = await ask("Connect with peer researchers");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.response).toContain("63% match with Ravi Kumar");
      // Lookups go through the discovery rules with the viewer's real role.
      expect(people.lastViewer).toEqual({ id: userId, role: "faculty" });
    });

    it("people intent never invents a match when nobody is discoverable", async () => {
      people.result = [];
      const json = await (await ask("Connect with peer researchers")).json();
      expect(json.response).toContain("I don't have a match for you yet");
      expect(json.response).not.toMatch(/\d+% match/);
    });

    it("people intent shows no percentage when the viewer has no embedding yet", async () => {
      people.result = [{ id: "p2", name: "Meera", role: "alumni", department: null, institution: null, summary: null, similarity: null }];
      const json = await (await ask("Who should I know?")).json();
      expect(json.response).not.toMatch(/\d+% match/);
    });

    it("rejects a session whose account was deleted", async () => {
      await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, userId));
      try {
        expect((await ask("hello")).status).toBe(401);
      } finally {
        await db.update(users).set({ deletedAt: null }).where(eq(users.id, userId));
      }
    });

    it("profile intent doesn't invent a completeness score", async () => {
      const json = await (await ask("Check my profile completeness and stats")).json();
      expect(json.response).not.toMatch(/75% complete/);
    });

    it("handles skills intent with database data", async () => {
      const req = new Request("http://localhost/api/yora/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "What are my biggest skill gaps?" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.response).toContain("You should focus on");
      expect(json.response).toContain("I recommend this course:");
    });
  });
});
