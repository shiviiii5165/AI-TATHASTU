import { expect, test } from "@playwright/test";

import { createUser, signIn } from "./support/fixtures";

const VIEWPORTS = [
  { name: "Desktop Large", width: 1440, height: 900 },
  { name: "Desktop Standard", width: 1280, height: 800 },
  { name: "Small Desktop / Tablet Landscape", width: 1024, height: 768 },
  { name: "Tablet Portrait", width: 768, height: 1024 },
  { name: "Large Mobile", width: 430, height: 932 },
  { name: "Standard Mobile", width: 390, height: 844 },
  { name: "Compact Mobile", width: 360, height: 780 },
  { name: "Narrow Mobile", width: 320, height: 700 },
] as const;

test.describe("Responsive Viewports Comprehensive Audit", () => {
  for (const vp of VIEWPORTS) {
    test(`renders cleanly without horizontal overflow at ${vp.name} (${vp.width}x${vp.height})`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      // Test public unauthenticated pages first
      const publicRoutes = ["/", "/about", "/contact", "/login"];
      for (const route of publicRoutes) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");
        const hasHorizontalOverflow = await page.evaluate(() => {
          return (
            document.documentElement.scrollWidth > window.innerWidth ||
            document.body.scrollWidth > window.innerWidth
          );
        });
        expect(
          hasHorizontalOverflow,
          `Horizontal scrollbar detected on ${route} at ${vp.name} (${vp.width}px)`
        ).toBe(false);
      }

      // Test onboarding flows with user
      const user = await createUser(`User ${vp.name.replace(/\s+/g, "")}`, "review");
      await signIn(context, user);

      const routes = [
        "/onboarding/role",
        "/onboarding/career-direction",
        "/onboarding/priorities",
        "/onboarding/basic-profile",
        "/onboarding/resume",
        "/onboarding/connect-sources",
        "/onboarding/review-consent",
      ];

      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");

        // Verify page loads with heading
        const heading = page.locator("h1");
        await expect(heading).toBeVisible();

        // Verify no horizontal overflow beyond viewport width
        const hasHorizontalOverflow = await page.evaluate(() => {
          return (
            document.documentElement.scrollWidth > window.innerWidth ||
            document.body.scrollWidth > window.innerWidth
          );
        });

        expect(
          hasHorizontalOverflow,
          `Horizontal scrollbar detected on ${route} at ${vp.name} (${vp.width}px)`
        ).toBe(false);
      }
    });
  }
});
