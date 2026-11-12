import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { opportunities, opportunitySources } from "@/db/schema";
import { EcosystemOpportunitiesRow } from "@/components/dashboard/mockup-sections/ecosystem-opportunities-row";
import { createTestDb } from "@/test/db";

import { AVSAR_HANDOFF_URL, type InternshipFeed } from "./avsar";
import { canonicalUrl } from "./canonical";
import { parseFeed } from "./feed";
import { explainFit, studyLevel, type StudentSignals } from "./fit";
import { addCuratedListing, applyLifecycle, refreshSource, robotsAllows, type OppDb } from "./ingest";
import { buildStudentSignals, researchForStudent } from "./recommend";

const NOT_CONFIGURED: InternshipFeed = { status: "not_configured", handoffUrl: AVSAR_HANDOFF_URL };
type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let tdb: TestDb;
let db: OppDb;

const NOW = new Date("2026-11-11T10:00:00Z");
const student = (demo: string[], listed: string[] = [], level: StudentSignals["level"] = "undergraduate"): StudentSignals => ({
  demonstrated: new Map(demo.map((s) => [s.toLowerCase(), s])),
  listed: new Map(listed.map((s) => [s.toLowerCase(), s])),
  level,
});

const rss = (items: { guid: string; title: string; link: string }[]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>Lab</title>${items
    .map((i) => `<item><guid>${i.guid}</guid><title><![CDATA[${i.title}]]></title><link>${i.link}</link><description>Apply via the lab page.</description><pubDate>Mon, 02 Nov 2026 09:00:00 GMT</pubDate></item>`)
    .join("")}</channel></rss>`;

/** A fake source server: records every URL requested so tests can prove what was (not) fetched. */
function fakeFetch(routes: Record<string, { status?: number; body?: string; type?: string }>) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url);
    const r = routes[url] ?? { status: 404, body: "" };
    return new Response(r.body ?? "", { status: r.status ?? 200, headers: { "content-type": r.type ?? "application/rss+xml" } });
  };
  return { impl, calls };
}

async function source(id: string, over: Partial<typeof opportunitySources.$inferInsert> = {}) {
  await tdb.insert(opportunitySources).values({ id, name: `Source ${id}`, kind: "rss", url: `https://lab-${id}.example.edu/feed.xml`, organization: `Lab ${id}`, termsReviewedAt: NOW, termsStatus: "approved", enabled: true, autoVerify: true, ...over });
  const [s] = await tdb.select().from(opportunitySources).where(eq(opportunitySources.id, id));
  return s!;
}

beforeAll(async () => {
  tdb = await createTestDb();
  db = tdb as unknown as OppDb;
});

describe("real versus hardcoded data", () => {
  it("retires the six fabricated 0014 seed rows instead of showing them", async () => {
    const seed = await tdb.select().from(opportunities).where(eq(opportunities.origin, "legacy_seed"));
    expect(seed.length).toBe(6);
    expect(seed.every((r) => r.status === "unverified" && r.canonicalUrl === null)).toBe(true);
    expect(await researchForStudent(db, student(["Python", "PyTorch"]), NOW)).toEqual([]);
  });


});

