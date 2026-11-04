/**
 * /settings/privacy: an onboarded student changes a consent after onboarding;
 * each change appends a row, and faculty don't see the discovery switch.
 */
import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

import { E2E_PORTS } from "./support/env";
import { createUser, signIn, sql } from "./support/fixtures";

const latest = async (userId: string, purpose: string) =>
  (
    await sql.query("SELECT granted FROM consents WHERE user_id = $1 AND purpose = $2 ORDER BY created_at DESC LIMIT 1", [userId, purpose])
  ).rows[0]?.granted;

test("privacy settings: toggles save as consent rows", async ({ browser }) => {
  const student = await createUser("Tara", "done");
  const context = await browser.newContext();
  await signIn(context, student, { onboarded: true });
  const page = await context.newPage();

  await page.goto("/settings/privacy");
  await expect(page.getByRole("heading", { name: "Your permissions" })).toBeVisible();
  const discovery = page.getByRole("switch", { name: "Let mentors and alumni find me" });
  await expect(discovery).not.toBeChecked();

  await discovery.click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect.poll(() => latest(student.id, "mentor_discovery")).toBe(true);

  await discovery.click();
  await expect.poll(() => latest(student.id, "mentor_discovery")).toBe(false);

  await page.reload();
  await expect(page.getByRole("switch", { name: "Let mentors and alumni find me" })).not.toBeChecked();
  await context.close();

  const faculty = await createUser("Dr Iyer", "done");
  await sql.query("UPDATE users SET role = 'faculty' WHERE id = $1", [faculty.id]);
  const facultyContext = await browser.newContext();
  await signIn(facultyContext, faculty, { onboarded: true });
  const facultyPage = await facultyContext.newPage();
  await facultyPage.goto("/settings/privacy");
  await expect(facultyPage.getByRole("switch", { name: "Use AI services to read my resume" })).toBeVisible();
  await expect(facultyPage.getByRole("switch", { name: "Let mentors and alumni find me" })).toHaveCount(0);
  await facultyContext.close();
});

test("privacy settings: a user permanently deletes their own account", async ({ browser }) => {
  const user = await createUser("Dev", "done");
  await sql.query(
    "INSERT INTO files (user_id, kind, storage_key, sha256, size_bytes, mime) VALUES ($1, 'resume', $2, 'abc', 1, 'text/plain')",
    [user.id, `resumes/${user.id}/abc.txt`],
  );
  await sql.query("INSERT INTO email_deliveries (recipient, subject, html_body, text_body) VALUES ($1, 's', 'h', 't')", [user.email]);
  const count = async (query: string, value: string) => Number((await sql.query(`SELECT count(*) AS n FROM ${query}`, [value])).rows[0].n);

  const context = await browser.newContext();
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  await page.goto("/settings/privacy");

  const confirm = page.getByLabel(`Type ${user.email} to confirm`);
  const button = page.getByRole("button", { name: "Permanently delete my account" });
  await confirm.fill("someone@else.test");
  await expect(button).toBeDisabled();
  expect(await count("users WHERE id = $1", user.id)).toBe(1);

  // An upload that was never registered in `files`: only listing the user's prefix can find it.
  const orphan = `http://127.0.0.1:${E2E_PORTS.r2}/resumes/resumes/${user.id}/orphan.txt`;
  const sha256 = createHash("sha256").update("x").digest("base64");
  await fetch(orphan, { method: "PUT", body: "x", headers: { "Content-Type": "text/plain", "x-amz-checksum-sha256": sha256 } });
  expect((await fetch(orphan, { method: "HEAD" })).status).toBe(200);

  await confirm.fill(user.email);
  await button.click();
  await expect.poll(() => count("users WHERE id = $1", user.id)).toBe(0);
  expect((await fetch(orphan, { method: "HEAD" })).status).toBe(404);
  expect(await count("files WHERE user_id = $1", user.id)).toBe(0);
  expect(await count("email_deliveries WHERE recipient = $1", user.email)).toBe(0);
  await expect(page).toHaveURL(/\/$/);

  // The old session can't get back in.
  await page.goto("/settings/privacy");
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});
