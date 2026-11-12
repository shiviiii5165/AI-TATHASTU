/**
 * Research opportunities, full student journey in the running app, on REAL listings ingested from live
 * official sources (scripts/e2e-seed-research.ts must have filled the E2E database first):
 * Discover → View details → Review eligibility → Apply → the official destination.
 * The external hop is verified by the redirect target (Location), so no third-party site is loaded.
 */
import { expect, test } from "@playwright/test";

import { E2E_ENV } from "./support/env";
import { createUser, seedComputedProfile, signIn, sql } from "./support/fixtures";

test("discover, read requirements and reach the official application destination", async ({ page, context, request }) => {
  const active = await sql.query(
    `SELECT o.id, o.title, o.organization, o.url, o.application_method, o.application_url, o.application_email
       FROM opportunities o JOIN opportunity_sources s ON s.id = o.source_id
      WHERE o.status = 'active' AND o.canonical_url > '' AND o.last_verified_at > now() - interval '30 days'
        AND (o.deadline_at IS NULL OR o.deadline_at > now())
      ORDER BY (o.application_method = 'portal') DESC, (o.application_method = 'email') DESC, o.title LIMIT 20`,
  );
  test.skip(active.rows.length === 0, "E2E database has no ingested research opportunities (run scripts/e2e-seed-research.ts)");

  const user = await createUser("Research Student", "done");
  await seedComputedProfile(user.id);
  await signIn(context, user, { onboarded: true });

  // 1. Discover: the listing page shows real, verified opportunities (no demo cards).
  await page.goto("/opportunities?section=all");
  await expect(page.getByRole("heading", { name: "Research opportunities" })).toBeVisible();
  const list = page.getByRole("list", { name: "All opportunities" });
  await expect(list.getByRole("listitem").first()).toBeVisible();
  const cards = await list.getByRole("listitem").count();
  expect(cards).toBeGreaterThan(0);
  await expect(page.getByText(/sample|lorem|demo listing/i)).toHaveCount(0);

  // Sections and filters are backed by the catalogue.
  await page.goto("/opportunities?section=jrf_srf");
  await expect(page.getByRole("link", { name: "JRF / SRF" })).toHaveAttribute("aria-current", "page");

  // 2. View details for a real listing.
  const target = active.rows[0] as { id: string; title: string; organization: string; url: string; application_method: string; application_url: string | null; application_email: string | null };
  await page.goto(`/opportunities/${target.id}`);
  await expect(page.getByRole("heading", { level: 1, name: target.title })).toBeVisible();
  await expect(page.getByText(target.organization).first()).toBeVisible();

  // 3. Review eligibility and requirements: published facts or an explicit "Not stated by the source".
  await expect(page.getByRole("heading", { name: "How this fits your profile" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Requirements (as published)" })).toBeVisible();
  await expect(page.getByText(/You confirm eligibility against the official announcement/)).toBeVisible();
  await expect(page.getByText(/%/).filter({ hasText: /match/i })).toHaveCount(0); // no match percentages

  // 4. Apply: source-aware, and only to a destination the source published.
  const howTo = page.locator("#how-to-apply");
  await expect(howTo).toBeVisible();
  if (target.application_method === "email") {
    await expect(howTo.getByText(target.application_email!)).toBeVisible();
  }
  const res = await request.get(`${E2E_ENV.AUTH_URL}/opportunities/${target.id}/apply`, { maxRedirects: 0, headers: { cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } });
  if (target.application_method === "portal" || target.application_method === "announcement") {
    expect(res.status()).toBe(303);
    const location = res.headers()["location"]!;
    const expected = target.application_method === "portal" ? target.application_url! : target.url;
    expect(location).toBe(new URL(expected).href); // the published destination, unchanged
    expect(new URL(location).pathname).not.toBe("/"); // never a generic homepage
  } else {
    expect(res.status()).toBe(303);
    expect(res.headers()["location"]).toContain(`/opportunities/${target.id}#how-to-apply`); // email: instructions, no redirect
  }

  // Tracking records what the student did, never an external submission.
  const kinds = (await sql.query("SELECT kind FROM opportunity_interactions WHERE user_id = $1 AND opportunity_id = $2", [user.id, target.id])).rows.map((r) => r.kind);
  expect(kinds).toContain("viewed");
  if (target.application_method !== "email") expect(kinds).toContain("opened_application");
  expect(kinds).not.toContain("confirmed_applied");

  // 5. Save with a reminder, then see it under Saved.
  await page.goto(`/opportunities/${target.id}`);
  await page.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByRole("button", { name: /Saved/ })).toBeVisible();
  await page.goto("/opportunities?section=saved");
  await expect(page.getByRole("link", { name: target.title }).first()).toBeVisible();
});

test("an expired or unknown opportunity is not shown and Apply does not redirect anywhere external", async ({ page, context, request }) => {
  const user = await createUser("Research Student Two", "done");
  await signIn(context, user, { onboarded: true });
  const closed = (await sql.query("SELECT id, title FROM opportunities WHERE status IN ('expired','withdrawn','unverified') LIMIT 1")).rows[0] as { id: string; title: string } | undefined;
  for (const id of [closed?.id, "00000000-0000-4000-8000-000000000000"].filter(Boolean) as string[]) {
    // Streamed pages send 200 before notFound() runs; what matters is the not-found page and no listing data.
    await page.goto(`/opportunities/${id}`);
    await expect(page.getByRole("heading", { name: "Nothing here." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "How to apply" })).toHaveCount(0);
    if (closed && id === closed.id) await expect(page.getByRole("heading", { level: 1, name: closed.title })).toHaveCount(0);
    const apply = await request.get(`${E2E_ENV.AUTH_URL}/opportunities/${id}/apply`, { maxRedirects: 0, headers: { cookie: (await context.cookies()).map((c) => `${c.name}=${c.value}`).join("; ") } });
    expect(apply.status()).toBe(303);
    expect(new URL(apply.headers()["location"]!, E2E_ENV.AUTH_URL).origin).toBe(new URL(E2E_ENV.AUTH_URL).origin);
  }
});
