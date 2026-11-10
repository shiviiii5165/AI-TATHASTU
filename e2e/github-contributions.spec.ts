// GitHub contribution calendar on the dashboard: rendered from the stored snapshot only,
// unavailable data is not shown as zero, and one user never sees another user's calendar.
import { expect, test, type Page } from "@playwright/test";

import { createUser, seedComputedProfile, signIn, sql } from "./support/fixtures";

const DAY = 86_400_000;

/** Test data in the shape the worker stores (worker/connectors/github_contributions.py). */
function calendar(counts: (i: number) => number) {
  const end = Date.UTC(2026, 10, 10);
  return Array.from({ length: 365 }, (_, i) => {
    const count = counts(i);
    return {
      date: new Date(end - (364 - i) * DAY).toISOString().slice(0, 10),
      count,
      level: count === 0 ? 0 : Math.min(4, 1 + Math.floor(count / 3)),
    };
  });
}

async function seedUser(name: string) {
  const user = await createUser(name, "done");
  await seedComputedProfile(user.id);
  await sql.query(
    `INSERT INTO code_repositories (user_id, source, repo_name, url, languages, stars, forks, last_commit_at)
     VALUES ($1, 'github', $2, $3, '{"Python": 100}', 2, 1, now())`,
    [user.id, `${name.toLowerCase().replace(/\s+/g, "")}/repo`, "https://github.com/x/repo"],
  );
  return user;
}

async function githubCard(page: Page) {
  const card = page.getByTestId("github-activity-card");
  await expect(card).toBeVisible();
  return card;
}

test("calendar shows GitHub's totals, days, legend and sync time; a later failure keeps the snapshot", async ({ page, context }) => {
  const user = await seedUser("Calendar User");
  const days = calendar((i) => (i % 7 === 3 ? 0 : i % 5));
  const total = days.reduce((s, d) => s + d.count, 0);
  await sql.query(
    `INSERT INTO github_contributions
       (user_id, range_start, range_end, total_contributions, days, category_totals, repositories,
        has_restricted_contributions, github_login, synced_at, last_attempt_at, last_error, last_error_at)
     VALUES ($1, now() - interval '1 year', now(), $2, $3, $4, '[]', true, 'calendaruser',
             '2026-11-10T08:00:00Z', now(), 'GitHub rate limit reached', now())`,
    [
      user.id, total, JSON.stringify(days),
      JSON.stringify({ commits: total - 30, pullRequests: 20, issues: 6, reviews: 4, repositories: 3, restricted: 12 }),
    ],
  );
  await signIn(context, user, { onboarded: true });

  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(vp);
    await page.goto("/dashboard");
    const card = await githubCard(page);
    const cal = card.getByTestId("contribution-calendar");
    await expect(cal).toContainText(`${total.toLocaleString("en")} contributions in the last year`);
    await expect(cal.locator("[data-level]")).toHaveCount(365);
    await expect(cal.locator('[data-level="0"]').first()).toBeVisible();
    await expect(cal).toContainText("Mon");
    await expect(cal).toContainText("Less");
    await expect(cal).toContainText("Synced 10 Nov 2026");
    await expect(cal).toContainText(`${(total - 30).toLocaleString("en")} commits · 20 pull requests · 6 issues · 4 reviews`);
    await expect(cal).toContainText("Includes 12 private contributions");
    await expect(cal).toContainText("The last refresh failed (GitHub rate limit reached)");
    // Repository stats stay below the calendar.
    await expect(card).toContainText("Repositories");
    await expect(card).toContainText("Forks");
    await expect(card).not.toContainText("month of last push");

    // Opens on the newest weeks; no month label is cut by the pinned weekday labels, there or after scrolling back.
    const scroller = cal.getByLabel("Contribution calendar, scroll for earlier weeks");
    const clipped = () =>
      scroller.evaluate((el) => {
        const pinned = el.querySelector(".sticky")!.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        // The month row: absolutely positioned labels above the weeks (independent of any test attribute).
        const labels = [...el.querySelectorAll<HTMLElement>("span")].filter((s) => getComputedStyle(s).position === "absolute");
        if (labels.length === 0) return ["<no month labels found>"];
        return labels
          .filter((l) => getComputedStyle(l).visibility !== "hidden")
          .map((l) => ({ label: l.textContent, r: l.getBoundingClientRect() }))
          .filter(({ r }) => r.right > box.left && r.left < box.right) // on screen
          .filter(({ r }) => r.left < pinned.right - 0.5 || r.right > box.right + 0.5)
          .map(({ label }) => label);
      });
    if (await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)) {
      expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    }
    await expect.poll(clipped).toEqual([]);
    await expect(cal.getByText("Mon")).toBeVisible();
    await scroller.evaluate((el) => el.scrollTo({ left: 0 }));
    await expect.poll(clipped).toEqual([]);
    await scroller.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
    );
    expect(overflow, `page-level horizontal overflow at ${vp.width}px`).toBe(false);
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: `test-results/github-calendar-${vp.width}.png` });
  }
});

test("a sync that never succeeded is unavailable, not zero; no calendar is shown for another user", async ({ browser }) => {
  const failed = await seedUser("Failed Calendar");
  await sql.query(
    "INSERT INTO github_contributions (user_id, last_attempt_at, last_error, last_error_at) VALUES ($1, now(), 'Could not reach GitHub', now())",
    [failed.id],
  );
  const fresh = await seedUser("Fresh Calendar");
  const other = await seedUser("Other Calendar");
  await sql.query(
    `INSERT INTO github_contributions (user_id, total_contributions, days, category_totals, synced_at)
     VALUES ($1, 999, $2, '{"commits":999,"pullRequests":0,"issues":0,"reviews":0,"repositories":1,"restricted":0}', now())`,
    [other.id, JSON.stringify(calendar(() => 3))],
  );

  for (const [user, heading, detail] of [
    [failed, "Contribution calendar unavailable", "Could not reach GitHub"],
    [fresh, "No contribution calendar yet", "after your next GitHub sync"],
  ] as const) {
    const context = await browser.newContext();
    await signIn(context, user, { onboarded: true });
    const page = await context.newPage();
    await page.goto("/dashboard");
    const card = await githubCard(page);
    await expect(card.getByTestId("contribution-unavailable")).toContainText(heading);
    await expect(card.getByTestId("contribution-unavailable")).toContainText(detail);
    await expect(card.getByTestId("contribution-calendar")).toHaveCount(0);
    await expect(card).not.toContainText("999");
    await expect(card).not.toContainText("0 contributions in the last year");
    if (user === failed) await card.screenshot({ path: "test-results/github-calendar-unavailable.png" });
    await context.close();
  }
});
