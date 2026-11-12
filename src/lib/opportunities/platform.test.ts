import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { opportunities, opportunityInteractions, opportunitySaves, opportunitySources, users } from "@/db/schema";
import { createTestDb } from "@/test/db";

import { applyModeOf, browseOpportunities, getOpportunity, recordInteraction, recordViewOnce, setSaved, upcomingSavedDeadlines } from "./browse";
import { extractFromText, runExtraction } from "./extract";
import type { StudentSignals } from "./fit";
import type { OppDb } from "./ingest";
import { sendDeadlineReminders } from "./reminders";

/**
 * Research platform (2026-11-11): announcement extraction with evidence, source-aware Apply, the shared
 * browse service (sections, filters, facets), saves, interactions and opt-in reminders. Simulated data only.
 */
type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let tdb: TestDb;
let db: OppDb;
const NOW = new Date("2026-11-11T10:00:00Z");
const DAY = 86_400_000;
const U = "00000000-0000-4000-8000-0000000000a1";
const student = (demo: string[] = [], level: StudentSignals["level"] = "postgraduate"): StudentSignals => ({ demonstrated: new Map(demo.map((s) => [s.toLowerCase(), s])), listed: new Map(), level });

// Text in the shape of real advertisements (IIT Kharagpur detail table; IIT Hyderabad PDF run-on text).
const KGP_TABLE = "Project Title\nAlloy Design and Processing Science for Additive Manufacturing of Rare Earth Permanent Magnets\nUpper Age Limit\n28 years\nEssential Qualification\nPost Graduate Degree in Basic Science with NET\nFellowship amount\nRs. 37,000/- per month + HRA";
const IITH_PDF =
  "Advertisement No.: (IITH/ANRFPAIR/001/2026) Advertisement for Project Assistant. Essential: M.Tech/ME degree in Chemical Engineering or Biotechnology. Desirable skills: Python, MATLAB, molecular simulation. Duration: 12 months, extendable. Interested candidates should apply through the google form https://forms.gle/AbCdEf123 by 15-11-2026. Contact the PI at chans2k2@gmail.com for queries.";
const EMAIL_AD = "Interested candidates may send their CV and transcripts to research.office@iith.ac.in with the subject JRF-2026. Principal Investigator: Dr. A. Kumar, Department of Physics";

beforeAll(async () => {
  tdb = await createTestDb();
  db = tdb as unknown as OppDb;
  await tdb.insert(users).values({ id: U, role: "student", name: "Student", email: "student@example.test" });
  await tdb.insert(opportunitySources).values([
    { id: "in-src", name: "IIT Test page", kind: "page_monitor", adapter: "iith_postdoc", url: "https://iit.example.ac.in/careers/", organization: "Indian Institute of Technology Test", country: "India", termsReviewedAt: NOW, termsStatus: "approved", enabled: true, autoVerify: true },
    { id: "de-src", name: "MPI Test feed", kind: "rss", url: "https://mpi.example.de/feed", organization: "Max Planck Institute Test", country: "Germany", termsReviewedAt: NOW, termsStatus: "approved", enabled: true, autoVerify: true },
  ]);
  const base = { type: "research", status: "active", lastVerifiedAt: NOW, origin: "page_monitor" };
  await tdb.insert(opportunities).values([
    { ...base, title: "Junior Research Fellow (JRF)", organization: "Indian Institute of Technology Test", country: "India", kind: "research_assistant", sourceId: "in-src", url: "https://iit.example.ac.in/jrf.pdf", canonicalUrl: "https://iit.example.ac.in/jrf.pdf", requiredSkills: ["Python", "MATLAB"], deadline: "13-11-2026", deadlineAt: new Date(NOW.getTime() + 2 * DAY) },
    { ...base, title: "Postdoctoral position (m/f/d)", organization: "Max Planck Institute Test", country: "Germany", kind: "fellowship", sourceId: "de-src", url: "https://mpi.example.de/jobs/1", canonicalUrl: "https://mpi.example.de/jobs/1" },
    { ...base, title: "Closed JRF", organization: "Indian Institute of Technology Test", country: "India", kind: "research_assistant", sourceId: "in-src", url: "https://iit.example.ac.in/old.pdf", canonicalUrl: "https://iit.example.ac.in/old.pdf", status: "expired" },
    { ...base, title: "Needs review", organization: "Indian Institute of Technology Test", country: "India", sourceId: "in-src", url: "https://iit.example.ac.in/nr.pdf", canonicalUrl: "https://iit.example.ac.in/nr.pdf", status: "unverified" },
  ]);
});

