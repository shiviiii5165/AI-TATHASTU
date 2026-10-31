import { describe, expect, it } from "vitest";

import { isAllowedRedirect, type IntegrationClient } from "./clients";

describe("OAuth Redirect URI Validation Security (isAllowedRedirect)", () => {
  const baseClient: IntegrationClient = {
    id: "collaborate",
    name: "Collaborate",
    description: "Test Client",
    origin: "https://collaborate.aitathastu.com",
    flag: "collaborate_profile_api",
    requested: ["skills"],
    secret: "test-secret",
    redirectUris: null,
    webhookUrl: null,
    webhookSecret: null,
  };

  it("permits canonical callback URL on client origin when redirectUris is not configured", () => {
    const valid = "https://collaborate.aitathastu.com/api/auth/tathastu/callback";
    expect(isAllowedRedirect(baseClient, valid)).toBe(true);
  });

  it("strictly rejects open-redirect or traversal subpaths when redirectUris is not configured", () => {
    // Arbitrary subpaths that could lead to open redirects on partner domain
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/login/redirect?target=evil.com")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/arbitrary/path")).toBe(false);
  });

  it("strictly enforces configured redirectUris whitelist when provided", () => {
    const clientWithWhitelist: IntegrationClient = {
      ...baseClient,
      redirectUris: ["https://collaborate.aitathastu.com/custom/oauth/callback"],
    };

    expect(isAllowedRedirect(clientWithWhitelist, "https://collaborate.aitathastu.com/custom/oauth/callback")).toBe(true);
    // Denies even the canonical path if not in the explicit whitelist
    expect(isAllowedRedirect(clientWithWhitelist, "https://collaborate.aitathastu.com/api/auth/tathastu/callback")).toBe(false);
  });

  it("rejects malicious URLs containing userinfo, hashes, or invalid protocols", () => {
    expect(isAllowedRedirect(baseClient, "https://user:pass@collaborate.aitathastu.com/api/auth/tathastu/callback")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/api/auth/tathastu/callback#token=leak")).toBe(false);
    expect(isAllowedRedirect(baseClient, "http://collaborate.aitathastu.com/api/auth/tathastu/callback")).toBe(false);
    expect(isAllowedRedirect(baseClient, "javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirect(baseClient, "not-a-url")).toBe(false);
  });

  it("permits localhost origins for local development over http", () => {
    const devClient: IntegrationClient = {
      ...baseClient,
      origin: "http://localhost:3001",
    };

    expect(isAllowedRedirect(devClient, "http://localhost:3001/api/auth/tathastu/callback")).toBe(true);
    expect(isAllowedRedirect(devClient, "http://localhost:3001/other/path")).toBe(false);
  });
});
