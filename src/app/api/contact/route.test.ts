import { beforeEach, describe, expect, it, vi } from "vitest";

const email = vi.hoisted(() => ({
  isEmailConfigured: vi.fn(() => true),
  sendEmail: vi.fn(async () => undefined),
  senderAddress: vi.fn(() => "support@aitathastu.test"),
}));
vi.mock("@/lib/email", () => email);

// One database for every module instance, like two serverless instances sharing Neon.
const shared = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  shared.db ??= await createTestDb();
  return { db: shared.db };
});

const { db } = await import("@/db");
const { rateLimits } = await import("@/db/schema");
const { POST } = await import("./route");

let ipSeq = 0;
function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/contact", {
    method: "POST",
    // A fresh IP per request unless the test pins one, so limits don't leak between tests.
    headers: { "Content-Type": "application/json", "x-forwarded-for": `10.0.0.${++ipSeq}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const valid = {
  name: "Priyanshu Sharma",
  email: "priyanshu@campus.edu",
  category: "general",
  subject: "Questions regarding platform features",
  message: "Hello team, I would like to learn more about the Tathastu modules.",
  consent: true,
};

beforeEach(() => {
  email.isEmailConfigured.mockReturnValue(true);
  email.sendEmail.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/contact", () => {
  // These simulate Vercel's edge, the only place forwarding headers are trusted by default.
  beforeEach(() => vi.stubEnv("VERCEL", "1"));
  it("rejects non-JSON payload", async () => {
    const res = await POST(createRequest("invalid-json"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid/i);
  });

  it("validates required fields", async () => {
    const res = await POST(
      createRequest({ name: "", email: "not-an-email", category: "invalid-category", subject: "", message: "too short", consent: false })
    );
    expect(res.status).toBe(400);
  });

  it("accepts a valid submission once it is delivered to support and returns referenceId", async () => {
    const res = await POST(createRequest(valid));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.referenceId).toMatch(/^#TAT-\d{4}$/);
    expect(data.timestamp).toBeDefined();
    expect(email.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("delivers non-Latin text intact and escapes markup instead of deleting it", async () => {
    const res = await POST(
      createRequest({
        ...valid,
        name: "प्रियंशु <b>Sharma</b>",
        subject: "नमस्ते\r\nBcc: victim@example.com",
        message: "मुझे सहायता चाहिए। <script>alert(1)</script> & thanks",
      }),
    );
    expect(res.status).toBe(200);
    const [{ email: sent }] = email.sendEmail.mock.calls[0] as unknown as [{ email: { subject: string; html: string; text: string } }];
    expect(sent.text).toContain("मुझे सहायता चाहिए।");
    expect(sent.text).toContain("प्रियंशु");
    expect(sent.html).toContain("मुझे सहायता चाहिए।");
    expect(sent.html).not.toContain("<script>");
    expect(sent.html).toContain("&#60;script&#62;");
    expect(sent.html).not.toContain("<b>Sharma");
    // One header line, so the subject can't add headers.
    expect(sent.subject).toContain("नमस्ते Bcc: victim@example.com");
    expect(sent.subject).not.toMatch(/[\r\n]/);
  });

  it("never reports success when email isn't configured (the message would be lost)", async () => {
    email.isEmailConfigured.mockReturnValue(false);
    const res = await POST(createRequest(valid));
    expect(res.status).toBe(503);
    expect((await res.json()).ok).toBeUndefined();
  });

  it("never reports success when delivery fails", async () => {
    email.sendEmail.mockRejectedValueOnce(new Error("smtp down"));
    const res = await POST(createRequest(valid));
    expect(res.status).toBe(502);
    expect((await res.json()).ok).toBeUndefined();
  });

  it("enforces the limit per IP from a shared store, not process memory", async () => {
    const ip = { "x-forwarded-for": "192.168.10.99" };
    for (let i = 0; i < 5; i++) expect((await POST(createRequest(valid, ip))).status).toBe(200);

    const over = await POST(createRequest(valid, ip));
    expect(over.status).toBe(429);
    expect(Number(over.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect((await over.json()).error).toMatch(/too many requests/i);

    // A different IP is unaffected; the raw IP is never stored.
    expect((await POST(createRequest(valid, { "x-forwarded-for": "192.168.10.100" }))).status).toBe(200);
    const keys = (await db.select({ key: rateLimits.key }).from(rateLimits)).map((r) => r.key);
    expect(keys.some((k) => k.includes("192.168"))).toBe(false);
  });

  it("keeps counting across a fresh module instance (another serverless instance)", async () => {
    const ip = { "x-forwarded-for": "172.16.0.5" };
    for (let i = 0; i < 5; i++) await POST(createRequest(valid, ip));
    vi.resetModules();
    const { POST: freshPost } = await import("./route");
    expect((await freshPost(createRequest(valid, ip))).status).toBe(429);
  });
});
