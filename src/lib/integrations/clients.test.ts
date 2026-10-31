import { describe, expect, it } from "vitest";

import { clientById, isAllowedRedirect, type IntegrationClient } from "./clients";

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

  it("strictly rejects query parameter injection on unconfigured fallback URLs", () => {
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/api/auth/tathastu/callback?redirect=https://evil.com")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/api/auth/tathastu/callback?token=leak")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/api/auth/tathastu/callback?")).toBe(false);
  });

  it("strictly rejects path traversal, subpaths, and trailing slash bypasses", () => {
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/api/auth/tathastu/callback/")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/api/auth/tathastu/callback/extra")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/api/auth/tathastu/callback/../admin")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/login/redirect?target=evil.com")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com/arbitrary/path")).toBe(false);
  });

  it("strictly rejects origin spoofing, subdomain takeover, and port mismatch", () => {
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com.evil.com/api/auth/tathastu/callback")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://attacker-collaborate.aitathastu.com/api/auth/tathastu/callback")).toBe(false);
    expect(isAllowedRedirect(baseClient, "https://collaborate.aitathastu.com:8443/api/auth/tathastu/callback")).toBe(false);
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
    expect(isAllowedRedirect(devClient, "http://localhost:3001/api/auth/tathastu/callback?leak=1")).toBe(false);
  });

  it("validates registered Collaborate and Meet clients for production compatibility", () => {
    // collaborate in .env.test has INTEGRATION_COLLABORATE_REDIRECT_URIS configured
    const collab = clientById("collaborate");
    expect(collab).not.toBeNull();
    // Whitelisted URL from .env.test is allowed
    expect(isAllowedRedirect(collab!, "http://127.0.0.1:9100/collaborate/callback")).toBe(true);
    // Non-whitelisted URL is denied
    expect(isAllowedRedirect(collab!, "https://collaborate.aitathastu.com/unregistered")).toBe(false);

    // meet has no redirectUris in .env.test, so it exercises the canonical callback fallback
    const meet = clientById("meet");
    expect(meet).not.toBeNull();
    expect(isAllowedRedirect(meet!, "https://connect.aitathastu.com/api/auth/tathastu/callback")).toBe(true);
    expect(isAllowedRedirect(meet!, "https://connect.aitathastu.com/other")).toBe(false);
    expect(isAllowedRedirect(meet!, "https://connect.aitathastu.com/api/auth/tathastu/callback?param=inject")).toBe(false);
    expect(isAllowedRedirect(meet!, "https://evil.com/api/auth/tathastu/callback")).toBe(false);
  });
});
