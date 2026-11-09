import { describe, expect, it } from "vitest";

import { crossSiteRefusal } from "./same-origin";

const req = (method: string, headers: Record<string, string>) =>
  new Request("https://www.aitathastu.com/api/consents", { method, headers: { host: "www.aitathastu.com", ...headers } });

describe("crossSiteRefusal (CSRF on cookie-authenticated writes)", () => {
  it("allows our own pages and navigations", () => {
    expect(crossSiteRefusal(req("POST", { "sec-fetch-site": "same-origin" }))).toBeNull();
    expect(crossSiteRefusal(req("POST", { "sec-fetch-site": "none" }))).toBeNull();
    expect(crossSiteRefusal(req("POST", { origin: "https://www.aitathastu.com" }))).toBeNull();
  });

  it("refuses sibling subdomains, which SameSite=Lax cookies do not stop", () => {
    expect(crossSiteRefusal(req("POST", { "sec-fetch-site": "same-site", origin: "https://collaborate.aitathastu.com" }))).toBe("sec-fetch-site:same-site");
    expect(crossSiteRefusal(req("DELETE", { origin: "https://avsar.aitathastu.com" }))).toBe("origin:mismatch"); // older browser, no Sec-Fetch-Site
  });

  it("refuses other websites, opaque origins and malformed origins", () => {
    expect(crossSiteRefusal(req("POST", { "sec-fetch-site": "cross-site", origin: "https://evil.example" }))).toBe("sec-fetch-site:cross-site");
    expect(crossSiteRefusal(req("PUT", { origin: "https://evil.example" }))).toBe("origin:mismatch");
    expect(crossSiteRefusal(req("PATCH", { origin: "null" }))).toBe("origin:null");
    expect(crossSiteRefusal(req("POST", { origin: "not a url" }))).toBe("origin:malformed");
  });

  it("uses the forwarded host behind the proxy", () => {
    const r = new Request("http://internal:3000/api/consents", { method: "POST", headers: { host: "internal:3000", "x-forwarded-host": "www.aitathastu.com", origin: "https://www.aitathastu.com" } });
    expect(crossSiteRefusal(r)).toBeNull();
  });

  it("ignores safe methods and server-to-server calls without browser headers", () => {
    expect(crossSiteRefusal(req("GET", { "sec-fetch-site": "cross-site" }))).toBeNull();
    expect(crossSiteRefusal(req("POST", {}))).toBeNull();
  });
});
