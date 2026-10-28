import { chromium } from "@playwright/test";
import { createUser, signIn, seedComputedProfile } from "../e2e/support/fixtures";
import { E2E_ENV } from "../e2e/support/env";

const VIEWPORTS = [
  { name: "320px - Narrow Mobile", width: 320, height: 700 },
  { name: "360px - Compact Android", width: 360, height: 780 },
  { name: "390px - Standard Mobile", width: 390, height: 844 },
  { name: "430px - Large Mobile", width: 430, height: 932 },
  { name: "768px - Tablet Portrait", width: 768, height: 1024 },
  { name: "1024px - Tablet Landscape / Laptop", width: 1024, height: 768 },
  { name: "1440px - Desktop Large", width: 1440, height: 900 },
  { name: "1920px - Wide Desktop", width: 1920, height: 1080 },
  { name: "Landscape Mobile (844x390)", width: 844, height: 390 },
  { name: "Short Mobile (360x640)", width: 360, height: 640 },
];

const ROUTES = [
  // Public
  "/",
  "/about",
  "/contact",
  "/login",
  // Onboarding
  "/onboarding/role",
  "/onboarding/career-direction",
  "/onboarding/priorities",
  "/onboarding/basic-profile",
  "/onboarding/resume",
  "/onboarding/connect-sources",
  "/onboarding/review-consent",
  // Dashboard & Workspace
  "/dashboard",
  "/profile",
  "/skills",
  "/projects",
  "/achievements",
  "/learning",
  "/people",
  "/connections",
  "/settings",
  "/settings/integrations",
  "/settings/privacy",
];

interface DefectReport {
  viewport: string;
  route: string;
  type: "document_overflow" | "element_overflow" | "ios_zoom_risk" | "small_touch_target";
  details: string;
}

