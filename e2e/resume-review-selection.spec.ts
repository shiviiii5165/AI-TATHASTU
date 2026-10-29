/**
 * Resume review bulk selection: the "Select all to save" controls in the
 * summary bar and the sticky footer are two views of one state. Checked in a
 * real browser, with the save result checked in Postgres.
 */
import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { createUser, signIn, sql } from "./support/fixtures";

const FACTS = [
  { group: "contact", field: "email", value: "asha.rao@example.com", confidence: 0.95 }, // high
  { group: "experience", field: "organization", value: "Acme AI", confidence: 0.9 }, // high
  { group: "contact", field: "phone", value: "+919876543210", confidence: 0.7 }, // medium
  { group: "experience", field: "role", value: "ML Engineer intern", confidence: 0.65 }, // medium
  { group: "certifications", field: "name", value: "Deep Learning Specialization", confidence: 0.4 }, // low
];

async function seed(userId: string) {
  const job = randomUUID();
  for (const f of FACTS) {
    await sql.query(
      `INSERT INTO profile_facts
         (user_id, field_group, field_name, record_key, extracted_value, normalized_value, source_evidence,
          extraction_method, origin, confidence, validation_status, confirmation)
       VALUES ($1, $2, $3, $4, $5, $5, $6, 'llm', 'resume', $7, 'validated', 'unconfirmed')`,
      [userId, f.group, f.field, f.group === "experience" ? job : f.group === "contact" ? null : randomUUID(),
        JSON.stringify(f.value), f.value, f.confidence],
    );
  }
}

const row = (page: Page, value: string) => page.locator(`li:has(input[value="${value}"])`);
const rowSave = (page: Page, value: string) => row(page, value).getByRole("checkbox", { name: "Save" });
const top = (page: Page) => page.locator("#select-all-top");
const footer = (page: Page) => page.locator("#select-all-footer");
const counts = (page: Page) => page.getByTestId("review-counts");

/**
 * React streams the review form into a hidden `<div id="S:n">` and then swaps it into <main>, so for a
 * moment the page holds an invisible second copy. Settled = the control is visible in <main> and is the only copy.
 */
async function settled(page: Page) {
  await expect(page.locator("#step-content #select-all-footer")).toBeVisible();
  await expect(footer(page)).toHaveCount(1);
}

async function expectMaster(page: Page, state: "true" | "false" | "mixed") {
  await expect(top(page)).toHaveAttribute("aria-checked", state);
  await expect(footer(page)).toHaveAttribute("aria-checked", state);
}

test("Select all to save: synchronized controls, rejections kept, edits kept, failed save honest", async ({ page, context }) => {
  const user = await createUser("Asha Rao", "resume");
  await seed(user.id);
  await signIn(context, user);
  await page.goto("/onboarding/resume/review");
  await settled(page);

  await expect(page.getByText("Select all to save")).toHaveCount(2);
  await expect(page.getByText("Includes medium-confidence fields. Rejected fields stay excluded.")).toBeVisible();
  await expectMaster(page, "false");
  await expect(counts(page)).toHaveText("0 to save · 0 rejected · 5 not selected");

  await test.step("high-confidence confirm keeps working and makes both controls indeterminate", async () => {
    await page.getByRole("button", { name: "Confirm all high confidence (2)" }).click();
    await expectMaster(page, "mixed");
    await expect(counts(page)).toHaveText("2 to save · 0 rejected · 3 not selected");
  });

  await test.step("reject the low-confidence field and edit a medium one", async () => {
    await row(page, "Deep Learning Specialization").getByRole("button", { name: /^Reject/ }).click();
    await row(page, "ML Engineer intern").getByRole("textbox").fill("ML Engineer intern (edited)");
    await expect(counts(page)).toHaveText("3 to save · 1 rejected · 1 not selected");
  });

  await test.step("top control selects every eligible field and updates the footer", async () => {
    await top(page).click();
    await expectMaster(page, "true");
    await expect(counts(page)).toHaveText("4 to save · 1 rejected · 0 not selected");
    await expect(rowSave(page, "+919876543210")).toHaveAttribute("aria-checked", "true");
    await expect(rowSave(page, "Deep Learning Specialization")).toHaveAttribute("aria-checked", "false");
    await expect(rowSave(page, "Deep Learning Specialization")).toBeDisabled();
    await expect(page.getByRole("textbox").and(page.locator('[value="ML Engineer intern (edited)"]'))).toHaveCount(1);
  });

  await test.step("footer control deselects and updates the top; rejection and edit survive", async () => {
    await footer(page).click();
    await expectMaster(page, "false");
    await expect(counts(page)).toHaveText("0 to save · 1 rejected · 4 not selected");
    await expect(page.getByRole("button", { name: /^Undo reject/ })).toHaveCount(1);
    await expect(page.locator('input[value="ML Engineer intern (edited)"]')).toHaveCount(1);
  });

  await test.step("individual changes drive both controls", async () => {
    await footer(page).click();
    await expectMaster(page, "true");
    await rowSave(page, "+919876543210").click();
    await expectMaster(page, "mixed");
    await expect(counts(page)).toHaveText("3 to save · 1 rejected · 1 not selected");
    await rowSave(page, "+919876543210").click();
    await expectMaster(page, "true");
  });

  await test.step("a failed save shows the error and persists nothing", async () => {
    // Another tab decided one of these facts: the server refuses the whole review.
    await sql.query(
      "UPDATE profile_facts SET confirmation = 'confirmed' WHERE user_id = $1 AND field_name = 'name' AND origin = 'resume'",
      [user.id],
    );
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /Some fields changed since you opened this page/ })).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding\/resume\/review$/);
    const decided = await sql.query(
      "SELECT count(*)::int AS n FROM profile_facts WHERE user_id = $1 AND origin = 'resume' AND confirmation <> 'unconfirmed' AND field_name <> 'name'",
      [user.id],
    );
    expect(decided.rows[0].n).toBe(0);
    await sql.query(
      "UPDATE profile_facts SET confirmation = 'unconfirmed' WHERE user_id = $1 AND field_name = 'name' AND origin = 'resume'",
      [user.id],
    );
  });

  await test.step("save persists exactly the selected fields, the edit and the rejection", async () => {
    await page.getByRole("button", { name: "Save and continue" }).click();
    await expect(page).toHaveURL(/\/onboarding\/connect-sources$/);
    const saved = await sql.query(
      "SELECT field_name, confirmation, normalized_value FROM profile_facts WHERE user_id = $1 AND origin = 'resume' ORDER BY field_name",
      [user.id],
    );
    expect(saved.rows.map((r) => [r.field_name, r.confirmation])).toEqual([
      ["email", "confirmed"],
      ["name", "rejected"],
      ["organization", "confirmed"],
      ["phone", "confirmed"],
      ["role", "edited"],
    ]);
    expect(saved.rows.find((r) => r.field_name === "role")?.normalized_value).toBe("ML Engineer intern (edited)");
  });
});

