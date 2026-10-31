import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiUserAtStep: vi.fn(),
  isR2Configured: vi.fn(() => true),
  headObject: vi.fn(),
  registerResume: vi.fn(),
  hitRateLimit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/dal", () => ({
  getApiUserAtStep: mocks.getApiUserAtStep,
}));

vi.mock("@/lib/r2", () => ({
  isR2Configured: mocks.isR2Configured,
  headObject: mocks.headObject,
}));

vi.mock("@/lib/uploads/register", () => ({
  registerResume: mocks.registerResume,
  resumeUploadSchema: {
    safeParse: vi.fn((input) => {
      if (!input || !input.sha256) return { success: false };
      return { success: true, data: input };
    }),
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  hitRateLimit: mocks.hitRateLimit,
}));

vi.mock("@/lib/uploads/resume", () => ({
  hexToBase64: vi.fn((h) => `base64-${h}`),
  resumeStorageKey: vi.fn((u, s, m) => `resumes/${u}/${s}.${m}`),
}));

import { POST } from "./route";

describe("POST /api/upload/resume/complete Security & Rate Limiting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isR2Configured.mockReturnValue(true);
    mocks.hitRateLimit.mockResolvedValue({ ok: true, retryAfter: 0 });
  });

  const validPayload = {
    fileName: "resume.pdf",
    mime: "application/pdf",
    sizeBytes: 1024,
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };

  it("rejects unauthorized users with 401/403", async () => {
    mocks.getApiUserAtStep.mockResolvedValueOnce({ ok: false, status: 401, error: "Sign in first." });
    const req = new Request("http://localhost:3000/api/upload/resume/complete", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("enforces rate limits and returns 429 when threshold exceeded before calling S3 headObject", async () => {
    mocks.getApiUserAtStep.mockResolvedValueOnce({
      ok: true,
      user: { id: "user-victim-1" },
      state: { currentStep: "resume" },
    });
    mocks.hitRateLimit.mockResolvedValueOnce({ ok: false, retryAfter: 120 });

    const req = new Request("http://localhost:3000/api/upload/resume/complete", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("120");
    const json = await res.json();
    expect(json.error).toMatch(/too many upload completion checks/i);

    // Critical security assertion: headObject must NOT be invoked when rate limit fails
    expect(mocks.headObject).not.toHaveBeenCalled();
  });

  it("verifies object in R2 and registers resume when under limit", async () => {
    mocks.getApiUserAtStep.mockResolvedValueOnce({
      ok: true,
      user: { id: "user-victim-1" },
      state: { currentStep: "resume" },
    });
    mocks.hitRateLimit.mockResolvedValueOnce({ ok: true, retryAfter: 0 });
    mocks.headObject.mockResolvedValueOnce({
      sizeBytes: 1024,
      mime: "application/pdf",
      sha256Base64: `base64-${validPayload.sha256}`,
    });
    mocks.registerResume.mockResolvedValueOnce({ jobId: "job-123" });

    const req = new Request("http://localhost:3000/api/upload/resume/complete", {
      method: "POST",
      body: JSON.stringify(validPayload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.jobId).toBe("job-123");
    expect(mocks.headObject).toHaveBeenCalledTimes(1);
    expect(mocks.registerResume).toHaveBeenCalledTimes(1);
  });
});
