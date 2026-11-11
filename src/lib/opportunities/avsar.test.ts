import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { decodeJwt, exportJWK, generateKeyPair } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { EcosystemOpportunitiesRow } from "@/components/dashboard/mockup-sections/ecosystem-opportunities-row";

import { AVSAR_HANDOFF_URL, getAvsarInternships, resetAvsarCache, type InternshipFeed } from "./avsar";
import type { StudentSignals } from "./fit";

/**
 * AI Tathastu side of the Avsar internship integration: the partner client (pagination, dedupe,
 * failures, stale cache, withdrawals, expiry), explanations, the dashboard card and hand-off links.
 * Avsar is simulated with a fake fetch serving the real PartnerInternshipV1 shape; its own route is
 * tested in the Avsar repository.
 */
const ORIGIN = "https://avsar.test";
const NOW = Date.parse("2026-11-11T10:00:00Z");
const DAY = 86_400_000;

const student = (demo: string[], listed: string[] = [], level: StudentSignals["level"] = "undergraduate"): StudentSignals => ({
  demonstrated: new Map(demo.map((s) => [s.toLowerCase(), s])),
  listed: new Map(listed.map((s) => [s.toLowerCase(), s])),
  level,
});

function item(id: string, over: Record<string, unknown> = {}) {
  return {
    id, slug: `s-${id}`, title: `Intern ${id}`, organization: "Acme Robotics", summary: null, description: "Real listing text.",
    requiredSkills: ["Python", "PyTorch"], preferredSkills: [], eligibility: null, locations: ["Pune"], country: "India", workMode: "hybrid",
    stipend: { min: 15000, max: 20000, currency: "INR", period: "month", note: null }, unpaid: false, durationWeeks: 12, startDate: null,
    publishedAt: "2026-11-01T00:00:00.000Z", deadline: new Date(NOW + 20 * DAY).toISOString(), updatedAt: "2026-11-01T00:00:00.000Z",
    status: "published", verification: "org_verified", applicationMethod: "internal",
    url: `${ORIGIN}/opportunities/s-${id}`, applyUrl: `${ORIGIN}/app/apply/s-${id}`, ...over,
  };
}
const page = (items: unknown[], p: number, hasMore: boolean, total = items.length) => ({ schema: "PartnerInternshipV1", generatedAt: new Date(NOW).toISOString(), page: p, pageSize: 50, total, hasMore, items });

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>;
function fakeAvsar(route: Route) {
  const calls: { url: string; auth: string | null; method: string; body: unknown }[] = [];
  const impl = (async (input: string | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), auth: new Headers(init?.headers).get("authorization"), method: init?.method ?? "GET", body: init?.body ?? null });
    return route(url, init);
  }) as typeof fetch;
  return { impl, calls };
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

let minted = 0;
const opts = (fetchImpl: typeof fetch, now = NOW) => ({ baseUrl: ORIGIN, fetchImpl, now: () => now, mintAssertion: async () => `assertion-${++minted}` });

beforeEach(() => resetAvsarCache());

describe("configuration", () => {
  it("without an Avsar base URL the feed is not_configured (never sample data)", async () => {
    const prev = process.env.AVSAR_API_BASE_URL;
    delete process.env.AVSAR_API_BASE_URL;
    expect(await getAvsarInternships(student(["Python"]))).toEqual({ status: "not_configured", handoffUrl: AVSAR_HANDOFF_URL });
    if (prev !== undefined) process.env.AVSAR_API_BASE_URL = prev;
  });
});

