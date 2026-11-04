/**
 * "Sign in with AI Tathastu" for Collaborate, end to end: approval screen →
 * code on the app's callback → server-side token exchange → consent-filtered
 * ProfessionalProjectionV1 → changing consent in Settings → Integrations
 * takes effect at once → disconnect cuts access.
 */
import { createHash } from "node:crypto";

import { expect, test, type APIRequestContext } from "@playwright/test";

import { E2E_ENV, E2E_PORTS } from "./support/env";
import { createUser, seedComputedProfile, signIn, sql } from "./support/fixtures";

const CALLBACK = `http://127.0.0.1:${E2E_PORTS.r2}/collaborate/callback`;
const VERIFIER = "e2e-pkce-verifier-".padEnd(64, "x");
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const AUTHORIZE = `/integrations/authorize?client_id=collaborate&redirect_uri=${encodeURIComponent(CALLBACK)}&state=xyz&code_challenge=${CHALLENGE}&code_challenge_method=S256`;

const exchange = (request: APIRequestContext, code: string) =>
  request.post("/api/integrations/sso/token", {
    form: {
      grant_type: "authorization_code",
      code,
      code_verifier: VERIFIER,
      redirect_uri: CALLBACK,
      client_id: "collaborate",
      client_secret: E2E_ENV.INTEGRATION_COLLABORATE_CLIENT_SECRET,
    },
  });

const profile = async (request: APIRequestContext, token: string) =>
  request.get("/api/integrations/v1/profile", { headers: { Authorization: `Bearer ${token}` } });

test("Collaborate: SSO, consent-filtered profile, settings and disconnect", async ({ page, context, request }) => {
  await sql.query("UPDATE feature_flags SET enabled = true WHERE key = 'collaborate_profile_api'");
  const user = await createUser("Asha Rao", "done");
  await seedComputedProfile(user.id);
  await signIn(context, user, { onboarded: true });

  let token = "";
  await test.step("approval screen: choose what to share, then back to the app with a code", async () => {
    await page.goto(AUTHORIZE);
    await expect(page.getByRole("heading", { name: "Sign in to Collaborate" })).toBeVisible();
    // Nothing is pre-enabled: every optional scope starts off.
    for (const sw of await page.getByRole("switch").all()) await expect(sw).not.toBeChecked();
    await expect(page.getByText("Requested by Collaborate").first()).toBeVisible();
    const eris = page.getByRole("switch", { name: /Share ERIS readiness score/ });
    await expect(eris).toBeDisabled(); // ERIS needs skills
    await page.getByRole("switch", { name: /Share verified skills/ }).click();
    await eris.click();
    await expect(eris).toBeChecked();
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await page.waitForURL((url) => url.href.startsWith(CALLBACK));

    const url = new URL(page.url());
    expect(url.searchParams.get("state")).toBe("xyz");
    const code = url.searchParams.get("code")!;
    const res = await exchange(request, code);
    expect(res.status()).toBe(200);
    token = (await res.json()).access_token;
    expect((await exchange(request, code)).status()).toBe(400); // single use
  });

  await test.step("the profile carries exactly what was shared", async () => {
    const p = await (await profile(request, token)).json();
    expect(p).toMatchObject({ schema: "ProfessionalProjectionV1", audience: "collaborate", identity: { id: user.id } });
    expect(p.skills.erisReadiness.score).toBe(0.63);
    expect(p.projects).toBeNull(); // requested by Collaborate, but not turned on
    expect(p.experience).toBeNull();
  });

  await test.step("Settings → Integrations: turning ERIS off masks it immediately", async () => {
    await page.goto("/settings/integrations");
    const card = page.getByRole("article", { name: "Collaborate" });
    await expect(card).toContainText("Connected");
    await card.getByRole("switch", { name: /Share ERIS readiness score/ }).click();
    await expect(card.getByText("Saved")).toBeVisible();
    const p = await (await profile(request, token)).json();
    expect(p.skills.erisReadiness).toBeNull();
    expect(p.privacy.masked).toContain("skills.erisReadiness");
  });

  await test.step("already approved: signing in again skips the screen", async () => {
    await page.goto(AUTHORIZE);
    await page.waitForURL((url) => url.href.startsWith(CALLBACK) && url.searchParams.has("code"));
  });

  const events = async () =>
    (await (await request.get(`http://127.0.0.1:${E2E_PORTS.r2}/collaborate/webhook/events`)).json()) as {
      delivery: string; type: string; data: { userId: string; reason?: string; profile?: { skills: { erisReadiness: unknown } | null } };
    }[];

  await test.step("Sync profile: a signed profile.updated reaches the app's receiver and is accepted", async () => {
    await page.goto("/settings/integrations");
    const card = page.getByRole("article", { name: "Collaborate" });
    await card.getByRole("button", { name: "Sync profile" }).click();
    await expect(card.getByText("Sent to Collaborate.")).toBeVisible();
    const synced = (await events()).filter((e) => e.type === "profile.updated" && e.data.userId === user.id);
    expect(synced.length).toBeGreaterThan(0);
    const last = synced.at(-1)!;
    expect(last.data.profile?.skills?.erisReadiness).toBeNull(); // consent at send time: ERIS was turned off
    expect(await sql.query("SELECT status FROM webhook_outbox WHERE id = $1", [last.delivery]).then((r) => r.rows[0]?.status)).toBe("delivered");
  });

  await test.step("disconnect: the app's token stops working at once", async () => {
    await page.goto("/settings/integrations");
    const card = page.getByRole("article", { name: "Collaborate" });
    await card.getByRole("button", { name: "Disconnect" }).click();
    await expect(card).toContainText("Disconnected");
    expect((await profile(request, token)).status()).toBe(401);
    // integration.revoked is sent after the response; it carries no profile.
    await expect.poll(async () => (await events()).some((e) => e.type === "integration.revoked" && e.data.userId === user.id)).toBe(true);
    expect((await events()).find((e) => e.type === "integration.revoked")?.data.profile).toBeUndefined();
  });
});
