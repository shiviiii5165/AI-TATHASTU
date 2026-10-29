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
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-restored-hero-desktop.png"),
      fullPage: false,
    });

    // 0b. Restored Full Landing Page (Desktop)
    await page.screenshot({
      path: path.join(ARTIFACT_DIR, "qa-landing-desktop-light.png"),
      fullPage: true,
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
});