describe("announcement extraction (evidence only, nothing invented)", () => {
  it("table-style adverts: the value comes from the cell after its label, with the exact evidence", () => {
    const x = extractFromText(KGP_TABLE);
    expect(x.details.researchArea).toEqual({ value: "Alloy Design and Processing Science for Additive Manufacturing of Rare Earth Permanent Magnets", evidence: "Project Title Alloy Design and Processing Science for Additive Manufacturing of Rare Earth Permanent Magnets" });
    expect(x.details.ageLimit?.value).toBe("28 years");
    expect(x.details.qualifications?.value).toBe("Post Graduate Degree in Basic Science with NET");
    expect(x.details.educationLevels?.value).toEqual(["master's degree"]);
    expect(x.details.stipend?.value).toBe("Rs. 37,000/- per month + HRA");
    expect(x.applicationMethod).toBe("announcement");
  });

  it("run-on PDF text is split into sentences; an official form link on an apply line becomes the portal", () => {
    const x = extractFromText(IITH_PDF);
    expect(x.details.duration?.value).toBe("12 months, extendable.");
    expect(x.requiredSkills).toEqual(["Python", "MATLAB", "molecular simulation"]);
    expect(x.applicationMethod).toBe("portal");
    expect(x.applicationUrl).toBe("https://forms.gle/AbCdEf123");
    expect(x.applicationEmail).toBeNull(); // a personal address is never used as the application address
  });

  it("an institutional address on an apply line is the email destination; the PI is read from the text", () => {
    const x = extractFromText(EMAIL_AD);
    expect(x.applicationMethod).toBe("email");
    expect(x.applicationEmail).toBe("research.office@iith.ac.in");
    expect(x.details.principalInvestigator?.value).toBe("Dr. A. Kumar");
    expect(x.details.documents?.value[0]).toContain("CV and transcripts");
  });

  it("text without these fields yields nothing (no defaults, no guesses)", () => {
    const x = extractFromText("Applications are invited. Details will follow.");
    expect(x.details.stipend).toBeUndefined();
    expect(x.details.duration).toBeUndefined();
    expect(x.requiredSkills).toEqual([]);
    expect(x.applicationUrl).toBeNull();
  });

  it("runExtraction records outcomes per listing and never overwrites skills the source page gave", async () => {
    const impl = async (url: string) =>
      url.endsWith("/jobs/1") ? new Response(`<html><body><p>${IITH_PDF}</p></body></html>`, { headers: { "content-type": "text/html" } }) : new Response("", { status: 404 });
    const r = await runExtraction(db, { fetchImpl: impl as typeof fetch, now: NOW, limit: 10 });
    expect(r.extracted).toBe(1);
    const [pd] = await tdb.select().from(opportunities).where(eq(opportunities.title, "Postdoctoral position (m/f/d)"));
    expect(pd).toMatchObject({ extractionStatus: "extracted", applicationMethod: "portal", applicationUrl: "https://forms.gle/AbCdEf123" });
    expect(pd!.details.sourceDocument).toBe("https://mpi.example.de/jobs/1");
    const [jrf] = await tdb.select().from(opportunities).where(eq(opportunities.title, "Junior Research Fellow (JRF)"));
    expect(jrf!.requiredSkills).toEqual(["Python", "MATLAB"]);
    expect(jrf!.extractionStatus).toBe("not_available"); // the PDF answered 404: recorded, not guessed
  });
});

describe("source-aware Apply (never constructed)", () => {
  it.each([
    [{ applicationMethod: "portal", applicationUrl: "https://forms.gle/x", applicationEmail: null, url: "https://a.ac.in/ad.pdf" }, "portal"],
    [{ applicationMethod: "portal", applicationUrl: null, applicationEmail: null, url: "https://a.ac.in/ad.pdf" }, "announcement"],
    [{ applicationMethod: "email", applicationEmail: "ro@a.ac.in", applicationUrl: null, url: "https://a.ac.in/ad.pdf" }, "email"],
    [{ applicationMethod: "announcement", applicationUrl: null, applicationEmail: null, url: "https://a.ac.in/ad.pdf" }, "announcement"],
    [{ applicationMethod: "unavailable", applicationUrl: null, applicationEmail: null, url: "https://a.ac.in/ad.pdf" }, "unavailable"],
    [{ applicationMethod: "portal", applicationUrl: "https://x", applicationEmail: null, url: null }, "unavailable"],
  ])("%j → %s", (o, kind) => {
    expect(applyModeOf(o).kind).toBe(kind);
  });
});