describe("canonical URLs and feed parsing", () => {
  it("canonicalises for dedupe and rejects non-http and relative links", () => {
    expect(canonicalUrl("https://WWW.Lab.edu/jobs/ra-1/?utm_source=x&b=2&a=1#top")).toBe("https://lab.edu/jobs/ra-1?a=1&b=2");
    expect(canonicalUrl("/opportunities")).toBeNull();
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalUrl("https://user:pw@lab.edu/x")).toBeNull();
  });

  it("parses RSS and JSON Feed, keeping only published fields", () => {
    const r = parseFeed(rss([{ guid: "g1", title: "RA in NLP", link: "https://lab.edu/ra" }]));
    expect(r).toEqual([{ externalId: "g1", title: "RA in NLP", url: "https://lab.edu/ra", description: "Apply via the lab page.", publishedAt: new Date("2026-11-02T09:00:00Z") }]);
    const j = parseFeed(JSON.stringify({ version: "https://jsonfeed.org/version/1.1", items: [{ id: "x", title: "Call for collaborators", url: "https://lab.edu/c" }] }), "application/feed+json");
    expect(j[0]).toMatchObject({ externalId: "x", title: "Call for collaborators", description: null, publishedAt: null });
    expect(() => parseFeed("<html>not a feed</html>")).toThrow("FEED_UNRECOGNISED");
  });

  it("robots.txt: our group overrides *, longest rule wins", () => {
    const txt = "User-agent: *\nDisallow: /private\n\nUser-agent: AITathastu-OpportunityBot\nDisallow: /feeds\nAllow: /feeds/research";
    expect(robotsAllows(txt, "/feeds/research.xml")).toBe(true);
    expect(robotsAllows(txt, "/feeds/other.xml")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /", "/feed.xml")).toBe(false);
    expect(robotsAllows("", "/feed.xml")).toBe(true);
  });
});

