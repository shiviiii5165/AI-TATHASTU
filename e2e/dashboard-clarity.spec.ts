/**
 * Dashboard clarity pass: every section is still present, the two approved sections (Your Journey, Skills
 * Intelligence) are pixel-identical to their baseline, and every "start here" signal names the same skill.
 * Uses real engine output (e2e/fixtures/engine-profile.json).
 *
 * Baseline for the frozen sections: run once on the approved build with --update-snapshots.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Browser } from "@playwright/test";

import type { IntelligenceDoc } from "../src/lib/dashboard/types";
import { createUser, signIn, sql } from "./support/fixtures";

const ENGINE: { intelligence: IntelligenceDoc; facts: { group: string; record: string; field: string; value: string }[] } = JSON.parse(
  readFileSync(path.join(__dirname, "fixtures/engine-profile.json"), "utf8"),
);
// A fixed assessment time, so relative dates ("Updated …") and journey content are the same on every run.
const FIXED = "2026-11-10T08:00:00.000Z";

async function setUp(browser: Browser, name: string, width = 1440) {
  const user = await createUser(name, "done");
  const intel = { ...structuredClone(ENGINE.intelligence), computedAt: FIXED };
  const base = JSON.parse(readFileSync(path.join(__dirname, "fixtures/profile-view.json"), "utf8").replaceAll("__NOW__", FIXED));
  await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [user.id, JSON.stringify({ ...base, computedAt: FIXED, intelligence: intel })]);
  for (const f of ENGINE.facts.filter((x) => !x.value.startsWith("["))) {
    await sql.query(
      `INSERT INTO profile_facts (user_id, field_group, field_name, record_key, extracted_value, normalized_value, source_evidence, extraction_method, origin, confidence, validation_status, confirmation)
       VALUES ($1, $2, $3, $4, $5, $5, NULL, 'llm', 'resume', 0.95, 'validated', 'confirmed')`,
      [user.id, f.group, f.field, f.record, JSON.stringify(f.value)],
    );
  }
  const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  await page.goto("/dashboard");
  await expect(page.getByTestId("career-roadmap")).toBeVisible();
  return { context, page };
}

test("every dashboard section and widget is still there", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Clarity sections");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  for (const id of ["journey-timeline", "skills-overview", "career-roadmap", "github-activity-card", "roadmap-next-action", "roadmap-next-steps", "roadmap-skill-progress"]) {
    await expect(page.getByTestId(id), id).toBeVisible();
  }
  for (const heading of ["Skill Gaps", "Skill Proficiency", "Learning Paths", "Career Roadmap", "Where you stand", "Skills to develop", "Recent GitHub work", "Your widgets"]) {
    await expect(page.getByRole("heading", { name: heading, exact: true }).first(), heading).toBeVisible();
  }
  // Pin and hide controls on the widgets are unchanged.
  for (const label of ["Where you stand", "Skills to develop", "Recent GitHub work"]) {
    const card = page.getByRole("article", { name: label, exact: true });
    await expect(card.getByRole("button", { name: `Hide ${label}` })).toBeVisible();
    await expect(card.getByRole("button", { name: new RegExp(`^(Pin|Unpin) ${label}`) })).toBeVisible();
  }
  await context.close();
});

test("one start: roadmap next action, Where you stand, Skills to develop and next steps agree", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Clarity start");
  const nextHref = (await page.getByTestId("next-action").getAttribute("href")) ?? "";
  const nextSkill = decodeURIComponent(nextHref.split("skill=")[1] ?? "");
  expect(nextSkill).not.toBe("");
  // Roadmap's next action names the same skill.
  await expect(page.getByTestId("roadmap-next-action")).toContainText(nextSkill);
  // Skills to develop marks the same skill "Start here", and only that one.
  const std = page.getByRole("article", { name: "Skills to develop", exact: true });
  await expect(std.getByText("Start here")).toHaveCount(1);
  await expect(std.locator(`[data-skill="${nextSkill}"]`)).toContainText("Start here");
  // "Your next steps" lists what comes after it, never the same step again.
  const steps = await page.getByTestId("roadmap-next-steps").locator("ol > li").allInnerTexts();
  for (const s of steps) expect(s.split("\n")[0]).not.toBe(nextSkill);
  // The same skill reads the same in Skill Gaps and Skills to develop.
  const role = ENGINE.intelligence.roles[0];
  for (const row of role.open.slice(0, 3)) {
    const inStd = await std.locator(`[data-skill="${row.skill}"]`).innerText().catch(() => null);
    if (!inStd) continue;
    const gapsCard = page.getByRole("heading", { name: "Skill Gaps", level: 2 }).locator("xpath=ancestor::section[1]");
    const label = inStd.match(/(Meets expected level|More practice needed|Listed, not yet shown|Described, not yet checkable|Possibly relevant|No work examples yet|Not assessed yet)/)?.[1];
    expect(label, row.skill).toBeTruthy();
    await expect(gapsCard.getByText(row.skill, { exact: true }).locator("xpath=ancestor::li[1]")).toContainText(label!);
  }
  await context.close();
});

test("the approved Your Journey and Skills Intelligence sections are unchanged", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Clarity frozen");
  for (const id of ["journey-timeline", "skills-overview"]) {
    const section = page.getByTestId(id);
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveScreenshot(`${id}.png`, { animations: "disabled", maxDiffPixelRatio: 0.002 });
  }
  await context.close();
});

for (const scheme of ["light", "dark"] as const) {
  test(`screenshots for visual review, ${scheme} mode`, async ({ browser }) => {
    test.skip(!process.env.SHOT_DIR, "set SHOT_DIR to capture review screenshots");
    test.setTimeout(240_000);
    for (const width of [1440, 1280, 1024, 768, 390]) {
      const user = await createUser(`Shots ${scheme} ${width}`, "done");
      const intel = { ...structuredClone(ENGINE.intelligence), computedAt: FIXED };
      const base = JSON.parse(readFileSync(path.join(__dirname, "fixtures/profile-view.json"), "utf8").replaceAll("__NOW__", FIXED));
      await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [user.id, JSON.stringify({ ...base, computedAt: FIXED, intelligence: intel })]);
      await sql.query("INSERT INTO connections (user_id, source_id, access_method, status, last_sync_at) VALUES ($1, 'github', 'oauth', 'connected', now())", [user.id]);
      await sql.query("INSERT INTO code_repositories (user_id, source, repo_name, url, languages, stars, last_commit_at) VALUES ($1, 'github', 'asha/resume-parser', 'https://github.com/asha/resume-parser', '{\"Python\": 5000}', 2, now() - interval '2 days')", [user.id]);
      const days = Array.from({ length: 365 }, (_, i) => ({ date: new Date(Date.UTC(2026, 10, 10) - (364 - i) * 86_400_000).toISOString().slice(0, 10), count: i % 5, level: Math.min(4, i % 5) }));
      await sql.query(
        "INSERT INTO github_contributions (user_id, total_contributions, days, category_totals, synced_at) VALUES ($1, $2, $3, '{\"commits\":700,\"pullRequests\":20,\"issues\":5,\"reviews\":3,\"repositories\":4,\"restricted\":0}', now())",
        [user.id, days.reduce((s, d) => s + d.count, 0), JSON.stringify(days)],
      );
      const context = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: scheme, reducedMotion: "reduce" });
      await signIn(context, user, { onboarded: true });
      const page = await context.newPage();
      await page.goto("/dashboard");
      await expect(page.getByTestId("career-roadmap")).toBeVisible();
      await expect(page.locator("html")).toHaveClass(scheme === "dark" ? /dark/ : /^(?!.*dark)/);
      const dir = process.env.SHOT_DIR;
      await page.screenshot({ path: `${dir}/${scheme}-${width}-full.png`, fullPage: true });
      for (const [name, locator] of [
        ["roadmap", page.getByTestId("career-roadmap")],
        ["widgets", page.locator("[data-widget=eris_readiness]").locator("xpath=..")],
        ["gaps", page.getByRole("heading", { name: "Skill Gaps", level: 2 }).locator("xpath=ancestor::section[1]")],
        ["github", page.getByTestId("github-activity-card")],
      ] as const) {
        await locator.scrollIntoViewIfNeeded();
        await locator.screenshot({ path: `${dir}/${scheme}-${width}-${name}.png` });
      }
      await context.close();
    }
  });
}

for (const width of [1440, 1280, 1024, 768, 390]) {
  test(`dashboard renders cleanly at ${width}px`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Clarity ${width}`, width);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const id of ["career-roadmap", "roadmap-skill-progress", "roadmap-next-action"]) {
      const clipped = await page.getByTestId(id).evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(clipped, `${id} overflows at ${width}px`).toBe(false);
    }
    if (process.env.SHOT_DIR) {
      await page.getByTestId("career-roadmap").screenshot({ path: `${process.env.SHOT_DIR}/roadmap-${process.env.SHOT_TAG ?? "after"}-${width}.png` });
      await page.screenshot({ path: `${process.env.SHOT_DIR}/dashboard-${process.env.SHOT_TAG ?? "after"}-${width}.png`, fullPage: true });
    }
    await context.close();
  });
}
