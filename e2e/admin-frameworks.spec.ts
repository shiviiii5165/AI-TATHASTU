/**
 * Career framework governance (Admin → Student Intelligence → Career Frameworks): an operator sees every role profile by
 * domain with its sources and checks, records a review, and a student can't open the page.
 */
import { expect, test } from "@playwright/test";

import { createUser, signIn, sql } from "./support/fixtures";

test("career frameworks: role profiles, sources, open questions and an immutable review", async ({ browser }) => {
  const student = await createUser("Framework Student", "done");
  const sc = await browser.newContext();
  await signIn(sc, student, { onboarded: true });
  const res = await (await sc.newPage()).goto("/admin/intelligence/frameworks");
  expect(res?.status()).toBe(404);
  await sc.close();

  await sql.query("DELETE FROM users WHERE email = 'admin@e2e.test'");
  const admin = await createUser("Ops Admin", "done", "admin@e2e.test");
  const context = await browser.newContext();
  await signIn(context, admin, { onboarded: true });
  const page = await context.newPage();

  await page.goto("/admin/intelligence/frameworks");
  await expect(page.getByRole("link", { name: "Career Frameworks" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText(/Career framework 2026\.11-draft\.4/)).toBeVisible();
  const roles = page.locator("table").first().locator("tbody tr");
  await expect(roles).toHaveCount(20);
  await expect(page.getByText("Should Robot Kinematics (forward/inverse kinematics, dynamics) be a required competency?")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("frameworks-index.png"), fullPage: true });

  await page.getByRole("link", { name: "Robotics Engineer" }).click();
  await expect(page.getByRole("heading", { name: "Decision-making and control" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Motion Planning" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nav2 documentation" })).toBeVisible();
  await expect(page.getByText(/Read 2026-11-20: .*localization/)).toBeVisible();

  await page.getByLabel("What you checked (kept as the record)").fill("Checked Nav2 and O*NET pages for planning and localisation.");
  await page.getByRole("button", { name: "Record review" }).click();
  await expect(page.getByText("Review recorded.")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Review status: Approved by admin@e2e\.test/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("frameworks-robotics.png"), fullPage: true });

  const { rows } = await sql.query("SELECT decision, role FROM framework_reviews WHERE reviewer_email = 'admin@e2e.test' ORDER BY created_at DESC LIMIT 1");
  expect(rows[0]).toMatchObject({ decision: "approved", role: "robotics_ai_engineer" });
  await expect(sql.query("UPDATE framework_reviews SET note = 'x'")).rejects.toThrow(/immutable/);
  await context.close();
});