describe("source verification, provenance and duplicates", () => {
  it("never fetches disabled, unreviewed or too-recent sources", async () => {
    const f = fakeFetch({});
    expect(await refreshSource(db, await source("off", { enabled: false }), { fetchImpl: f.impl, now: NOW })).toEqual({ status: "skipped", reason: "disabled" });
    // Not approved by the owner (needs human review): never fetched, whatever robots.txt says.
    expect(await refreshSource(db, { ...(await source("rev", { enabled: false })), enabled: true, termsStatus: "needs_human_review" }, { fetchImpl: f.impl, now: NOW })).toEqual({ status: "skipped", reason: "not_approved" });
    expect(await refreshSource(db, { ...(await source("rej", { enabled: false })), enabled: true, termsStatus: "rejected" }, { fetchImpl: f.impl, now: NOW })).toEqual({ status: "skipped", reason: "not_approved" });
    expect(await refreshSource(db, await source("recent", { lastFetchedAt: new Date(NOW.getTime() - 60_000) }), { fetchImpl: f.impl, now: NOW })).toEqual({ status: "skipped", reason: "interval" });
    expect(f.calls).toEqual([]);
  });

  it("ingests an auto-verified official feed with provenance; requests carry no student data", async () => {
    const s = await source("a");
    const f = fakeFetch({ [s.url!]: { body: rss([{ guid: "ra-1", title: "Research Assistant, Speech Lab", link: "https://lab-a.example.edu/ra-1?utm_source=feed" }, { guid: "p-2", title: "Funded summer research programme", link: "https://lab-a.example.edu/p-2" }]) } });
    const r = await refreshSource(db, s, { fetchImpl: f.impl, now: NOW });
    expect(r).toMatchObject({ status: "ok", seen: 2, inserted: 2 });
    expect(f.calls).toEqual(["https://lab-a.example.edu/robots.txt", "https://lab-a.example.edu/feed.xml"]);
    const rows = await tdb.select().from(opportunities).where(eq(opportunities.sourceId, "a"));
    const ra = rows.find((x) => x.externalId === "ra-1")!;
    expect(ra).toMatchObject({ status: "active", origin: "feed", canonicalUrl: "https://lab-a.example.edu/ra-1", organization: "Lab a", deadline: null, deadlineAt: null });
    expect(ra.lastVerifiedAt?.toISOString()).toBe(NOW.toISOString());
    const cards = await researchForStudent(db, student(["Python"]), NOW);
    expect(cards.map((c) => c.title)).toContain("Research Assistant, Speech Lab");
    expect(cards.find((c) => c.title.startsWith("Research Assistant"))).toMatchObject({ sourceName: "Source a", deadline: null, url: "https://lab-a.example.edu/ra-1?utm_source=feed" });
  });

  it("a re-fetch updates in place (no duplicate) and, for a complete-listing source, withdraws entries it dropped", async () => {
    await tdb.update(opportunitySources).set({ withdrawOnAbsence: true }).where(eq(opportunitySources.id, "a"));
    const [s] = await tdb.select().from(opportunitySources).where(eq(opportunitySources.id, "a"));
    const later = new Date(NOW.getTime() + 7 * 3600_000);
    const f = fakeFetch({ [s!.url!]: { body: rss([{ guid: "ra-1", title: "Research Assistant, Speech Lab (updated)", link: "https://lab-a.example.edu/ra-1" }]) } });
    expect(await refreshSource(db, s!, { fetchImpl: f.impl, now: later })).toMatchObject({ status: "ok", inserted: 0, updated: 1, withdrawn: 1 });
    const rows = await tdb.select().from(opportunities).where(eq(opportunities.sourceId, "a"));
    expect(rows.length).toBe(2);
    expect(rows.find((x) => x.externalId === "p-2")!.status).toBe("withdrawn");
    expect((await researchForStudent(db, student(["Python"]), later)).some((c) => c.title.includes("summer"))).toBe(false);
  });

  it("the same opening from a second source is not listed twice", async () => {
    const s = await source("b");
    const f = fakeFetch({ [s.url!]: { body: rss([{ guid: "mirror", title: "RA (mirrored)", link: "https://www.lab-a.example.edu/ra-1/" }]) } });
    expect(await refreshSource(db, s, { fetchImpl: f.impl, now: NOW })).toMatchObject({ status: "ok", inserted: 0, duplicates: 1 });
  });

  it("entries from a source that is not auto-verified wait as unverified and are never recommended", async () => {
    const s = await source("c", { autoVerify: false });
    const f = fakeFetch({ [s.url!]: { body: rss([{ guid: "u1", title: "Unreviewed call", link: "https://lab-c.example.edu/u1" }]) } });
    await refreshSource(db, s, { fetchImpl: f.impl, now: NOW });
    const [row] = await tdb.select().from(opportunities).where(eq(opportunities.externalId, "u1"));
    expect(row!.status).toBe("unverified");
    expect((await researchForStudent(db, student(["Python"]), NOW)).some((c) => c.title === "Unreviewed call")).toBe(false);
  });

  it("failures (robots, HTTP error, rate limit, bad feed) record a code and keep existing listings", async () => {
    const before = await tdb.select().from(opportunities).where(eq(opportunities.sourceId, "a"));
    const s = await source("d");
    await tdb.insert(opportunities).values({ title: "Kept", organization: "Lab d", type: "research", url: "https://lab-d.example.edu/k", canonicalUrl: "https://lab-d.example.edu/k", externalId: "k", sourceId: "d", origin: "feed", status: "active", lastVerifiedAt: NOW });
    const cases: [Record<string, { status?: number; body?: string }>, string][] = [
      [{ "https://lab-d.example.edu/robots.txt": { body: "User-agent: *\nDisallow: /" } }, "ROBOTS_DISALLOWED"],
      [{ [s.url!]: { status: 500 } }, "HTTP_500"],
      [{ [s.url!]: { status: 429 } }, "RATE_LIMITED_BY_SOURCE"],
      [{ [s.url!]: { body: "<html>maintenance</html>" } }, "FEED_UNRECOGNISED"],
    ];
    for (const [routes, code] of cases) {
      // Each case starts clean: no interval, no backoff, no lease left from the previous failure.
      await tdb.update(opportunitySources).set({ lastFetchedAt: null, nextAttemptAt: null, lockedUntil: null, consecutiveFailures: 0 }).where(eq(opportunitySources.id, "d"));
      const [fresh] = await tdb.select().from(opportunitySources).where(eq(opportunitySources.id, "d"));
      expect(await refreshSource(db, fresh!, { fetchImpl: fakeFetch(routes).impl, now: NOW })).toEqual({ status: "failed", error: code });
      const [kept] = await tdb.select().from(opportunities).where(eq(opportunities.externalId, "k"));
      expect(kept!.status).toBe("active");
    }
    const [rec] = await tdb.select().from(opportunitySources).where(eq(opportunitySources.id, "d"));
    expect(rec!.lastError).toBe("FEED_UNRECOGNISED");
    expect((await tdb.select().from(opportunities).where(eq(opportunities.sourceId, "a"))).length).toBe(before.length);
  });

  it("curated listings need a manual source and a real link; duplicates are refused", async () => {
    await source("m", { kind: "manual", url: null, termsReviewedAt: null });
    await expect(addCuratedListing(db, { sourceId: "a", title: "x", kind: "research_project", url: "https://x.edu/1", verifiedAt: NOW })).rejects.toThrow("CURATED_NEEDS_MANUAL_SOURCE");
    await expect(addCuratedListing(db, { sourceId: "m", title: "x", kind: "research_project", url: "/opportunities", verifiedAt: NOW })).rejects.toThrow("SOURCE_URL_REQUIRED");
    const first = await addCuratedListing(db, {
      sourceId: "m", title: "Faculty-led project: low-resource ASR", kind: "research_project", url: "https://cs.example.edu/projects/asr",
      requiredSkills: ["Python", "PyTorch", "Speech Processing"], eligibleLevels: ["undergraduate", "postgraduate"],
      deadline: "15 December 2026", deadlineAt: new Date("2026-12-15T23:59:00Z"), verifiedAt: NOW,
    });
    expect(first.duplicate).toBe(false);
    expect((await addCuratedListing(db, { sourceId: "m", title: "same", kind: "research_project", url: "https://cs.example.edu/projects/asr/", verifiedAt: NOW })).duplicate).toBe(true);
  });
});

