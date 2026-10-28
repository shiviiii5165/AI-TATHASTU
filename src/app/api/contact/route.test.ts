import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

vi.mock("@/lib/email", () => ({
  isEmailConfigured: vi.fn(() => false),
  sendEmail: vi.fn(),
  senderAddress: vi.fn(() => "support@aitathastu.test"),
}));

function createRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/contact", () => {
  it("rejects non-JSON payload", async () => {
    const res = await POST(createRequest("invalid-json"));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/invalid/i);
  });

  it("validates required fields", async () => {
    const res = await POST(
      createRequest({
        name: "",
        email: "not-an-email",
        category: "invalid-category",
        subject: "",
        message: "too short",
        consent: false,
      })
    );
    expect(res.status).toBe(400);
  });

  it("accepts valid contact submission and returns referenceId", async () => {
    const res = await POST(
      createRequest({
        name: "Priyanshu Sharma",
        email: "priyanshu@campus.edu",
        category: "general",
        subject: "Questions regarding platform features",
        message: "Hello team, I would like to learn more about the Tathastu modules.",
        consent: true,
      })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.referenceId).toMatch(/^#TAT-\d{4}$/);
    expect(data.timestamp).toBeDefined();
  });

  it("enforces rate limiting after repeated requests from same IP", async () => {
    const ip = "192.168.10.99";
    const payload = {
      name: "Priyanshu",
      email: "priyanshu@campus.edu",
      category: "support",
      subject: "Help needed with connecting repository",
      message: "Here are the steps to reproduce my issue with GitHub sync.",
      consent: true,
    };

    // First request should succeed
    const res1 = await POST(createRequest(payload, { "x-forwarded-for": ip }));
    expect(res1.status).toBe(200);

    // Rapid requests up to rate limit
    for (let i = 0; i < 4; i++) {
      await POST(createRequest(payload, { "x-forwarded-for": ip }));
    }

    // 6th request should hit rate limit (status 429)
    const resOverLimit = await POST(createRequest(payload, { "x-forwarded-for": ip }));
    expect(resOverLimit.status).toBe(429);
    const data = await resOverLimit.json();
    expect(data.error).toMatch(/too many requests/i);
  });
});
