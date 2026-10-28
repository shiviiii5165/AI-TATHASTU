/**
 * Personas: the Step 0 gate, the faculty and alumni flows end to end, the
 * persona-specific source lists and review rows, switching persona, and each
 * persona's dashboard (preview widgets ranked by the worker's view).
 */
import { expect, test, type Page } from "@playwright/test";

import { completeIntelligenceWithView, createUser, signIn, sql } from "./support/fixtures";

const cont = (page: Page) => page.getByRole("button", { name: "Continue", exact: true });

const widget = (id: string, label: string, score: number, state = "preview", data: unknown = null) => ({
  id, module: "x", label, score, components: { I: 1, G: 1, R: 1, F: 1 }, state, data,
});

function view(persona: "faculty" | "alumni", widgets: ReturnType<typeof widget>[]) {
  return {
    version: 1, computedAt: new Date().toISOString(), trigger: "onboarding_complete", persona,
    identity: { name: null, university: null, degree: null, careerRole: null },
    goals: { primaryRole: null, roles: [], roleOther: null, priorities: [] },
    skills: [], projects: [], erisScore: { overall: null, byRole: {}, gaps: [] },
    readinessIndicators: { resumeLinked: false, connectorsCount: 0, confirmedFacts: 0, profileComplete: 0.4 },
    widgets,
  };
}

const user = async (id: string) =>
  (await sql.query("SELECT role, department, academic_title, company, job_title, graduation_year FROM users WHERE id = $1", [id])).rows[0];

