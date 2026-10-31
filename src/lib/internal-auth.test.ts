import { describe, expect, it } from "vitest";

import { isInternalCall, safeEqual } from "./internal-auth";

describe("safeEqual", () => {
  it("matches identical values only", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secret", "secreT")).toBe(false);
    expect(safeEqual("short", "longer")).toBe(false);
  });

  it("is false for missing values", () => {
    expect(safeEqual(null, "x")).toBe(false);
    expect(safeEqual("x", undefined)).toBe(false);
    expect(safeEqual("", "")).toBe(false);
  });

  it("returns false, not a RangeError, for non-ASCII input of the same character length", () => {
    expect(safeEqual("ééééé", "abcde")).toBe(false);
  });
});

describe("isInternalCall", () => {
  it("rejects a non-ASCII bearer token of the secret's length instead of crashing", () => {
    const secret = "s".repeat(40);
    process.env.INTERNAL_API_SECRET = secret;
    const call = (token: string) => new Request("http://x", { headers: { authorization: `Bearer ${token}` } });
    expect(isInternalCall(call(secret))).toBe(true);
    expect(isInternalCall(call("é".repeat(40)))).toBe(false);
  });
});
