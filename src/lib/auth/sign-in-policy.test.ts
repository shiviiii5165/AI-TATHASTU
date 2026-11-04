import { describe, expect, it } from "vitest";

import { isSessionCurrent, isSignInAllowed } from "./sign-in-policy";

describe("isSignInAllowed", () => {
  it("requires Google to assert a verified email, even when linked", () => {
    expect(isSignInAllowed("google", true, false)).toBe(true);
    expect(isSignInAllowed("google", false, true)).toBe(false);
    expect(isSignInAllowed("google", undefined, false)).toBe(false);
  });

  it("blocks a new LinkedIn identity without a verified email", () => {
    expect(isSignInAllowed("linkedin", true, false)).toBe(true);
    expect(isSignInAllowed("linkedin", false, false)).toBe(false);
    expect(isSignInAllowed("linkedin", undefined, false)).toBe(false);
  });

  it("keeps already-linked LinkedIn accounts working", () => {
    expect(isSignInAllowed("linkedin", undefined, true)).toBe(true);
  });

  it("leaves magic links to their own proof of the address", () => {
    expect(isSignInAllowed("resend", undefined, false)).toBe(true);
  });
});

describe("isSessionCurrent", () => {
  it("accepts a matching version and treats pre-claim tokens as version 0", () => {
    expect(isSessionCurrent(2, 2)).toBe(true);
    expect(isSessionCurrent(undefined, 0)).toBe(true);
  });

  it("rejects tokens issued before a revocation", () => {
    expect(isSessionCurrent(1, 2)).toBe(false);
    expect(isSessionCurrent(undefined, 1)).toBe(false);
  });
});
