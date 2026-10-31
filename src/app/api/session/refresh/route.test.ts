import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  unstable_update: vi.fn(),
  resolvePostAuthDestination: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: mocks.auth,
  unstable_update: mocks.unstable_update,
}));

vi.mock("@/lib/auth/destination", () => ({
  resolvePostAuthDestination: mocks.resolvePostAuthDestination,
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => {}),
}));

import { NextRequest } from "next/server";
import { GET } from "./route";

describe("GET /api/session/refresh Navigation & Onboarding State Guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects unauthenticated visitors to /login", async () => {
    mocks.auth.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost:3000/api/session/refresh");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost:3000/login");
    expect(mocks.unstable_update).not.toHaveBeenCalled();
  });

  it("redirects deleted users to /login?reason=session", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "user-del" } });
    mocks.resolvePostAuthDestination.mockResolvedValueOnce({
      destination: "/login?reason=session",
      isDeleted: true,
      isOnboarded: false,
    });

    const req = new NextRequest("http://localhost:3000/api/session/refresh");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost:3000/login?reason=session");
  });

  it("preserves exact active onboarding step for mid-onboarding users (never redirects to /dashboard prematurely)", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "user-mid" } });
    mocks.resolvePostAuthDestination.mockResolvedValueOnce({
      destination: "/onboarding/priorities",
      isDeleted: false,
      isOnboarded: false,
    });

    const req = new NextRequest("http://localhost:3000/api/session/refresh");
    const res = await GET(req);

    expect(res.status).toBe(307);
    // Crucial bugfix verification: mid-onboarding user stays on their step, not redirected to /dashboard
    expect(res.headers.get("Location")).toBe("http://localhost:3000/onboarding/priorities");
  });

  it("redirects fully onboarded users away from /onboarding to /dashboard", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "user-done" } });
    mocks.resolvePostAuthDestination.mockResolvedValueOnce({
      destination: "/onboarding",
      isDeleted: false,
      isOnboarded: true,
    });

    const req = new NextRequest("http://localhost:3000/api/session/refresh");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost:3000/dashboard");
  });

  it("redirects fully onboarded users to requested safe custom destination", async () => {
    mocks.auth.mockResolvedValueOnce({ user: { id: "user-done" } });
    mocks.resolvePostAuthDestination.mockResolvedValueOnce({
      destination: "/settings",
      isDeleted: false,
      isOnboarded: true,
    });

    const req = new NextRequest("http://localhost:3000/api/session/refresh?redirect=/settings");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("Location")).toBe("http://localhost:3000/settings");
  });
});
