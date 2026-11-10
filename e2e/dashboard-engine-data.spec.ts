/**
 * The three dashboard sections against output from the real career engine (worker/intelligence/career_engine.py),
 * not hand-written intelligence. e2e/fixtures/engine-profile.json was produced by running engine.compute on a mixed
 * profile: dated and undated education, experience and projects, an achievement, a claimed-only skill, two GitHub
 * repositories, the ml_engineer goal and catalogue courses as seeded in learning_resources. Regenerate it when the
 * engine changes:  python -I e2e/support/gen-engine-profile.py worker e2e/fixtures/engine-profile.json
 *
 * Every assertion is checked against the engine document itself, so nothing on screen can be more than the engine said.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Browser } from "@playwright/test";

import type { IntelligenceDoc } from "../src/lib/dashboard/types";
import { createUser, signIn, sql } from "./support/fixtures";

type EngineProfile = { intelligence: IntelligenceDoc; facts: { group: string; record: string; field: string; value: string }[] };
const ENGINE: EngineProfile = JSON.parse(readFileSync(path.join(__dirname, "fixtures/engine-profile.json"), "utf8"));
const intel = ENGINE.intelligence;

type Fact = { group: string; record: string; field: string; value: string };

// Several ongoing records plus dated and undated achievements, as on a real profile with concurrent roles.
const CONCURRENT: Fact[] = [
  ["education", "edu3", "degree", "B.Tech"],
  ["education", "edu3", "institution", "Lovely Professional University"],
  ["education", "edu3", "end_date", "Present"],
  ["experience", "exp3", "role", "Technical Advisor & Lead Developer"],
  ["experience", "exp3", "organization", "Nayee Asha"],
  ["experience", "exp3", "start_date", "Jul 2026"],
  ["experience", "exp3", "end_date", "Present"],
  ["experience", "exp4", "role", "Frontend Developer & Sponsorship Manager"],
  ["experience", "exp4", "organization", "Real Gods eSports"],
  ["experience", "exp4", "start_date", "Oct. 2025"],
  ["experience", "exp4", "end_date", "Present"],
  ["achievements", "a3", "title", "Nodwin Cups"],
  ["achievements", "a4", "title", "Vision Week"],
  ["achievements", "a5", "title", "Best Speaker, Model UN"],
  ["achievements", "a5", "date", "2023"],
].map(([group, record, field, value]) => ({ group, record, field, value }));

async function setUp(browser: Browser, name: string, { extra = [] as Fact[], width = 1366 } = {}) {
  const user = await createUser(name, "done");
  const base = JSON.parse(readFileSync(path.join(__dirname, "fixtures/profile-view.json"), "utf8").replaceAll("__NOW__", intel.computedAt));
  const view = { ...base, computedAt: intel.computedAt, intelligence: intel };
  await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [user.id, JSON.stringify(view)]);
  // The confirmed resume records the engine read (list-valued fields aside: they feed skills, not the journey).
  for (const f of [...ENGINE.facts.filter((x) => !x.value.startsWith("[")), ...extra]) {
    await sql.query(
      `INSERT INTO profile_facts (user_id, field_group, field_name, record_key, extracted_value, normalized_value, source_evidence, extraction_method, origin, confidence, validation_status, confirmation)
       VALUES ($1, $2, $3, $4, $5, $5, $6, 'llm', 'resume', 0.95, 'validated', 'confirmed')`,
      [user.id, f.group, f.field, f.record, JSON.stringify(f.value), f.value],
    );
  }
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  await page.goto("/dashboard");
  return { user, context, page };
}

test("journey with several ongoing records: one 'where you are now', dated achievements on the path, undated ones grouped", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Engine concurrent", { extra: CONCURRENT });
  const journey = page.getByTestId("journey-timeline");
  await expect(journey.getByText("Where you are now")).toHaveCount(1);
  const primary = journey.locator("[data-primary]");
  await expect(primary).toHaveCount(1);
  await expect(primary).toContainText("Technical Advisor & Lead Developer"); // the most recently started ongoing job
  expect(await journey.locator("[data-current]").count()).toBeGreaterThan(1);
  await expect(journey.locator('[data-current]:not([data-primary])').first()).toContainText("Ongoing");
  // Ongoing records ordered by when they started.
  const ongoing = await journey.locator("[data-current]").allInnerTexts();
  expect(ongoing.findIndex((t) => t.includes("Real Gods eSports"))).toBeLessThan(ongoing.findIndex((t) => t.includes("Nayee Asha")));
  // A dated achievement is a timeline event; undated ones sit in their own compact group, never on the path.
  await expect(journey.getByRole("list", { name: /earliest to most recent/ })).toContainText("Best Speaker, Model UN");
  const undated = journey.getByTestId("undated-achievements");
  await expect(undated).toContainText("Nodwin Cups");
  await expect(undated).toContainText("Vision Week");
  await expect(journey.getByRole("list", { name: /earliest to most recent/ })).not.toContainText("Nodwin Cups");
  await context.close();
});

test("sections run journey, skills, skill gaps and roadmap, then next steps from the roadmap", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Engine order");
  await expect(page.getByTestId("career-roadmap")).toBeVisible();
  const top = async (locator: import("@playwright/test").Locator) => (await locator.boundingBox())!.y;
  const journey = await top(page.getByTestId("journey-timeline"));
  const skills = await top(page.getByTestId("skills-overview"));
  const gaps = await top(page.getByRole("heading", { name: "Skill Gaps", level: 2 }));
  const roadmap = await top(page.getByTestId("career-roadmap"));
  const nextSteps = await top(page.getByRole("heading", { name: "Your next steps" }));
  const metrics = await top(page.getByRole("link", { name: /Profile Complete/ }));
  expect(metrics).toBeLessThan(journey);
  expect(Math.max(journey, skills)).toBeLessThan(Math.min(gaps, roadmap));
  expect(Math.max(gaps, roadmap)).toBeLessThan(nextSteps);

  // Next steps are the roadmap's workable milestones for the chosen goal.
  const steps = page.getByRole("heading", { name: "Your next steps" }).locator("xpath=ancestor::section[1]").getByRole("listitem");
  await expect(steps.first()).toContainText("Statistics");
  await expect(steps.first()).toContainText("ML Engineer expects Statistics");
  for (const t of await steps.allInnerTexts()) expect(t).not.toMatch(/Machine Learning:|MLflow:|Connect with research peers/);
  await context.close();
});

for (const width of [1440, 390]) {
  test(`skills network at ${width}px: circular nodes, none overlapping or clipped, only real links`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Engine network ${width}`, { width });
    const network = page.getByTestId("skill-network");
    await expect(network.locator("[data-node]").first()).toBeVisible();
    const report = await network.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const nodes = [...el.querySelectorAll("[data-node]")].map((g) => ({
        id: g.getAttribute("data-node")!,
        circle: g.querySelectorAll("circle")[1].getBoundingClientRect(),
        label: g.querySelectorAll("text")[g.querySelectorAll("text").length - 1].getBoundingClientRect(),
      }));
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const pairs: string[] = [];
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          if (hit(a.circle, b.circle) || hit(a.label, b.label) || hit(a.circle, b.label) || hit(a.label, b.circle)) pairs.push(`${a.id}/${b.id}`);
        }
      const clipped = nodes.filter(({ circle, label }) => [circle, label].some((r) => r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)).map((n) => n.id);
      return { count: nodes.length, pairs, clipped, fontPx: parseFloat(getComputedStyle(el.querySelector("[data-node] text:last-of-type")!).fontSize), pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(report.count).toBeGreaterThan(0);
    expect(report.pairs).toEqual([]);
    expect(report.clipped).toEqual([]);
    expect(report.fontPx).toBeGreaterThanOrEqual(10);
    expect(report.pageOverflow).toBeLessThanOrEqual(0);

    // Every circle's status matches the engine; selecting one lights exactly its recorded links.
    for (const n of intel.graph.nodes) {
      const g = network.locator(`[data-node="${n.id}"]`);
      if (await g.count()) await expect(g).toHaveAttribute("data-status", n.status);
    }
    const python = network.locator('[data-node="Python"]');
    await python.focus();
    await page.keyboard.press("Enter");
    await expect(python).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("skills-overview").getByRole("region", { name: "Python evidence" })).toBeVisible();

    // The text alternative lists the same skills.
    await page.getByTestId("skills-overview").getByRole("button", { name: "List" }).click();
    await expect(page.getByTestId("skills-overview").getByRole("list", { name: "Skills" }).getByRole("listitem")).toHaveCount(report.count);
    await context.close();
  });
}

test("every link in the dashboard content goes somewhere real, and the hero CTA reaches the roadmap", async ({ browser }) => {
  // Opens every linked page in turn; on a loaded machine that alone can pass the default 3 minutes.
  test.setTimeout(420_000);
  const { context, page } = await setUp(browser, "Engine links");
  await expect(page.getByTestId("career-roadmap")).toBeVisible();
  const hrefs = await page.locator("#app-content a[href]").evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute("href")!))]);
  const internal = hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//"));
  const anchors = hrefs.filter((h) => h.startsWith("#"));
  expect(internal.length).toBeGreaterThan(5);

  const broken: string[] = [];
  const check = await context.newPage();
  for (const href of internal) {
    const res = await check.goto(href);
    const text = await check.locator("body").innerText();
    if (!res || res.status() >= 400) broken.push(`${href}: HTTP ${res?.status()}`);
    else if (text.includes("Not available yet")) broken.push(`${href}: placeholder page`);
  }
  expect(broken).toEqual([]);
  for (const a of anchors) await expect(page.locator(a), `${a} has a target`).toHaveCount(1);

  await page.getByRole("link", { name: "See your next step" }).click();
  await expect(page).toHaveURL(/#career-roadmap$/);
  await expect(page.getByTestId("career-roadmap")).toBeInViewport();
  await context.close();
});

test("journey: mixed record types in year order, current last, undated apart, undated projects left out", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Engine journey");
  const journey = page.getByTestId("journey-timeline");
  const items = journey.getByRole("list", { name: /earliest to most recent/ }).locator(":scope > li");
  await expect(items).toHaveCount(5);
  const rows = await items.evaluateAll((lis) => lis.map((li) => ({ kind: li.getAttribute("data-kind"), current: li.hasAttribute("data-current"), text: (li as HTMLElement).innerText })));
  // Years never go backwards; the ongoing role is last and marked as now.
  const years = rows.map((r) => (r.current ? 9999 : Math.max(...[...r.text.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1])))));
  expect(years).toEqual([...years].sort((a, b) => a - b));
  expect(rows.at(-1)).toMatchObject({ kind: "experience", current: true });
  expect(rows.at(-1)!.text).toContain("ML Engineer");
  expect(rows.at(-1)!.text).toContain("Nimbus AI");
  expect(new Set(rows.map((r) => r.kind))).toEqual(new Set(["achievement", "experience", "education", "project"]));
  // The 2021 tie (hackathon and internship) may come in either order, but both come before 2022.
  expect(rows.slice(0, 2).map((r) => r.kind).sort()).toEqual(["achievement", "experience"]);

  await expect(journey.getByTestId("undated-other")).toBeVisible();
  await expect(journey).toContainText("Online Diploma in Data Science");
  await expect(journey).not.toContainText("Undated Side Project");
  await context.close();
});

test("skills: only the engine's evidence edges are drawn, and scores appear only where the engine scored", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Engine skills");
  const card = page.getByTestId("skills-overview");
  await expect(card.locator("[data-node]").first()).toBeVisible(); // drawn once the width is measured
  const shown = await card.locator("[data-node]").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")!.split(":")[0]));
  const shownSet = new Set(shown);
  for (const name of shown) expect(intel.graph.nodes.map((n) => n.name)).toContain(name);

  const expectedEvidence = intel.graph.edges.filter((e) => e.basis === "evidence" && shownSet.has(e.source) && shownSet.has(e.target));
  expect(expectedEvidence.length).toBeGreaterThan(0);
  await expect(card.locator('path[data-basis="evidence"]')).toHaveCount(expectedEvidence.length);
  await expect(card.locator('path[data-basis="ontology"]')).toHaveCount(0);

  for (const node of intel.graph.nodes.filter((n) => shownSet.has(n.name))) {
    await card.getByRole("button", { name: new RegExp(`^${node.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`) }).click();
    const detail = card.getByRole("region", { name: `${node.name} evidence` });
    if (node.proficiency === null) {
      await expect(detail).toContainText("No proficiency shown");
      await expect(detail).not.toContainText("Proficiency:");
    } else {
      await expect(detail).toContainText(`Proficiency: ${node.level}`);
    }
    // Ontology lines drawn on selection are exactly the engine's documented relations for this skill.
    const ontology = intel.graph.edges.filter((e) => e.basis === "ontology" && (e.source === node.id || e.target === node.id) && shownSet.has(e.source) && shownSet.has(e.target));
    await expect(card.locator('path[data-basis="ontology"]')).toHaveCount(ontology.length);
  }
  await context.close();
});

test("roadmap: evidenced position, coverage, blocked milestone, catalogue course and evidence submission", async ({ browser }) => {
  const { user, context, page } = await setUp(browser, "Engine roadmap");
  const roadmap = page.getByTestId("career-roadmap");
  const rm = intel.roadmap!;
  await expect(roadmap).toContainText(rm.currentPosition!);
  await expect(page.getByTestId("roadmap-progress-bar")).toHaveAttribute("style", new RegExp(`width:\\s*${Math.round(rm.progress * 100)}%`));

  // Machine Learning requires Statistics, which the evidence doesn't show: blocked, with the reason.
  const ml = roadmap.locator('[data-status="blocked"]', { hasText: "Machine Learning" });
  await expect(ml).toBeVisible();
  await ml.click();
  const detail = roadmap.locator("#roadmap-milestone-detail");
  await expect(detail).toContainText("Start with Statistics first.");

  // Statistics: the engine's next milestone, with the catalogue course it recommends.
  const rec = intel.recommendations.find((r) => r.skill === "Statistics")!;
  expect(rec.resource).not.toBeNull();
  await detail.getByRole("button", { name: /Statistics/ }).click();
  await expect(detail.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(detail.getByRole("link", { name: new RegExp(rec.resource!.title.replace(/[&]/g, "\\$&")) })).toHaveAttribute("href", rec.resource!.url);

  // A milestone the catalogue has no course for says so instead of inventing one.
  await roadmap.locator("[data-status]", { hasText: "Docker" }).click();
  await expect(detail).toContainText("No catalogued course for this skill");

  // Evidence submission: saved, shown as pending review, and never marks the milestone complete.
  await roadmap.locator("[data-status]", { hasText: "Statistics" }).click();
  await detail.getByRole("button", { name: "Submit evidence of your work" }).click();
  await detail.getByLabel("Link to your work for Statistics").fill("https://github.com/asha/stats-notebooks");
  await detail.getByRole("button", { name: "Submit" }).click();
  await expect(detail).toContainText("Evidence submitted");
  await expect
    .poll(async () => (await sql.query("SELECT milestone_id, evidence_url FROM roadmap_milestone_submissions WHERE user_id = $1", [user.id])).rows)
    .toEqual([{ milestone_id: "ml_engineer:statistics", evidence_url: "https://github.com/asha/stats-notebooks" }]);
  await page.reload();
  await expect(roadmap.locator('[data-status="submitted"]', { hasText: "Statistics" })).toBeVisible();
  await expect(page.getByTestId("roadmap-progress-bar")).toHaveAttribute("style", new RegExp(`width:\\s*${Math.round(rm.progress * 100)}%`));
  await context.close();
});
