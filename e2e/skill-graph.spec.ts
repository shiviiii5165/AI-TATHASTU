/**
 * The career intelligence cards on real pages, from a stored engine view: the graph fits its
 * card at every width with its labels whole, evidence opens from the keyboard, and none of the
 * old invented content appears.
 */
import { expect, test, type Page } from "@playwright/test";

import { createUser, seedComputedProfile, signIn } from "./support/fixtures";

const FABRICATED = ["Core Foundation", "Industry Impact", "AI Scored", "Free Certificate", "Student / Engineer", "6 Weeks", "Enroll in Path", "AI Impact Score", "Start Assessment"];

async function setUp(browser: import("@playwright/test").Browser, name: string, width: number) {
  const user = await createUser(name, "done");
  await seedComputedProfile(user.id);
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  return { context, page };
}

async function expectGraphInsideCard(page: Page) {
  const card = page.getByTestId("skill-graph");
  const network = card.getByTestId("skill-network");
  await expect(network.locator("svg text").first()).toBeVisible();
  const report = await card.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const mains = [...el.querySelectorAll("[data-testid=skill-network] circle[data-main]")];
    const rects = mains.map((n) => n.getBoundingClientRect());
    let overlapping = 0;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const d = Math.hypot(a.x + a.width / 2 - (b.x + b.width / 2), a.y + a.height / 2 - (b.y + b.height / 2));
        if (d < a.width / 2 + b.width / 2) overlapping++;
      }
    return {
      parts: rects.length,
      outside: rects.filter((r) => r.left < box.left - 0.5 || r.right > box.right + 0.5).length,
      overlapping,
      // The dashboard's palette: gradient fills, never the theme's primary or card colour.
      flatFills: mains.filter((c) => {
        const fill = c.getAttribute("fill") ?? "";
        return fill.startsWith("var(") || fill === "black" || fill === "#000";
      }).length,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(report.parts).toBeGreaterThan(0);
  expect(report.outside).toBe(0);
  expect(report.overlapping).toBe(0);
  expect(report.flatFills).toBe(0);
  expect(report.pageOverflow).toBeLessThanOrEqual(0);
}

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`skill graph and skill groups fit at ${width}px`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Width ${width}`, width);
    await page.goto("/skills"); // the full graph lives on /skills
    await expectGraphInsideCard(page);
    await expect(page.getByTestId("skill-network").locator("text", { hasText: /^LangChain$/ })).toBeVisible();
    await expect(page.getByTestId("skill-collection")).toBeVisible();
    await page.screenshot({ path: `test-results/skills-${width}.png`, fullPage: true });
    await context.close();
  });
}

test("the /skills graph uses the same drawing as the dashboard's Skills Intelligence", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Compare", 1440);
  await page.goto("/dashboard");
  const home = page.getByTestId("skills-overview");
  await expect(home.getByTestId("skill-network").locator("[data-node]").first()).toBeVisible();
  await home.screenshot({ path: "test-results/compare-dashboard.png" });
  const homeFills = await home.locator("circle[data-main]").evaluateAll((cs) => cs.map((c) => (c.getAttribute("fill") ?? "").replace(/url\(#[^-]+-/, "url(#")));
  await page.goto("/skills");
  const full = page.getByTestId("skill-graph");
  await full.screenshot({ path: "test-results/compare-skills.png" });
  const fullFills = await full.locator("circle[data-main]").evaluateAll((cs) => cs.map((c) => (c.getAttribute("fill") ?? "").replace(/url\(#[^-]+-/, "url(#")));
  expect(new Set(fullFills)).toEqual(new Set(homeFills));
  await context.close();
});

test("selecting a skill shows its evidence; the list matches the graph", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Keys", 1280);
  await page.goto("/skills");
  const card = page.getByTestId("skill-graph");
  const python = card.getByRole("button", { name: /^Python: Demonstrated/ });
  await python.focus();
  await page.keyboard.press("Enter");
  const detail = card.getByRole("region", { name: "Python evidence" });
  await expect(detail.getByRole("link", { name: /asha\/resume-parser/ })).toHaveAttribute("href", "https://github.com/asha/resume-parser");
  await page.keyboard.press("Escape");
  await expect(detail).toBeHidden();

  await card.getByRole("button", { name: "List" }).click();
  await expect(card.getByRole("list", { name: "Skills" }).getByRole("listitem")).not.toHaveCount(0);
  await card.getByRole("button", { name: "Network" }).click();
  await expect(card.getByTestId("skill-network")).toBeVisible();
  await context.close();
});

test("skills are grouped, explained, and suggestions are never assessed", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Groups", 1280);
  await page.goto("/skills");
  const collection = page.getByTestId("skill-collection");
  await expect(collection.getByRole("heading", { name: "Assessed skills" })).toBeVisible();

  const guide = collection.getByTestId("level-guide");
  await guide.locator("summary").click();
  for (const level of ["Foundational", "Working", "Proficient", "Advanced", "Not assessed"]) await expect(guide.getByText(level, { exact: true })).toBeVisible();
  await expect(guide.getByText(/not from an exam/)).toBeVisible();

  // Every assessed card shows a level, a confidence and its sources; no "Verified" badge on a non-demonstrated skill.
  const cards = collection.getByRole("list", { name: "Assessed skills" }).getByRole("listitem").filter({ has: page.locator("h4") });
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(cards.first().getByText("Confidence")).toBeVisible();
  await expect(collection.locator("[data-state]", { hasText: "Verified" })).toHaveCount(0);

  const suggested = collection.getByTestId("group-suggested");
  if (await suggested.count()) {
    await suggested.locator("summary").click();
    const rows = suggested.getByRole("listitem");
    for (const row of await rows.all()) await expect(row.getByText("Not assessed")).toBeVisible();
  }
  await context.close();
});

test("the Skill Gaps card and the Skills to develop widget list the same skills, in the same order", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Same", 1280);
  await page.goto("/dashboard");
  const widget = page.getByRole("article", { name: "Skills to develop" });
  await expect(widget.getByRole("link", { name: "Learn Kubernetes" })).toBeVisible();
  const fromWidget = (await widget.getByRole("link", { name: /^Learn / }).evaluateAll((links) => links.map((a) => a.getAttribute("aria-label")))).map((l) => l!.replace("Learn ", ""));
  const card = page.getByRole("heading", { name: "Skill Gaps", level: 2 }).locator("xpath=ancestor::section[1]");
  for (const skill of fromWidget) await expect(card.getByText(skill, { exact: true })).toBeVisible();
  expect(fromWidget).toEqual(["Kubernetes", "Docker"]);
  await context.close();
});

test("the dashboard, skills and learning pages show evidence states and nothing invented", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Honest", 1280);
  for (const path of ["/dashboard", "/skills", "/learning"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const text = await page.locator("body").innerText();
    for (const phrase of FABRICATED) expect(text, `${path} shows "${phrase}"`).not.toContain(phrase);
  }
  await page.goto("/dashboard");
  await expect(page.getByText("Not assessed").first()).toBeVisible();
  await context.close();
});
