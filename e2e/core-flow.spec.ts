/**
 * Phases 1–3, end to end, in a real browser against the real app:
 * sign-in → Steps 1–3 → resume upload (presigned PUT to the fake R2) →
 * extraction (fake worker) → review → Step 5 → Step 6 → dashboard built from
 * the mocked profile_views document → dismiss a widget.
 *
 * Each step's outcome is also checked in Postgres, so a UI that looks right
 * but doesn't persist fails here.
 */
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

import { expect, test, type Page } from "@playwright/test";

import { E2E_ENV } from "./support/env";
import {
  completeIntelligence,
  completeResumeExtraction,
  countRows,
  createUser,
  mockResumePdf,
  onboarding,
  signIn,
  sql,
  type TestUser,
} from "./support/fixtures";

const continueButton = (page: Page) => page.getByRole("button", { name: "Continue", exact: true });

test("Phase 1–3 journey: onboarding to a personalized dashboard", async ({ page, context }) => {
  const user = await createUser();
  await signIn(context, user);

  await test.step("an unfinished user is kept out of the dashboard", async () => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/onboarding\/career-direction$/);
  });

  await test.step("Step 1: career direction", async () => {
    const card = page.getByRole("button", { name: /^ML Engineer/ });
    await card.click();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await onboarding(user.id))?.career_role).toBe("ml_engineer");
    await continueButton(page).click();
    await expect(page).toHaveURL(/\/onboarding\/priorities$/);
  });

  await test.step("Step 2: priorities", async () => {
    await page.getByRole("button", { name: /^Internships & Jobs/ }).click();
    await page.getByRole("button", { name: /^Learn AI & ML/ }).click();
    await expect.poll(async () => (await onboarding(user.id))?.priorities).toEqual(["avasar_jobs", "learn_ai_ml"]);
    await continueButton(page).click();
    await expect(page).toHaveURL(/\/onboarding\/basic-profile$/);
  });

  await test.step("Step 3: basic profile (catalogue picks)", async () => {
    await page.getByLabel("Full name").fill(user.name);
    const institution = page.getByRole("combobox", { name: "University or college" });
    await institution.fill("IIT Madras");
    await expect(page.getByRole("option", { name: /Indian Institute of Technology Madras/ })).toBeVisible();
    await institution.press("Enter");
    // Location comes from the institution and is read-only.
    await expect(page.getByLabel("City")).toHaveValue("Chennai");
    await expect(page.getByLabel("Country")).toHaveValue("India");
    await expect(page.getByLabel("City")).toHaveAttribute("readonly", "");

    await page.getByRole("combobox", { name: "Degree" }).click();
    await page.getByRole("option", { name: "B.Tech / B.E." }).click();
    await page.getByRole("combobox", { name: "Specialization" }).click();
    await page.getByRole("option", { name: "Computer Science and Engineering" }).click();
    await page.getByRole("combobox", { name: "Current year" }).click();
    await page.getByRole("option", { name: "3rd year" }).click();
    await expect(page.getByRole("combobox", { name: "Expected graduation" })).not.toHaveText(/Select a year/); // suggested
    await continueButton(page).click();
    await expect(page).toHaveURL(/\/onboarding\/resume$/);

    const saved = await sql.query(
      `SELECT u.name, u.university, u.degree, u.specialization, u.academic_year, u.city, u.country, u.current_academic_year,
              u.expected_graduation_year IS NOT NULL AS has_grad, i.canonical_name AS institution, d.canonical_name AS degree_name
         FROM users u JOIN institutions i ON i.id = u.institution_id JOIN degrees d ON d.id = u.degree_id WHERE u.id = $1`,
      [user.id],
    );
    expect(saved.rows[0]).toEqual({
      name: user.name, university: "Indian Institute of Technology Madras", degree: "B.Tech / B.E.",
      specialization: "Computer Science and Engineering", academic_year: "3rd year", city: "Chennai", country: "India",
      current_academic_year: "3rd year", has_grad: true, institution: "Indian Institute of Technology Madras", degree_name: "B.Tech / B.E.",
    });
    expect(
      await countRows(
        "SELECT count(*) AS n FROM profile_facts WHERE user_id = $1 AND field_group = 'identity' AND origin = 'user_entered' AND confirmation = 'confirmed'",
        [user.id],
      ),
    ).toBe(7);
  });

  await test.step("Step 4: upload a resume (presigned PUT to fake R2, fake extraction)", async () => {
    const pdf = mockResumePdf([user.name, "ML Engineer intern, Acme AI", "PyTorch, Python, SQL", "Resume Parser"]);
    await page.locator('input[type="file"]').setInputFiles({ name: "asha-rao-cv.pdf", mimeType: "application/pdf", buffer: pdf });

    // The app only queues extraction after HeadObject confirms the bytes reached storage.
    await expect(page.getByRole("list", { name: "Processing progress" })).toBeVisible();
    const file = await sql.query("SELECT size_bytes, mime FROM files WHERE user_id = $1", [user.id]);
    expect(file.rows).toEqual([{ size_bytes: pdf.length, mime: "application/pdf" }]);

    await completeResumeExtraction(user.id, mockFacts());
    await page.getByRole("link", { name: "Review what we found" }).click();
    await expect(page).toHaveURL(/\/onboarding\/resume\/review$/);
  });

  await test.step("Step 4b: approve the extracted facts", async () => {
    const highCount = mockFacts().filter((f) => f.confidence >= 0.85).length;
    await page.getByRole("button", { name: `Confirm all high confidence (${highCount})` }).click();
    await expect(page.getByRole("button", { name: "High confidence confirmed" })).toBeDisabled();
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/\/onboarding\/connect-sources$/);

    const byState = await sql.query(
      "SELECT confirmation, count(*)::int AS n FROM profile_facts WHERE user_id = $1 AND origin = 'resume' GROUP BY 1 ORDER BY 1",
      [user.id],
    );
    // High-confidence facts approved; the low-confidence one was left for later.
    expect(byState.rows).toEqual([
      { confirmation: "confirmed", n: highCount },
      { confirmation: "unconfirmed", n: mockFacts().length - highCount },
    ]);
  });

  await test.step("Step 5: connectors (skipped)", async () => {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/onboarding\/review-consent$/);
  });

  await test.step("Step 6: review and generate", async () => {
    await page.getByRole("button", { name: "Create my profile" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Personalizing your dashboard…")).toBeVisible();
    expect((await onboarding(user.id))?.current_step).toBe("done");
  });

  await test.step("Phase 2 output lands; dashboard renders it", async () => {
    await completeIntelligence(user.id);
    expectPhase2Verified(user);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Good to see you, Asha\./, { timeout: 30_000 });
    await expect(page.getByText("Built around ML Engineer · Internships & Jobs first")).toBeVisible();

    const eris = widget(page, "Interview readiness");
    await expect(eris.getByRole("meter", { name: "Interview readiness" })).toHaveAttribute("aria-valuenow", "63");
    await expect(eris).toContainText("for ML Engineer");
    await expect(eris.getByRole("link", { name: /Kubernetes\s*20%/ })).toBeVisible();
    await expect(eris.getByText("Not scored")).toBeVisible(); // problem_solving missing from the breakdown

    const github = widget(page, "Recent GitHub work");
    await expect(github).toContainText("2 repositories");
    // Newest commit first; links go to the repository on GitHub.
    const repos = github.getByRole("link", { name: /opens GitHub/ });
    await expect(repos).toHaveText([/^resume-parser/, /^mnist-from-scratch/]);
    await expect(repos.first()).toHaveAttribute("href", "https://github.com/asha/resume-parser");

    const gaps = widget(page, "Skills to develop");
    await expect(gaps).toContainText("For ML Engineer: 2 skills missing or thin on your profile.");
    await expect(gaps.getByRole("link", { name: "Learn Kubernetes" })).toBeVisible();
    await expect(gaps.getByRole("link", { name: "Learn Docker" })).toBeVisible();

    // Widgets with data come first; the empty Avasar widget is last.
    const order = await page
      .getByRole("article")
      .filter({ has: page.getByRole("button", { name: /^Hide / }) }) // widgets, not other cards on the page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(order[0]).toBe("Interview readiness");
    expect(order.at(-1)).toBe("Jobs that fit you");
  });

  await test.step("dismissing a widget hides it, and it stays hidden", async () => {
    await widget(page, "Skills to develop").getByRole("button", { name: "Hide Skills to develop" }).click();
    await expect(widget(page, "Skills to develop")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "1 hidden widget" })).toBeVisible();
    await expect
      .poll(() => countRows("SELECT count(*) AS n FROM widget_prefs WHERE user_id = $1 AND widget_id = 'skill_gaps' AND dismissed", [user.id]))
      .toBe(1);

    await page.reload();
    await expect(widget(page, "Interview readiness")).toBeVisible();
    await expect(widget(page, "Skills to develop")).toHaveCount(0);
  });
});

