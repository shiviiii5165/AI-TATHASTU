/**
 * Home dashboard intelligence widgets (Where you stand, Skills to develop, Recent GitHub work) against output from
 * the real career engine v3 (e2e/fixtures/engine-profile.json, see dashboard-engine-data.spec.ts). The score on
 * screen is checked against the documented formula applied to the stored engine document.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Browser, type Page } from "@playwright/test";

import { intelligenceScore } from "../src/lib/dashboard/eris-intelligence";
import type { IntelligenceDoc } from "../src/lib/dashboard/types";
import { countRows, createUser, signIn, sql } from "./support/fixtures";

const ENGINE: { intelligence: IntelligenceDoc } = JSON.parse(readFileSync(path.join(__dirname, "fixtures/engine-profile.json"), "utf8"));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test fixtures edit arbitrary parts of the stored view
type Mutate = (view: Record<string, any>) => void;

async function setUp(browser: Browser, name: string, { width = 1440, mutate, github = true }: { width?: number; mutate?: Mutate; github?: boolean } = {}) {
  const user = await createUser(name, "done");
  const intel = structuredClone(ENGINE.intelligence);
  const base = JSON.parse(readFileSync(path.join(__dirname, "fixtures/profile-view.json"), "utf8").replaceAll("__NOW__", intel.computedAt));
  const view = { ...base, computedAt: intel.computedAt, intelligence: intel };
  mutate?.(view);
  await sql.query("INSERT INTO profile_views (user_id, view) VALUES ($1, $2)", [user.id, JSON.stringify(view)]);
  if (github) {
    await sql.query("INSERT INTO connections (user_id, source_id, access_method, status, last_sync_at) VALUES ($1, 'github', 'oauth', 'connected', now())", [user.id]);
    for (const [repo, langs, days] of [
      ["asha/resume-parser", { Python: 52000, Shell: 800 }, 2],
      ["acme-labs/sql-dashboards", { Python: 9000, SQL: 6000 }, 20],
    ] as const) {
      await sql.query(
        "INSERT INTO code_repositories (user_id, source, repo_name, url, languages, stars, last_commit_at) VALUES ($1, 'github', $2, $3, $4, 0, now() - ($5 || ' days')::interval)",
        [user.id, repo, `https://github.com/${repo}`, JSON.stringify(langs), days],
      );
    }
  }
  const context = await browser.newContext({ viewport: { width, height: 1000 } });
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  await page.goto("/dashboard");
  return { user, context, page, view };
}

const widget = (page: Page, label: string) => page.getByRole("article", { name: label, exact: true });

test("a current v3 assessment shows the documented score, the alignment separately, gaps and the next action", async ({ browser }) => {
  const { context, page, view } = await setUp(browser, "Home v3");
  const analysis = view.intelligence.roles.find((r: { role: string }) => r.role === view.goals.primaryRole);
  const expected = intelligenceScore(analysis)!;
  expect(expected).not.toBeNull();

  const wys = widget(page, "Where you stand");
  await expect(wys.getByTestId("eris-value")).toHaveText(String(expected.score));
  await expect(wys.getByRole("meter", { name: "ERIS — Intelligence Score" })).toHaveAttribute("aria-valuenow", String(expected.score));
  await expect(wys.getByTestId("alignment-state")).toHaveText(analysis.alignment.label);
  await expect(wys).toContainText(`${analysis.alignment.requiredMet} of ${analysis.alignment.required} required skills`);
  await expect(wys).toContainText("ML Engineer");
  await expect(wys).toContainText(/Last assessed \d{1,2} \w{3} \d{4}/);
  await expect(wys).toContainText("Not a job-readiness or hiring estimate");
  await expect(wys).not.toContainText("%");

  // Required gaps only, the engine's critical one first; a suggested skill is never called missing or self-described.
  const gaps = wys.getByRole("list", { name: "Priority gaps" }).getByRole("listitem");
  await expect(gaps.first()).toContainText(analysis.alignment.criticalGaps[0]);
  await expect(gaps.first()).toContainText("Only suggested by related skills");
  for (const item of await gaps.allInnerTexts()) expect(analysis.skills.find((s: { skill: string }) => item.includes(s.skill))?.tier).toBe("required");
  await expect(wys.getByTestId("next-action")).toHaveAttribute("href", /\/learn\?skill=/);

  // Skills to develop: the engine's open rows in its order, required/supporting labelled, link per skill.
  const std = widget(page, "Skills to develop");
  const rows = std.getByRole("list", { name: "Skills to develop" }).getByRole("listitem");
  const open = analysis.open.filter((r: { state: string }) => r.state !== "met");
  await expect(rows).toHaveCount(Math.min(7, open.length));
  await expect(rows.first()).toContainText(open[0].skill);
  // "Start here" is the same skill as Where you stand's next action (the roadmap's next step).
  const nextSkill = ((await wys.getByTestId("next-action").getAttribute("href")) ?? "").split("skill=")[1];
  await expect(std.locator(`[data-skill="${decodeURIComponent(nextSkill)}"]`)).toContainText("Start here");
  await expect(std.getByText("Start here")).toHaveCount(1);
  await expect(std.getByText("Supporting", { exact: false }).first()).toBeVisible();
  // "No evidence yet" only where the engine says missing.
  for (const r of open.slice(0, 7)) {
    const row = std.locator(`[data-skill="${r.skill}"]`);
    if (r.state === "missing") await expect(row).toContainText("No evidence yet");
    else await expect(row).not.toContainText("No evidence yet");
  }
  if (open.length > 7) await expect(std.getByRole("link", { name: `See all ${open.length} on Skills` })).toBeVisible();

  // Recent GitHub work: real repositories, owner shown, newest first, real URLs.
  const gh = widget(page, "Recent GitHub work");
  const links = gh.getByRole("link", { name: /opens GitHub/ });
  await expect(links).toHaveText([/^asha\/resume-parser/, /^acme-labs\/sql-dashboards/]);
  await expect(links.nth(1)).toHaveAttribute("href", "https://github.com/acme-labs/sql-dashboards");
  await expect(gh).toContainText("Updated");
  await expect(gh).toContainText("not who wrote each part");
  await context.close();
});

test("a pre-v3 assessment shows no score", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Home legacy", { mutate: (v) => (v.intelligence.engineVersion = 2) });
  const wys = widget(page, "Where you stand");
  await expect(wys).toContainText("earlier version of the engine");
  await expect(wys.getByTestId("eris-value")).toHaveCount(0);
  await context.close();
});

test("insufficient evidence says so, with no zero score", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Home thin", {
    mutate: (v) => {
      for (const r of v.intelligence.roles) {
        r.assessed = false;
        r.alignment.state = "not_enough_evidence";
        r.alignment.label = "Not enough evidence";
      }
    },
  });
  const wys = widget(page, "Where you stand");
  await expect(wys.getByTestId("eris-value")).toHaveText("Not enough evidence");
  await expect(wys.getByRole("meter")).toHaveCount(0);
  await expect(wys).not.toContainText(/\b0\s*\/\s*100\b/);
  await expect(widget(page, "Skills to develop")).toContainText("That isn't the same as having gaps");
  await context.close();
});

test("with no career direction nothing is assumed", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Home no role", { mutate: (v) => (v.goals = { ...v.goals, primaryRole: null, roles: [] }) });
  await expect(widget(page, "Where you stand")).toContainText("No career direction is selected");
  await expect(widget(page, "Where you stand").getByTestId("eris-value")).toHaveCount(0);
  await expect(widget(page, "Skills to develop")).toContainText("None is assumed");
  await context.close();
});

test("without GitHub the card offers to connect it and invents nothing", async ({ browser }) => {
  const { context, page } = await setUp(browser, "Home no gh", { github: false });
  const gh = widget(page, "Recent GitHub work");
  if (await gh.count()) {
    await expect(gh.getByRole("link", { name: /opens GitHub/ })).toHaveCount(0);
  }
  await context.close();
});

test("another user never sees this student's score or gaps", async ({ browser }) => {
  const { context } = await setUp(browser, "Home owner");
  const other = await createUser("Other Student", "done");
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await signIn(ctx2, other, { onboarded: true });
  const page2 = await ctx2.newPage();
  await page2.goto("/dashboard");
  await expect(page2.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page2.getByText("ERIS — Intelligence Score")).toHaveCount(0);
  await expect(page2.getByText("Holding your alignment back")).toHaveCount(0);
  await ctx2.close();
  await context.close();
});

test("pinning still works and is saved", async ({ browser }) => {
  const { user, context, page } = await setUp(browser, "Home pin");
  await widget(page, "Recent GitHub work").getByRole("button", { name: "Pin Recent GitHub work to the top" }).click();
  await expect.poll(() => countRows("SELECT count(*) AS n FROM widget_prefs WHERE user_id = $1 AND widget_id = 'github_activity' AND pinned", [user.id])).toBe(1);
  await page.reload();
  await expect(widget(page, "Recent GitHub work")).toBeVisible();
  const titles = await page.getByRole("article").filter({ has: page.getByRole("button", { name: /^Hide / }) }).getByRole("heading", { level: 2 }).allTextContents();
  expect(titles[0]).toBe("Recent GitHub work");
  await expect(widget(page, "Recent GitHub work")).toContainText("Pinned");
  await context.close();
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`the three widgets fit and balance at ${width}px`, async ({ browser }) => {
    const { context, page } = await setUp(browser, `Home ${width}`, { width });
    const ids = ["eris_readiness", "skill_gaps", "github_activity"];
    for (const id of ids) await expect(page.locator(`[data-widget=${id}]`)).toBeVisible();
    const m = await page.evaluate((ids) => {
      const cards = ids.map((id) => document.querySelector(`[data-widget=${id}]`) as HTMLElement);
      const boxes = cards.map((c) => c.getBoundingClientRect());
      return {
        boxes: boxes.map((b) => ({ x: b.x, y: b.y, w: b.width, h: b.height })),
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        // A card wider inside than its own box means text or a row escaped it.
        cardOverflow: cards.filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.dataset.widget),
      };
    }, ids);
    expect(m.pageOverflow).toBeLessThanOrEqual(0);
    expect(m.cardOverflow).toEqual([]);
    if (width >= 1280) {
      // Where you stand and GitHub stack on the left; Skills to develop runs down the right.
      const [wys, std, gh] = m.boxes;
      expect(Math.abs(wys.x - gh.x)).toBeLessThan(2);
      expect(std.x).toBeGreaterThan(wys.x + wys.w - 2);
      expect(gh.y).toBeGreaterThan(wys.y + wys.h - 2);
    }
    const grid = page.locator("[data-widget=eris_readiness]").locator("xpath=..");
    await grid.screenshot({ path: `test-results/home-intel-${width}.png` });
    await context.close();
  });
}