describe("lifecycle: expiry and stale verification", () => {
  it("expires past deadlines and demotes stale verification; nothing is deleted", async () => {
    const total = (await tdb.select().from(opportunities)).length;
    const afterDeadline = new Date("2026-12-16T00:00:00Z");
    const r = await applyLifecycle(db, afterDeadline);
    expect(r.expired).toBeGreaterThanOrEqual(1);
    const [asr] = await tdb.select().from(opportunities).where(eq(opportunities.canonicalUrl, "https://cs.example.edu/projects/asr"));
    expect(asr!.status).toBe("expired");
    expect(r.stale).toBeGreaterThanOrEqual(1); // verified on NOW, 35 days earlier
    expect(await researchForStudent(db, student(["Python"]), afterDeadline)).toEqual([]);
    expect((await tdb.select().from(opportunities)).length).toBe(total);
  });
});

describe("matching explanations and eligibility (qualitative, no percentages)", () => {
  const opp = (requiredSkills: string[], eligibleLevels: string[] = [], eligibility: string | null = null) => ({ requiredSkills, eligibleLevels, eligibility });

  it("strong fit rests on demonstrated evidence; listed skills alone are only a potential fit", () => {
    const strong = explainFit(opp(["Python", "PyTorch"]), student(["Python", "PyTorch"]));
    expect(strong.state).toBe("strong_fit");
    expect(strong.supportedBy).toEqual([{ skill: "Python", evidence: "demonstrated" }, { skill: "PyTorch", evidence: "demonstrated" }]);
    const listed = explainFit(opp(["Python", "PyTorch"]), student([], ["Python", "PyTorch"]));
    expect(listed.state).toBe("potential_fit");
    expect(listed.summary).toContain("not yet demonstrated");
  });

  it("missing evidence is 'not shown', never 'lacking'; empty profiles are insufficient information", () => {
    const e = explainFit(opp(["Python", "Rust", "Speech Processing"]), student(["Python"]));
    expect(e.notShown).toEqual(["Rust", "Speech Processing"]);
    expect(JSON.stringify(e)).not.toMatch(/lack|missing skill|%/i);
    expect(explainFit(opp(["Python"]), student([], [])).state).toBe("insufficient_information");
    expect(explainFit(opp([]), student(["Python"])).state).toBe("insufficient_information");
  });

  it("eligibility is evaluated separately and only from a published structured restriction", () => {
    const pg = explainFit(opp(["Python"], ["postgraduate"]), student(["Python"], [], "undergraduate"));
    expect(pg.state).toBe("not_eligible");
    expect(pg.eligibility.status).toBe("not_met");
    expect(explainFit(opp(["Python"], ["undergraduate"]), student(["Python"])).eligibility.status).toBe("met");
    expect(explainFit(opp(["Python"], ["postgraduate"]), student(["Python"], [], null)).eligibility.status).toBe("unknown");
    const freeText = explainFit(opp(["Python"], [], "Open to 3rd-year B.Tech students with CGPA above 8"), student(["Python"]));
    expect(freeText.eligibility.status).toBe("unknown"); // shown for the student to check, never decided
    expect(freeText.state).toBe("strong_fit");
  });

  it("study level comes from the degree text only", () => {
    expect(studyLevel("B.Tech, Computer Science")).toBe("undergraduate");
    expect(studyLevel("M.Sc Physics")).toBe("postgraduate");
    expect(studyLevel("PhD in Linguistics")).toBe("doctoral");
    expect(studyLevel("Certificate course")).toBeNull();
    expect(studyLevel(null)).toBeNull();
  });

  it("demonstrated = the Intelligence Engine's Proficient/Advanced assessments only", () => {
    const s = buildStudentSignals({
      skills: [{ name: "python" }, { name: "sql" }],
      intelligenceSkills: [
        { name: "Python", proficiency: 72, level: "Proficient" },
        { name: "Docker", proficiency: 40, level: "Working" },
        { name: "Rust", proficiency: null, level: null },
      ],
      degree: "B.E. Electronics",
    });
    expect([...s.demonstrated.values()]).toEqual(["Python"]);
    expect([...s.listed.keys()].sort()).toEqual(["docker", "rust", "sql"]);
    expect(s.level).toBe("undergraduate");
  });
});

