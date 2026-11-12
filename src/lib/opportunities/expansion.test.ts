import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { opportunities, opportunitySources } from "@/db/schema";
import { createTestDb } from "@/test/db";

import { ADAPTERS, parseIndianDate } from "./adapters";
import { REJECTED_SOURCES, RESEARCH_SOURCES } from "./catalogue";
import { coverageReport } from "./coverage";
import { extractFromText } from "./extract";
import { explainFit, type StudentSignals } from "./fit";
import { classifyRole, collapseTranslations, refreshSource, type OppDb } from "./ingest";

/**
 * Source expansion (2026-11-12): governance (approval states), research classification beyond title
 * keywords, translation duplicates, IIT Roorkee / IIIT Hyderabad adapters (markup mirrors the live pages),
 * topic relevance, page-cited evidence and the coverage report. Simulated network only.
 */
type TestDb = Awaited<ReturnType<typeof createTestDb>>;
let tdb: TestDb;
let db: OppDb;
const NOW = new Date("2026-11-12T08:00:00Z");

beforeAll(async () => {
  tdb = await createTestDb();
  db = tdb as unknown as OppDb;
});

describe("source governance", () => {
  it("no catalogue source is approved by default; every collectable source records terms evidence", () => {
    for (const s of RESEARCH_SOURCES) {
      expect(s.termsStatus).not.toBe("approved");
      expect(s.termsEvidence.length).toBeGreaterThan(40);
      expect(s.url.startsWith("https://")).toBe(true);
      if (s.kind === "page_monitor") expect(ADAPTERS[s.adapter!]).toBeTypeOf("function");
    }
    expect(RESEARCH_SOURCES.length).toBe(8);
    expect(REJECTED_SOURCES.every((r) => r.reason.length > 10)).toBe(true);
  });

  it("the database refuses to enable a source that is not approved (migration 0030)", async () => {
    await expect(
      tdb.insert(opportunitySources).values({ id: "unapproved", name: "x", kind: "rss", url: "https://x.example/feed", organization: "X", enabled: true, termsStatus: "needs_human_review" }),
    ).rejects.toThrow();
    await tdb.insert(opportunitySources).values({ id: "approved-src", name: "y", kind: "rss", url: "https://y.example/feed", organization: "Y", enabled: true, termsStatus: "approved", termsReviewedAt: NOW });
    const [row] = await tdb.select().from(opportunitySources).where(eq(opportunitySources.id, "approved-src"));
    expect(row!.enabled).toBe(true);
  });

  it("an unapproved source is never fetched", async () => {
    await tdb.insert(opportunitySources).values({ id: "review-src", name: "z", kind: "rss", url: "https://z.example/feed", organization: "Z", enabled: false, termsStatus: "needs_human_review" });
    const [s] = await tdb.select().from(opportunitySources).where(eq(opportunitySources.id, "review-src"));
    let fetched = false;
    const r = await refreshSource(db, { ...s!, enabled: true }, { fetchImpl: async () => ((fetched = true), new Response("")), now: NOW });
    expect(r).toEqual({ status: "skipped", reason: "not_approved" });
    expect(fetched).toBe(false);
  });
});

describe("research classification (title + description + source context)", () => {
  it.each([
    ["Junior Research Fellow (JRF)", null, "research"],
    ["PhD Student (f/m/d) Probing Exotic Quantum Excitations - 2026/135", null, "research"],
    ["Postdoctoral position (m/f/d) | The sensory ecology of worm towers", null, "research"],
    ["Field Attendant", null, "non_research"],
    ["Program Coordinator (PC)", null, "non_research"],
    ["Vocational training 2027: IT Specialist (f/m/d)", null, "non_research"],
    ["Project Assistant (Admin)", null, "uncertain"],
    ["Engineer for detector upgrades", "Work in our research group on the detector, within a funded project.", "research"],
    ["AI Medical Imaging Engineer", null, "uncertain"],
  ] as const)("%s → %s", (title, description, expected) => {
    expect(classifyRole(title, description, null)).toBe(expected);
  });

  it("a source's own include pattern adds research signal (e.g. 'Scientific Employee' at HZDR)", () => {
    expect(classifyRole("Scientific Employee (f/m/d) on the HPC-RSE-Nexus project - 2026/132", null, /scientific employee/i)).toBe("research");
  });

  it("translations sharing a reference number are one listing; the English entry is kept", () => {
    const { kept, duplicates } = collapseTranslations([
      { title: "Doktorand (w/m/d) Untersuchung exotischer Quantenanregungen - 2026/135" },
      { title: "PhD Student (f/m/d) Probing Exotic Quantum Excitations - 2026/135" },
      { title: "Postdoc without reference" },
    ]);
    expect(duplicates).toBe(1);
    expect(kept.map((k) => k.title)).toEqual(["PhD Student (f/m/d) Probing Exotic Quantum Excitations - 2026/135", "Postdoc without reference"]);
  });
});