test("faculty: Step 0 → faculty flow → faculty dashboard", async ({ page, context }) => {
  const u = await createUser("Meera Iyer", "role");
  await signIn(context, u);

  await test.step("new users start at the persona gate", async () => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding\/role$/);
    await expect(page.getByRole("heading", { name: /Who are you/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /I am a Student/ })).toBeVisible();
    // Steps 1–6 stay locked until a persona is chosen.
    await page.goto("/onboarding/career-direction");
    await expect(page).toHaveURL(/\/onboarding\/role$/);
    await page.getByRole("button", { name: /I am a Faculty/ }).click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/faculty-profile$/);
    expect((await user(u.id)).role).toBe("faculty");
  });

  await test.step("Step 1: faculty profile (validated)", async () => {
    await expect(page.getByText("01 / 06 · Faculty profile")).toBeVisible();
    await cont(page).click(); // empty required fields
    await expect(page.getByText("Department is required.")).toBeVisible();
    await expect(page.getByText("Choose your institution, or pick Other / Not listed.")).toBeVisible();
    // Same catalogue combobox and dependent fields as students.
    const box = page.getByRole("combobox", { name: "University or college" });
    await box.click();
    await box.fill("IIT Madras");
    await expect(page.getByRole("option", { name: /Indian Institute of Technology Madras/ })).toBeVisible();
    await box.press("Enter");
    await expect(page.getByLabel("City")).toHaveValue("Chennai");
    await page.getByRole("combobox", { name: "Highest degree" }).click();
    await page.getByRole("option", { name: "Ph.D." }).click();
    await page.getByRole("combobox", { name: "Specialization" }).click();
    await page.getByRole("option", { name: "Computer Science and Engineering" }).click();
    await expect(page.getByRole("combobox", { name: "Current year" })).toHaveCount(0); // students only
    await page.getByLabel("Department").fill("Computer Science");
    await page.getByRole("combobox", { name: "Title" }).click();
    await page.getByRole("option", { name: "Assistant Professor" }).click();
    await cont(page).click();
    await expect(page).toHaveURL(/\/onboarding\/research-expertise$/);
    expect(await user(u.id)).toMatchObject({ department: "Computer Science", academic_title: "Assistant Professor" });
    const ids = (await sql.query(
      `SELECT i.canonical_name AS inst, d.canonical_name AS degree, u.university FROM users u
         JOIN institutions i ON i.id = u.institution_id JOIN degrees d ON d.id = u.degree_id WHERE u.id = $1`, [u.id])).rows[0];
    expect(ids).toEqual({ inst: "Indian Institute of Technology Madras", degree: "Ph.D.", university: "Indian Institute of Technology Madras" });
  });

  await test.step("Step 2: research interests, expertise areas, ORCID card", async () => {
    await expect(cont(page)).toBeDisabled();
    const input = page.getByLabel("Add a research interest");
    await input.fill("Multimodal learning");
    await input.press("Enter");
    await input.fill("Federated learning");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByRole("button", { name: "ML Engineer", exact: true }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(page.getByText("ORCID sign-in isn't set up yet.")).toBeVisible(); // no ORCID keys in this stack
    await cont(page).click();
    await expect(page).toHaveURL(/\/onboarding\/mentorship$/);
    const state = (await sql.query("SELECT research_interests, expertise_areas FROM onboarding_state WHERE user_id = $1", [u.id])).rows[0];
    expect(state).toEqual({ research_interests: ["Multimodal learning", "Federated learning"], expertise_areas: ["ml_engineer"] });
  });

  await test.step("Step 3: mentorship", async () => {
    await page.getByLabel("How many students can you mentor at a time?").fill("3");
    await page.getByLabel("I can review resumes").check();
    await cont(page).click();
    await expect(page).toHaveURL(/\/onboarding\/resume$/);
  });

  await test.step("Steps 4–5: resume optional; faculty sources", async () => {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/onboarding\/connect-sources$/);
    await expect(page.getByRole("article").getByRole("heading", { level: 2 })).toHaveText([
      "ORCID", "Google Scholar", "LinkedIn", "GitHub", "Portfolio or personal site",
    ]);
    await expect(page.getByRole("article", { name: "Google Scholar" })).toContainText("Coming soon");
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page).toHaveURL(/\/onboarding\/review-consent$/);
  });

  await test.step("Step 6: the review shows the faculty answers", async () => {
    await expect(page.getByText("Assistant Professor · Computer Science · Indian Institute of Technology Madras")).toBeVisible();
    await expect(page.getByText("Multimodal learning, Federated learning")).toBeVisible();
    await expect(page.getByText("Up to 3 students")).toBeVisible();
    await expect(page.getByText("Also reviews resumes")).toBeVisible();
    await page.getByRole("button", { name: "Create my profile" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  await test.step("dashboard: faculty widgets, ranked, as previews", async () => {
    await completeIntelligenceWithView(u.id, view("faculty", [
      widget("student_matches", "Students who match your expertise", 0.9),
      widget("mentee_requests", "Mentee requests", 0.8),
      widget("research_feed", "Papers and events", 0.6),
      // As the worker writes it: faculty completeness checks.
      widget("profile_completeness", "Finish your profile", 0.4, "ready", {
        percent: 40,
        checks: [
          { id: "research", label: "Add research interests", done: true },
          { id: "orcid", label: "Connect ORCID", done: false },
        ],
      }),
    ]));
    await expect(page.getByText("Assistant Professor, Computer Science")).toBeVisible({ timeout: 30_000 });
    const titles = await page
      .getByRole("article")
      .filter({ has: page.getByRole("button", { name: /^Hide / }) })
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(titles.slice(0, 3)).toEqual(["Students who match your expertise", "Mentee requests", "Papers and events in your areas"]);
    await expect(page.getByRole("article", { name: "Students who match your expertise" })).toContainText("Preview");
    expect(titles).not.toContain("Interview readiness");
    await expect(page.getByRole("article", { name: "Mentee requests" })).toContainText("Fills in when mentoring requests in Collaborate is connected.");
  });

  await test.step("matched students appear only with their discovery consent", async () => {
    // As compute_matches leaves them: two matched students, one discoverable.
    const visible = await createUser("Asha Rao", "done");
    const hidden = await createUser("Private Person", "done");
    for (const [s, score] of [[visible, 0.82], [hidden, 0.9]] as const) {
      await sql.query("INSERT INTO matches (student_id, mentor_id, kind, score, reasons) VALUES ($1, $2, 'faculty', $3, $4)", [
        s.id, u.id, score, JSON.stringify(["Researches Multimodal learning, close to your Deep Learning", "Same field (Computer Science and Engineering)"]),
      ]);
    }
    await sql.query("INSERT INTO consents (user_id, purpose, granted, policy_version) VALUES ($1, 'mentor_discovery', true, 'test')", [visible.id]);
    await page.reload();
    const card = page.getByRole("article", { name: "Students who match your expertise" });
    await expect(card).toContainText("Asha Rao");
    await expect(card).toContainText("82% fit");
    await expect(card).toContainText("Same field (Computer Science and Engineering)");
    await expect(card).not.toContainText("Private Person");
    await expect(card).toContainText("1 more matching student hasn't made their profile visible to mentors yet.");
    await expect(card).not.toContainText("Preview");
  });
});

test("alumni: switch persona from Student, then the alumni flow and dashboard", async ({ page, context }) => {
  const u = await createUser("Rohan Mehta", "role");
  await signIn(context, u);
  await page.goto("/onboarding/role");
  await page.getByRole("button", { name: /I am a Student/ }).click();
  await page.getByRole("button", { name: /Continue/ }).click();
  await expect(page).toHaveURL(/\/onboarding\/career-direction$/);

  await test.step("switch persona from the rail", async () => {
    await page.getByRole("link", { name: /^Student \(change\)/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/role$/);
    await expect(page.getByRole("button", { name: /I am a Student/ })).toBeVisible();
    await page.getByRole("button", { name: /I am an Alumni/ }).click();
    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page).toHaveURL(/\/onboarding\/alumni-profile$/);
    // The student flow is no longer reachable.
    await page.goto("/onboarding/priorities");
    await expect(page).toHaveURL(/\/onboarding\/alumni-profile$/);
  });

  await test.step("alumni profile, work, give back", async () => {
    const box = page.getByRole("combobox", { name: "University or college" });
    await box.click();
    await box.fill("IITM");
    await expect(page.getByRole("option", { name: /Indian Institute of Technology Madras/ })).toBeVisible();
    await box.press("Enter");
    // An alum choosing M.Tech gets M.Tech's specializations; no "current year".
    await page.getByRole("combobox", { name: "Degree" }).click();
    await page.getByRole("option", { name: "M.Tech" }).click();
    await page.getByRole("combobox", { name: "Specialization" }).click();
    await expect(page.getByRole("option", { name: "Civil Engineering" })).toHaveCount(0);
    await page.getByRole("option", { name: "VLSI Design" }).click();
    await expect(page.getByRole("combobox", { name: "Current year" })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Graduation year" }).click();
    await page.getByRole("option", { name: "2019", exact: true }).click();
    await cont(page).click();
    await expect(page).toHaveURL(/\/onboarding\/professional-profile$/);
    await page.getByLabel("Current company").fill("Acme AI");
    await page.getByLabel("Job title").fill("Staff ML Engineer");
    await page.getByRole("combobox", { name: "Closest area" }).click();
    await page.getByRole("option", { name: "ML Engineer", exact: true }).click();
    await cont(page).click();
    await expect(page).toHaveURL(/\/onboarding\/give-back$/);
    await page.getByLabel("Willing to refer for jobs").check();
    await cont(page).click();
    await expect(page).toHaveURL(/\/onboarding\/resume$/);
    expect(await user(u.id)).toMatchObject({ role: "alumni", company: "Acme AI", job_title: "Staff ML Engineer", graduation_year: 2019 });
    const facts = await sql.query(
      "SELECT field_group, field_name, normalized_value FROM profile_facts WHERE user_id = $1 AND record_key = 'alumni:current-role' AND superseded_by IS NULL ORDER BY field_name",
      [u.id],
    );
    expect(facts.rows.map((r) => [r.field_name, r.normalized_value])).toEqual([["end_date", "Present"], ["organization", "Acme AI"], ["role", "Staff ML Engineer"]]);
  });

  await test.step("alumni sources, review, dashboard", async () => {
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByRole("article").getByRole("heading", { level: 2 })).toHaveText([
      "LinkedIn", "GitHub", "Portfolio or personal site", "Kaggle", "Stack Exchange",
    ]);
    await page.getByRole("button", { name: "Skip for now" }).click();
    await expect(page.getByText("Staff ML Engineer · Acme AI")).toBeVisible();
    await expect(page.getByText("Job referrals")).toBeVisible();
    await page.getByRole("button", { name: "Create my profile" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await completeIntelligenceWithView(u.id, view("alumni", [
      widget("top_talent", "Top student talent", 0.9),
      widget("referral_requests", "Referral requests", 0.8),
      widget("alumni_network", "Your alumni network", 0.7),
    ]));
    await expect(page.getByText("Staff ML Engineer at Acme AI")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("article", { name: "Top student talent" })).toContainText("Preview");
    await expect(page.getByRole("article", { name: "Students who match your expertise" })).toHaveCount(0);
  });
});