describe("browse service (shared by dashboard, pages and YORA)", () => {
  it("only verified, active listings; sections and facets come from the real catalogue", async () => {
    const all = await browseOpportunities(db, U, student(), { section: "all" }, NOW);
    expect(all.items.map((i) => i.title).sort()).toEqual(["Junior Research Fellow (JRF)", "Postdoctoral position (m/f/d)"]);
    expect(all.facets.countries).toEqual(["Germany", "India"]);
    expect((await browseOpportunities(db, U, student(), { section: "international" }, NOW)).items.map((i) => i.title)).toEqual(["Postdoctoral position (m/f/d)"]);
    // A JRF is listed under JRF / SRF, not under Research / Project Assistant.
    expect((await browseOpportunities(db, U, student(), { section: "jrf_srf" }, NOW)).items.map((i) => i.title)).toEqual(["Junior Research Fellow (JRF)"]);
    expect((await browseOpportunities(db, U, student(), { section: "assistant" }, NOW)).items).toEqual([]);
    expect((await browseOpportunities(db, U, student(), { section: "postdoc" }, NOW)).items.map((i) => i.title)).toEqual(["Postdoctoral position (m/f/d)"]);
    expect((await browseOpportunities(db, U, student(), { closingWithinDays: 7 }, NOW)).items.map((i) => i.title)).toEqual(["Junior Research Fellow (JRF)"]);
    expect((await browseOpportunities(db, U, student(), { q: "max planck" }, NOW)).items).toHaveLength(1);
  });

  it("Recommended contains only evidence-backed fits; with no profile evidence it is honestly empty", async () => {
    // The postdoc qualifies too: its skills were read from its announcement in the extraction test above.
    const rec = (await browseOpportunities(db, U, student(["Python", "MATLAB"]), { section: "recommended" }, NOW)).items;
    expect(rec.map((i) => i.title)).toContain("Junior Research Fellow (JRF)");
    expect(rec.every((i) => i.fit.state === "strong_fit" || i.fit.state === "potential_fit")).toBe(true);
    expect((await browseOpportunities(db, U, student(), { section: "recommended" }, NOW)).items).toEqual([]);
  });

  it("detail lookup refuses expired, needs-review and malformed ids", async () => {
    const [closed] = await tdb.select().from(opportunities).where(eq(opportunities.title, "Closed JRF"));
    const [review] = await tdb.select().from(opportunities).where(eq(opportunities.title, "Needs review"));
    expect(await getOpportunity(db, closed!.id, U, student(), NOW)).toBeNull();
    expect(await getOpportunity(db, review!.id, U, student(), NOW)).toBeNull();
    expect(await getOpportunity(db, "../../etc", U, student(), NOW)).toBeNull();
  });
});

describe("saves, interactions and reminders", () => {
  it("save with reminder opt-in, list saved, upcoming deadlines, unsave", async () => {
    const [jrf] = await tdb.select().from(opportunities).where(eq(opportunities.title, "Junior Research Fellow (JRF)"));
    await setSaved(db, U, jrf!.id, true, true);
    expect((await browseOpportunities(db, U, student(), { section: "saved" }, NOW)).items.map((i) => i.title)).toEqual(["Junior Research Fellow (JRF)"]);
    expect((await upcomingSavedDeadlines(db, U, NOW)).map((d) => d.title)).toEqual(["Junior Research Fellow (JRF)"]);
    const v = await getOpportunity(db, jrf!.id, U, student(), NOW);
    expect(v).toMatchObject({ saved: true, remind: true });
  });

  it("interactions record what the student did; a view is recorded once; nothing claims an external submission", async () => {
    const [jrf] = await tdb.select().from(opportunities).where(eq(opportunities.title, "Junior Research Fellow (JRF)"));
    await recordViewOnce(db, U, jrf!.id);
    await recordViewOnce(db, U, jrf!.id);
    await recordInteraction(db, U, jrf!.id, "opened_application");
    let v = await getOpportunity(db, jrf!.id, U, student(), NOW);
    expect(v!.interactions).toEqual({ opened: true, confirmedApplied: false });
    await recordInteraction(db, U, jrf!.id, "confirmed_applied");
    v = await getOpportunity(db, jrf!.id, U, student(), NOW);
    expect(v!.interactions.confirmedApplied).toBe(true);
    const rows = await tdb.select().from(opportunityInteractions).where(eq(opportunityInteractions.userId, U));
    expect(rows.filter((r) => r.kind === "viewed")).toHaveLength(1);
    expect(new Set(rows.map((r) => r.kind))).toEqual(new Set(["viewed", "opened_application", "confirmed_applied"]));
  });

  it("reminders: only opted-in saves within 72h of a published deadline, once; nothing without email configured", async () => {
    const sent: string[] = [];
    expect(await sendDeadlineReminders(db, { now: NOW, send: null })).toMatchObject({ sent: 0, skipped: "email_not_configured" });
    const r = await sendDeadlineReminders(db, { now: NOW, send: async (to, e) => void sent.push(`${to}|${e.subject}`) });
    expect(r).toEqual({ due: 1, sent: 1 });
    expect(sent[0]).toBe("student@example.test|Deadline soon: Junior Research Fellow (JRF)");
    expect((await sendDeadlineReminders(db, { now: NOW, send: async () => void sent.push("again") })).sent).toBe(0); // once per save
    const [save] = await tdb.select().from(opportunitySaves).where(eq(opportunitySaves.userId, U));
    expect(save!.remindedAt).not.toBeNull();
  });

  it("unsave removes it from Saved", async () => {
    const [jrf] = await tdb.select().from(opportunities).where(eq(opportunities.title, "Junior Research Fellow (JRF)"));
    await setSaved(db, U, jrf!.id, false);
    expect((await browseOpportunities(db, U, student(), { section: "saved" }, NOW)).items).toEqual([]);
  });
});
