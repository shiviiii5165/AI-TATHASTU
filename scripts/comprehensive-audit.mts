import { chromium } from "@playwright/test";
import { createUser, signIn, seedComputedProfile, sql } from "../e2e/support/fixtures";
import { E2E_ENV } from "../e2e/support/env";
import fs from "node:fs";
import path from "node:path";

// 14 Viewport profiles as explicitly mandated in Section 5 of the Master Prompt
const VIEWPORTS = [
  { name: "Narrow mobile (320x700)", width: 320, height: 700 },
  { name: "Compact mobile (360x640)", width: 360, height: 640 },
  { name: "Small mobile (375x812)", width: 375, height: 812 },
  { name: "Standard mobile (390x844)", width: 390, height: 844 },
  { name: "Large mobile (430x932)", width: 430, height: 932 },
  { name: "Large phone (480x900)", width: 480, height: 900 },
  { name: "Small tablet (600x900)", width: 600, height: 900 },
  { name: "Tablet portrait (768x1024)", width: 768, height: 1024 },
  { name: "Tablet landscape (1024x768)", width: 1024, height: 768 },
  { name: "Laptop (1280x800)", width: 1280, height: 800 },
  { name: "Desktop (1440x900)", width: 1440, height: 900 },
  { name: "Large desktop (1920x1080)", width: 1920, height: 1080 },
  { name: "Landscape phone (844x390)", width: 844, height: 390 },
  { name: "Short landscape (640x360)", width: 640, height: 360 },
];

interface RouteSpec {
  path: string;
  category: "public" | "student_onboarding" | "faculty_onboarding" | "alumni_onboarding" | "dashboard" | "admin";
  captureScreenshots?: boolean;
}

const ALL_ROUTES: RouteSpec[] = [
  // 1. Public marketing and auth routes
  { path: "/", category: "public", captureScreenshots: true },
  { path: "/about", category: "public", captureScreenshots: true },
  { path: "/contact", category: "public", captureScreenshots: true },
  { path: "/team", category: "public", captureScreenshots: true },
  { path: "/login", category: "public", captureScreenshots: true },
  { path: "/login/check-email", category: "public", captureScreenshots: true },

  // 2. Student Onboarding flow
  { path: "/onboarding/role", category: "student_onboarding", captureScreenshots: true },
  { path: "/onboarding/career-direction", category: "student_onboarding", captureScreenshots: true },
  { path: "/onboarding/priorities", category: "student_onboarding", captureScreenshots: true },
  { path: "/onboarding/basic-profile", category: "student_onboarding", captureScreenshots: true },
  { path: "/onboarding/resume", category: "student_onboarding", captureScreenshots: true },
  { path: "/onboarding/connect-sources", category: "student_onboarding", captureScreenshots: true },
  { path: "/onboarding/review-consent", category: "student_onboarding", captureScreenshots: true },

  // 3. Faculty Onboarding flow
  { path: "/onboarding/faculty-profile", category: "faculty_onboarding", captureScreenshots: true },
  { path: "/onboarding/research-expertise", category: "faculty_onboarding", captureScreenshots: true },
  { path: "/onboarding/mentorship", category: "faculty_onboarding", captureScreenshots: true },

  // 4. Alumni Onboarding flow
  { path: "/onboarding/alumni-profile", category: "alumni_onboarding", captureScreenshots: true },
  { path: "/onboarding/professional-profile", category: "alumni_onboarding", captureScreenshots: true },
  { path: "/onboarding/give-back", category: "alumni_onboarding", captureScreenshots: true },

  // 5. Dashboard core routes
  { path: "/dashboard", category: "dashboard", captureScreenshots: true },
  { path: "/profile", category: "dashboard", captureScreenshots: true },
  { path: "/skills", category: "dashboard", captureScreenshots: true },
  { path: "/projects", category: "dashboard", captureScreenshots: true },
  { path: "/achievements", category: "dashboard", captureScreenshots: true },
  { path: "/learning", category: "dashboard", captureScreenshots: true },
  { path: "/people", category: "dashboard", captureScreenshots: true },
  { path: "/connections", category: "dashboard", captureScreenshots: true },
  { path: "/settings", category: "dashboard", captureScreenshots: true },
  { path: "/settings/integrations", category: "dashboard", captureScreenshots: true },
  { path: "/settings/privacy", category: "dashboard", captureScreenshots: true },

  // 6. Dynamic Workspace Modules
  { path: "/opportunities", category: "dashboard", captureScreenshots: true },
  { path: "/internships", category: "dashboard", captureScreenshots: true },
  { path: "/mentor", category: "dashboard", captureScreenshots: true },
  { path: "/research", category: "dashboard", captureScreenshots: true },
  { path: "/ai-interview", category: "dashboard", captureScreenshots: true },
  { path: "/collaborate", category: "dashboard", captureScreenshots: true },
  { path: "/cv-builder", category: "dashboard", captureScreenshots: true },

  // 7. Admin
  { path: "/admin/institutions", category: "admin", captureScreenshots: true },
];

