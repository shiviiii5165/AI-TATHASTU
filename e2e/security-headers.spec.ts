/** Security headers from a real build, and the newsletter never claiming a sign-up it didn't make. */
import { expect, test } from "@playwright/test";

for (const path of ["/", "/login", "/api/integrations/jwks"]) {
  test(`security headers on ${path}`, async ({ request }) => {
    const headers = (await request.get(path)).headers();
    expect(headers["strict-transport-security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
}

test("pages never answer with wildcard CORS; COOP skips the embed popup flow", async ({ request }) => {
  const home = (await request.get("/")).headers();
  expect(home["access-control-allow-origin"]).toBe("https://www.aitathastu.com");
  expect(home["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
  // Collaborate/Avsar open /embed/authorize (via /login) and need window.opener.
  for (const path of ["/embed/authorize", "/login"]) {
    expect((await request.get(path)).headers()["cross-origin-opener-policy"], path).toBeUndefined();
  }
});

test("unknown root paths get the plain 404, never the dashboard shell", async ({ request }) => {
  for (const path of ["/robots.txt.bak", "/foo.xml", "/not-a-module"]) {
    const res = await request.get(path);
    expect(res.status(), path).toBe(404);
    const html = await res.text();
    expect(html, path).not.toContain("Sign out");
    expect(html, path).not.toContain("Ask Yora");
  }
  expect((await request.get("/robots.txt")).headers()["content-type"]).toContain("text/plain");
  expect(await (await request.get("/llms.txt")).text()).toMatch(/^# AI Tathastu/);
});

test("the signed-out app and internal APIs refuse access", async ({ request }) => {
  for (const path of ["/api/widget-prefs", "/api/dashboard/status", "/api/internal/queue-health"]) {
    expect((await request.get(path)).status(), path).toBe(401);
  }
  expect((await request.post("/api/internal/notify", { data: { jobId: "x" } })).status()).toBe(401);
  expect((await request.get("/api/internal/queue-health", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
});

test("the landing newsletter says it saved nothing", async ({ page }) => {
  await page.goto("/");
  await page.locator("#footerEmailInput").fill("person@example.com");
  const consent = page.locator("#footerConsentCheck");
  if (!(await consent.isChecked())) await consent.check({ force: true });
  await page.locator("#footerSubmitBtn").click();
  await expect(page.getByText("Newsletter sign-up isn't open yet, so your email wasn't saved.")).toBeVisible();
  await expect(page.getByText(/Thank you for subscribing/)).toHaveCount(0);
});
