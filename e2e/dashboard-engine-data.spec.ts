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

async function setUp(browser: Browser, name: string) {
  const user = await createUser(name, "done");
  const base = JSON.parse(readFileSync(path.join(__dirname, "fixtures/profile-view.json"), "utf8").replaceAll("__NOW__", intel.computedAt));
  const view = { ...base, computedAt: intel.computedAt, intelligence: intel };
  await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [user.id, JSON.stringify(view)]);
  // The confirmed resume records the engine read (list-valued fields aside: they feed skills, not the journey).
  for (const f of ENGINE.facts.filter((x) => !x.value.startsWith("["))) {
    await sql.query(
      `INSERT INTO profile_facts (user_id, field_group, field_name, record_key, extracted_value, normalized_value, source_evidence, extraction_method, origin, confidence, validation_status, confirmation)
       VALUES ($1, $2, $3, $4, $5, $5, $6, 'llm', 'resume', 0.95, 'validated', 'confirmed')`,
      [user.id, f.group, f.field, f.record, JSON.stringify(f.value), f.value],
    );
  }
  const context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  await page.goto("/dashboard");
  return { user, context, page };
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

  await expect(journey).toContainText("No date on the record");
  await expect(journey).toContainText("Online Diploma in Data Science");
  await expect(journey).not.toContainText("Undated Side Project");
  await context.close();
});

test("skills: only the engine's evidence edges are drawn, and scores appear only where the engine scored", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Engine skills");
  const card = page.getByTestId("skills-overview");
  const shown = await card.locator("[data-cluster] button[aria-pressed]").evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label")!.split(":")[0]));
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