const widget = (page: Page, label: string) => page.getByRole("article", { name: label, exact: true });

function mockFacts() {
  const job = randomUUID();
  const project = randomUUID();
  return [
    { group: "contact", field: "email", value: "asha.rao@example.com", confidence: 0.98 },
    { group: "skills", field: "skill", value: "PyTorch", confidence: 0.95, record: randomUUID() },
    { group: "skills", field: "skill", value: "Python", confidence: 0.95, record: randomUUID() },
    { group: "skills", field: "skill", value: "SQL", confidence: 0.9, record: randomUUID() },
    { group: "experience", field: "organization", value: "Acme AI", confidence: 0.92, record: job },
    { group: "experience", field: "role", value: "ML Engineer intern", confidence: 0.9, record: job },
    { group: "projects", field: "title", value: "Resume Parser", confidence: 0.88, record: project },
    { group: "projects", field: "technologies", value: "Python, PyTorch", confidence: 0.86, record: project },
    { group: "certifications", field: "name", value: "Deep Learning Specialization", confidence: 0.55, record: randomUUID() },
  ];
}

/** Runs scripts/verify-phase2.ts against the E2E database: it must pass for this user. */
function expectPhase2Verified(user: TestUser) {
  const out = execFileSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/verify-phase2.ts", user.id], {
    env: { ...process.env, DATABASE_URL: E2E_ENV.DATABASE_URL },
    encoding: "utf8",
  });
  expect(out).toContain("all checks passed");
}
