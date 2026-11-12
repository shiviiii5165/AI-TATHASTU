import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { opportunities, opportunitySources } from "@/db/schema";
import { createTestDb } from "@/test/db";

import { ADAPTERS, AdapterError, parseIndianDate } from "./adapters";
import { RESEARCH_SOURCES } from "./catalogue";
import { checkLinks, decideStatus, kindFromTitle, refreshDueSources, refreshSource, type Candidate, type OppDb } from "./ingest";
import { researchForStudent } from "./recommend";

/**
 * Automated discovery (2026-11-11): page-monitor adapters (markup mirrors the live official pages),
 * VERIFIED / NEEDS_REVIEW / REJECTED decisions, absence semantics, backoff, leases, link checks and the
 * scheduled pass. All network is simulated here; the real-provider run is reported separately.
 */
type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let tdb: TestDb;
let db: OppDb;
const NOW = new Date("2026-11-11T10:00:00Z");
const HOUR = 3600_000;

// ── Markup in the shape of the live pages (trimmed) ─────────────────────────
const IISC = `<table id="tablepress-174" class="tablepress tablepress-id-174"><thead><tr class="row-1"><th class="column-1">Post</th><th class="column-2">Department</th><th class="column-3">Detailed Advertisement</th><th class="column-4">Application Closing Date</th><th class="column-5">Status of Recruitment</th></tr></thead><tbody>
<tr class="row-2"><td class="column-1">Junior Program Manager</td><td class="column-2">CeNSE</td><td class="column-3"><a href="/wp-content/uploads/2026/11/jpm.pdf">Click here</a></td><td class="column-4">21.11.2026</td><td class="column-5">Open</td></tr>
<tr class="row-3"><td class="column-1">Research Associate &#8211; I </td><td class="column-2">Civil Engineering</td><td class="column-3"><a href="/wp-content/uploads/2026/11/ra.pdf">Click here</a></td><td class="column-4">17.11.2026, <br>5:00 PM</td><td class="column-5">Open</td></tr>
<tr class="row-4"><td class="column-1">Project Associate</td><td class="column-2"></td><td class="column-3"><a href="/wp-content/uploads/2026/10/pa.pdf">Click here</a></td><td class="column-4">18.10.2026</td><td class="column-5">Closed</td></tr></tbody></table>`;
const KGP = `<u>Temporary Position(s)</u><table><tr>
<td align="left" style="x"><a href="javaScript:void(0);" onclick="advView(6128)">Research Associate</a><br>PI Name - Subhamoy Mandal<br>Dept - Department of Medical Science and Technology</td>
<td align="center">1</td><td align="center"> 14-11-2026 </td></tr>
<tr><td align="left" style="x"><a href="javaScript:void(0);" onclick="advView(6141)">Project Assistant</a><br>Dept - Nano Science and Technology</td><td align="center">1</td><td align="center">25-11-2026</td></tr></table>`;
const IITH = `<section id="postdoc" class="careers-section"><table class="careers-table"><thead><tr><th>Start Date</th><th>Advertisement</th><th>End Date</th></tr></thead><tbody>
<tr data-career-expires="1797359400"><td class="border">09-11-2026</td><td class="border"><a class="x" href="/assets/files/careers/staff/Advertisement for Project Assistant-1-anrf.pdf" target="_blank">Applications are invited for the Post of Project Assistant (ANRF PAIR) at IIT Hyderabad.</a></td><td class="border"> 15-Nov-2026 </td></tr>
<tr><td class="border">07-11-2026</td><td class="border"><a href="/assets/files/careers/staff/JRF__Nov 2026.pdf">Applications are invited for the Post of Junior Research Fellow (JRF) in the Department of Chemical Engineering at IIT Hyderabad.</a></td><td class="border">Rolling</td></tr>
</tbody></table></section>`;

beforeAll(async () => {
  tdb = await createTestDb();
  db = tdb as unknown as OppDb;
});

