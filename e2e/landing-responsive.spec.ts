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

test.describe("See it in action + final CTA", () => {
  for (const [width, height] of [[1440, 900], [1280, 800], [1240, 800], [1024, 768], [768, 1024], [390, 844], [320, 640]] as const) {
    test(`${width}px: demo layout and CTA callouts`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.locator("#start").scrollIntoViewIfNeeded();
      await page.waitForLoadState("networkidle");

      // Demo: copy beside the preview from 861px, stacked (copy first) below.
      const demo = await page.evaluate(() => {
        const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
        const copy = r(".demo-copy"), frame = r(".demo-frame-inner"), img = document.querySelector<HTMLImageElement>(".demo-preview-img")!;
        return { side: copy.right <= frame.left, stackedFirst: copy.bottom <= frame.top, ratio: frame.width / frame.height, vw: document.documentElement.clientWidth, frameRight: frame.right, w: img.getAttribute("width"), h: img.getAttribute("height") };
      });
      if (width >= 861) expect(demo.side, "copy beside preview").toBe(true);
      else expect(demo.stackedFirst, "copy above preview").toBe(true);
      expect(demo.ratio).toBeCloseTo(16 / 9, 1);
      expect(demo.frameRight).toBeLessThanOrEqual(demo.vw);
      expect([demo.w, demo.h]).toEqual(["1600", "900"]);

      // Callouts: circular avatar + separate label; never over the centre copy.
      const cta = await page.evaluate(() => {
        const grid = document.getElementById("finalCtaGrid")!;
        const text = [...grid.querySelectorAll(".final-cta-center h2, .final-cta-center p, #ctaStartFreeBtn, .final-cta-reassurances > div")].map((e) => e.getBoundingClientRect());
        const callouts = [...grid.querySelectorAll(".final-callout")].map((c) => {
          const a = c.querySelector(".callout-avatar")!, l = c.querySelector(".callout-label")!;
          const ab = a.getBoundingClientRect(), lb = l.getBoundingClientRect();
          return { label: l.textContent, round: getComputedStyle(a).borderRadius === "50%", square: Math.abs(ab.width - ab.height) < 1, ab, lb };
        });
        const overlap = callouts.some(({ ab, lb }) => [ab, lb].some((c) => text.some((t) => c.left < t.right && t.left < c.right && c.top < t.bottom && t.top < c.bottom)));
        // Sample every connector path against the copy.
        const g = grid.getBoundingClientRect();
        const paths = [...grid.querySelectorAll<SVGPathElement>("#finalCtaLines path")];
        const crosses = paths.some((p) => {
          const len = p.getTotalLength();
          for (let s = 0; s <= 40; s++) {
            const pt = p.getPointAtLength((len * s) / 40);
            const x = pt.x + g.left, y = pt.y + g.top;
            if (text.some((t) => x > t.left && x < t.right && y > t.top && y < t.bottom)) return true;
          }
          return false;
        });
        const vw = document.documentElement.clientWidth;
        const offscreen = callouts.some(({ ab, lb }) => ab.left < 0 || lb.right > vw);
        return { labels: callouts.map((c) => c.label), allRound: callouts.every((c) => c.round && c.square), overlap, paths: paths.length, crosses, offscreen };
      });
      expect(cta.labels).toEqual(["Learn new skills", "Get real opportunities", "Connect with mentors", "Build together"]);
      expect(cta.allRound).toBe(true);
      expect(cta.overlap, "callout overlaps CTA copy").toBe(false);
      expect(cta.offscreen).toBe(false);
      expect(cta.crosses, "connector crosses CTA copy").toBe(false);
      if (width >= 1240) expect(cta.paths).toBe(4);
      else expect(cta.paths).toBe(0);
    });
  }

  test("play control and CTA open the coming-soon dialog; no fake playback UI", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("#demo .demo-track-progress, #demo .demo-duration")).toHaveCount(0);
    for (const trigger of ["#demoPlayTrigger", "#watchDemoBtn"]) {
      await page.locator(trigger).scrollIntoViewIfNeeded();
      await page.locator(trigger).click();
      await expect(page.locator("#demoModal")).toHaveClass(/open/);
      await expect(page.locator("#demoModal")).toContainText("Our 2-minute product demo is coming soon.");
      await page.keyboard.press("Escape");
      await expect(page.locator("#demoModal")).not.toHaveClass(/open/);
    }
  });

  test("headline and connectors finish their entrance; reduced motion shows them at once", async ({ browser }) => {
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion });
      const page = await ctx.newPage();
      await page.goto("/");
      await page.locator("#start").scrollIntoViewIfNeeded();
      await expect(page.locator("#finalCtaGrid")).toHaveClass(/\bin\b/);
      await expect
        .poll(() => page.evaluate(() => {
          const h = getComputedStyle(document.querySelector(".final-cta-headline")!);
          const p = document.querySelector("#finalCtaLines path");
          return h.opacity === "1" && h.transform === "none" && !!p && parseFloat(getComputedStyle(p).strokeDashoffset) === 0;
        }), { timeout: 4000 })
        .toBe(true);
      await ctx.close();
    }
  });
});
