/**
 * AVSAR → Collaborations, end to end in the production build on the throwaway stack:
 * visitor discovery → owner publishes with the wizard → another student applies → owner accepts → team chat,
 * then admin moderation, mobile layout, keyboard tabs, and the other AVSAR categories still working.
 */
import { expect, test, type Browser } from "@playwright/test";

import { createUser, signIn, sql, type TestUser } from "./support/fixtures";

const stamp = Date.now().toString(36);
const TITLE = `Campus air quality sensors ${stamp}`;

async function as(browser: Browser, user: TestUser, viewport?: { width: number; height: number }) {
  const context = await browser.newContext(viewport ? { viewport } : {});
  await signIn(context, user, { onboarded: true });
  return { context, page: await context.newPage() };
}

test("collaboration marketplace: publish, discover, apply, accept, chat, moderate", async ({ browser }) => {
  const owner = await createUser(`Owner ${stamp}`, "done");
  const applicant = await createUser(`Applicant ${stamp}`, "done");

  await test.step("owner publishes through the five-step wizard inside AVSAR", async () => {
    const { context, page } = await as(browser, owner);
    await page.goto("/opportunities?cat=collaborations");
    await expect(page.getByRole("link", { name: "Collaborations" })).toHaveAttribute("aria-current", "page");
    const hub = page.getByTestId("collaborate-hub");
    await expect(hub.getByRole("heading", { name: "Build it together." })).toBeVisible();
    await hub.getByRole("button", { name: "Start a collaboration" }).click();

    const sheet = page.getByRole("dialog");
    await sheet.getByText("Project", { exact: true }).click();
    await sheet.getByRole("button", { name: "Continue" }).click();
    // Validation keeps the user on the step and says what's missing.
    await sheet.getByRole("button", { name: "Continue" }).click();
    await expect(sheet.getByText("Give the title at least 6 characters.")).toBeVisible();
    await sheet.getByLabel("Collaboration title *").fill(TITLE);
    await sheet.getByLabel(/Short description/).fill("Low-cost sensors that map air quality across the hostel blocks.");
    await sheet.getByRole("button", { name: "Continue" }).click();
    await sheet.getByLabel("Role title").fill("Embedded developer");
    await sheet.getByLabel("Positions").fill("1");
    await sheet.getByLabel("Skills").first().fill("arduino, c");
    await sheet.getByRole("button", { name: "Continue" }).click();
    await sheet.getByRole("button", { name: "Continue" }).click();
    await expect(sheet.getByText("Visible to everyone, including people who aren't signed in.")).toBeVisible();
    await sheet.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Saved and live. People can find it in Discover.")).toBeVisible();
    await context.close();
  });

  const [{ id: postId }] = (await sql.query("SELECT id FROM collab_posts WHERE title = $1", [TITLE])).rows as { id: string }[];

  await test.step("a visitor finds it without signing in, with no private details", async () => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/collaborations");
    await page.getByRole("searchbox", { name: "Search collaborations" }).fill(stamp);
    const card = page.getByRole("list", { name: "Collaborations" }).getByRole("listitem").filter({ hasText: TITLE });
    await expect(card).toBeVisible();
    await expect(card.getByText("Student-led")).toBeVisible();
    await card.getByRole("button", { name: TITLE }).click();
    await expect(page.getByRole("link", { name: "Sign in to apply" })).toBeVisible();
    await expect(page.getByText(owner.email)).toHaveCount(0);
    const api = await page.request.get(`/api/collaborations/${postId}`);
    expect(api.status()).toBe(200);
    const body = await api.text();
    expect(body).not.toContain(owner.email);
    expect(body).not.toContain(owner.id);
    // Writes need an account.
    const denied = await page.request.post(`/api/collaborations/${postId}/apply`, { data: { intro: "x", motivation: "y" }, headers: { "sec-fetch-site": "same-origin" } });
    expect(denied.status()).toBe(401);
    await context.close();
  });

  await test.step("another student requests to join", async () => {
    const { context, page } = await as(browser, applicant);
    await page.goto(`/opportunities?cat=collaborations&post=${postId}`);
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("heading", { name: TITLE })).toBeVisible();
    await sheet.getByRole("button", { name: "Request to join" }).click();
    await sheet.getByRole("button", { name: "Send request" }).click();
    await expect(sheet.getByText("Introduction is required.")).toBeVisible(); // server validation, field kept
    await sheet.getByLabel("Short introduction *").fill("Second-year ECE, built two Arduino weather stations.");
    await sheet.getByLabel("Why this collaboration? *").fill("I want our hostel to have cleaner air data.");
    await sheet.getByRole("button", { name: "Send request" }).click();
    await expect(sheet.getByText("Request sent.", { exact: false })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Withdraw request" })).toBeVisible();
    await context.close();
  });

  await test.step("owner accepts in Requests; the team chat opens for both", async () => {
    const { context, page } = await as(browser, owner);
    await page.goto("/opportunities?cat=collaborations&view=requests");
    const req = page.getByRole("list", { name: "Pending requests" }).getByRole("listitem").filter({ hasText: applicant.name });
    await expect(req).toBeVisible();
    await expect(req.getByText(applicant.email)).toHaveCount(0);
    await req.getByRole("button", { name: "Accept" }).click();
    await expect(page.getByText(`${applicant.name} joined the team.`)).toBeVisible();

    await page.getByRole("tab", { name: /Inbox/ }).click();
    await page.getByRole("button", { name: new RegExp(TITLE) }).click();
    await page.getByRole("textbox", { name: "Message" }).fill("Welcome aboard! Kick-off on Saturday?");
    await page.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByText("Welcome aboard! Kick-off on Saturday?", { exact: true })).toBeVisible();
    await context.close();

    const a = await as(browser, applicant);
    await a.page.goto("/opportunities?cat=collaborations&view=inbox");
    await a.page.getByRole("button", { name: new RegExp(TITLE) }).click();
    await expect(a.page.getByText("Welcome aboard! Kick-off on Saturday?", { exact: true })).toBeVisible();
    await a.context.close();
  });

  await test.step("admin suspends it with a reason; it disappears for the public", async () => {
    await sql.query("DELETE FROM users WHERE email = 'admin@e2e.test'");
    const admin = await createUser("Ops Admin", "done", "admin@e2e.test");
    const { context, page } = await as(browser, admin);
    await page.goto(`/admin/collaborations/${postId}`);
    await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
    await page.getByRole("button", { name: "Suspend" }).click(); // required reason blocks an empty submit
    await expect(page.getByText("Suspended.")).toHaveCount(0);
    await page.getByLabel("Reason (kept in history)").first().fill("E2E moderation check");
    await page.getByRole("button", { name: "Suspend" }).click();
    await expect(page.getByText("Suspended.")).toBeVisible();
    await expect(page.getByText(/suspend by Ops Admin|suspend by admin@e2e.test/)).toBeVisible();
    await context.close();

    const anon = await browser.newContext();
    expect((await anon.request.get(`/api/collaborations/${postId}`)).status()).toBe(404);
    await anon.close();
  });
});

