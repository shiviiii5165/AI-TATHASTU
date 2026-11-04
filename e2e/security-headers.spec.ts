/** Security headers from a real build, and the newsletter never claiming a sign-up it didn't make. */
import { expect, test } from "@playwright/test";

for (const path of ["/", "/login", "/api/integrations/jwks"]) {
  test(`security headers on ${path}`, async ({ request }) => {
    const headers = (await request.get(path)).headers();
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
}

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