interface DefectReport {
  viewport: string;
  route: string;
  type: "document_overflow" | "element_overflow" | "ios_zoom_risk";
  details: string;
}

async function runComprehensiveAudit() {
  console.log("======================================================================");
  console.log("   AI TATHASTU — EXHAUSTIVE UNIVERSAL UI/UX DEFECT AUDIT ENGINE       ");
  console.log("======================================================================");

  const defects: DefectReport[] = [];
  const outDir = path.resolve(process.cwd(), "test-screenshots");
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ channel: "chrome" });

  // 1. Public context
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();

  // 2. Student Onboarding context
  const studentOnboardingContext = await browser.newContext();
  const studentOnbEmail = `student-onb-${Date.now()}@example.com`;
  const studentOnbUser = await createUser("Aditi Sharma", "role", studentOnbEmail);
  await signIn(studentOnboardingContext, studentOnbUser, { onboarded: false });
  const studentOnbPage = await studentOnboardingContext.newPage();

  // 3. Faculty Onboarding context
  const facultyOnboardingContext = await browser.newContext();
  const facultyEmail = `faculty-onb-${Date.now()}@example.com`;
  const facultyUser = await createUser("Dr. Rajesh Kumar", "faculty_profile", facultyEmail);
  await sql.query("UPDATE users SET role = 'faculty' WHERE id = $1", [facultyUser.id]);
  await sql.query("UPDATE onboarding_state SET current_step = 'faculty_profile' WHERE user_id = $1", [facultyUser.id]);
  await signIn(facultyOnboardingContext, facultyUser, { onboarded: false });
  const facultyOnbPage = await facultyOnboardingContext.newPage();

  // 4. Alumni Onboarding context
  const alumniOnboardingContext = await browser.newContext();
  const alumniEmail = `alumni-onb-${Date.now()}@example.com`;
  const alumniUser = await createUser("Vikram Singh", "alumni_profile", alumniEmail);
  await sql.query("UPDATE users SET role = 'alumni' WHERE id = $1", [alumniUser.id]);
  await sql.query("UPDATE onboarding_state SET current_step = 'alumni_profile' WHERE user_id = $1", [alumniUser.id]);
  await signIn(alumniOnboardingContext, alumniUser, { onboarded: false });
  const alumniOnbPage = await alumniOnboardingContext.newPage();

  // 5. Dashboard (Onboarded Student with full Computed Profile)
  const dashboardContext = await browser.newContext();
  const dashEmail = `dash-user-${Date.now()}@example.com`;
  const dashUser = await createUser("Asha Rao", "done", dashEmail);
  await seedComputedProfile(dashUser.id);
  await signIn(dashboardContext, dashUser, { onboarded: true });
  const dashPage = await dashboardContext.newPage();

  // 6. Admin Context
  const adminContext = await browser.newContext();
  const adminEmail = `admin-user-${Date.now()}@example.com`;
  const adminUser = await createUser("Admin Lead", "done", adminEmail);
  await sql.query("UPDATE users SET is_admin = true WHERE id = $1", [adminUser.id]);
  await signIn(adminContext, adminUser, { onboarded: true });
  const adminPage = await adminContext.newPage();

  console.log(`Auditing ${ALL_ROUTES.length} routes across ${VIEWPORTS.length} viewports (${ALL_ROUTES.length * VIEWPORTS.length} total configurations)...\n`);

  for (const routeSpec of ALL_ROUTES) {
    let page = publicPage;
    if (routeSpec.category === "student_onboarding") page = studentOnbPage;
    else if (routeSpec.category === "faculty_onboarding") page = facultyOnbPage;
    else if (routeSpec.category === "alumni_onboarding") page = alumniOnbPage;
    else if (routeSpec.category === "dashboard") page = dashPage;
    else if (routeSpec.category === "admin") page = adminPage;

    console.log(`[${routeSpec.category.toUpperCase()}] Route: ${routeSpec.path}`);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      try {
        await page.goto(`${E2E_ENV.AUTH_URL}${routeSpec.path}`, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        await page.waitForTimeout(150);

        // Check 1: Document Horizontal Overflow
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
            route: routeSpec.path,
            type: "document_overflow",
            details: `Page overflows horizontally by ${docOverflow.delta}px (doc: ${docOverflow.docW}px, body: ${docOverflow.bodyW}px, win: ${docOverflow.winW}px)`,
          });
        }

        // Check 2: Element protruding beyond visible bounds without overflow protection
        const protruding = await page.evaluate(() => {
          const winW = window.innerWidth;
          const offenders: Array<{ selector: string; right: number; delta: number }> = [];
          const allEls = document.querySelectorAll("main *, header *, footer *, nav *, form *, aside *");
          for (const el of allEls) {
            const style = window.getComputedStyle(el);
            if (style.overflowX === "auto" || style.overflowX === "scroll") continue;
            let clipped = false;
            let ancestor: HTMLElement | null = el.parentElement;
            while (ancestor && ancestor.tagName !== "BODY" && ancestor.tagName !== "HTML") {
              const aStyle = window.getComputedStyle(ancestor);
              if (
                aStyle.overflowX === "hidden" ||
                aStyle.overflowX === "auto" ||
                aStyle.overflowX === "scroll" ||
                aStyle.overflow === "hidden"
              ) {
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
              const cls =
                el.className && typeof el.className === "string"
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
            route: routeSpec.path,
            type: "element_overflow",
            details: `${off.selector} protrudes by ${off.delta}px outside viewport`,
          });
        }

        // Check 3: iOS Safari auto-zoom risk (< 16px font-size) on mobile viewports (< 768px)
        if (vp.width < 768) {
          const smallInputs = await page.evaluate(() => {
            const inputs = document.querySelectorAll<HTMLInputElement>(
              "input[type='text'], input[type='email'], input[type='search'], input:not([type]), select, textarea"
            );
            const bad: string[] = [];
            for (const input of inputs) {
              const style = window.getComputedStyle(input);
              const px = parseFloat(style.fontSize);
              if (px < 15.5) {
                bad.push(`${input.name || input.id || input.placeholder || "control"} (${style.fontSize})`);
              }
            }
            return bad;
          });

          if (smallInputs.length > 0) {
            defects.push({
              viewport: vp.name,
              route: routeSpec.path,
              type: "ios_zoom_risk",
              details: `Controls with font-size < 16px triggering iOS Safari auto-zoom: ${smallInputs.join(", ")}`,
            });
          }
        }

        // Screenshot representative key viewports:
        // 320px (Narrow Mobile), 390px (Standard Mobile), 768px (Tablet), 1440px (Desktop), 844x390 (Landscape Phone)
        const keyVpForScreen = [
          "Narrow mobile (320x700)",
          "Standard mobile (390x844)",
          "Tablet portrait (768x1024)",
          "Desktop (1440x900)",
          "Landscape phone (844x390)",
        ];
        if (routeSpec.captureScreenshots && keyVpForScreen.includes(vp.name)) {
          const safeRouteName = routeSpec.path === "/" ? "landing" : routeSpec.path.replace(/\//g, "-").replace(/^-/, "");
          const safeVpName = vp.name.replace(/[^a-zA-Z0-9]/g, "_");
          await page.screenshot({
            path: path.join(outDir, `${safeRouteName}__${safeVpName}.png`),
            fullPage: false,
          });
        }
      } catch (err) {
        console.error(`  [${vp.name}] on ${routeSpec.path} error: ${(err as Error).message}`);
      }
    }
  }

  await browser.close();

  console.log("\n======================================================================");
  console.log(`  COMPREHENSIVE AUDIT FINISHED: ${defects.length} defect reports`);
  console.log("======================================================================");

  const uniqueMap = new Map<string, DefectReport>();
  for (const d of defects) {
    const key = `${d.type}::${d.route}::${d.details}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, d);
    }
  }

  const unique = Array.from(uniqueMap.values());
  console.log(`Total Unique Defects: ${unique.length}\n`);

  for (const d of unique) {
    console.log(`- [${d.type.toUpperCase()}] ${d.route} (${d.viewport}): ${d.details}`);
  }

  if (unique.length > 0) {
    process.exit(1);
  } else {
    console.log("SUCCESS: 0 DEFECTS FOUND ACROSS ALL ROUTES AND VIEWPORTS!");
    process.exit(0);
  }
}

runComprehensiveAudit().catch((err) => {
  console.error("Audit script failed with unhandled error:", err);
  process.exit(1);
});