describe("dashboard rendering and empty states", () => {
  const html = (props: Parameters<typeof EcosystemOpportunitiesRow>[0]) => renderToStaticMarkup(createElement(EcosystemOpportunitiesRow, props));

  it("renders truthful empty, unavailable and Avsar states (sections never hidden)", () => {
    const empty = html({ research: { status: "ok", items: [], personalised: true }, internships: NOT_CONFIGURED });
    expect(empty).toContain("No verified research opportunities right now");
    expect(empty).toContain("Browse internships on Avsar");
    expect(empty).toContain('href="/integrations/launch/avasar"');
    expect(html({ research: { status: "unavailable" }, internships: NOT_CONFIGURED })).toContain("temporarily unavailable");
  });

  it("a card shows source, verification date, published deadline, fit reason and the original link; no percentages", async () => {
    // Re-verified at the source (the lifecycle test above demoted it as stale).
    await tdb.update(opportunities).set({ status: "active", lastVerifiedAt: NOW }).where(eq(opportunities.externalId, "ra-1"));
    const cards = await researchForStudent(db, student(["Python"]), NOW);
    const out = html({ research: { status: "ok", items: cards, personalised: true }, internships: NOT_CONFIGURED });
    expect(out).toContain("Research Assistant, Speech Lab");
    expect(out).toContain("Source a · verified");
    expect(out).toContain("No deadline published");
    // Links go to the detail page and the Apply hand-off (which redirects to the official source).
    expect(out).toMatch(/href="\/opportunities\/[0-9a-f-]{36}"/);
    expect(out).toMatch(/href="\/opportunities\/[0-9a-f-]{36}\/apply"/);
    expect(out).toContain("Apply on official site");
    expect(out).not.toMatch(/\d+% (skills )?match/);
    const unpersonalised = html({ research: { status: "ok", items: cards, personalised: false }, internships: NOT_CONFIGURED });
    expect(unpersonalised).toContain("Add skills or connect GitHub");
  });
});
