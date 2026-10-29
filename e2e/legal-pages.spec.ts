import { expect, test } from "@playwright/test";

test.describe("AI Tathastu Legal Documentation Pages", () => {
  test("1. Privacy Policy page renders all 17 sections, badges, and contact channels", async ({ page }) => {
    await page.goto("/privacy");
    await page.waitForLoadState("domcontentloaded");

    // Title & Main heading
    await expect(page).toHaveTitle(/Privacy Policy · AI Tathastu/);
    const h1 = page.locator("h1");
    await expect(h1).toContainText("AI Tathastu — Privacy Policy");

    // Effective date & updated date
    await expect(page.locator("text=Effective Date: 30 October 2026")).toBeVisible();

    // Table of contents
    await expect(page.locator("text=Table of Contents")).toBeVisible();
    await expect(page.locator('a[href="#sec-1"]')).toContainText("1. Introduction");
    await expect(page.locator('a[href="#sec-17"]')).toContainText("17. Contact & Grievance");

    // Check specific critical sections
    await expect(page.locator("#sec-1")).toBeVisible();
    await expect(page.locator("#sec-3")).toContainText("3. Information We Collect");
    await expect(page.locator("#sec-5")).toContainText("5. AI Processing and Automated Analysis");
    await expect(page.locator("#sec-6")).toContainText("6. Public Profiles and Visibility");
    await expect(page.locator("#sec-17")).toContainText("17. Contact and Grievance Information");

    // Contact emails
    await expect(page.locator('a[href*="privacy@aitathastu.com"]').first()).toBeVisible();
    await expect(page.locator('a[href*="support.aitathastu@gmail.com"]').first()).toBeVisible();
  });

  test("2. Terms of Use page renders all 27 sections, intellectual property clause, and contacts", async ({ page }) => {
    await page.goto("/terms");
    await page.waitForLoadState("domcontentloaded");

    // Title & Main heading
    await expect(page).toHaveTitle(/Terms of Use · AI Tathastu/);
    const h1 = page.locator("h1");
    await expect(h1).toContainText("AI Tathastu — Terms of Use");

    // Core principle
    await expect(page.locator("text=You own 100% of your work")).toBeVisible();

    // Table of contents
    await expect(page.locator("text=Table of Contents (27 Sections)")).toBeVisible();

    // Specific key sections
    await expect(page.locator("#term-1")).toBeVisible();
    await expect(page.locator("#term-8")).toContainText("8. AI Analysis, Scores, and Recommendations");
    await expect(page.locator("#term-9")).toContainText("9. No Guarantee of Employment or Career Results");
    await expect(page.locator("#term-15")).toContainText("15. Intellectual Property");
    await expect(page.locator("#term-27")).toContainText("27. Contact Information");

    // Legal & Support contacts
    await expect(page.locator('a[href*="legal@aitathastu.com"]').first()).toBeVisible();
    await expect(page.locator('a[href*="support.aitathastu@gmail.com"]').first()).toBeVisible();
  });

  test("3. Cookie Policy page renders all 11 sections and /cookies redirects properly", async ({ page }) => {
    await page.goto("/cookie-policy");
    await page.waitForLoadState("domcontentloaded");

    // Title & Main heading
    await expect(page).toHaveTitle(/Cookie Policy · AI Tathastu/);
    const h1 = page.locator("h1");
    await expect(h1).toContainText("AI Tathastu — Cookie Policy");

    // Categories
    await expect(page.locator("#cookie-3")).toContainText("3. Categories of Cookies and Similar Technologies");
    await expect(page.locator("#cookie-11")).toContainText("11. Contact Information");

    // Test alias /cookies redirects to /cookie-policy
    await page.goto("/cookies");
    await page.waitForURL("**/cookie-policy");
    await expect(page.locator("h1")).toContainText("AI Tathastu — Cookie Policy");
  });
});
