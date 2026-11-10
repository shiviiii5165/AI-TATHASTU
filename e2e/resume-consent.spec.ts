/**
 * Resume step consent: plain-language disclosure (including the outside AI services that really receive
 * resume content), accept and decline both persist, and the same permission can be withdrawn in Privacy settings.
 */
import { expect, test } from "@playwright/test";

import { createUser, signIn, sql } from "./support/fixtures";

const latest = async (userId: string) =>
  (await sql.query<{ granted: boolean; policy_version: string }>("SELECT granted, policy_version FROM consents WHERE user_id = $1 AND purpose = 'external_ai' ORDER BY created_at DESC LIMIT 1", [userId])).rows[0];

test("consent explains what happens in plain language, and accepting or declining is saved", async ({ browser }) => {
  const user = await createUser("Consent", "resume");
  const context = await browser.newContext();
  await signIn(context, user);
  const page = await context.newPage();
  await page.goto("/onboarding/resume");

  const box = page.getByRole("checkbox", { name: "Allow AI-assisted reading of my resume" });
  await expect(box).not.toBeChecked();
  await expect(page.getByText("You check everything before it's saved.")).toBeVisible();

  const details = page.locator("#ai-consent-details");
  await expect(details).toBeHidden();
  await page.getByRole("button", { name: "Read more" }).click();
  for (const heading of ["What we extract", "Why we need it", "Who processes your resume", "What else this covers", "What is saved", "If you don't allow it", "Changing your mind"]) {
    await expect(details.getByText(heading, { exact: true })).toBeVisible();
  }
  // Material disclosure stays: the outside services are named.
  await expect(details).toContainText("Groq, Google Gemini or OpenRouter");
  // Implementation language is gone.
  for (const jargon of ["parser", "rule-based", "pipeline", "extraction job"]) await expect(details).not.toContainText(jargon);
  await expect(details.getByRole("link", { name: /Privacy settings/ })).toHaveAttribute("href", "/settings/privacy");

  await box.click();
  await expect(box).toBeChecked();
  await expect.poll(async () => (await latest(user.id))?.granted).toBe(true);
  expect((await latest(user.id)).policy_version).toBe("2026-11-10");

  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Allow AI-assisted reading of my resume" })).toBeChecked();

  await page.getByRole("checkbox", { name: "Allow AI-assisted reading of my resume" }).click();
  await expect(page.getByText("Your resume won't be sent to outside AI services.")).toBeVisible();
  await expect.poll(async () => (await latest(user.id))?.granted).toBe(false);
  await context.close();
});

const rowsOf = async (userId: string) =>
  (await sql.query("SELECT id, purpose, granted, policy_version, created_at FROM consents WHERE user_id = $1 ORDER BY created_at, id", [userId])).rows;

async function earlierConsentUser(browser: import("@playwright/test").Browser, name: string) {
  const user = await createUser(name, "done");
  await sql.query(
    `INSERT INTO consents (user_id, purpose, granted, policy_version, created_at) VALUES
       ($1, 'external_ai', true, '2026-10-29', now() - interval '10 days'),
       ($1, 'analytics', false, '2026-10-29', now() - interval '10 days')`,
    [user.id],
  );
  const context = await browser.newContext();
  await signIn(context, user, { onboarded: true });
  return { user, context, page: await context.newPage() };
}

test("an earlier, resume-only grant is asked about once, without blocking, and its history is kept", async ({ browser }) => {
  const { user, context, page } = await earlierConsentUser(browser, "Earlier consent");
  const before = await rowsOf(user.id);

  // Not a gate: the dashboard opens; the request names every newly disclosed purpose.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);
  const notice = page.getByTestId("consent-scope-notice");
  await expect(notice).toBeVisible();
  for (const purpose of ["portfolio", "GitHub repositories", "match you with people", "Groq, Google Gemini or OpenRouter"]) await expect(notice).toContainText(purpose);
  expect(await rowsOf(user.id)).toEqual(before); // looking at it records nothing

  // Saving an unrelated setting doesn't quietly extend the old grant.
  await page.goto("/settings/privacy");
  await page.getByRole("switch", { name: "Share usage analytics" }).click();
  await expect.poll(async () => (await rowsOf(user.id)).length).toBeGreaterThan(before.length);
  expect(await latest(user.id)).toEqual({ granted: true, policy_version: "2026-10-29" });
  await page.goto("/dashboard");
  await expect(page.getByTestId("consent-scope-notice")).toBeVisible();

  // One explicit answer: recorded under the current version, and the request never returns.
  await page.getByRole("button", { name: "Allow all of these" }).click();
  await expect(page.getByTestId("consent-scope-notice")).toBeHidden();
  expect(await latest(user.id)).toEqual({ granted: true, policy_version: "2026-11-10" });
  const answered = await rowsOf(user.id);
  for (const visit of [1, 2, 3]) {
    await page.goto(visit === 2 ? "/onboarding/resume" : "/dashboard");
    await expect(page.getByTestId("consent-scope-notice")).toHaveCount(0);
  }
  expect(await rowsOf(user.id)).toEqual(answered);
  for (const row of before) expect(answered).toContainEqual(row); // full history kept
  await context.close();
});

test("declining the updated scope turns AI processing off, once, and isn't asked again", async ({ browser }) => {
  const { user, context, page } = await earlierConsentUser(browser, "Earlier decline");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Turn off AI processing" }).click();
  await expect(page.getByTestId("consent-scope-notice")).toBeHidden();
  expect(await latest(user.id)).toMatchObject({ granted: false });
  await page.reload();
  await expect(page.getByTestId("consent-scope-notice")).toHaveCount(0);
  await page.goto("/settings/privacy");
  await expect(page.getByRole("switch", { name: "Use AI services to read my resume" })).not.toBeChecked();
  await context.close();
});

test("consent given once at the resume step is reused: no prompts and no new records on later visits", async ({ browser }) => {
  const user = await createUser("Once", "resume");
  const context = await browser.newContext();
  await signIn(context, user);
  const page = await context.newPage();
  await page.goto("/onboarding/resume");
  await page.getByRole("checkbox", { name: "Allow AI-assisted reading of my resume" }).click();
  await expect.poll(async () => (await latest(user.id))?.policy_version).toBe("2026-11-10");
  const once = await rowsOf(user.id);
  expect(once).toHaveLength(1);

  await sql.query("UPDATE onboarding_state SET current_step = 'done' WHERE user_id = $1", [user.id]);
  for (const path of ["/onboarding/resume", "/dashboard", "/settings/privacy", "/dashboard"]) {
    await page.goto(path);
    await expect(page.getByTestId("consent-scope-notice")).toHaveCount(0);
  }
  expect(await rowsOf(user.id)).toEqual(once);
  await context.close();
});

test("permission granted at the resume step can be withdrawn in Privacy settings", async ({ browser }) => {
  const user = await createUser("Withdraw", "done");
  await sql.query("INSERT INTO consents (user_id, purpose, granted, policy_version) VALUES ($1, 'external_ai', true, '2026-11-10')", [user.id]);
  const context = await browser.newContext();
  await signIn(context, user, { onboarded: true });
  const page = await context.newPage();
  await page.goto("/settings/privacy");
  const toggle = page.getByRole("switch", { name: "Use AI services to read my resume" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect.poll(async () => (await latest(user.id))?.granted).toBe(false);
  await context.close();
});
