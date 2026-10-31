import { expect, test } from "@playwright/test";

test.describe("Landing Page Redesign — Interactive E2E Verification", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("1. All 10 sections are present and ordered correctly in the rendered DOM", async ({ page }) => {
    const sectionIds = [
      "top",
      "ecosystem",
      "how",
      "demo",
      "campus",
      "privacy",
      "faq",
      "start",
      "footer",
    ];

    for (const id of sectionIds) {
      const el = page.locator(`#${id}`);
      await expect(el).toBeAttached();
    }

    // Verify college showcase is absent
    const collegeShowcase = page.locator("text=TRUSTED BY STUDENTS FROM INSTITUTIONS WORLDWIDE");
    await expect(collegeShowcase).toHaveCount(0);
  });

  test("1b. Canonical Hero is restored with headline, copy, CTAs, profile card, sources and destinations", async ({ page }) => {
    const hero = page.locator("#top");
    await expect(hero).toBeVisible();

    // Headline & supporting copy
    await expect(hero.locator(".ref-hero-headline")).toContainText("Know where you stand.");
    await expect(hero.locator(".ref-hero-headline")).toContainText("Know what to do next.");
    await expect(hero.locator(".ref-hero-copy")).toContainText(
      "Connect your GitHub, LinkedIn, LeetCode and resume. See what skills you have, what is missing, and what to learn next."
    );

    // Primary & secondary CTAs
    const primaryCta = hero.locator(".ref-primary-cta");
    await expect(primaryCta).toBeVisible();
    await expect(primaryCta).toContainText("Get Started Free");
    await expect(primaryCta).toHaveAttribute("href", "/login");

    const secondaryCta = hero.locator("#seeHowItWorksBtn");
    await expect(secondaryCta).toBeVisible();
    await expect(secondaryCta).toContainText("Watch Demo (2 min)");
    await expect(secondaryCta).toHaveAttribute("href", "#demo");

    // Central Profile Card
    const profileCard = hero.locator("#refCentralCard");
    await expect(profileCard).toBeVisible();
    await expect(profileCard).toContainText("YOUR PROFILE");
    await expect(profileCard).toContainText("Ananya Sharma");
    await expect(profileCard).toContainText("Computer Science Student");
    await expect(profileCard).toContainText("Skills");
    await expect(profileCard).toContainText("24");
    await expect(profileCard).toContainText("Projects");
    await expect(profileCard).toContainText("8");

    // Sources & Destinations
    const sources = ["Resume", "GitHub", "LinkedIn", "LeetCode", "Kaggle", "Research Papers", "Projects"];
    for (const s of sources) {
      await expect(hero.locator(`#refSourceCol:has-text("${s}")`)).toBeAttached();
    }

    const destinations = ["Opportunities", "Learning", "Connections"];
    for (const d of destinations) {
      await expect(hero.locator(`#refDestCol:has-text("${d}")`)).toBeAttached();
    }
  });

  test("2. Header CTA displays 'Get Started Free' and links to /login for signed-out visitors", async ({ page }) => {
    const navCta = page.locator("#navCreateProfileBtn");
    await expect(navCta).toBeVisible();
    await expect(navCta).toContainText("Get Started Free");
    await expect(navCta).not.toContainText("Open Dashboard");
    await expect(navCta).toHaveAttribute("href", "/login");
  });

  test("3. Final CTA section contains exact headline, supporting copy, and reassurance strings", async ({ page }) => {
    const ctaSection = page.locator(".final-cta-section");
    await expect(ctaSection).toBeVisible();

    const headline = ctaSection.locator(".final-cta-headline");
    await expect(headline).toHaveText("Start your career journey today");

    const subtitle = ctaSection.locator(".final-cta-subtitle");
    await expect(subtitle).toHaveText("Join thousands of students who are already building a brighter future with AI Tathastu.");

    const primaryBtn = ctaSection.locator("#ctaStartFreeBtn");
    await expect(primaryBtn).toBeVisible();
    await expect(primaryBtn).toContainText("Get Started Free");

    await expect(ctaSection).toContainText("No credit card required");
    await expect(ctaSection).toContainText("Takes less than 2 minutes");
  });

  test("4. Privacy section renders 4 exact card titles", async ({ page }) => {
    const privacy = page.locator("#privacy");
    await expect(privacy).toBeVisible();

    await expect(privacy.locator("text=Secure & Encrypted Data Storage")).toBeVisible();
    await expect(privacy.locator("text=You Own Your Data (Export or Delete Anytime)")).toBeVisible();
    await expect(privacy.locator("text=No Training on Your Personal Data (Without Consent)")).toBeVisible();
    await expect(privacy.locator("text=Granular Privacy Controls (Choose What to Share)")).toBeVisible();

    const privacyLink = privacy.locator('a[href="/privacy"]');
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toContainText("Read our Privacy Policy");
  });

  test("5. FAQ accordion expands and collapses answers with correct aria-expanded state", async ({ page }) => {
    const firstTrigger = page.locator(".faq-trigger").first();
    const firstItem = page.locator(".faq-item").first();
    const firstAnswer = firstItem.locator(".faq-answer-panel");

    await expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
    await expect(firstAnswer).not.toBeVisible();

    // Click to open
    await firstTrigger.click();
    await expect(firstItem).toHaveClass(/open/);
    await expect(firstTrigger).toHaveAttribute("aria-expanded", "true");
    await expect(firstAnswer).toBeVisible();

    // Click again to close
    await firstTrigger.click();
    await expect(firstItem).not.toHaveClass(/open/);
    await expect(firstTrigger).toHaveAttribute("aria-expanded", "false");
  });

  test("6. Demo CTA and play trigger open Demo Coming Soon modal, and Escape closes it", async ({ page }) => {
    const demoModal = page.locator("#demoModal");
    await expect(demoModal).not.toHaveClass(/open/);

    // Click Watch Demo button
    const watchBtn = page.locator("#watchDemoBtn");
    await watchBtn.scrollIntoViewIfNeeded();
    await watchBtn.click();

    await expect(demoModal).toHaveClass(/open/);
    await expect(demoModal.locator(".coming-soon-pill")).toBeVisible();
    await expect(demoModal.locator("#demoModalTitle")).toContainText("Product Demo (2 min)");

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(demoModal).not.toHaveClass(/open/);

    // Click player frame trigger
    const playTrigger = page.locator("#demoPlayTrigger");
    await playTrigger.click();
    await expect(demoModal).toHaveClass(/open/);

    // Click close button
    await page.locator("#demoModalCloseBtn").click();
    await expect(demoModal).not.toHaveClass(/open/);
  });

  test("7. Room cards open honest Coming Soon modal via mouse and keyboard (Enter/Space)", async ({ page }) => {
    const roomModal = page.locator("#roomModal");
    await expect(roomModal).not.toHaveClass(/open/);

    // Click Learn room card
    const learnCard = page.locator('[data-room="learn"]');
    await learnCard.scrollIntoViewIfNeeded();
    await learnCard.click();

    await expect(roomModal).toHaveClass(/open/);
    await expect(roomModal.locator("#modalTitle")).toContainText("Learn");
    await expect(roomModal.locator(".coming-soon-pill")).toBeVisible();

    // Close modal
    await page.locator("#modalCloseBtn").click();
    await expect(roomModal).not.toHaveClass(/open/);

    // Keyboard trigger: focus collaborate card and hit Enter
    const collabCard = page.locator('[data-room="collaborate"]');
    await collabCard.focus();
    await page.keyboard.press("Enter");

    await expect(roomModal).toHaveClass(/open/);
    await expect(roomModal.locator("#modalTitle")).toContainText("Collaborate");

    // Close via Got it button
    await page.locator("#modalActionBtn").click();
    await expect(roomModal).not.toHaveClass(/open/);
  });

  test("8. Desktop and mobile viewports render cleanly without horizontal overflow", async ({ page }) => {
    // Desktop Viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    let overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);

    // Mobile Viewport
    await page.setViewportSize({ width: 390, height: 844 });
    overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
