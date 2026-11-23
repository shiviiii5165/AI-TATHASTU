// 36-attack matrix, round 2 (2026-11-23): attacks executed in a real browser / over HTTP against
// the isolated e2e stack (PGlite + fake R2, synthetic users only). Each test names its matrix row.
import { createHash, createHmac, randomUUID } from "node:crypto";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { E2E_ENV, E2E_PORTS } from "./support/env";
import { createUser, signIn, sql } from "./support/fixtures";

const SO = { "sec-fetch-site": "same-origin" };

// Every payload sets the same flag if it ever runs. CSP allows inline handlers ('unsafe-inline'),
// so an injected handler WOULD execute: a clean flag means the markup was never created.
const XSS = {
  img: `<img src=x onerror="window.__xss=(window.__xss||0)+1">`,
  svg: `<svg/onload=window.__xss=(window.__xss||0)+1>`,
  script: `"><script>window.__xss=(window.__xss||0)+1</script>`,
};
const MARK = "onerror=&quot;window.__xss"; // how React renders the escaped img payload in HTML

async function watchForXss(page: Page) {
  const dialogs: string[] = [];
  page.on("dialog", async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  return {
    dialogs,
    async fired() {
      await page.waitForLoadState("networkidle").catch(() => {});
      const flag = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss ?? 0);
      const injected = await page.evaluate(() => document.querySelectorAll('img[src="x"], svg[onload]').length);
      return { flag, injected, dialogs: dialogs.length };
    },
  };
}