describe("fetching from Avsar's partner API", () => {
  it("pages through results, collapses duplicates, sends only a service assertion and makes only GETs", async () => {
    const a = fakeAvsar((u) =>
      u.searchParams.get("page") === "1" ? json(page([item("1"), item("2")], 1, true, 3)) : json(page([item("2"), item("3")], 2, false, 3)),
    );
    const feed = await getAvsarInternships(student(["Python", "PyTorch"]), opts(a.impl));
    expect(feed.status).toBe("ok");
    if (feed.status !== "ok") return;
    expect(feed.items.map((i) => i.id).sort()).toEqual(["1", "2", "3"]);
    expect(a.calls.map((c) => c.url)).toEqual([`${ORIGIN}/api/partner/v1/internships?page=1&pageSize=50`, `${ORIGIN}/api/partner/v1/internships?page=2&pageSize=50`]);
    expect(a.calls.every((c) => c.method === "GET" && c.body === null && /^Bearer assertion-\d+$/.test(c.auth ?? ""))).toBe(true);
    // No student identity or profile data leaves AI Tathastu.
    expect(a.calls.some((c) => /python|pytorch|user|email/i.test(c.url))).toBe(false);
  });

  it("drops unpublished entries, links off Avsar's origin and anything past its deadline", async () => {
    const a = fakeAvsar(() =>
      json(page([
        item("ok"),
        item("paused", { status: "paused" }),
        item("evil", { applyUrl: "https://phish.example/apply" }),
        item("past", { deadline: new Date(NOW - DAY).toISOString() }),
        { id: "broken" },
      ], 1, false)),
    );
    const feed = await getAvsarInternships(student(["Python"]), opts(a.impl));
    expect(feed.status === "ok" && feed.items.map((i) => i.id)).toEqual(["ok"]);
  });

  it.each([
    [401, "auth"],
    [429, "rate_limited"],
    [500, "http_error"],
  ] as const)("HTTP %i is reported as unavailable (%s), never replaced by listings", async (status, reason) => {
    const feed = await getAvsarInternships(student(["Python"]), opts(fakeAvsar(() => json({ error: { code: "x" } }, status)).impl));
    expect(feed).toEqual({ status: "unavailable", reason, handoffUrl: AVSAR_HANDOFF_URL });
  });

  it("timeouts and malformed responses are unavailable too", async () => {
    const abort = fakeAvsar(() => {
      const e = new Error("aborted");
      e.name = "AbortError";
      throw e;
    });
    expect(await getAvsarInternships(student([]), opts(abort.impl))).toMatchObject({ status: "unavailable", reason: "timeout" });
    resetAvsarCache();
    expect(await getAvsarInternships(student([]), opts(fakeAvsar(() => json({ items: "nope" })).impl))).toMatchObject({ status: "unavailable", reason: "bad_response" });
  });

  it("an empty Avsar result is an honest empty state", async () => {
    const feed = await getAvsarInternships(student(["Python"]), opts(fakeAvsar(() => json(page([], 1, false))).impl));
    expect(feed).toMatchObject({ status: "ok", items: [] });
  });
});

