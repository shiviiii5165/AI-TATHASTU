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
  await expect(card.getByTestId("skill-graph-canvas").locator("text").first()).toBeVisible();
  const report = await card.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const graph = el.querySelector("[data-testid=skill-graph-canvas]")!;
    const parts = [...graph.querySelectorAll("circle, text")].map((n) => n.getBoundingClientRect());
    return {
      outside: parts.filter((r) => r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5).length,
      parts: parts.length,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(report.parts).toBeGreaterThan(0);
  expect(report.outside).toBe(0);
  expect(report.pageOverflow).toBeLessThanOrEqual(0);
}

for (const width of [360, 768, 1280, 1920]) {
  test(`skill graph fits its card at ${width}px`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Width ${width}`, width);
    await page.goto("/skills"); // the full graph lives on /skills
    await expectGraphInsideCard(page);
    await expect(page.getByTestId("skill-graph-canvas").locator("text", { hasText: /^LangChain$/ })).toBeVisible();
    await context.close();
  });
}

test("evidence opens from the keyboard and closes with Escape; the list matches the graph", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Keys", 1280);
  await page.goto("/skills");
  const card = page.getByTestId("skill-graph");
  const python = card.getByRole("button", { name: /^Python: Verified/ });
  await python.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("link", { name: "asha/resume-parser" })).toHaveAttribute("href", "https://github.com/asha/resume-parser");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await card.getByRole("button", { name: "list" }).click();
  await expect(card.getByRole("list", { name: "Skills" }).getByRole("listitem")).toHaveCount(6);
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