describe("page-monitor adapters (official institution pages)", () => {
  it("IISc: post, department, PDF link, closing date and explicit Open/Closed status", () => {
    const e = ADAPTERS.iisc_contract_staff!(IISC, "https://iisc.ac.in/careers/contract-project-staff/");
    expect(e).toHaveLength(3);
    expect(e[1]).toMatchObject({ title: "Research Associate – I", researchGroup: "Civil Engineering", url: "https://iisc.ac.in/wp-content/uploads/2026/11/ra.pdf", statusHint: "open", deadline: "17.11.2026, 5:00 PM" });
    expect(e[1]!.deadlineAt?.toISOString()).toBe("2026-11-17T18:29:00.000Z"); // end of day, India time
    expect(e[2]!.statusHint).toBe("closed");
    expect(e[2]!.researchGroup).toBeNull(); // blank department stays unknown
  });

  it("IIT Kharagpur: advert id → official AdvertiseView link, PI and department, last date", () => {
    const e = ADAPTERS.iitkgp_sric!(KGP, "https://erp.iitkgp.ac.in/SRICStaffRecruitment/Advertise.jsp");
    expect(e[0]).toMatchObject({ externalId: "iitkgp-sric-6128", url: "https://erp.iitkgp.ac.in/SRICStaffRecruitment/AdvertiseView.jsp?serial_no=6128", researchGroup: "Department of Medical Science and Technology · PI: Subhamoy Mandal", deadline: "14-11-2026" });
    expect(e[1]!.researchGroup).toBe("Nano Science and Technology");
  });

  it("IIT Hyderabad: machine-readable expiry, start date, rolling calls, department from the title", () => {
    const e = ADAPTERS.iith_postdoc!(IITH, "https://iith.ac.in/careers/");
    expect(e[0]).toMatchObject({ title: "Project Assistant (ANRF PAIR)", rolling: false });
    // The published "15-Nov-2026" wins over the page's later machine expiry (15 Dec).
    expect(e[0]!.deadlineAt?.toISOString()).toBe("2026-11-15T18:29:00.000Z");
    expect(e[0]!.url).toBe("https://iith.ac.in/assets/files/careers/staff/Advertisement%20for%20Project%20Assistant-1-anrf.pdf");
    expect(e[1]).toMatchObject({ rolling: true, deadlineAt: null, researchGroup: "Chemical Engineering" });
    expect(e[1]!.publishedAt).not.toBeNull();
  });

  it("a redesigned page fails loudly instead of returning nothing", () => {
    expect(() => ADAPTERS.iisc_contract_staff!("<html>new design</html>", "https://iisc.ac.in/x")).toThrow(AdapterError);
    expect(() => ADAPTERS.iitkgp_sric!("<html></html>", "https://erp.iitkgp.ac.in/x")).toThrow(AdapterError);
    expect(() => ADAPTERS.iith_postdoc!("<html></html>", "https://iith.ac.in/x")).toThrow(AdapterError);
  });

  it("dates: only exact published dates parse; nothing is guessed", () => {
    expect(parseIndianDate("15-Nov-2026")?.toISOString()).toBe("2026-11-15T18:29:00.000Z");
    expect(parseIndianDate("31.02.2026")).toBeNull();
    expect(parseIndianDate("Rolling")).toBeNull();
    expect(parseIndianDate("Within 15 days")).toBeNull();
  });
});

describe("VERIFIED / NEEDS_REVIEW / REJECTED", () => {
  const c = (over: Partial<Candidate>): Candidate => ({ externalId: "x", title: "JRF", url: null, description: null, publishedAt: null, researchGroup: null, deadline: null, deadlineAt: null, statusHint: null, rolling: false, ...over });
  const monitor = { kind: "page_monitor", autoVerify: true } as const;
  it.each([
    ["closed by the source", c({ statusHint: "closed", deadlineAt: new Date(NOW.getTime() + 86_400_000) }), "expired"],
    ["deadline passed", c({ deadlineAt: new Date(NOW.getTime() - HOUR) }), "expired"],
    ["future deadline", c({ deadlineAt: new Date(NOW.getTime() + 86_400_000) }), "active"],
    ["explicitly open", c({ statusHint: "open" }), "active"],
    ["rolling call", c({ rolling: true }), "active"],
    ["no date, no status", c({}), "unverified"],
  ])("page monitor, %s → %s", (_l, cand, expected) => {
    expect(decideStatus(monitor, cand, NOW).status).toBe(expected);
  });
  it("a source that isn't auto-verified always needs review", () => {
    expect(decideStatus({ kind: "rss", autoVerify: false }, c({ statusHint: "open" }), NOW).status).toBe("unverified");
  });
  it("categories come from the title words only", () => {
    expect(kindFromTitle("Junior Research Fellow (JRF)")).toBe("research_assistant");
    expect(kindFromTitle("Postdoctoral position (m/f/d) | Worm towers")).toBe("fellowship");
    expect(kindFromTitle("PhD Program / PhD Students")).toBe("phd_position");
    expect(kindFromTitle("Head of IT")).toBeNull();
  });
});

