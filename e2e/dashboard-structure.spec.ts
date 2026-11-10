/**
 * AI Tathastu and Collaborate: personal intelligence here, full networking there. Navigation shows Collaborate
 * once (the authorised launch route), no People & Network / Communities / Internships entries and no Yora card;
 * the dashboard keeps a short people preview that hands off to Collaborate, and drops the Avasar jobs placeholder
 * and the profile-complete widget, while everything that works stays.
 */
import { expect, test, type Browser } from "@playwright/test";

import { createUser, seedComputedProfile, signIn } from "./support/fixtures";

async function setUp(browser: Browser, name: string, width: number) {
  const user = await createUser(name, "done");
  await seedComputedProfile(user.id);
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  await page.goto("/dashboard");
  return { context, page };
}

test("desktop sidebar: removed entries gone, Collaborate exactly once via the authorised launch, no Yora card", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Structure desktop", 1440);
  const sidebar = page.locator("aside");
  await expect(sidebar.getByRole("link", { name: "Home" })).toBeVisible();
  for (const gone of ["People & Network", "Communities", "Internships", "Open Collaborate"]) await expect(sidebar.getByRole("link", { name: gone, exact: true })).toHaveCount(0);
  await expect(sidebar.getByRole("button", { name: /Ask Yora/ })).toHaveCount(0);
  await expect(sidebar.getByText("Yora AI")).toHaveCount(0);

  const collaborate = sidebar.getByRole("link", { name: /^Collaborate/ });
  await expect(collaborate).toHaveCount(1);
  await expect(collaborate).toHaveAttribute("href", "/integrations/launch/collaborate");
  // Unaffected items keep their order; Privacy, Integrations and Sign out stay.
  const labels = await sidebar.getByRole("navigation", { name: "Main" }).getByRole("link").allTextContents();
  expect(labels.slice(0, 6)).toEqual(["Home", "My Profile", "Skills", "Projects", "Achievements", "Opportunities"]);
  for (const kept of ["Privacy", "Integrations"]) await expect(sidebar.getByRole("link", { name: kept })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: "Sign out" })).toBeVisible();

  // The underlying People page still works for existing links and bookmarks.
  const res = await page.request.get("/people");
  expect(res.status()).toBe(200);
  await context.close();
});

test("mobile menu: same boundary, Collaborate once, no Yora banner", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Structure mobile", 390);
  await page.getByRole("button", { name: "Open full menu and modules" }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("link", { name: /Dashboard Overview/ })).toBeVisible();
  for (const gone of ["People & Network", "Communities", "Internships", "Open Collaborate"]) await expect(drawer.getByRole("link", { name: gone, exact: true })).toHaveCount(0);
  await expect(drawer.getByText("Ask Yora Assistant")).toHaveCount(0);
  const collaborate = drawer.getByRole("link", { name: /^Collaborate/ });
  await expect(collaborate).toHaveCount(1);
  await expect(collaborate).toHaveAttribute("href", "/integrations/launch/collaborate");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await context.close();
});

test("dashboard: people preview hands off to Collaborate; removed widgets gone; working sections kept", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Structure dashboard", 1440);
  const preview = page.getByTestId("people-preview");
  await expect(preview.getByRole("heading", { name: "People you may know" })).toBeVisible();
  // No eligible matches in this environment: a compact, honest line instead of placeholder cards.
  await expect(preview.getByText(/No suggestions yet|Looking for people/)).toBeVisible();
  expect(await preview.getByRole("listitem").count()).toBeLessThanOrEqual(3);
  await expect(preview).not.toContainText("%");
  await expect(preview.getByRole("link", { name: "Explore more on Collaborate" })).toHaveAttribute("href", "/integrations/launch/collaborate");
  await expect(preview.getByRole("link", { name: /View All|Browse Network/ })).toHaveCount(0);
  expect((await preview.boundingBox())!.height).toBeLessThan(420);

  // Removed widgets.
  await expect(page.getByRole("heading", { name: "Jobs that fit you" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Finish your profile" })).toHaveCount(0);
  await expect(page.getByText("Connect your Avasar account")).toHaveCount(0);

  // Kept: GitHub work, research and internship previews, journey, skills, roadmap; the profile metric still reads completeness.
  await expect(page.getByRole("heading", { name: "Recent GitHub work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Research opportunities" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Internships" })).toBeVisible();
  for (const id of ["journey-timeline", "skills-overview", "career-roadmap"]) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByRole("link", { name: /Profile Complete/ })).toBeVisible();
  await context.close();
});

test("the Collaborate launch goes through the existing authorised route, never a dead end", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Structure launch", 1440);
  const res = await page.request.get("/integrations/launch/collaborate", { maxRedirects: 0 });
  expect(res.status()).toBe(303);
  const location = res.headers()["location"] ?? "";
  // Either Collaborate's own start URL (integration on) or Integrations with a notice (off in this environment).
  expect(location).toMatch(/\/settings\/integrations\?unavailable=collaborate|^https?:\/\//);
  await context.close();
});

test("sidebar runs in one sequence: the lower links follow straight after the last module", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Structure sequence", 1440);
  const sidebar = page.locator("aside");
  const last = await sidebar.getByRole("navigation", { name: "Main" }).getByRole("link").last().boundingBox();
  const collaborate = await sidebar.getByRole("link", { name: /^Collaborate/ }).boundingBox();
  // Just the divider between them, however tall the window is.
  expect(collaborate!.y - (last!.y + last!.height)).toBeLessThan(48);
  await context.close();
});

for (const [path, title, testId] of [["/ai-interview", /practice interview room/, "coming-soon-ai-interview"], ["/mentor", /mentor network/, "coming-soon-mentor"]] as const) {
  test(`${path} shows its animated coming-soon page, still under reduced motion`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Coming soon ${path}`, 1440);
    await page.goto(path);
    const scene = page.getByTestId(testId);
    await expect(scene.getByRole("heading", { level: 1 })).toContainText(title);
    await expect(scene).toContainText("Coming soon");
    await expect(scene.getByRole("link", { name: "Return to dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(await scene.locator(".cs-ring, .cs-orbit, .cs-wave").count()).toBeGreaterThan(0);
    expect(await scene.locator(".cs-ring").first().evaluate((e) => getComputedStyle(e).animationName)).not.toBe("none");
    await context.close();

    const calm = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: "reduce" });
    const user = await createUser(`Calm ${path}`, "done");
    await signIn(calm, user, { onboarded: true });
    const p = await calm.newPage();
    await p.goto(path);
    const still = p.getByTestId(testId);
    await expect(still).toBeVisible();
    expect(await still.locator("[class*='cs-']").evaluateAll((els) => els.every((e) => getComputedStyle(e).animationName === "none"))).toBe(true);
    expect(await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await calm.close();
  });
}
