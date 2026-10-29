import { expect, test, type Page } from "@playwright/test";

// The landing body sets `overflow-x: hidden`, so scrollWidth checks alone can't
// catch overflow. These tests measure element geometry instead.

const VIEWPORTS = [
  [320, 640], [360, 780], [375, 667], [390, 844], [430, 932], [600, 960],
  [768, 1024], [834, 1194], [1024, 768], [1100, 800], [1180, 820],
  [1280, 800], [1366, 768], [1440, 900], [1920, 1080], [2560, 1440],
] as const;

async function heroGeometry(page: Page) {
  return page.evaluate(() => {
    const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
    const src = r("#refSourceCol"), card = r("#refCentralCard"), dest = r("#refDestCol");
    const truncated = [...document.querySelectorAll<HTMLElement>("#refSourceCol .ref-source-title")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1)
      .map((el) => el.textContent?.trim());
    return {
      vw: document.documentElement.clientWidth,
      row: src.right <= card.left && card.right <= dest.left,
      gapL: card.left - src.right,
      gapR: dest.left - card.right,
      destRight: dest.right,
      paths: document.querySelectorAll("#refSvgConnectionsGroup path").length,
      truncated,
    };
  });
}

test.describe("Landing page responsive layout", () => {
  for (const [width, height] of VIEWPORTS) {
    test(`${width}x${height}: hero, stories and sections fit the viewport`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Approved section order is intact.
      const ids = await page.evaluate(() =>
        ["top", "ecosystem", "how", "demo", "campus", "privacy", "faq", "start", "footer"].map(
          (id) => document.getElementById(id)?.getBoundingClientRect().top ?? NaN,
        ),
      );
      for (let i = 1; i < ids.length; i++) expect(ids[i]).toBeGreaterThan(ids[i - 1]);

      // Hero: outcome cards stay on screen; when laid out in a row the connector
      // curves are drawn and have room; no source label is truncated.
      await expect.poll(async () => (await heroGeometry(page)).paths > 0 || !(await heroGeometry(page)).row).toBe(true);
      const hero = await heroGeometry(page);
      expect(hero.destRight, "outcome cards clipped").toBeLessThanOrEqual(hero.vw);
      expect(hero.truncated, "truncated source labels").toEqual([]);
      if (hero.row) {
        expect(hero.gapL).toBeGreaterThanOrEqual(24);
        expect(hero.gapR).toBeGreaterThanOrEqual(24);
        expect(hero.paths).toBeGreaterThan(0);
      }

      // Stories: the centred card is inside the viewport and holds its content.
      const card = page.locator(".story-card.pos-center").first();
      await card.scrollIntoViewIfNeeded();
      const story = await card.evaluate((el) => {
        const b = el.getBoundingClientRect();
        return {
          left: b.left,
          right: b.right,
          vw: document.documentElement.clientWidth,
          spills: el.scrollHeight > el.clientHeight + 1,
        };
      });
      expect(story.left).toBeGreaterThanOrEqual(0);
      expect(story.right).toBeLessThanOrEqual(story.vw);
      expect(story.spills, "story card content spills past its border").toBe(false);

      // No visible element in normal flow extends past the viewport edges.
      const offenders = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("body *")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") continue;
          let p = el.parentElement, clipped = false;
          while (p && p !== document.body) {
            if (/(hidden|clip|auto|scroll)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; }
            p = p.parentElement;
          }
          if (clipped) continue;
          const b = el.getBoundingClientRect();
          if (b.width && b.height && (b.right > vw + 1 || b.left < -1)) out.push(el.className || el.tagName);
        }
        return out.slice(0, 5);
      });
      expect(offenders).toEqual([]);
    });
  }

  test("demo dialog fits short and narrow viewports", async ({ page }) => {
    for (const [width, height] of [[320, 568], [667, 375], [1024, 600]] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.locator("#watchDemoBtn").scrollIntoViewIfNeeded();
      await page.locator("#watchDemoBtn").click();
      const dialog = page.locator("#demoModal .modal-card, #demoModal [role=dialog]").first();
      await expect(page.locator("#demoModal")).toHaveClass(/open/);
      const b = (await dialog.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(width);
      await expect(page.locator("#demoModalCloseBtn")).toBeInViewport();
      await page.keyboard.press("Escape");
      await expect(page.locator("#demoModal")).not.toHaveClass(/open/);
    }
  });

  test("small controls keep a 24px touch target", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".story-dot, .footer-legal-btn")].map((el) => {
        const b = el.getBoundingClientRect();
        const before = getComputedStyle(el, "::before");
        const extra = before.content !== "none" ? -2 * parseFloat(before.top || "0") : 0;
        return b.height + extra;
      }),
    );
    expect(sizes.length).toBeGreaterThan(0);
    for (const h of sizes) expect(h).toBeGreaterThanOrEqual(24);
  });
});
