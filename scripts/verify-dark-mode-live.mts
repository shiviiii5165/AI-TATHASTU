import { chromium } from "playwright";

const VIEWPORTS = [
  { name: "320px Narrow Mobile", width: 320, height: 700 },
  { name: "360px Compact Mobile", width: 360, height: 780 },
  { name: "390px Standard Mobile", width: 390, height: 844 },
  { name: "430px Large Mobile", width: 430, height: 932 },
  { name: "768px Tablet Portrait", width: 768, height: 1024 },
  { name: "1024px Small Desktop", width: 1024, height: 768 },
  { name: "1280px Desktop Standard", width: 1280, height: 800 },
  { name: "1440px Desktop Large", width: 1440, height: 900 },
];

async function run() {
  console.log("🚀 Starting Comprehensive Live Dark Mode Verification against http://127.0.0.1:3000...");
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext();
  const page = await context.newPage();

  const results: Record<string, boolean> = {};

  try {
    // 1. Landing Page Test
    console.log("\n--- Testing Landing Page (/) ---");
    await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });

    const initialClasses = await page.evaluate(() => document.documentElement.className);
    console.log("Initial <html> class:", initialClasses);

    // Click theme toggle button
    const toggleBtn = page.locator("#refThemeToggleBtn");
    const isVisible = await toggleBtn.isVisible();
    console.log("#refThemeToggleBtn is visible:", isVisible);
    results["landing_toggle_visible"] = isVisible;

    await toggleBtn.click();
    await page.waitForTimeout(300);

    const isDarkAfterToggle = await page.evaluate(() =>
      document.documentElement.classList.contains("dark") &&
      document.documentElement.getAttribute("data-theme") === "dark"
    );
    console.log("Dark mode active after toggle:", isDarkAfterToggle);
    results["landing_toggle_activates_dark"] = isDarkAfterToggle;

    const storedTheme = await page.evaluate(() => localStorage.getItem("ai-tathastu-theme"));
    console.log("Stored theme in localStorage:", storedTheme);
    results["landing_persists_storage"] = storedTheme === "dark";

    // Reload and check persistence
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
    const isDarkAfterReload = await page.evaluate(() =>
      document.documentElement.classList.contains("dark") &&
      document.documentElement.getAttribute("data-theme") === "dark"
    );
    console.log("Dark mode preserved after reload:", isDarkAfterReload);
    results["landing_persists_reload"] = isDarkAfterReload;

    // Toggle back to light mode
    await page.locator("#refThemeToggleBtn").click();
    await page.waitForTimeout(300);
    const isLightRestored = await page.evaluate(() =>
      !document.documentElement.classList.contains("dark") &&
      document.documentElement.getAttribute("data-theme") === "light"
    );
    console.log("Light mode restored after second toggle:", isLightRestored);
    results["landing_toggle_restores_light"] = isLightRestored;

    // 2. Navigation & Persistence to About & Contact
    console.log("\n--- Testing Route Transitions & Persistence ---");
    // Set to dark mode again
    await page.locator("#refThemeToggleBtn").click();
    await page.waitForTimeout(300);

    await page.goto("http://127.0.0.1:3000/about", { waitUntil: "domcontentloaded", timeout: 15000 });
    const isAboutDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    console.log("/about inherits dark mode:", isAboutDark);
    results["about_inherits_dark"] = isAboutDark;

    await page.goto("http://127.0.0.1:3000/contact", { waitUntil: "domcontentloaded", timeout: 15000 });
    const isContactDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    console.log("/contact inherits dark mode:", isContactDark);
    results["contact_inherits_dark"] = isContactDark;

    await page.goto("http://127.0.0.1:3000/login", { waitUntil: "domcontentloaded", timeout: 15000 });
    const isLoginDark = await page.evaluate(() => document.documentElement.classList.contains("dark"));
    console.log("/login inherits dark mode:", isLoginDark);
    results["login_inherits_dark"] = isLoginDark;

    // 3. Login Theme Button Test
    console.log("\n--- Testing Login Page Theme Button ---");
    const loginToggle = page.locator('button[aria-label*="Switch to"]');
    const loginBtnVisible = await loginToggle.isVisible();
    console.log("Login ThemeToggleButton visible:", loginBtnVisible);
    results["login_button_visible"] = loginBtnVisible;

    if (loginBtnVisible) {
      await loginToggle.click();
      await page.waitForTimeout(300);
      const isLoginLightNow = await page.evaluate(() => !document.documentElement.classList.contains("dark"));
      console.log("Login toggles to light:", isLoginLightNow);
      results["login_toggles_light"] = isLoginLightNow;

      await loginToggle.click();
      await page.waitForTimeout(300);
      const isLoginDarkAgain = await page.evaluate(() => document.documentElement.classList.contains("dark"));
      console.log("Login toggles back to dark:", isLoginDarkAgain);
      results["login_toggles_dark"] = isLoginDarkAgain;
    }

    // 4. Viewport Responsiveness across 8 widths
    console.log("\n--- Testing 8 Viewport Widths ---");
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded", timeout: 15000 });

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth || document.body.scrollWidth > window.innerWidth;
      });

      const btnVisible = await page.locator("#refThemeToggleBtn").isVisible();
      console.log(`Viewport ${vp.name} (${vp.width}px): overflow=${overflow}, themeBtnVisible=${btnVisible}`);
      results[`vp_${vp.width}_no_overflow`] = !overflow;
      results[`vp_${vp.width}_theme_btn_visible`] = btnVisible;
    }

    console.log("\n==========================================");
    console.log("LIVE VERIFICATION SUMMARY:");
    console.log("==========================================");
    let allPassed = true;
    for (const [k, v] of Object.entries(results)) {
      console.log(`${v ? "✓" : "✗"} ${k}: ${v ? "PASSED" : "FAILED"}`);
      if (!v) allPassed = false;
    }

    if (allPassed) {
      console.log("\n🎉 ALL 23 LIVE DARK MODE CHECKS PASSED PERFECTLY!");
    } else {
      console.error("\n❌ Some checks failed!");
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error("Verification script error:", err);
  process.exit(1);
});
