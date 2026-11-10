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
  const steps = page.getByTestId("roadmap-next-steps").getByRole("listitem");
  // The engine's next milestone is the roadmap's Next action, so the list continues after it without repeating it.
  await expect(page.getByTestId("roadmap-next-action")).toContainText("Statistics");
  // Each step names its skill and the engine's deliverable; why it's recommended is on hover.
  await expect(steps.first()).toContainText("A public project using");
  await expect(steps.first().locator("[title^='ML Engineer expects']")).toHaveCount(1);
  for (const t of await steps.allInnerTexts()) expect(t).not.toMatch(/Statistics:|Machine Learning:|MLflow:|Connect with research peers/);
  await context.close();
});

for (const width of [1440, 390]) {
  test(`skills network at ${width}px: circular nodes, none overlapping or clipped, only real links`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Engine network ${width}`, { width });
    const network = page.getByTestId("skill-network");
    await expect(network.locator("[data-node]").first()).toBeVisible();
    const report = await network.evaluate((el) => {
      const box = el.getBoundingClientRect();
      // True circle geometry (on-screen centre and radius), not bounding boxes: diagonal neighbours' boxes overlap
      // even when the circles are well apart.
      const nodes = [...el.querySelectorAll("[data-node]")].map((g) => {
        const c = g.querySelector("circle[data-main]")!.getBoundingClientRect();
        return { id: g.getAttribute("data-node")!, cx: c.left + c.width / 2, cy: c.top + c.height / 2, r: c.width / 2, circle: c, label: g.querySelector("text")!.getBoundingClientRect() };
      });
      const pairs: string[] = [];
      for (let i = 0; i < nodes.length; i++)
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          if (Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.r + b.r) pairs.push(`${a.id}/${b.id}`);
        }
      // Each name stays inside its own circle (so it can't run into a neighbour).
      const spilling = nodes
        .filter(({ cx, cy, r, label }) => [[label.left, label.top], [label.right, label.top], [label.left, label.bottom], [label.right, label.bottom]].some(([x, y]) => Math.hypot(x - cx, y - cy) > r + 2))
        .map((n) => n.id);
      const clipped = nodes.filter(({ circle }) => circle.left < box.left - 0.5 || circle.right > box.right + 0.5 || circle.top < box.top - 0.5 || circle.bottom > box.bottom + 0.5).map((n) => n.id);
      return { count: nodes.length, pairs, spilling, clipped, fontPx: parseFloat(getComputedStyle(el.querySelector("[data-node] text")!).fontSize), pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(report.count).toBeGreaterThan(0);
    expect(report.pairs).toEqual([]);
    expect(report.spilling).toEqual([]);
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
    // Every skill in the engine graph, not only the ones drawn.
    await expect(page.getByTestId("skills-overview").getByRole("list", { name: "Skills" }).getByRole("button")).toHaveCount(intel.graph.nodes.length);
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
  await expect(roadmap.getByTestId("journey-current")).toContainText(rm.currentPosition!);
  await expect(page.getByTestId("roadmap-progress-bar")).toHaveAttribute("style", new RegExp(`width:\\s*${Math.round(rm.progress * 100)}%`));
  const role = intel.roles.find((r) => r.role === rm.role)!;
  await expect(roadmap).toContainText(`${rm.completed.length} of ${role.skills.length} skills`);

  // Goal skill progress: the engine's own classification, counts and evidence.
  const progress = roadmap.getByTestId("roadmap-skill-progress");
  const count = (states: string[]) => String(role.skills.filter((s) => states.includes(s.state)).length);
  await expect(progress.locator('[data-bucket="demonstrated"]')).toContainText(count(["met"]));
  await expect(progress.locator('[data-bucket="inProgress"]')).toContainText(count(["underdeveloped"]));
  await expect(progress.locator('[data-bucket="notYet"]')).toContainText(count(["unverified", "inferred", "missing", "not_assessed"]));
  await progress.locator('[data-bucket="inProgress"]').click();
  for (const s of role.skills.filter((x) => x.state === "underdeveloped")) await expect(progress.getByTestId("roadmap-skill-bucket")).toContainText(s.skill);

  // Machine Learning requires Statistics, which the evidence doesn't show: its stage is locked, with the reason.
  await expect(roadmap.getByTestId("journey-stage-build")).toContainText("Complete Statistics first to unlock this step");
  await roadmap.getByTestId("journey-stage-build").getByRole("button").click();
  const stage = roadmap.getByTestId("roadmap-stage-detail");
  await expect(roadmap.getByTestId("roadmap-focus-skill")).toHaveText("Machine Learning");
  await stage.getByRole("button", { name: "View skill details" }).click();
  const detail = roadmap.locator("#roadmap-milestone-detail");
  await expect(detail).toContainText("Complete Statistics first to unlock this step.");

  // Statistics: the engine's next milestone, with the catalogue course it recommends, also as the next action.
  const rec = intel.recommendations.find((r) => r.skill === "Statistics")!;
  expect(rec.resource).not.toBeNull();
  await expect(roadmap.getByTestId("roadmap-next-action").getByRole("link", { name: /Start the course/ })).toHaveAttribute("href", rec.resource!.url);
  await detail.getByRole("button", { name: /Statistics/ }).click(); // follows the prerequisite to its stage
  await expect(roadmap.getByTestId("roadmap-focus-skill")).toHaveText("Statistics");
  await expect(roadmap.locator("#roadmap-milestone-detail").getByRole("heading", { name: "Statistics" })).toBeVisible();
  await expect(roadmap.locator("#roadmap-milestone-detail").getByRole("link", { name: new RegExp(rec.resource!.title.replace(/[&]/g, "\\$&")) })).toHaveAttribute("href", rec.resource!.url);

  // Other skills in the stage are compact chips; one the catalogue has no course for says so instead of inventing one.
  await stage.locator("button[data-status]", { hasText: "Docker" }).click();
  await expect(roadmap.locator("#roadmap-milestone-detail")).toContainText("No catalogued course for this skill");

  // Evidence submission: saved, shown as in review, and never marks the milestone complete.
  await stage.getByRole("button", { name: "View skill details" }).click();
  const statsDetail = roadmap.locator("#roadmap-milestone-detail");
  await expect(statsDetail.getByRole("heading", { name: "Statistics" })).toBeVisible();
  await statsDetail.getByRole("button", { name: "Submit evidence of your work" }).click();
  await statsDetail.getByLabel("Link to your work for Statistics").fill("https://github.com/asha/stats-notebooks");
  await statsDetail.getByRole("button", { name: "Submit" }).click();
  await expect(statsDetail).toContainText("Evidence submitted");
  await expect
    .poll(async () => (await sql.query("SELECT milestone_id, evidence_url FROM roadmap_milestone_submissions WHERE user_id = $1", [user.id])).rows)
    .toEqual([{ milestone_id: "ml_engineer:statistics", evidence_url: "https://github.com/asha/stats-notebooks" }]);
  await page.reload();
  await expect(roadmap.getByTestId("roadmap-focus-skill")).toHaveText("Statistics");
  await expect(roadmap.getByTestId("roadmap-stage-detail")).toContainText("In review");
  await expect(page.getByTestId("roadmap-progress-bar")).toHaveAttribute("style", new RegExp(`width:\\s*${Math.round(rm.progress * 100)}%`));
  // Still nothing completed: the runner hasn't moved.
  await expect(roadmap.getByTestId("journey-runner")).toHaveAttribute("data-at", "0");
  await context.close();
});

for (const width of [1440, 390]) {
  test(`roadmap journey at ${width}px: ${width < 768 ? "vertical" : "curved, left to right"}, runner at real progress, no sample data`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Engine roadmap ${width}`, { width });
    const mobile = width < 768;
    const journey = page.getByTestId(mobile ? "roadmap-journey-mobile" : "roadmap-journey");
    await expect(journey).toBeVisible();
    const report = await journey.evaluate((el, mob) => {
      const nodes = [...el.querySelectorAll("[data-journey-node]")].map((n) => n.getBoundingClientRect());
      const runner = el.querySelector(mob ? "[data-testid=journey-runner-mobile]" : "[data-testid=journey-runner]")!;
      const r = runner.getBoundingClientRect();
      return {
        count: nodes.length,
        xs: nodes.map((b) => Math.round(b.left + b.width / 2)),
        ys: nodes.map((b) => Math.round(b.top)),
        at: Number(runner.getAttribute("data-at")),
        runnerX: r.left + r.width / 2,
        runnerY: r.top + r.height / 2,
        segments: [...el.querySelectorAll("[data-segment]")].map((s) => s.getAttribute("data-segment")),
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, mobile);
    expect(report.count).toBe(intel.roadmap!.stages.length + 2); // where you are, each engine stage, the goal
    if (mobile) expect(report.ys).toEqual([...report.ys].sort((a, b) => a - b));
    else expect(report.xs).toEqual([...report.xs].sort((a, b) => a - b));
    // Nothing completed in this profile: the runner is at the start, and the path ahead isn't drawn as done.
    expect(report.at).toBe(0);
    if (mobile) expect(report.runnerY).toBeLessThan(report.ys[1]);
    else expect(report.runnerX).toBeLessThan(report.xs[1]);
    expect(report.segments).not.toContain("done");
    expect(report.segments[0]).toBe("active");
    expect(report.overflow).toBeLessThanOrEqual(0);

    // None of the mockup's placeholder values or time-horizon labels; only the engine's estimates, labelled as such.
    const text = await page.getByTestId("career-roadmap").innerText();
    for (const sample of ["4-8 weeks", "4–8 weeks", "2–3 months", "3–6 months", "Strengthen ML Foundations", "B.Tech Student (AI & ML)", "B.Tech / B.E.", "3 of 10 skills"]) expect(text).not.toContain(sample);
    expect(text).not.toMatch(/short term|mid term|long term/i);
    for (const s of intel.roadmap!.stages) expect(text).toContain(`≈ ${s.estimateWeeks} weeks (estimate)`);
    await context.close();
  });
}
