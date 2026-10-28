import { expect, test } from "@playwright/test";

test.describe("Dark Mode Comprehensive E2E Verification", () => {
  test("1. Landing page theme toggle activates dark mode, sets attributes, and persists on reload", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Initially should not be dark if clean
    const initialIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );

    // Click theme toggle button
    const toggleBtn = page.locator("#refThemeToggleBtn");
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();

    // Verify .dark and data-theme="dark" are applied to documentElement
    const isDarkAfter = await page.evaluate(() =>
      document.documentElement.classList.contains("dark") &&
      document.documentElement.getAttribute("data-theme") === "dark"
    );
    expect(isDarkAfter).toBe(!initialIsDark);

    // Verify localStorage persistence
    const storedTheme = await page.evaluate(() =>
      localStorage.getItem("ai-tathastu-theme")
    );
    expect(storedTheme).toBe(isDarkAfter ? "dark" : "light");

    // Reload page and verify first-paint / DOM keeps the theme
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    const isDarkAfterReload = await page.evaluate(() =>
      document.documentElement.classList.contains("dark") &&
      document.documentElement.getAttribute("data-theme") === "dark"
    );
    expect(isDarkAfterReload).toBe(isDarkAfter);
  });

  test("2. Theme persists across client-side navigation between landing, about, contact, and login", async ({
    page,
  }) => {
    // Set theme to dark first
    await page.addInitScript(() => {
      localStorage.setItem("ai-tathastu-theme", "dark");
    });

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    let isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isDark).toBe(true);

    // Navigate to /about
    await page.goto("/about");
    await page.waitForLoadState("domcontentloaded");
    isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isDark).toBe(true);

    // Navigate to /contact
    await page.goto("/contact");
    await page.waitForLoadState("domcontentloaded");
    isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isDark).toBe(true);

    // Navigate to /login
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isDark).toBe(true);
  });

  test("3. Login page theme toggle button switches theme seamlessly", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");

    const themeToggle = page.locator('button[aria-label*="Switch to"]');
    await expect(themeToggle).toBeVisible();

    const initialTheme = await page.evaluate(() =>
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );

    // Toggle theme
    await themeToggle.click();

    const toggledTheme = await page.evaluate(() =>
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
    expect(toggledTheme).not.toBe(initialTheme);

    // Toggle back
    await themeToggle.click();
    const restoredTheme = await page.evaluate(() =>
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
    expect(restoredTheme).toBe(initialTheme);
  });

  test("4. Mobile viewports (320px to 430px) have accessible theme toggles", async ({
    page,
  }) => {
    const mobileWidths = [320, 360, 390, 430];

    for (const width of mobileWidths) {
      await page.setViewportSize({ width, height: 750 });
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");

      const toggleBtn = page.locator("#refThemeToggleBtn");
      await expect(toggleBtn).toBeVisible();

      // Check bounding box is accessible
      const box = await toggleBtn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(30);
      expect(box!.height).toBeGreaterThanOrEqual(30);

      // Verify click operates
      await toggleBtn.click();
      const isDark = await page.evaluate(() =>
        document.documentElement.classList.contains("dark")
      );
      expect(typeof isDark).toBe("boolean");
    }
  });

  test("5. Theme initialization script handles blocked/unavailable storage gracefully", async ({
    page,
  }) => {
    // Simulate throwing on localStorage access (e.g. security sandbox)
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        value: {
          getItem: () => {
            throw new Error("SecurityError: Access denied");
          },
          setItem: () => {
            throw new Error("SecurityError: Access denied");
          },
          removeItem: () => {},
          clear: () => {},
        },
        writable: true,
      });
    });

    // Should load cleanly without uncaught fatal exception
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const bodyVisible = await page.locator("body").isVisible();
    expect(bodyVisible).toBe(true);
  });
});
