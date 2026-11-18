import { describe, expect, it } from "vitest";

import { wakeUrl } from "@/lib/worker-ping";

describe("wakeUrl", () => {
  it("adds wake=1 so the worker leaves its deep idle (a plain health check must not)", () => {
    expect(wakeUrl("https://ai-tathastu.onrender.com/health")).toBe("https://ai-tathastu.onrender.com/health?wake=1");
  });

  it("keeps existing query parameters and does not duplicate wake", () => {
    expect(wakeUrl("https://w.example/health?a=1&wake=0")).toBe("https://w.example/health?a=1&wake=1");
  });

  it("returns an unparseable value unchanged rather than throwing", () => {
    expect(wakeUrl("not a url")).toBe("not a url");
  });
});