describe("cache: bounded, stale-labelled, withdrawals and expiry honoured", () => {
  it("serves cache within 10 minutes, refreshes after, and drops withdrawn internships on refresh", async () => {
    let listing = [item("a"), item("b")];
    const a = fakeAvsar(() => json(page(listing, 1, false)));
    await getAvsarInternships(student(["Python"]), opts(a.impl, NOW));
    await getAvsarInternships(student(["Python"]), opts(a.impl, NOW + 5 * 60_000));
    expect(a.calls.length).toBe(1);
    listing = [item("a")]; // Avsar closed/unpublished "b"
    const feed = await getAvsarInternships(student(["Python"]), opts(a.impl, NOW + 11 * 60_000));
    expect(a.calls.length).toBe(2);
    expect(feed.status === "ok" && feed.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("when Avsar fails, the last result is shown as stale (with its time) for up to 24h; expired ones never", async () => {
    let up = true;
    const a = fakeAvsar(() => (up ? json(page([item("soon", { deadline: new Date(NOW + 2 * 3600_000).toISOString() }), item("later")], 1, false)) : json({}, 503)));
    await getAvsarInternships(student(["Python"]), opts(a.impl, NOW));
    up = false;
    const stale = await getAvsarInternships(student(["Python"]), opts(a.impl, NOW + 3 * 3600_000));
    expect(stale).toMatchObject({ status: "ok", stale: true, fetchedAt: new Date(NOW).toISOString() });
    expect(stale.status === "ok" && stale.items.map((i) => i.id)).toEqual(["later"]); // "soon" passed its deadline meanwhile
    expect(await getAvsarInternships(student(["Python"]), opts(a.impl, NOW + 25 * 3600_000))).toMatchObject({ status: "unavailable" });
  });
});

describe("recommendation explanations (fit.ts; no percentages)", () => {
  it("separates mandatory eligibility from skill alignment and never judges levels it can't map", async () => {
    const a = fakeAvsar(() =>
      json(page([
        item("ug", { eligibility: { educationLevels: ["bachelors"], graduationYearMin: 2026, graduationYearMax: 2027, minExperienceYears: null, requiredCertifications: null, allowedLocations: null, requiresWorkAuthorizationIndia: true, notes: null } }),
        item("pg", { eligibility: { educationLevels: ["masters"], graduationYearMin: null, graduationYearMax: null, minExperienceYears: null, requiredCertifications: null, allowedLocations: null, requiresWorkAuthorizationIndia: false, notes: null } }),
        item("dip", { eligibility: { educationLevels: ["diploma"], graduationYearMin: null, graduationYearMax: null, minExperienceYears: null, requiredCertifications: null, allowedLocations: null, requiresWorkAuthorizationIndia: false, notes: null } }),
      ], 1, false)),
    );
    const feed = await getAvsarInternships(student(["Python", "PyTorch"]), opts(a.impl));
    if (feed.status !== "ok") throw new Error(feed.status);
    const by = Object.fromEntries(feed.items.map((i) => [i.id, i]));
    expect(by.ug!.fit.state).toBe("strong_fit");
    expect(by.ug!.fit.eligibility.status).toBe("met");
    expect(by.ug!.checks).toEqual(["Graduating 2026–2027", "Authorised to work in India"]);
    expect(by.pg!.fit.state).toBe("not_eligible");
    expect(by.dip!.fit.eligibility.status).toBe("unknown"); // left for Avsar to check
    expect(by.dip!.fit.state).not.toBe("not_eligible");
    expect(feed.items.at(-1)!.id).toBe("pg"); // not eligible sorts last
    expect(JSON.stringify(feed)).not.toMatch(/\d+\s?%/);
  });

  it("listed-only skills are a potential fit; missing skills are 'not shown', not lacking", async () => {
    const feed = await getAvsarInternships(student([], ["Python"]), opts(fakeAvsar(() => json(page([item("x")], 1, false))).impl));
    if (feed.status !== "ok") throw new Error(feed.status);
    expect(feed.items[0]!.fit.state).toBe("potential_fit");
    expect(feed.items[0]!.fit.notShown).toEqual(["PyTorch"]);
  });
});

describe("dashboard card and Apply hand-off", () => {
  const html = (internships: InternshipFeed) => renderToStaticMarkup(createElement(EcosystemOpportunitiesRow, { research: { status: "ok", items: [], personalised: true }, internships }));

  it("renders real Avsar data with View details and Apply on Avsar links to Avsar's own pages", async () => {
    const feed = await getAvsarInternships(student(["Python", "PyTorch"]), opts(fakeAvsar(() => json(page([item("1", { title: "Machine Learning Intern", stipend: { min: 15000, max: 20000, currency: "INR", period: "month", note: "Plus travel" } })], 1, false))).impl));
    const out = html(feed);
    expect(out).toContain("Machine Learning Intern");
    expect(out).toContain("Acme Robotics · Pune · Hybrid");
    expect(out).toContain('href="https://avsar.test/opportunities/s-1"');
    expect(out).toContain('href="https://avsar.test/app/apply/s-1"');
    expect(out).toContain("Apply on Avsar");
    expect(out).toContain("Apply by");
    expect(out).toContain("₹15,000–₹20,000 / month · Plus travel");
    expect(out).not.toMatch(/\d+% (skills )?match|days left/);
  });

  it("not configured, unavailable, empty and stale states are truthful, with a working Avsar link", async () => {
    expect(html({ status: "not_configured", handoffUrl: AVSAR_HANDOFF_URL })).toContain("aren&#x27;t connected yet");
    const down = html({ status: "unavailable", reason: "timeout", handoffUrl: AVSAR_HANDOFF_URL });
    expect(down).toContain("Avsar is temporarily unavailable");
    expect(down).toContain(`href="${AVSAR_HANDOFF_URL}"`);
    const empty = html({ status: "ok", items: [], fetchedAt: new Date(NOW).toISOString(), stale: false, personalised: true, browseUrl: AVSAR_HANDOFF_URL });
    expect(empty).toContain("No active internships on Avsar right now");
    expect(empty).toContain("Browse internships on Avsar");
    const feed = await getAvsarInternships(student(["Python"]), opts(fakeAvsar(() => json(page([item("1")], 1, false))).impl));
    if (feed.status !== "ok") throw new Error(feed.status);
    expect(html({ ...feed, stale: true })).toContain("Couldn&#x27;t refresh from Avsar");
  });

  it("legacy seeded internships (Google, NVIDIA, Adobe) can never appear: the card only renders Avsar items", async () => {
    const feed = await getAvsarInternships(student(["Python"]), opts(fakeAvsar(() => json(page([], 1, false))).impl));
    expect(html(feed)).not.toMatch(/Google Research|NVIDIA|Adobe Research|LLM Systems Engineering Intern|days left/);
  });
});

describe("integration identity", () => {
  beforeAll(async () => {
    const { privateKey } = await generateKeyPair("ES256", { extractable: true });
    process.env.INTEGRATION_JWT_PRIVATE_KEY = JSON.stringify({ ...(await exportJWK(privateKey)), kid: "test-kid" });
  });

  it("the partner assertion is a distinct, short-lived service credential that user-token checks reject", async () => {
    const { mintPartnerAssertion, verifyAccessToken } = await import("@/lib/integrations/tokens");
    const token = await mintPartnerAssertion({ audience: "avsar-partner-api", scope: "opportunities:read" });
    const claims = decodeJwt(token);
    expect(claims).toMatchObject({ iss: "https://www.aitathastu.com", sub: "ai-tathastu", aud: "avsar-partner-api", scope: "opportunities:read" });
    expect(claims.exp! - claims.iat!).toBe(120);
    expect(claims.jti).toBeTruthy();
    expect(Object.keys(claims)).not.toContain("email");
    expect(await verifyAccessToken(token)).toBeNull(); // cannot be used as a user's profile token
  });
});