test("collaborate hub works on a phone and by keyboard, and other AVSAR tabs still work", async ({ browser }) => {
  const user = await createUser(`Mobile ${stamp}`, "done");
  const { context, page } = await as(browser, user, { width: 390, height: 844 });
  await page.goto("/opportunities?cat=collaborations");
  const hub = page.getByTestId("collaborate-hub");
  await expect(hub).toBeVisible();
  // Nothing in the Collaborate hub extends past the viewport (scrolling rows clip their own content).
  // (The AVSAR category nav above it overflows by a few px on every tab; that predates Collaborate.)
  const overHub = await hub.evaluate((root) => {
    const vw = document.documentElement.clientWidth;
    return [root, ...root.querySelectorAll("*")].filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= vw + 0.5) return false;
      // Children of a horizontally scrolling row are clipped by it, not overflowing the page.
      for (let p = el.parentElement; p && p !== root.parentElement; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible" && p.getBoundingClientRect().right <= vw + 0.5) return false;
      return true;
    }).length;
  });
  expect(overHub).toBe(0);

  const discover = page.getByRole("tab", { name: "Discover" });
  await discover.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "My Collaborations" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "My Collaborations" })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /Inbox/ })).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(/view=inbox/);

  // Regression: the other categories render their own content as before.
  await page.goto("/opportunities?cat=jobs");
  await expect(page.getByText("Jobs aren't connected to AVSAR yet")).toBeVisible();
  await expect(page.getByTestId("collaborate-hub")).toHaveCount(0);
  await page.goto("/opportunities?cat=internships");
  await expect(page.getByRole("link", { name: "Internships" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("collaborate-hub")).toHaveCount(0);
  await context.close();
});