test("keyboard focus is never hidden behind the sticky footer (WCAG 2.4.11)", async ({ page, context }) => {
  const user = await createUser("Asha Rao", "resume");
  await seed(user.id);
  await signIn(context, user);
  await page.setViewportSize({ width: 1024, height: 700 });
  await page.goto("/onboarding/resume/review");
  await settled(page);
  // The router can move focus once after hydration; retry until our starting point holds.
  await expect(async () => {
    await page.locator("#select-all-top").focus();
    await expect(page.locator("#select-all-top")).toBeFocused({ timeout: 500 });
  }).toPass();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    const hidden = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const bar = document.querySelector("#select-all-footer")!.closest("div.sticky")!;
      if (!el || el === document.body || bar.contains(el) || el.getBoundingClientRect().width <= 1) return null; // body / sr-only
      return el.getBoundingClientRect().bottom > bar.getBoundingClientRect().top + 1 ? el.outerHTML.slice(0, 80) : null;
    });
    expect(hidden, `focus ${i} under the footer`).toBeNull();
  }
});

test("dark mode: indeterminate master and footer stay visible", async ({ page, context }) => {
  await page.addInitScript(() => localStorage.setItem("ai-tathastu-theme", "dark"));
  const user = await createUser("Asha Rao", "resume");
  await seed(user.id);
  await signIn(context, user);
  await page.goto("/onboarding/resume/review");
  await settled(page);
  await page.getByRole("button", { name: "Confirm all high confidence (2)" }).click();
  await expect(footer(page)).toHaveAttribute("aria-checked", "mixed");
  const s = await page.evaluate(() => {
    const box = document.querySelector("#select-all-footer")!;
    const bar = box.closest("div.sticky")!;
    return { box: getComputedStyle(box).backgroundColor, fg: getComputedStyle(box).color, bar: getComputedStyle(bar).backgroundColor };
  });
  expect(s.box).not.toBe(s.fg); // minus icon contrasts with its fill
  expect(s.bar).not.toMatch(/^oklab\(0\.99|^rgba?\(255, 255, 255/); // footer is not the light-theme white
});

// Basic Profile, Resume Upload and Resume Review share one centred frame inside the workspace.
for (const width of [1440, 1280, 1024, 768, 430, 390, 375, 320]) {
  test(`onboarding frame and footer at ${width}px`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: width >= 1024 ? 900 : 800 });
    const user = await createUser("Asha Rao", "resume");
    await seed(user.id);
    await signIn(context, user);

    const frames: Record<string, { left: number; right: number }> = {};
    for (const [name, path] of [["upload", "/onboarding/resume"], ["review", "/onboarding/resume/review"]] as const) {
      await page.goto(path);
      await expect(page.locator("main h1")).toBeVisible();
      // Step content streams in after the header.
      await expect(page.getByRole("button", { name: name === "upload" ? "Skip for now" : "Save and continue" })).toBeVisible();
      const m = await page.evaluate(() => {
        const main = document.querySelector("main")!.getBoundingClientRect();
        const header = document.querySelector("main header")!.getBoundingClientRect();
        const overflow = [...document.querySelectorAll("main *")].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > window.innerWidth + 1;
        }).length;
        return { mainL: main.left, mainR: main.right, left: header.left, right: header.right, overflow, sw: document.documentElement.scrollWidth };
      });
      frames[name] = m;
      expect(m.overflow, `${name}: elements past the viewport`).toBe(0);
      expect(m.sw).toBeLessThanOrEqual(width);
      // Centred in the workspace: equal space either side (±2px).
      expect(Math.abs(m.left - m.mainL - (m.mainR - m.right))).toBeLessThanOrEqual(2);
    }

    // Upload and review share the same centre line.
    const centre = (f: { left: number; right: number }) => (f.left + f.right) / 2;
    expect(Math.abs(centre(frames.upload) - centre(frames.review))).toBeLessThanOrEqual(2);

    // The sticky footer never hides the last review row once scrolled to the end.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight - 1)).toBe(true);
    const covered = await page.evaluate(() => {
      const footerBar = document.querySelector("#select-all-footer")!.closest("div.sticky")!.getBoundingClientRect();
      const add = [...document.querySelectorAll("main section")].at(-1)!.getBoundingClientRect();
      return add.bottom > footerBar.top + 1;
    });
    expect(covered).toBe(false);
  });
}