// ── Ingestion behaviours against simulated sources ───────────────────────────
function fake(routes: Record<string, { status?: number; body?: string; type?: string }>) {
  const calls: { url: string; method: string }[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? "GET" });
    const r = routes[url] ?? { status: 404, body: "" };
    return new Response(r.body ?? "", { status: r.status ?? 200, headers: { "content-type": r.type ?? "text/html" } });
  };
  return { impl, calls };
}
const rss = (items: { guid: string; title: string; link: string }[]) =>
  `<rss version="2.0"><channel>${items.map((i) => `<item><guid>${i.guid}</guid><title>${i.title}</title><link>${i.link}</link></item>`).join("")}</channel></rss>`;
async function addSource(id: string, over: Partial<typeof opportunitySources.$inferInsert>) {
  await tdb.insert(opportunitySources).values({ id, name: id, kind: "rss", url: `https://${id}.example.org/feed`, organization: `Org ${id}`, termsReviewedAt: NOW, termsStatus: "approved", enabled: true, autoVerify: true, ...over });
  return (await tdb.select().from(opportunitySources).where(eq(opportunitySources.id, id)))[0]!;
}
const reload = async (id: string) => (await tdb.select().from(opportunitySources).where(eq(opportunitySources.id, id)))[0]!;

describe("ingestion lifecycle", () => {
  it("a page monitor stores verified, closed and needs-review entries with provenance", async () => {
    const s = await addSource("iisc-like", { kind: "page_monitor", adapter: "iisc_contract_staff", url: "https://iisc.example.ac.in/careers/", withdrawOnAbsence: true, includePattern: "research|project (associate|assistant)" });
    const f = fake({ "https://iisc.example.ac.in/careers/": { body: IISC } });
    expect(await refreshSource(db, s, { fetchImpl: f.impl, now: NOW })).toMatchObject({ status: "ok", seen: 2, inserted: 2 });
    const rows = await tdb.select().from(opportunities).where(eq(opportunities.sourceId, "iisc-like"));
    expect(rows.find((r) => r.title.startsWith("Research Associate"))).toMatchObject({ status: "active", origin: "page_monitor", researchGroup: "Civil Engineering", kind: "research_assistant" });
    expect(rows.find((r) => r.title === "Project Associate")).toMatchObject({ status: "expired", statusReason: "Marked closed by the source" });
    expect(rows.some((r) => r.title === "Junior Program Manager")).toBe(false); // filtered: not a research role
  });

  it("a rolling feed (withdraw_on_absence = false) never withdraws an entry just because it scrolled out", async () => {
    const s = await addSource("rolling", { withdrawOnAbsence: false });
    await refreshSource(db, s, { fetchImpl: fake({ [s.url!]: { body: rss([{ guid: "1", title: "PhD position A", link: "https://rolling.example.org/a" }]) } }).impl, now: NOW });
    const later = new Date(NOW.getTime() + 7 * HOUR);
    const r = await refreshSource(db, await reload("rolling"), { fetchImpl: fake({ [s.url!]: { body: rss([{ guid: "2", title: "PhD position B", link: "https://rolling.example.org/b" }]) } }).impl, now: later });
    expect(r).toMatchObject({ status: "ok", withdrawn: 0 });
    const a = (await tdb.select().from(opportunities).where(eq(opportunities.externalId, "1")))[0]!;
    expect(a.status).toBe("active");
  });

  it("failures back off exponentially (bounded) and leave listings intact; success resets", async () => {
    const s = await addSource("flaky", {});
    expect(await refreshSource(db, s, { fetchImpl: fake({ [s.url!]: { status: 503 } }).impl, now: NOW })).toEqual({ status: "failed", error: "HTTP_503" });
    let st = await reload("flaky");
    expect(st.consecutiveFailures).toBe(1);
    expect(st.nextAttemptAt!.getTime() - NOW.getTime()).toBe(360 * 60_000);
    expect(st.lockedUntil).toBeNull();
    const t2 = new Date(NOW.getTime() + 7 * HOUR);
    await refreshSource(db, st, { fetchImpl: fake({ [s.url!]: { status: 503 } }).impl, now: t2 });
    st = await reload("flaky");
    expect(st.nextAttemptAt!.getTime() - t2.getTime()).toBe(2 * 360 * 60_000);
    // Past the 6h interval but inside the 12h backoff: the backoff holds the retry.
    expect(await refreshSource(db, st, { now: new Date(t2.getTime() + 7 * HOUR) })).toEqual({ status: "skipped", reason: "backoff" });
    const t3 = new Date(t2.getTime() + 13 * HOUR);
    expect(await refreshSource(db, st, { fetchImpl: fake({ [s.url!]: { body: rss([]) } }).impl, now: t3 })).toMatchObject({ status: "ok" });
    st = await reload("flaky");
    expect(st).toMatchObject({ consecutiveFailures: 0, nextAttemptAt: null, lastError: null });
  });

  it("403 access denial is recorded, never bypassed", async () => {
    const s = await addSource("denied", {});
    expect(await refreshSource(db, s, { fetchImpl: fake({ [s.url!]: { status: 403 } }).impl, now: NOW })).toEqual({ status: "failed", error: "ACCESS_DENIED_403" });
  });

  it("a lease prevents overlapping refreshes of the same source", async () => {
    const s = await addSource("leased", { lockedUntil: new Date(NOW.getTime() + 5 * 60_000) });
    expect(await refreshSource(db, s, { fetchImpl: fake({}).impl, now: NOW })).toEqual({ status: "skipped", reason: "locked" });
  });

  it("broken links: only 404/410 withdraw; timeouts and other errors never do", async () => {
    await tdb.insert(opportunities).values([
      { title: "Gone", organization: "o", type: "research", url: "https://links.example.org/gone", canonicalUrl: "https://links.example.org/gone", status: "active", lastVerifiedAt: NOW, sourceId: "rolling" },
      { title: "Flaky", organization: "o", type: "research", url: "https://links.example.org/flaky", canonicalUrl: "https://links.example.org/flaky", status: "active", lastVerifiedAt: NOW, sourceId: "rolling" },
    ]);
    const impl = async (url: string) => {
      if (url.endsWith("/gone")) return new Response("", { status: 404 });
      if (url.endsWith("/flaky")) throw new Error("timeout");
      return new Response("", { status: 200 });
    };
    const r = await checkLinks(db, { fetchImpl: impl, now: NOW, limit: 50 });
    expect(r.broken).toBe(1);
    const [gone] = await tdb.select().from(opportunities).where(eq(opportunities.title, "Gone"));
    const [flaky] = await tdb.select().from(opportunities).where(eq(opportunities.title, "Flaky"));
    expect(gone).toMatchObject({ status: "withdrawn", linkStatus: 404 });
    expect(flaky).toMatchObject({ status: "active", linkStatus: null });
  });

  it("the scheduled pass isolates failures and is idempotent within the interval", async () => {
    const first = await refreshDueSources(db, { fetchImpl: fake({}).impl, now: new Date(NOW.getTime() + 2 * 86_400_000), linkCheckLimit: 0 });
    expect(Object.keys(first.results).length).toBeGreaterThan(3);
    const again = await refreshDueSources(db, { fetchImpl: fake({}).impl, now: new Date(NOW.getTime() + 2 * 86_400_000 + 60_000), linkCheckLimit: 0 });
    expect(Object.values(again.results).every((o) => o.status === "skipped")).toBe(true);
  });

  it("expired and needs-review listings are never recommended (dashboard and YORA share this query)", async () => {
    const cards = await researchForStudent(db, { demonstrated: new Map(), listed: new Map(), level: null }, NOW);
    expect(cards.some((c) => c.title === "Project Associate")).toBe(false);
    expect(cards.some((c) => c.title === "Gone")).toBe(false);
    expect(cards.some((c) => c.title.startsWith("Research Associate"))).toBe(true);
  });
});

describe("catalogue integrity", () => {
  it("every source is official, https, uses a known adapter and declares absence semantics", () => {
    for (const s of RESEARCH_SOURCES) {
      expect(s.url.startsWith("https://")).toBe(true);
      if (s.kind === "page_monitor") expect(ADAPTERS[s.adapter!]).toBeTypeOf("function");
      if (s.includePattern) expect(() => new RegExp(s.includePattern!, "i")).not.toThrow();
      expect(typeof s.withdrawOnAbsence).toBe("boolean");
    }
    expect(RESEARCH_SOURCES.find((s) => s.id === "mpg-job-offers")!.withdrawOnAbsence).toBe(false); // rolling feed
  });
});
