/**
 * Your Journey, Skills Intelligence and Career Roadmap on the real dashboard, from a stored engine view
 * plus confirmed profile facts: chronological animation order, evidence-only links, an interactive roadmap
 * with real states, reduced motion, no horizontal overflow on phones, and honest empty states.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Browser } from "@playwright/test";

import { createUser, signIn, sql } from "./support/fixtures";

function viewWithRoadmap() {
  const view = JSON.parse(readFileSync(path.join(__dirname, "fixtures/profile-view.json"), "utf8").replaceAll("__NOW__", new Date().toISOString()));
  const ms = (skill: string, requires: string[]) => ({
    id: `ml_engineer:${skill.toLowerCase()}`,
    skill,
    state: "missing",
    done: false,
    requires,
    deliverable: `A public project using ${skill}`,
    criterion: `${skill} reaches Working from your evidence`,
    estimateWeeks: 4,
  });
  view.intelligence.roadmap = {
    role: "ml_engineer",
    currentPosition: "ML Intern at Acme",
    progress: 0.6,
    completed: ["Python", "PyTorch"],
    stages: [
      { key: "foundation", title: "Build the foundations", estimateWeeks: 4, milestones: [ms("Docker", [])] },
      { key: "build", title: "Build on them", estimateWeeks: 4, milestones: [ms("Kubernetes", ["Docker"])] },
    ],
    assumption: "Estimates assume about 8 hours a week, one skill at a time. They are planning figures, not measured.",
  };
  return view;
}

const FACTS: [string, string, string, string][] = [
  ["education", "edu1", "degree", "B.Tech Computer Science"],
  ["education", "edu1", "institution", "IIT Delhi"],
  ["education", "edu1", "end_date", "2022"],
  ["achievements", "ach1", "title", "Smart India Hackathon winner"],
  ["achievements", "ach1", "date", "2021"],
  ["experience", "exp1", "role", "ML Intern"],
  ["experience", "exp1", "organization", "Acme"],
  ["experience", "exp1", "start_date", "2023"],
  ["experience", "exp1", "end_date", "Present"],
  ["achievements", "ach2", "title", "Kaggle Expert"],
];

async function setUp(browser: Browser, name: string, width: number, { seeded = true, reducedMotion = "no-preference" as "reduce" | "no-preference" } = {}) {
  const user = await createUser(name, "done");
  if (seeded) {
    await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [user.id, JSON.stringify(viewWithRoadmap())]);
    for (const [group, record, field, value] of FACTS) {
      await sql.query(
        `INSERT INTO profile_facts (user_id, field_group, field_name, record_key, extracted_value, normalized_value, source_evidence, extraction_method, origin, confidence, validation_status, confirmation)
         VALUES ($1, $2, $3, $4, $5, $5, $6, 'llm', 'resume', 0.95, 'validated', 'confirmed')`,
        [user.id, group, field, record, JSON.stringify(value), value],
      );
    }
  }
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion });
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  await page.goto("/dashboard");
  return { context, page };
}

test("journey runs earliest to latest, ending on the current position, with undated records apart", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Journey", 1280);
  const journey = page.getByTestId("journey-timeline");
  const items = journey.getByRole("list", { name: /earliest to most recent/ }).locator(":scope > li");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Smart India Hackathon winner");
  await expect(items.nth(1)).toContainText("B.Tech Computer Science");
  await expect(items.nth(2)).toContainText("ML Intern");
  await expect(items.nth(2)).toHaveAttribute("data-current", "true");
  await expect(items.nth(2)).toContainText("Where you are now");
  await expect(journey).toContainText("No date on the record");
  await expect(journey).toContainText("Kaggle Expert");

  // The reveal is sequential in that order: each node starts later than the one before it.
  const delays = await journey.getByTestId("journey-node").evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).animationDelay)));
  expect(delays).toEqual([...delays].sort((a, b) => a - b));
  expect(new Set(delays).size).toBe(delays.length);
  await expect(journey.getByTestId("journey-segment")).toHaveCount(2);
  await context.close();
});

test("skills are clustered by category, linked only by recorded edges, and explain their evidence", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Skills", 1280);
  const card = page.getByTestId("skills-overview");
  const network = card.getByTestId("skill-network");
  await expect(network.locator("[data-cluster]").first()).toBeVisible();
  // One evidence edge in the stored graph (Python and PyTorch share a repository); documented relations stay hidden.
  await expect(network.locator('path[data-basis="evidence"]')).toHaveCount(1);
  await expect(network.locator('path[data-basis="ontology"]')).toHaveCount(0);

  await card.getByRole("button", { name: /^LangChain:/ }).click();
  await expect(network.locator('path[data-basis="ontology"]')).toHaveCount(2);
  const detail = card.getByRole("region", { name: "LangChain evidence" });
  await expect(detail).toBeVisible();
  // Verified in the stored graph with no evidence items listed: the reason says so rather than naming sources.
  await expect(detail).toContainText("Verified from independent evidence on your profile.");
  await expect(detail).toContainText("Proficiency: Working");
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();
  await context.close();
});

test("the roadmap shows where you are, your goal, a next step, and blocked milestones with reasons", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Roadmap", 1280);
  const roadmap = page.getByTestId("career-roadmap");
  await expect(roadmap).toContainText("ML Intern at Acme");
  await expect(roadmap).toContainText("Where you want to go");
  await expect(roadmap.getByText("What to do next")).toBeVisible();
  await expect(roadmap.getByText("A public project using Docker").first()).toBeVisible();
  await expect(roadmap.locator('[data-status="active"]')).toContainText("Docker");
  await expect(roadmap.locator('[data-status="blocked"]')).toContainText("Kubernetes");
  await expect(page.getByTestId("roadmap-progress-bar")).toHaveAttribute("style", /width:\s*60%/);

  await roadmap.locator('[data-status="blocked"]').click();
  const detail = roadmap.locator("#roadmap-milestone-detail");
  await expect(detail).toContainText("Why this is on your roadmap");
  await expect(detail).toContainText("Start with Docker first.");
  await detail.getByRole("button", { name: /Docker/ }).click();
  await expect(detail.getByRole("heading", { name: "Docker" })).toBeVisible();
  await context.close();
});

test("reduced motion shows the finished state without animation", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Calm", 1280, { reducedMotion: "reduce" });
  const names = await page.getByTestId("journey-node").evaluateAll((els) => els.map((e) => getComputedStyle(e).animationName));
  expect(names.length).toBeGreaterThan(0);
  expect(names.every((n) => n === "none")).toBe(true);
  expect(await page.getByTestId("roadmap-progress-bar").evaluate((e) => getComputedStyle(e).animationName)).toBe("none");
  await context.close();
});

for (const width of [360, 768]) {
  test(`all three sections fit at ${width}px without horizontal overflow`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Narrow ${width}`, width);
    for (const id of ["journey-timeline", "skills-overview", "career-roadmap"]) await expect(page.getByTestId(id)).toBeVisible();
    const report = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      // Visible content that sticks out of its section (decorative, aria-hidden glows are clipped on purpose).
      wide: ["journey-timeline", "skills-overview", "career-roadmap"].flatMap((id) => {
        const el = document.querySelector(`[data-testid=${id}]`)!;
        const box = el.getBoundingClientRect();
        return [...el.querySelectorAll("*")]
          .filter((c) => !c.closest("[aria-hidden=true]") && !c.classList.contains("sr-only"))
          .filter((c) => {
            const r = c.getBoundingClientRect();
            return r.width > 0 && (r.left < box.left - 1 || r.right > box.right + 1);
          })
          .map((c) => `${id}: ${c.tagName} ${(c.textContent ?? "").slice(0, 30)}`);
      }),
    }));
    expect(report.overflow).toBeLessThanOrEqual(0);
    expect(report.wide).toEqual([]);
    await context.close();
  });
}

test("the dashboard uses one sans-serif system, with no serif or italic text", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Type", 1280);
  await expect(page.getByTestId("career-roadmap")).toBeVisible();
  const offenders = await page.evaluate(() =>
    [...document.querySelectorAll("#app-content *")]
      .filter((el) => el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
      .map((el) => ({ el, s: getComputedStyle(el) }))
      .filter(({ s }) => /instrument|serif(?!-)/i.test(s.fontFamily.replace(/sans-serif/gi, "")) || s.fontStyle === "italic")
      .map(({ el, s }) => `${el.tagName} "${el.textContent!.trim().slice(0, 30)}" ${s.fontFamily} ${s.fontStyle}`),
  );
  expect(offenders).toEqual([]);
  // One family for all text in the shell: no Figtree or system fallback mixed in with the loaded sans.
  const families = await page.evaluate(() => [...new Set([...document.querySelectorAll("#app-content *")].filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())).map((el) => getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/"/g, "")))]);
  expect(families.filter((f) => !/Plus Jakarta Sans|Geist Mono|mono/i.test(f))).toEqual([]);
  // Hidden widgets aside, every page heading in the shell resolves to the same family as body text.
  const [h1, body] = await page.evaluate(() => [getComputedStyle(document.querySelector("#app-content h1")!).fontFamily, getComputedStyle(document.querySelector(".app-type")!).fontFamily]);
  const primary = (f: string) => f.split(",")[0].trim();
  expect(primary(h1)).toBe(primary(body));
  expect(h1).toMatch(/sans-serif$/);
  await context.close();
});

test("with no evidence, each section explains what's missing instead of drawing anything", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Empty", 1280, { seeded: false });
  await expect(page.getByTestId("journey-timeline")).toContainText("Nothing on your timeline yet");
  await expect(page.getByTestId("skills-overview")).toContainText("No skills identified yet");
  await expect(page.getByTestId("career-roadmap")).toContainText(/being calculated|Choose where you want to go|No roadmap for your goal yet/);
  await expect(page.getByTestId("journey-node")).toHaveCount(0);
  await expect(page.locator('[data-testid="skill-network"]')).toHaveCount(0);
  await context.close();
});
