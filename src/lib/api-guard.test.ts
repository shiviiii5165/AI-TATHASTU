import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { guarded } from "./api-guard";

describe("guarded", () => {
  it("passes a response through untouched", async () => {
    const res = await guarded(async () => new Response("ok", { status: 201 }))();
    expect(res.status).toBe(201);
  });

  it("turns a failure into 503 with Retry-After, without exposing the error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await guarded(async () => {
      throw new Error("password authentication failed for user admin");
    })();
    expect(res.status).toBe(503);
    expect(res.headers.get("Retry-After")).toBe("30");
    expect(await res.text()).not.toContain("password");
  });

  it("lets Next's control flow through", async () => {
    const redirect = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/x;307;" });
    await expect(guarded(async () => { throw redirect; })()).rejects.toBe(redirect);
  });
});