describe("new official page adapters", () => {
  const IITR = `<a href="/x/Project_Jobs/">Project Jobs</a>
<div class="publicationListItem"><div class="ui title-bar"><div class="ui intro-text ">Advertisement dated November 05, 2026: Advertisement for the position(s) of Junior Research Fellow (JRF) in Dept. of Chemical Engg. (Last date to apply: November 25, 2026 by 05:00 PM, Date and time for interview: December 02, 2026)</div><a href="https://iitr.ac.in/Careers/static/Project_Jobs/CH/2026/adv061120261.pdf" class="ui button">view</a></div></div>
<div class="publicationListItem"><div class="ui title-bar"><div class="ui intro-text ">Advertisement dated November 05, 2026: Advertisement for the position(s) of Senior Research Fellow (SRF) / Junior Research Fellow (JRF) in Dept. of Civil Engg. (Date and time for interview: November 13, 2026, 10:00 AM)</div><a href="https://iitr.ac.in/Careers/static/Project_Jobs/CE/2026/adv051120263.pdf" class="ui button">view</a></div></div>`;
  const IIITH = `<table><thead><tr><th>Start Date</th><th>Advt</th><th>Title</th><th>End Date</th><th>Status</th></tr></thead><tbody>
<tr><td><div class="td-content"> 15-06-2026 </div></td><td><div class="td-content"> IIITH/RnD Recruitments/008/2026 </div></td><td><div class="td-content-wrapper"> <a href="https://www.iiit.ac.in/wp-content/uploads/2026/06/08.pdf">IIIT Hyderabad Invites Applications for the Position of Project Associate I under research projects funded by DST at Biomedical Research Center (BMRC)</a> </div></td><td><div class="td-content"> 30-06-2026 </div></td><td><div class="td-content"> Closed </div></td></tr>
<tr><td><div class="td-content"> 01-11-2026 </div></td><td><div class="td-content"> IIITH/RnD Recruitments/020/2026 </div></td><td><div class="td-content-wrapper"> <a href="https://www.iiit.ac.in/wp-content/uploads/2026/11/20.pdf">Research Assistant at Centre for Visual Information Technology</a> </div></td><td><div class="td-content"> 30-11-2026 </div></td><td><div class="td-content"> Open </div></td></tr></tbody></table>`;

  it("IIT Roorkee: position, department, last date (or interview date), publication date, PDF", () => {
    const e = ADAPTERS.iitr_project_jobs!(IITR, "https://iitr.ac.in/Careers/Project%20Jobs.html");
    expect(e[0]).toMatchObject({ title: "Junior Research Fellow (JRF)", researchGroup: "Dept. of Chemical Engg.", deadline: "Last date to apply: November 25, 2026", url: "https://iitr.ac.in/Careers/static/Project_Jobs/CH/2026/adv061120261.pdf" });
    expect(e[0]!.deadlineAt?.toISOString()).toBe("2026-11-25T18:29:00.000Z");
    expect(e[0]!.publishedAt).not.toBeNull();
    expect(e[1]).toMatchObject({ deadline: "Interview: November 13, 2026" }); // interview-only call closes on that date
  });

  it("IIIT Hyderabad: R&D table with explicit Open/Closed status and research centre", () => {
    const e = ADAPTERS.iiith_rnd!(IIITH, "https://www.iiit.ac.in/careers/");
    expect(e[0]).toMatchObject({ title: "Project Associate I", statusHint: "closed", researchGroup: "Biomedical Research Center" });
    expect(e[1]).toMatchObject({ title: "Research Assistant at Centre for Visual Information Technology", statusHint: "open", deadline: "30-11-2026" });
  });

  it("'Month DD, YYYY' dates parse; impossible dates do not", () => {
    expect(parseIndianDate("November 25, 2026")?.toISOString()).toBe("2026-11-25T18:29:00.000Z");
    expect(parseIndianDate("Sept. 3, 2026")?.toISOString()).toBe("2026-09-03T18:29:00.000Z");
    expect(parseIndianDate("February 30, 2026")).toBeNull();
  });
});

