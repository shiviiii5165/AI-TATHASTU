import { test } from "@playwright/test";
import path from "node:path";

const ARTIFACT_DIR = "C:/Users/Lenovo/.gemini/antigravity/brain/82a2080e-b933-41db-90bd-24d0c02f740d";

test.describe("Landing Page Visual QA Screenshots", () => {
  test("capture all sections and states", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(600);

    // 0. Restored Hero Section (Desktop)
    const heroSection = page.locator("#top");
    await heroSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2800);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-restored-hero-desktop.png"),
      fullPage: false,
    });

    // 0b. Restored Full Landing Page (Desktop)
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-landing-desktop-light.png"),
      fullPage: true,
    });

    // 0c. Five Rooms Section (Desktop)
    const fiveRoomsSection = page.locator("#ecosystem");
    await fiveRoomsSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-five-rooms-desktop.png"),
      fullPage: false,
    });

    // 0d. IRIS Room Card specifically (Desktop)
    const irisCard = page.locator('.card-iris');
    await irisCard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-room-iris-desktop.png"),
      fullPage: false,
    });

    // 1. How it works section
    const howSection = page.locator("#how");
    await howSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-how-it-works.png"),
      fullPage: false,
    });

    // 2. Demo section
    const demoSection = page.locator("#demo");
    await demoSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-demo-section.png"),
      fullPage: false,
    });

    // 3. Privacy section
    const privacySection = page.locator("#privacy");
    await privacySection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-privacy-section.png"),
      fullPage: false,
    });

    // 4. Final CTA section
    const finalCta = page.locator(".final-cta-section");
    await finalCta.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-final-cta.png"),
      fullPage: false,
    });
  });

  test("capture Five Rooms at tablet and mobile viewports", async ({ page }) => {
    // Tablet (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    const roomsTablet = page.locator("#ecosystem");
    await roomsTablet.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-five-rooms-tablet.png"),
      fullPage: false,
    });

    const howTablet = page.locator("#how");
    await howTablet.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-how-it-works-tablet.png"),
      fullPage: false,
    });

    // Mobile (390px)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(500);

    const roomsMobile = page.locator("#ecosystem");
    await roomsMobile.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-five-rooms-mobile.png"),
      fullPage: false,
    });

    const irisMobile = page.locator(".card-iris");
    await irisMobile.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-room-iris-mobile.png"),
      fullPage: false,
    });

    const howMobile = page.locator("#how");
    await howMobile.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-how-it-works-mobile.png"),
      fullPage: false,
    });
  });

  test("capture Five Rooms In-Card Coming Soon visual transformations", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);

    const fiveRooms = page.locator("#ecosystem");
    await fiveRooms.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);

    // 1. Avasar transformed
    const avasarCard = page.locator('[data-room="avasar"]');
    await avasarCard.scrollIntoViewIfNeeded();
    await avasarCard.click();
    await page.waitForTimeout(600);
    await avasarCard.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-cs-avasar.png"),
    });

    // 2. Learn transformed (clicking Learn should close Avasar and open Learn)
    const learnCard = page.locator('[data-room="learn"]');
    await learnCard.click();
    await page.waitForTimeout(600);
    await learnCard.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-cs-learn.png"),
    });

    // 3. Collaborate transformed
    const collabCard = page.locator('[data-room="collaborate"]');
    await collabCard.click();
    await page.waitForTimeout(600);
    await collabCard.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-cs-collaborate.png"),
    });

    // 4. Meet transformed
    const meetCard = page.locator('[data-room="meet"]');
    await meetCard.click();
    await page.waitForTimeout(600);
    await meetCard.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-cs-meet.png"),
    });

    // 5. IRIS transformed
    const irisCard = page.locator('[data-room="iris"]');
    await irisCard.click();
    await page.waitForTimeout(600);
    await irisCard.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-cs-iris.png"),
    });

    // Capture entire Five Rooms section with IRIS active
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-five-rooms-active-iris.png"),
      fullPage: false,
    });

    // 6. Close IRIS and verify return to idle state
    const irisCloseBtn = irisCard.locator(".room-cs-close");
    await irisCloseBtn.click();
    await page.waitForTimeout(500);
    await irisCard.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-cs-iris-reverted.png"),
    });

    // 7. Mobile Viewport Transformation
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(600);

    const mobileLearnCard = page.locator('[data-room="learn"]');
    await mobileLearnCard.scrollIntoViewIfNeeded();
    await mobileLearnCard.click();
    await page.waitForTimeout(600);
    await mobileLearnCard.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-cs-mobile-learn.png"),
    });
  });
});
