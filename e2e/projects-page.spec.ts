// Projects & Engineering Repositories: layout at common widths and honest
// handling of sparse repository data (no description, no languages, long names).
import { expect, test } from "@playwright/test";

import { createUser, signIn, sql } from "./support/fixtures";

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

const LONG = "asha/an-extremely-long-repository-name-that-should-truncate-gracefully-inside-the-card";

async function seedRepos(userId: string) {
  type Row = { name: string; desc: string | null; langs: Record<string, number>; topics: string[]; stars: number; forks: number };
  const rows: Row[] = [
    { name: "asha/rag-eval", desc: "Evaluation harness for retrieval-augmented generation.", langs: { Python: 9000, Shell: 300 }, topics: ["llm", "rag"], stars: 4, forks: 1 },
    { name: "asha/portfolio", desc: null, langs: { CSS: 4000, JavaScript: 3000 }, topics: [], stars: 0, forks: 0 },
    { name: "asha/empty", desc: null, langs: {}, topics: [], stars: 0, forks: 0 },
    { name: LONG, desc: "x ".repeat(200), langs: { Python: 1, Go: 1, Rust: 1, TypeScript: 1, C: 1, Java: 1 }, topics: [], stars: 0, forks: 0 },
  ];
  for (let i = 0; i < 26; i++) rows.push({ name: `asha/repo-${i}`, desc: null, langs: { Python: 1 }, topics: [], stars: 0, forks: 0 });
  for (const r of rows) {
    await sql.query(
      `INSERT INTO code_repositories (user_id, source, repo_name, description, url, languages, topics, stars, forks, last_commit_at)
       VALUES ($1, 'github', $2, $3, $4, $5, $6, $7, $8, now())`,
      [userId, r.name, r.desc, `https://github.com/${r.name}`, JSON.stringify(r.langs), r.topics, r.stars, r.forks],
    );
  }
}

test("projects page: empty state", async ({ page, context }) => {
  const user = await createUser("Empty Projects", "done");
  await signIn(context, user, { onboarded: true });
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "No repositories synced yet" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Connect GitHub" })).toBeVisible();
});

test("projects page: factual cards, no score claims, no overflow", async ({ page, context }) => {
  const user = await createUser("Projects Layout", "done");
  await seedRepos(user.id);
  await signIn(context, user, { onboarded: true });

  for (const vp of VIEWPORTS) {
    await page.setViewportSize(vp);
    await page.goto("/projects");
    await expect(page.getByRole("heading", { level: 1, name: "Projects & Engineering Repositories" })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth,
    );
    expect(overflow, `horizontal overflow at ${vp.width}px`).toBe(false);

    await page.screenshot({ path: `test-results/projects-${vp.width}.png`, fullPage: false });
  }

  const body = page.locator("main");
  await expect(body).not.toContainText(/Impact|rationale|engineering impact/i);
  await expect(page.getByText("30 repositories synced from GitHub.")).toBeVisible();
  await expect(page.getByText("No description provided.").first()).toBeVisible();
  await expect(page.getByText("+2 more")).toBeVisible();
  await expect(page.getByRole("link", { name: /View on GitHub/ })).toHaveCount(30);
  await expect(page.getByRole("link", { name: /View on GitHub/ }).first()).toHaveAttribute("target", "_blank");

  // Long names stay on one line inside the card.
  const longTitle = page.locator(`h2[title="${LONG}"]`);
  const box = await longTitle.boundingBox();
  expect(box!.height).toBeLessThan(30);
});