// ── #23 Stored XSS (also #8 web-worm vector, #13 whaling via operator pages) ────────────────────
test.describe.serial("#23 stored XSS in a real browser", () => {
  let attacker: Awaited<ReturnType<typeof createUser>>;
  let postId = "";

  test("attacker stores payloads in their profile name and a published post (title, summary, role)", async ({ browser }) => {
    await sql.query("DELETE FROM users WHERE email = 'admin@e2e.test'");
    // A display name comes from the OAuth profile, so the attacker controls it.
    attacker = await createUser(`Mallory ${XSS.img}`, "done");
    const ctx = await browser.newContext();
    await signIn(ctx, attacker, { onboarded: true });
    const res = await ctx.request.post("/api/collaborations", {
      headers: SO,
      data: {
        publish: true,
        post: {
          category: "project",
          title: `XSS probe ${XSS.svg}`.slice(0, 120),
          summary: `Synthetic stored-XSS probe ${XSS.img} ${XSS.script} for the isolated security test.`,
          roles: [{ title: `Dev ${XSS.svg}`.slice(0, 60), count: 1 }],
          links: ["https://example.com/?q=%3Cscript%3E"],
        },
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    postId = (await res.json()).id;
    // javascript: links are refused at input (stored-XSS via href).
    const js = await ctx.request.post("/api/collaborations", {
      headers: SO,
      data: { publish: true, post: { category: "project", title: "JS link probe", summary: "Synthetic javascript: link probe for the security test.", roles: [{ title: "Dev", count: 1 }], links: ["javascript:window.__xss=1"] } },
    });
    expect(js.status(), "javascript: link rejected").toBe(400);
    await ctx.close();
  });

  for (const [who, path] of [
    ["victim user", "/collaborations"],
    ["victim user", "/people"],
    ["operator", "/admin/collaborations"],
    ["operator", "/admin/collaborations/{post}"],
    ["operator", "/admin/students/{attacker}"],
  ] as const) {
    test(`${who} viewing ${path} does not execute stored payloads`, async ({ browser }) => {
      // Reuse the operator if an earlier test created it: a duplicate-key error would leave the
      // PGlite socket unusable for the next query.
      const existing = who === "operator" ? (await sql.query<{ id: string }>("SELECT id FROM users WHERE email = 'admin@e2e.test'")).rows[0] : undefined;
      const viewer = existing
        ? ({ id: existing.id, email: "admin@e2e.test" } as Awaited<ReturnType<typeof createUser>>)
        : who === "operator"
          ? await createUser("Ops Viewer", "done", "admin@e2e.test")
          : await createUser(`Victim ${randomUUID().slice(0, 6)}`, "done");
      const ctx = await browser.newContext();
      await signIn(ctx, viewer, { onboarded: true });
      const page = await ctx.newPage();
      const xss = await watchForXss(page);
      const res = await page.goto(path.replace("{post}", postId).replace("{attacker}", attacker.id));
      expect(res?.status(), `reached ${path}`).toBeLessThan(400);
      const html = await page.content();
      const r = await xss.fired();
      expect(r, `no execution on ${path}`).toEqual({ flag: 0, injected: 0, dialogs: 0 });
      // Evidence the sink was reached: the payload is present, but as escaped text.
      test.info().annotations.push({ type: "payload-rendered-escaped", description: `${path}: ${html.includes(MARK) || html.includes("&lt;img src=x") || html.includes("&lt;svg/onload")}` });
      await ctx.close();
    });
  }

  test("payload text is shown inertly on the public listing (sink reached)", async ({ browser }) => {
    const ctx = await browser.newContext();
    await signIn(ctx, await createUser("Reader", "done"), { onboarded: true });
    const page = await ctx.newPage();
    await page.goto("/collaborations");
    await expect(page.getByText("XSS probe", { exact: false }).first()).toBeVisible();
    expect(await page.content()).toContain("&lt;svg/onload");
    await ctx.close();
  });
});

// ── #23 DOM-based XSS: URL fragment, query and javascript: sources in a real browser ────────────
test("#23 DOM XSS: fragment / query / javascript: sources never reach a sink", async ({ browser }) => {
  const ctx = await browser.newContext();
  await signIn(ctx, await createUser("Dom Victim", "done"), { onboarded: true });
  const page = await ctx.newPage();
  const xss = await watchForXss(page);
  const enc = encodeURIComponent;
  for (const url of [
    `/#${XSS.img}`,
    `/?q=${enc(XSS.script)}#${enc(XSS.svg)}`,
    `/login?callbackUrl=${enc("javascript:window.__xss=1")}`,
    `/embed/authorize?origin=${enc("javascript:window.__xss=1")}`,
    `/collaborations?q=${enc(XSS.img)}`,
    `/people?q=${enc(XSS.img)}`,
  ]) {
    await page.goto(url);
    // Click every link/button carrying a javascript: href if one were rendered.
    expect(await page.locator('a[href^="javascript:" i]').count(), `javascript: href on ${url}`).toBe(0);
    expect(await xss.fired(), url).toEqual({ flag: 0, injected: 0, dialogs: 0 });
  }
  // Landing-page "mint" input: name is typed into the page and echoed into a toast.
  await page.goto("/");
  const name = page.locator("#profNameInput");
  if (await name.count()) {
    await name.fill(XSS.img);
    await page.locator("#mintBtn, [id*=mint]").first().click({ trial: false }).catch(() => {});
    await page.waitForTimeout(1500);
    expect(await xss.fired(), "landing mint input").toEqual({ flag: 0, injected: 0, dialogs: 0 });
  }
  await ctx.close();
});

// ── #32 espionage / #26 token theft: embed token cannot be minted for an attacker origin ────────
test("#32 embed token is never issued to an unlisted origin", async ({ browser }) => {
  const ctx = await browser.newContext();
  await signIn(ctx, await createUser("Embed Victim", "done"), { onboarded: true });
  const res = await ctx.request.get(`/api/auth/embed-token?origin=${encodeURIComponent("https://evil.example")}`);
  expect(res.status()).toBe(400);
  expect(await res.text()).not.toContain("token\":\"ey");
  const page = await ctx.newPage();
  await page.goto(`/embed/authorize?origin=${encodeURIComponent("https://evil.example")}`);
  await expect(page.getByText("This site isn't allowed to show AI Tathastu profiles.")).toBeVisible();
  await ctx.close();
});

// ── #28 brute force + #13 whaling + #26 replay: admin TOTP, driven through the real page ────────
function totp(secretB32: string, nowMs = Date.now()) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secretB32.replace(/[\s=]/g, "").toUpperCase()) bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(nowMs / 1000 / 30)));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

