/**
 * Onboarding Step 5: connector cards settle without a reload once the worker
 * finishes, and LinkedIn asks for its scraping consent where it's used.
 */
import { expect, test, type Page } from "@playwright/test";

import { completeConnectorSync, createUser, signIn, sql } from "./support/fixtures";

const card = (page: Page, name: string) => page.getByRole("article", { name, exact: true });

test("connector cards: import status updates live; LinkedIn asks for consent inline on its card", async ({ page, context }) => {
  const user = await createUser("Asha Rao", "connectors");
  await signIn(context, user);
  await page.goto("/onboarding/connect-sources");

  await test.step("LeetCode: Importing, then Connected without a reload", async () => {
    await card(page, "LeetCode").getByRole("button", { name: "Connect LeetCode" }).click();
    await page.getByLabel("Username or profile link").fill("https://leetcode.com/u/asha_rao/");
    await page.getByRole("dialog").getByRole("button", { name: "Connect" }).click();

    const leetcode = card(page, "LeetCode");
    await expect(leetcode).toContainText("@asha_rao");
    await expect(leetcode).toContainText("Importing");
    await completeConnectorSync(user.id, "leetcode");
    await expect(leetcode).toContainText("Connected", { timeout: 20_000 });
    await expect(leetcode).toContainText("Last imported");
  });

  // LinkedIn OAuth isn't configured in the E2E stack, so the redirect lands back
  // here with ?error=not_configured; the consent is recorded before it either way.
  for (const tick of [false, true]) {
    await test.step(`LinkedIn: Connect shows the inline consent; ${tick ? "ticked" : "unticked"} is saved before redirect`, async () => {
      await page.goto("/onboarding/connect-sources");
      const linkedin = card(page, "LinkedIn");
      await expect(linkedin.getByRole("checkbox")).toHaveCount(0);

      await linkedin.getByRole("button", { name: "Connect LinkedIn" }).click();
      const consent = linkedin.getByRole("checkbox", { name: "Read my public LinkedIn profile" });
      await expect(consent).not.toBeChecked();
      if (tick) await consent.check();

      await linkedin.getByRole("button", { name: "Connect LinkedIn" }).click();
      await expect(page).toHaveURL(/source=linkedin/);
      const latest = await sql.query(
        "SELECT granted FROM consents WHERE user_id = $1 AND purpose = 'linkedin_scrape' ORDER BY created_at DESC LIMIT 1",
        [user.id],
      );
      expect(latest.rows[0]?.granted).toBe(tick);
    });
  }

  await test.step("Continue is enabled once a source is connected", async () => {
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page).toHaveURL(/\/onboarding\/review-consent$/);
  });
});
