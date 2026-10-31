import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";

import { E2E_ENV } from "./support/env";
import { createUser } from "./support/fixtures";

const SESSION_COOKIE = "authjs.session-token";

test("session refresh updates the claim, keeps the cookie HttpOnly and re-issues no other cookie", async ({ request }) => {
  const user = await createUser("Cookie Check", "done");
  const value = await encode({
    token: { sub: user.id, email: user.email, onboarded: false },
    secret: E2E_ENV.AUTH_SECRET,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60,
  });

  const res = await request.get("/api/session/refresh", {
    maxRedirects: 0,
    headers: { cookie: `${SESSION_COOKIE}=${value}; ait_github_oauth=user.state.onboarding; tat_auth_email=someone%40example.com` },
  });
  expect(res.status()).toBe(307);
  expect(res.headers().location).toMatch(/\/dashboard$/);

  const cookies = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie").map((h) => h.value);
  const session = cookies.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  expect(session, "the refreshed session cookie reaches the browser").toBeTruthy();
  expect(session).toMatch(/;\s*HttpOnly/i);
  expect(session).toMatch(/;\s*SameSite=Lax/i);
  expect(session).toMatch(/;\s*Expires=|;\s*Max-Age=/i);

  // Cookies scoped elsewhere must not be copied to Path=/.
  expect(cookies.some((c) => c.startsWith("ait_github_oauth="))).toBe(false);
  expect(cookies.some((c) => c.startsWith("tat_auth_email="))).toBe(false);

  // The new cookie really carries the refreshed claim: /dashboard opens rather than bouncing to /onboarding.
  const next = await request.get("/dashboard", {
    maxRedirects: 0,
    headers: { cookie: session!.split(";")[0] },
  });
  expect(next.headers().location ?? "").not.toContain("/onboarding");
});