test("#28 admin MFA: enrollment works, replay refused, brute force locked out even for the right code", async ({ browser }) => {
  await sql.query("DELETE FROM users WHERE email = 'admin@e2e.test'");
  const admin = await createUser("Mfa Operator", "done", "admin@e2e.test");
  const ctx: BrowserContext = await browser.newContext();
  await signIn(ctx, admin, { onboarded: true });
  const page = await ctx.newPage();

  await page.goto("/admin-mfa");
  await page.getByRole("button", { name: "Start setup" }).click();
  const secret = (await page.locator("code").first().textContent())!.trim();
  expect(secret.length).toBeGreaterThanOrEqual(16);

  // Ground truth is the server's own counter: wait until each submission has been counted, so a
  // stale error message from the previous attempt can't let clicks race ahead of the server.
  const KEY = `admin_mfa:${admin.id}`;
  const attempts = async () => Number((await sql.query<{ count: number }>("SELECT count FROM rate_limits WHERE key = $1", [KEY])).rows[0]?.count ?? 0);
  const submit = async (code: string) => {
    const before = await attempts();
    await page.getByLabel(/6-digit code/).fill(code);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect.poll(attempts, { timeout: 15_000 }).toBe(before + 1);
    await expect(page.getByRole("button", { name: "Verify" }).or(page.getByRole("heading", { name: "Save your recovery codes" }))).toBeEnabled();
  };
  // The limiter's 15-minute window is clock-aligned; don't let it roll over mid-test.
  const intoWindow = (Date.now() / 1000) % 900;
  if (intoWindow > 900 - 120) await page.waitForTimeout((900 - intoWindow + 2) * 1000);

  // Attempt 1 — control: the correct code enrolls and yields recovery codes.
  const first = totp(secret);
  await submit(first);
  // Regression (MFA-01): codes issued in the DB must also be SHOWN — the page used to remount the
  // form on confirm and drop them, leaving the operator with codes they never saw.
  const rc = await sql.query<{ n: number }>("SELECT count(*)::int AS n FROM admin_mfa_recovery_codes WHERE user_id = $1", [admin.id]);
  expect(rc.rows[0].n).toBe(10);
  await expect(page.getByRole("heading", { name: "Save your recovery codes" })).toBeVisible();
  await expect(page.locator("main li")).toHaveCount(10);

  // Attempt 2 — replay of the code just used: refused.
  await page.goto("/admin-mfa");
  await submit(first);
  await expect(page.locator("#code-error")).toContainText(/didn't work|Too many/);

  // Attempts 3–5 — guesses: refused.
  for (const guess of ["000000", "123456", "999999"]) {
    await submit(guess);
    await expect(page.locator("#code-error")).toContainText("didn't work");
  }
  // Attempt 6 — the CORRECT current code is refused: the limiter, not luck, stops guessing.
  expect(await attempts(), "five attempts counted by the server").toBe(5);
  const proof = async () => (await ctx.cookies()).find((c) => c.name === "ait_admin_mfa")?.value ?? null;
  const proofBefore = await proof();
  await page.waitForTimeout(Math.max(0, 31_000 - (Date.now() % 30_000))); // next time-step, so it isn't a replay
  await submit(totp(secret));
  await expect(page.locator("#code-error")).toContainText("Too many attempts");
  // And it didn't succeed: the locked-out attempt issued no new MFA proof and logged no pass.
  expect(await proof(), "no fresh MFA proof after lockout").toBe(proofBefore);

  // Insider/whaling evidence: every failure is in the admin audit log.
  const audit = await sql.query<{ action: string; n: string }>(
    "SELECT action, count(*)::text AS n FROM admin_audit_logs WHERE actor_id = $1 GROUP BY action",
    [admin.id],
  );
  const counts = Object.fromEntries(audit.rows.map((r) => [r.action, Number(r.n)]));
  expect(counts["admin.mfa_failed"], JSON.stringify(counts)).toBe(4); // replay + 3 guesses; the 6th never reached verification
  expect(counts["admin.mfa_enrolled"]).toBe(1);
  expect(counts["admin.mfa_passed"] ?? 0, "lockout attempt did not pass").toBe(0);
  await ctx.close();
});

// ── #26 session hijacking / #11 phishing redirect / #18 AitM-code-interception: SSO (AIT as OAuth AS) ─
test.describe.serial("#26 OAuth/SSO attacks on AI Tathastu's authorization server", () => {
  const CALLBACK = `http://127.0.0.1:${E2E_PORTS.r2}/collaborate/callback`;
  const VERIFIER = "e2e-attack-pkce-verifier-".padEnd(64, "y");
  const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
  const authorize = (extra = "", redirect = CALLBACK) =>
    `/integrations/authorize?client_id=collaborate&redirect_uri=${encodeURIComponent(redirect)}&state=st&code_challenge=${CHALLENGE}&code_challenge_method=S256&prompt=consent${extra}`;

  let ctx: BrowserContext;
  const getCode = async () => {
    const page = await ctx.newPage();
    await page.goto(authorize());
    await page.getByRole("button", { name: "Allow and continue" }).click();
    await page.waitForURL((u) => u.href.startsWith(CALLBACK));
    const code = new URL(page.url()).searchParams.get("code")!;
    await page.close();
    return code;
  };
  const exchange = (code: string, over: Record<string, string> = {}) =>
    ctx.request.post("/api/integrations/sso/token", {
      form: { grant_type: "authorization_code", code, code_verifier: VERIFIER, redirect_uri: CALLBACK, client_id: "collaborate", client_secret: E2E_ENV.INTEGRATION_COLLABORATE_CLIENT_SECRET, ...over },
    });

  test.beforeAll(async ({ browser }) => {
    await sql.query("UPDATE feature_flags SET enabled = true WHERE key = 'collaborate_profile_api'");
    ctx = await browser.newContext();
    await signIn(ctx, await createUser("Sso Victim", "done"), { onboarded: true });
  });
  test.afterAll(async () => ctx.close());

  test("authorize refuses unregistered redirect_uri and PKCE plain (no code leaves to an attacker)", async () => {
    const page = await ctx.newPage();
    const seen: string[] = [];
    page.on("request", (r) => seen.push(r.url()));
    await page.goto(authorize("", "https://evil.example/cb"));
    await expect(page.getByRole("heading", { name: /Can.t sign in here/ })).toBeVisible();
    expect(seen.some((u) => u.startsWith("https://evil.example")), "never navigates to attacker").toBe(false);
    await page.goto(authorize().replace("code_challenge_method=S256", "code_challenge_method=plain"));
    expect(page.url().includes("code=")).toBe(false);
    await page.close();
  });

  test("intercepted code is useless without the verifier, right redirect_uri or client secret", async () => {
    for (const [label, over] of [
      ["wrong PKCE verifier (AitM code interception)", { code_verifier: "x".repeat(64) }],
      ["swapped redirect_uri", { redirect_uri: "https://evil.example/cb" }],
      ["wrong client secret", { client_secret: "not-the-secret-0123456789abcdef" }],
      ["unknown client", { client_id: "evil-app" }],
    ] as const) {
      const res = await exchange(await getCode(), over);
      expect([400, 401], `${label}: ${res.status()}`).toContain(res.status());
      expect(await res.text(), label).not.toContain("access_token");
    }
    // Control: the legitimate exchange still works.
    expect((await exchange(await getCode())).status()).toBe(200);
  });

  test("forged bearer tokens are refused at the profile API (alg none / HS256 confusion / garbage)", async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const claims = { sub: randomUUID(), aud: "collaborate", iss: E2E_ENV.AUTH_URL, exp: Math.floor(Date.now() / 1000) + 600, scope: "profile" };
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64(claims)}.`;
    const pub = JSON.parse(E2E_ENV.INTEGRATION_JWT_PRIVATE_KEY);
    delete pub.d; // attacker only knows the public JWK (published at /api/integrations/jwks)
    const hsInput = `${b64({ alg: "HS256", typ: "JWT", kid: pub.kid })}.${b64(claims)}`;
    const hs = `${hsInput}.${createHmac("sha256", JSON.stringify(pub)).update(hsInput).digest("base64url")}`;
    const hsSecret = `${hsInput}.${createHmac("sha256", E2E_ENV.INTEGRATION_COLLABORATE_CLIENT_SECRET).update(hsInput).digest("base64url")}`;
    for (const [label, tok] of [["alg none", none], ["HS256 w/ public key", hs], ["HS256 w/ client secret", hsSecret], ["garbage", "abc.def.ghi"]] as const) {
      const res = await ctx.request.get("/api/integrations/v1/profile", { headers: { Authorization: `Bearer ${tok}` } });
      expect(res.status(), label).toBe(401);
    }
  });
});

// ── #24 CSRF / #11 login-CSRF on the GitHub connector callback (state check precedes any GitHub call) ─
test("#24 connector OAuth callback: missing, foreign or mismatched state is refused", async ({ browser }) => {
  const victim = await createUser("State Victim", "done");
  const attacker = await createUser("State Attacker", "done");
  const ctx = await browser.newContext();
  await signIn(ctx, victim, { onboarded: true });
  const COOKIE = "ait_gh_oauth"; // GITHUB_STATE_COOKIE in src/lib/connectors/github.ts (server-only module)
  // Set via the cookie jar: a raw Cookie header would replace the victim's session cookie.
  const call = async (v: string | null, state: string, extra?: string) => {
    await ctx.clearCookies({ name: COOKIE });
    if (v) await ctx.addCookies([{ name: COOKIE, value: v, url: `${E2E_ENV.AUTH_URL}/api/connectors/github/callback` }]);
    return ctx.request.get(`/api/connectors/github/callback?state=${state}${extra ?? "&code=attacker-code"}`, { maxRedirects: 0 });
  };

  for (const [label, cookie, state] of [
    ["no state cookie (classic CSRF)", null, "abc"],
    ["attacker's own cookie replayed to victim (login CSRF)", `${attacker.id}.s3cr3t.connections`, "s3cr3t"],
    ["victim cookie, wrong state", `${victim.id}.s3cr3t.connections`, "guess"],
  ] as const) {
    const res = await call(cookie, state);
    expect(res.status(), label).toBe(307);
    expect(res.headers()["location"], label).toContain("error=state");
  }
  // Control: correct cookie+state passes the CSRF check (user declined → error=denied, no GitHub call).
  const ok = await call(`${victim.id}.s3cr3t.connections`, "s3cr3t", "&error=access_denied");
  expect(ok.headers()["location"]).toContain("error=denied");
  const linked = await sql.query("SELECT 1 FROM connections WHERE user_id = $1 AND source_id = 'github'", [victim.id]);
  expect(linked.rowCount, "nothing linked").toBe(0);
  await ctx.close();
});

// ── #27 zero-day (defence in depth): replay a known framework auth-bypass as a stand-in for an unknown one.
// CVE-2025-29927 let `x-middleware-subrequest` skip Next.js middleware. Even if a future bug skips the proxy
// entirely, the DAL must still refuse: protected pages/APIs stay closed to an anonymous caller.
test("#27 proxy-bypass headers (CVE-2025-29927 class) do not open protected routes", async ({ request }) => {
  const bypass: Record<string, string>[] = [
    { "x-middleware-subrequest": "middleware" },
    { "x-middleware-subrequest": "src/middleware:src/middleware:src/middleware:src/middleware:src/middleware" },
    { "x-middleware-subrequest": "proxy:proxy:proxy:proxy:proxy" },
    { "x-middleware-subrequest": "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy" },
    { "x-invoke-path": "/admin", "x-invoke-status": "200" },
  ];
  for (const headers of bypass) {
    for (const path of ["/admin", "/dashboard", "/settings/privacy", "/profile"]) {
      const res = await request.get(path, { headers, maxRedirects: 0 });
      const body = res.status() === 200 ? await res.text() : "";
      // Closed means a redirect to login, a 404, or a 401 — never the protected page itself.
      expect([301, 302, 303, 307, 308, 401, 403, 404], `${path} with ${JSON.stringify(headers)} → ${res.status()}`).toContain(res.status());
      expect(body).not.toContain("Admin verification");
    }
    for (const api of ["/api/profile/v1/me", "/api/search?q=ab", `/api/jobs/${randomUUID()}`, "/api/collaborations/me"]) {
      expect((await request.get(api, { headers })).status(), `${api} ${JSON.stringify(headers)}`).toBe(401);
    }
  }
});

// ── #35 watering hole: no third-party script/style/frame for an attacker to poison; CSP enforced in-browser.
test("#35 every active resource is same-origin and CSP blocks an injected third-party script", async ({ browser }) => {
  const ctx = await browser.newContext();
  await signIn(ctx, await createUser("Visitor", "done"), { onboarded: true });
  const page = await ctx.newPage();
  const base = new URL(E2E_ENV.AUTH_URL).origin;
  const foreign: string[] = [];
  page.on("request", (r) => {
    const t = r.resourceType();
    if (["script", "stylesheet", "document", "font"].includes(t) && !r.url().startsWith(base) && !r.url().startsWith("data:")) foreign.push(`${t} ${r.url()}`);
  });
  const visited: string[] = [];
  for (const p of ["/", "/login", "/collaborations", "/people", "/dashboard"]) {
    // Some pages navigate client-side mid-load (ERR_ABORTED); the requests they made are what we inspect.
    await page.goto(p).catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    visited.push(new URL(page.url()).pathname);
  }
  expect(visited.length).toBe(5);
  expect(foreign, "third-party active resources").toEqual([]);
  // If an attacker did get a <script src=evil> into a page, CSP must stop the browser fetching it.
  await page.goto("/");
  const violations: string[] = [];
  page.on("console", (m) => m.text().includes("Content Security Policy") && violations.push(m.text()));
  const loaded = await page.evaluate(() => new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = "https://evil.example/miner.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  }));
  expect(loaded, "third-party script loaded").toBe(false);
  expect(violations.length, "CSP reported the blocked script").toBeGreaterThan(0);
  await ctx.close();
});