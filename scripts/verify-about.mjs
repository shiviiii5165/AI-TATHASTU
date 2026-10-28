import { chromium } from "@playwright/test";

async function run() {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  page.on("console", (msg) => console.log("BROWSER CONSOLE:", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("BROWSER ERROR:", err));

  console.log("Loading http://localhost:3000/about ...");
  await page.goto("http://localhost:3000/about", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // 1. Verify title
  const title = await page.title();
  console.log("Title:", title);

  // 2. Click Avasar card
  const avasarBtn = page.locator("#room-tab-avasar");
  console.log("Clicking Avasar card...");
  await avasarBtn.click();
  await page.waitForTimeout(500);

  const panel = page.locator(".eco-detail-panel");
  const isAvasarOpen = await panel.isVisible();
  console.log("Avasar panel open after click:", isAvasarOpen);

  if (isAvasarOpen) {
    const headline = await page.locator(".eco-detail-headline").innerText();
    const kicker = await page.locator(".eco-detail-kicker").innerText();
    const intro = await page.locator(".eco-detail-intro").innerText();
    const cta = await page.locator(".eco-action-cta-btn").innerText();
    console.log("Avasar headline:", headline);
    console.log("Avasar kicker:", kicker);
    console.log("Avasar intro:", intro);
    console.log("Avasar CTA:", cta);
  }

  // 3. Test Learn card
  console.log("Clicking Learn card...");
  await page.locator("#room-tab-learn").click();
  await page.waitForTimeout(300);
  console.log("Learn headline:", await page.locator(".eco-detail-headline").innerText());

  // 4. Test Collaborate card
  console.log("Clicking Collaborate card...");
  await page.locator("#room-tab-collaborate").click();
  await page.waitForTimeout(300);
  console.log("Collaborate headline:", await page.locator(".eco-detail-headline").innerText());

  // 5. Test Meet card
  console.log("Clicking Meet card...");
  await page.locator("#room-tab-meet").click();
  await page.waitForTimeout(300);
  console.log("Meet headline:", await page.locator(".eco-detail-headline").innerText());

  // 6. Test IRIS card
  console.log("Clicking IRIS card...");
  await page.locator("#room-tab-iris").click();
  await page.waitForTimeout(300);
  console.log("IRIS headline:", await page.locator(".eco-detail-headline").innerText());

  // 7. Test Close button
  console.log("Clicking Close details...");
  await page.locator(".eco-close-btn").click();
  await page.waitForTimeout(300);
  console.log("Panel visible after close:", await panel.isVisible());

  // 8. Test Viewports
  const viewports = [
    { name: "Desktop", width: 1440, height: 900 },
    { name: "Tablet", width: 768, height: 1024 },
    { name: "Mobile Large", width: 390, height: 844 },
    { name: "Mobile Small", width: 320, height: 700 },
  ];

  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(100);
    const overflow = await page.evaluate(() => {
      return (
        document.documentElement.scrollWidth > window.innerWidth ||
        document.body.scrollWidth > window.innerWidth
      );
    });
    console.log(`${vp.name} (${vp.width}px) overflow: ${overflow}`);
  }

  // 9. Confirm "How we build" is gone
  const bodyText = await page.locator("body").innerText();
  console.log("Contains 'How we build':", bodyText.includes("How we build"));
  console.log("Contains 'Technology should open doors':", bodyText.includes("Technology should open doors"));

  await browser.close();
  console.log("=== ALL CHECKS FINISHED ===");
}

run().catch(console.error);