describe("evidence, Apply destinations and relevance", () => {
  it("evidence cites the PDF page it was read from", () => {
    const x = extractFromText("\n[[page 1]]\nProject Title\nQuantum sensing with NV centres\n[[page 2]]\nDuration: 12 months");
    expect(x.details.researchArea).toMatchObject({ value: "Quantum sensing with NV centres", page: 1 });
    expect(x.details.duration).toMatchObject({ value: "12 months", page: 2 });
  });

  it("a bare institute homepage on an apply line is not an application destination", () => {
    const x = extractFromText("Interested candidates may apply through https://www.iitx.ac.in/ before the deadline.");
    expect(x.applicationUrl).toBeNull();
    expect(x.applicationMethod).toBe("announcement");
    const y = extractFromText("Apply online at https://www.iitx.ac.in/recruitment/jrf-2026 before the deadline.");
    expect(y.applicationUrl).toBe("https://www.iitx.ac.in/recruitment/jrf-2026");
  });

  const student = (demo: string[], listed: string[] = []): StudentSignals => ({ demonstrated: new Map(demo.map((s) => [s.toLowerCase(), s])), listed: new Map(listed.map((s) => [s.toLowerCase(), s])), level: "postgraduate" });
  const opp = (topicText: string) => ({ requiredSkills: [] as string[], eligibleLevels: [] as string[], eligibility: null, topicText });

  it("with no published skills, a demonstrated skill named in the project topic is a potential fit (worded as a mention)", () => {
    const f = explainFit(opp("Machine-Learning Enabled Multi-Omics Integration to Differentiate between LNTB and Sarcoidosis"), student(["Machine Learning"]));
    expect(f.state).toBe("potential_fit");
    expect(f.summary).toContain("mentions Machine Learning");
    expect(f.summary).toContain("doesn't publish required skills");
    expect(f.supportedBy).toEqual([{ skill: "Machine Learning", evidence: "topic" }]);
  });

  it("a listed-only skill in the topic stays 'insufficient information'; unrelated topics say nothing", () => {
    expect(explainFit(opp("Deep learning for crop yield"), student([], ["Deep Learning"])).state).toBe("insufficient_information");
    expect(explainFit(opp("Rare earth permanent magnets"), student(["Python"])).summary).toBe("The listing does not name required skills, so fit cannot be assessed.");
    expect(explainFit(opp("Javascript tooling"), student(["Java"])).state).toBe("insufficient_information"); // whole words only
  });
});

describe("regressions found in the running app (2026-11-12)", () => {
  it("IIT Hyderabad: the published end date wins over a later machine expiry (no expired listing shown as open)", () => {
    const html = `<section id="postdoc"><table><tbody><tr data-career-expires="1799999999"><td>01-11-2026</td><td><a href="/a.pdf">Applications are invited for the Post of Junior Research Fellow (JRF) at IIT Hyderabad.</a></td><td>10-Nov-2026, 17:00 hrs</td></tr></tbody></table></section>`;
    const [e] = ADAPTERS.iith_postdoc!(html, "https://iith.ac.in/careers/");
    expect(e!.deadlineAt?.toISOString()).toBe("2026-11-10T18:29:00.000Z");
  });

  it("skills: asides and filler are dropped ('coding in python/MATLAB (or any other language)' → python, MATLAB)", () => {
    const x = extractFromText("Desirable: Familiarity with coding in python/MATLAB (or any other language) especially for data analysis");
    expect(x.requiredSkills).toEqual(["python", "MATLAB"]);
  });

  it("qualifications: a sub-heading after the label is skipped; skills lose leading articles", () => {
    const x = extractFromText("Eligibility Essential Qualifications\nPhD in Chemical Engineering or Materials Science with publications\nDesirable: Familiarity with the synthesis of graphene or other 2D materials.");
    expect(x.details.qualifications?.value).toBe("PhD in Chemical Engineering or Materials Science with publications");
    expect(x.requiredSkills).toEqual(["synthesis of graphene", "2D materials"]);
  });

  it("procedure: a bare 'How to Apply' heading takes the instructions that follow, not the heading", () => {
    const x = extractFromText("How to Apply\nEligible applicants must submit the application by filling the google form https://forms.gle/AbC123");
    expect(x.details.procedure?.value).toBe("Eligible applicants must submit the application by filling the google form https://forms.gle/AbC123");
    expect(x.applicationUrl).toBe("https://forms.gle/AbC123");
  });
});

describe("coverage report", () => {
  it("reports review state, health and real listing counts per source (never institutions as opportunities)", async () => {
    await tdb.insert(opportunitySources).values({ id: "cov-src", name: "c", kind: "page_monitor", adapter: "iisc_contract_staff", url: "https://c.example.ac.in/", organization: "C", country: "India", enabled: true, termsStatus: "approved", termsReviewedAt: NOW, lastSuccessAt: NOW, lastFilteredCount: 2 });
    await tdb.insert(opportunities).values([
      { title: "JRF", organization: "C", type: "research", status: "active", lastVerifiedAt: NOW, sourceId: "cov-src", url: "https://c.example.ac.in/1.pdf", canonicalUrl: "https://c.example.ac.in/1.pdf" },
      { title: "Unclear role", organization: "C", type: "research", status: "unverified", sourceId: "cov-src", url: "https://c.example.ac.in/2.pdf", canonicalUrl: "https://c.example.ac.in/2.pdf" },
      { title: "Closed", organization: "C", type: "research", status: "expired", sourceId: "cov-src", url: "https://c.example.ac.in/3.pdf", canonicalUrl: "https://c.example.ac.in/3.pdf" },
    ]);
    const r = await coverageReport(db, NOW);
    const row = r.sources.find((s) => s.id === "cov-src")!;
    expect(row).toMatchObject({ health: "healthy", active: 1, needsReview: 1, closedOrExpired: 1, filteredLastRefresh: 2, termsStatus: "approved" });
    expect(r.sources.find((s) => s.id === "review-src")!.health).toBe("disabled");
    expect(r.totals.verifiedActiveOpportunities).toBe(1);
    expect(r.rejectedSources.length).toBeGreaterThan(10);
  });
});
