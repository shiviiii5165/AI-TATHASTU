/**
 * Student Intelligence (/admin/intelligence): access control, every page renders from seeded evidence, and a ranking
 * built in the builder can be saved, published, snapshotted and opened. The existing Student Directory still works.
 * Set INTEL_SHOTS to a folder to save full-page screenshots.
 */
import { expect, type Page, test } from "@playwright/test";

import { createUser, seedComputedProfile, signIn, sql } from "./support/fixtures";

const shots = process.env.INTEL_SHOTS;
const shot = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};
const noCrash = async (page: Page) => {
  await expect(page.getByText(/Application error|Internal Server Error|This page could not be found/)).toHaveCount(0);
};

test("student intelligence: access, pages, and a ranking from builder to snapshot", async ({ browser }) => {
  test.setTimeout(300_000);
  const s1 = await createUser("Ananya Iyer", "done");
  const s2 = await createUser("Rohan Mehta", "done");
  const s3 = await createUser("Zoya Khan", "done");
  await seedComputedProfile(s1.id);
  await seedComputedProfile(s2.id);
  // Different, real-shaped evidence so the ranks differ.
  await sql.query("INSERT INTO unified_projects (user_id, canonical_title, status) VALUES ($1, 'Retrieval eval harness', 'matched'), ($1, 'Lab robot', 'standalone')", [s1.id]);
  await sql.query("INSERT INTO learning_records (user_id, kind, title, source, status, verification) VALUES ($1, 'certification', 'Cloud Practitioner', 'user', 'completed', 'verified')", [s2.id]);
  await sql.query("INSERT INTO profile_facts (user_id, field_group, field_name, record_key, origin, extracted_value) VALUES ($1, 'education', 'grade', 'ed1', 'resume', '\"CGPA 8.7/10\"')", [s3.id]);

  await test.step("a student gets a 404", async () => {
    const ctx = await browser.newContext();
    await signIn(ctx, s1, { onboarded: true });
    const page = await ctx.newPage();
    expect((await page.goto("/admin/intelligence"))?.status()).toBe(404);
    await ctx.close();
  });

  await sql.query("DELETE FROM users WHERE email = 'admin@e2e.test'");
  const admin = await createUser("Ops Admin", "done", "admin@e2e.test");
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await signIn(context, admin, { onboarded: true });
  const page = await context.newPage();

  await test.step("existing Student Directory is unchanged and still works", async () => {
    await page.goto("/admin/students");
    await expect(page.getByRole("heading", { name: "Student & Account Directory" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ananya Iyer/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Student Intelligence" }).first()).toBeVisible();
    await shot(page, "00-student-directory");
  });

  await test.step("overview", async () => {
    await page.goto("/admin/intelligence");
    await expect(page.getByRole("heading", { name: "Student Intelligence" })).toBeVisible();
    await expect(page.getByText("Evidence coverage by benchmark")).toBeVisible();
    await noCrash(page);
    await shot(page, "01-overview");
  });

  await test.step("auto ranking leaderboard", async () => {
    await page.goto("/admin/intelligence/rankings");
    await expect(page.getByRole("heading", { name: "Auto · all available evidence" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ananya Iyer" }).first()).toBeVisible();
    await noCrash(page);
    await shot(page, "02-rankings-auto");
  });

  await test.step("build, save and publish a ranking", async () => {
    await page.goto("/admin/intelligence/builder");
    await page.getByPlaceholder(/Ranking name/).fill("Placement readiness (e2e)");
    await page.getByRole("button", { name: /^Skills/ }).click();
    await page.getByRole("button", { name: /^Projects/ }).click();
    await page.getByRole("button", { name: "Even split" }).click();
    await expect(page.getByText("Ready to publish.")).toBeVisible();
    await page.getByRole("radio", { name: /All evidence/ }).check();
    await page.getByRole("slider", { name: /Minimum evidence coverage/ }).fill("0");
    await page.getByRole("button", { name: "Preview on live evidence" }).click();
    await expect(page.getByText(/students ranked\./)).toBeVisible();
    await shot(page, "03-builder");
    await page.getByRole("button", { name: "Save & publish" }).click();
    await expect(page).toHaveURL(/\/admin\/intelligence\/rankings\?r=/);
    await expect(page.getByText("Published version 1").first()).toBeVisible();
    await page.getByRole("button", { name: "Save snapshot" }).click();
    await expect(page.getByText(/Snapshot saved/)).toBeVisible();
    await shot(page, "04-rankings-published");
  });

  await test.step("student 360 from the leaderboard, and back keeps the ranking", async () => {
    const rankingUrl = page.url();
    await page.getByRole("link", { name: "Ananya Iyer" }).first().click();
    await expect(page.getByRole("heading", { name: "Ananya Iyer" })).toBeVisible();
    await expect(page.getByText("Skill inventory")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ecosystem sources" })).toBeVisible();
    await noCrash(page);
    await shot(page, "05-student-360");
    await page.getByRole("link", { name: "Back to rankings" }).click();
    await expect(page).toHaveURL(rankingUrl);
  });

  await test.step("compare, benchmarks, ecosystem", async () => {
    await page.goto(`/admin/intelligence/compare?ids=${s1.id},${s2.id},${s3.id}`);
    await expect(page.getByText("Category scores")).toBeVisible();
    await noCrash(page);
    await shot(page, "06-compare");
    await page.goto("/admin/intelligence/benchmarks");
    await expect(page.getByText(/benchmarks/).first()).toBeVisible();
    await noCrash(page);
    await shot(page, "07-benchmarks");
    await page.goto("/admin/intelligence/integrations");
    await expect(page.getByText("MentorMaze")).toBeVisible();
    await noCrash(page);
    await shot(page, "08-ecosystem");
  });

  await test.step("CSV export", async () => {
    const res = await page.request.get("/admin/intelligence/rankings/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/csv");
    expect(await res.text()).toContain("Ananya Iyer");
  });

  await test.step("dark mode", async () => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.goto("/admin/intelligence");
    await page.evaluate(() => { document.documentElement.classList.add("dark"); document.documentElement.setAttribute("data-theme", "dark"); });
    await shot(page, "09-overview-dark");
    await page.goto(`/admin/intelligence/students/${s1.id}`);
    await page.evaluate(() => { document.documentElement.classList.add("dark"); document.documentElement.setAttribute("data-theme", "dark"); });
    await shot(page, "10-student-360-dark");
  });

  const audits = await sql.query("SELECT action FROM admin_audit_logs WHERE action LIKE 'intelligence.%'");
  const actions = audits.rows.map((r) => r.action);
  for (const a of ["intelligence.ranking_create", "intelligence.ranking_publish", "intelligence.ranking_snapshot", "intelligence.student_view", "intelligence.ranking_export"]) expect(actions).toContain(a);
  await context.close();
});