async function runAudit() {
  console.log("=== AI TATHASTU UNIVERSAL RESPONSIVE AUDIT ===");
  const defects: DefectReport[] = [];
  const browser = await chromium.launch({ channel: "chrome" });
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();

  const authContext = await browser.newContext();
  // Seed user with full computed profile for dashboard access
  const email = `audit-user-${Date.now()}@example.com`;
  const user = await createUser("Audit Scholar", "review", email);
  await seedComputedProfile(user.id);
  await signIn(authContext, user, { onboarded: true });
  const authPage = await authContext.newPage();

  const publicRoutes = ["/", "/about", "/contact", "/login"];

  // Route by Route across viewports
  for (const route of ROUTES) {
    const isPublic = publicRoutes.includes(route);
    const page = isPublic ? publicPage : authPage;
    console.log(`Auditing route: ${route} (${isPublic ? "public" : "authenticated"})`);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      try {
        await page.goto(`${E2E_ENV.AUTH_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 15000 });
        await page.waitForTimeout(150);

        // 1. Document overflow
        const docOverflow = await page.evaluate(() => {
          const docW = document.documentElement.scrollWidth;
          const bodyW = document.body.scrollWidth;
          const winW = window.innerWidth;
          const delta = Math.max(docW, bodyW) - winW;
          return { hasOverflow: delta > 2, delta, docW, bodyW, winW };
        });

        if (docOverflow.hasOverflow) {
          defects.push({
            viewport: vp.name,
            route,
            type: "document_overflow",
            details: `Page overflows horizontally by ${docOverflow.delta}px (doc: ${docOverflow.docW}px, body: ${docOverflow.bodyW}px, win: ${docOverflow.winW}px)`,
          });
        }

        // 2. Offscreen elements
        const protruding = await page.evaluate(() => {
          const winW = window.innerWidth;
          const offenders: Array<{ selector: string; right: number; delta: number }> = [];
          const allEls = document.querySelectorAll("main *, header *, footer *, nav *, form *, aside *");
          for (const el of allEls) {
            // Ignore intentional horizontally scrolling containers or elements clipped by overflow-hidden ancestor
            const style = window.getComputedStyle(el);
            if (style.overflowX === "auto" || style.overflowX === "scroll") continue;
            let clipped = false;
            let ancestor: HTMLElement | null = el.parentElement;
            while (ancestor && ancestor.tagName !== "BODY" && ancestor.tagName !== "HTML") {
              const aStyle = window.getComputedStyle(ancestor);
              if (aStyle.overflowX === "hidden" || aStyle.overflowX === "auto" || aStyle.overflowX === "scroll" || aStyle.overflow === "hidden") {
                clipped = true;
                break;
              }
              ancestor = ancestor.parentElement;
            }
            if (clipped) continue;

            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.right > winW + 3) {
              const tag = el.tagName.toLowerCase();
              const id = el.id ? `#${el.id}` : "";
              const cls = el.className && typeof el.className === "string"
                ? `.${el.className.split(" ").filter(Boolean).slice(0, 2).join(".")}`
                : "";
              offenders.push({
                selector: `${tag}${id}${cls}`,
                right: Math.round(rect.right),
                delta: Math.round(rect.right - winW),
              });
              if (offenders.length >= 2) break;
            }
          }
          return offenders;
        });

        for (const off of protruding) {
          defects.push({
            viewport: vp.name,
            route,
            type: "element_overflow",
            details: `${off.selector} protrudes by ${off.delta}px outside viewport`,
          });
        }

        // 3. iOS zoom input risk (< 16px font-size on mobile viewports)
        if (vp.width < 768) {
          const smallInputs = await page.evaluate(() => {
            const inputs = document.querySelectorAll<HTMLInputElement>(
              "input[type='text'], input[type='email'], input[type='search'], input:not([type]), select"
            );
            const bad: string[] = [];
            for (const input of inputs) {
              const style = window.getComputedStyle(input);
              const px = parseFloat(style.fontSize);
              if (px < 15.5) {
                bad.push(`${input.name || input.id || input.placeholder || "input"} (${style.fontSize})`);
              }
            }
            return bad;
          });

          if (smallInputs.length > 0) {
            defects.push({
              viewport: vp.name,
              route,
              type: "ios_zoom_risk",
              details: `Inputs with font-size < 16px triggering iOS Safari zoom: ${smallInputs.join(", ")}`,
            });
          }
        }
        // Capture screenshot for key viewports on representative routes
        const captureRoutes = ["/", "/login", "/onboarding/role", "/dashboard", "/skills", "/projects", "/profile"];
        const captureVps = ["320px - Narrow Mobile", "390px - Standard Mobile", "768px - Tablet Portrait", "1440px - Desktop Large", "Landscape Mobile (844x390)"];
        if (captureRoutes.includes(route) && captureVps.includes(vp.name)) {
          const fs = await import("node:fs");
          const path = await import("node:path");
          const safeRouteName = route === "/" ? "landing" : route.replace(/\//g, "-").replace(/^-/, "");
          const safeVpName = vp.name.replace(/[^a-zA-Z0-9]/g, "-");
          const outDir = path.resolve(process.cwd(), "test-screenshots");
          if (!fs.existsSync(outDir)) {
            fs.mkdirSync(outDir, { recursive: true });
          }
          await page.screenshot({
            path: path.join(outDir, `${safeRouteName}_${safeVpName}.png`),
            fullPage: false,
          });
        }
      } catch (err) {
        // Log brief error and continue
        console.error(`  [${vp.name}] error: ${(err as Error).message}`);
      }
    }
  }

  await browser.close();

  console.log("\n=======================================================");
  console.log(`AUDIT COMPLETE: ${defects.length} defect instances reported`);
  console.log("=======================================================");

  // Unique defects grouped by type
  const uniqueKeys = new Set<string>();
  const uniqueDefects: DefectReport[] = [];
  for (const d of defects) {
    const key = `${d.type}::${d.route}::${d.details}`;
    if (!uniqueKeys.has(key)) {
      uniqueKeys.add(key);
      uniqueDefects.push(d);
    }
  }

  console.log(`Total Unique Responsive Defects: ${uniqueDefects.length}`);
  for (const d of uniqueDefects) {
    console.log(`- [${d.type.toUpperCase()}] ${d.route} (${d.viewport}): ${d.details}`);
  }

  return uniqueDefects;
}

runAudit()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Audit failed:", e);
    process.exit(1);
  });
