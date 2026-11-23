// Phase-2 dynamic security assessment against the isolated e2e stack
// (PGlite + fake R2, synthetic users only — no production creds/data).
// Validates authorization boundaries at the HTTP layer. Bounded and
// non-destructive. See SECURITY_ASSESSMENT notes for the attack-path map.
import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { createUser, signIn, sql } from "./support/fixtures";

const seedJob = (userId: string, id = randomUUID()) =>
  sql
    .query("INSERT INTO jobs (id, user_id, type, idempotency_key) VALUES ($1, $2, 'resume_extract', $3)", [id, userId, `k-${id}`])
    .then(() => id);

test.describe("dynamic authz boundaries", () => {
  // Path 3 — unauthenticated access to protected endpoints is refused.
  test("protected endpoints reject anonymous callers (401)", async ({ browser }) => {
    const ctx = await browser.newContext();
    for (const url of ["/api/profile/v1/me", "/api/search?q=test", `/api/jobs/${randomUUID()}`]) {
      expect((await ctx.request.get(url)).status(), url).toBe(401);
    }
    await ctx.close();
  });

  // Path 1 — IDOR/BOLA: user A must not read user B's job.
  test("user A cannot read user B's job (IDOR)", async ({ browser }) => {
    const A = await createUser("Alice Alpha", "done");
    const B = await createUser("Bob Beta", "done");
    const aJob = await seedJob(A.id);
    const bJob = await seedJob(B.id);

    const ctx = await browser.newContext();
    await signIn(ctx, A, { onboarded: true });

    // Control: A reads its own job.
    expect((await ctx.request.get(`/api/jobs/${aJob}`)).status(), "own job").toBe(200);
    // Attack: A requests B's job id — must read as not-found, not leak.
    expect((await ctx.request.get(`/api/jobs/${bJob}`)).status(), "cross-user job").toBe(404);
    await ctx.close();
  });

  // Path 2 — vertical privilege escalation: ordinary user cannot reach /admin.
  test("ordinary user is denied /admin (404, not advertised)", async ({ browser }) => {
    const A = await createUser("Ordinary One", "done");
    const ctx = await browser.newContext();
    await signIn(ctx, A, { onboarded: true });
    const res = await ctx.request.get("/admin", { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    await ctx.close();
  });

  // Path 2 (control) — an operator email is NOT 404'd (reaches page or step-up MFA).
  test("operator email is not blocked at /admin (control)", async ({ browser }) => {
    // Other specs leave this operator behind in a full run; recreate it cleanly.
    await sql.query("DELETE FROM users WHERE email = 'admin@e2e.test'");
    const admin = await createUser("Ops Admin", "done", "admin@e2e.test");
    const ctx = await browser.newContext();
    await signIn(ctx, admin, { onboarded: true });
    const res = await ctx.request.get("/admin", { maxRedirects: 0 });
    expect([200, 302, 307], `admin status ${res.status()}`).toContain(res.status());
    await ctx.close();
  });

  // Path 8 — rate limiting trips under a bounded burst (search: 60/60s).
  test("search rate limit returns 429 under burst", async ({ browser }) => {
    const A = await createUser("Rate Rider", "done");
    const ctx = await browser.newContext();
    await signIn(ctx, A, { onboarded: true });
    let got429 = false;
    for (let i = 0; i < 75 && !got429; i++) {
      got429 = (await ctx.request.get("/api/search?q=ab")).status() === 429;
    }
    expect(got429, "expected a 429 within 75 requests").toBe(true);
    await ctx.close();
  });
});

// ── Collaborations IDOR/BOLA: posts, applications, threads, members roster ──
// Resources are created through the real API (owner B), then every owner-/
// participant-scoped read and mutation is attacked from a non-owning account
// (outsider / wrong-role) and anonymously, with the owner path kept as a
// control. `sec-fetch-site: same-origin` is sent on writes so the CSRF guard
// passes and the AUTHORIZATION boundary is what's under test.
test.describe.serial("collaborations IDOR/BOLA", () => {
  const SO = { "sec-fetch-site": "same-origin" };
  const PROJECT = (title: string) => ({
    category: "project",
    title,
    summary: "Synthetic collaboration created for authorization testing on the isolated e2e stack.",
    roles: [{ title: "Developer", count: 1 }],
  });

  test("owner-scoped reads/mutations resist cross-user and anonymous access", async ({ browser }) => {
    const tag = Math.random().toString(36).slice(2, 8);
    // Operator identity must be the configured ADMIN_EMAILS value; recreate it cleanly.
    await sql.query("DELETE FROM users WHERE email = 'admin@e2e.test'");

    const owner = await createUser(`Owner ${tag}`, "done");
    const applicant = await createUser(`Applicant ${tag}`, "done");
    const applicant2 = await createUser(`Applicant2 ${tag}`, "done");
    const outsider = await createUser(`Outsider ${tag}`, "done");
    const admin = await createUser(`Admin ${tag}`, "done", "admin@e2e.test");

    const ctxOf = new Map<string, Awaited<ReturnType<typeof browser.newContext>>>();
    for (const u of [owner, applicant, applicant2, outsider, admin]) {
      const c = await browser.newContext();
      await signIn(c, u, { onboarded: true });
      ctxOf.set(u.id, c);
    }
    const anon = await browser.newContext();
    const r = (u: { id: string }) => ctxOf.get(u.id)!.request;

    // ── Setup: owner creates a published post and a draft; two applicants; an enquiry thread.
    const createPost = async (publish: boolean, title: string) => {
      const res = await r(owner).post("/api/collaborations", { headers: SO, data: { publish, post: PROJECT(title) } });
      expect(res.status(), await res.text()).toBe(201);
      return (await res.json()).id as string;
    };
    const postPub = await createPost(true, `Authz Pub ${tag}`);
    const postDraft = await createPost(false, `Authz Draft ${tag}`);

    const applyTo = async (who: { id: string }, postId: string) => {
      const res = await r(who).post(`/api/collaborations/${postId}/apply`, {
        headers: SO,
        data: { intro: "Synthetic applicant intro for authz testing.", motivation: "Synthetic motivation for authz testing." },
      });
      expect(res.status(), await res.text()).toBe(201);
      return (await res.json()).id as string;
    };
    const appA = await applyTo(applicant, postPub);
    const appA2 = await applyTo(applicant2, postPub);

    const enq = await r(applicant).post(`/api/collaborations/${postPub}/enquiry`, { headers: SO, data: { body: "Is this still open?" } });
    expect(enq.status(), await enq.text()).toBe(201);
    const threadId = (await enq.json()).threadId as string;

    // ── Resource: private owner view (?edit=1) ───────────────────────────────
    await test.step("post private view: owner only", async () => {
      expect((await r(owner).get(`/api/collaborations/${postPub}?edit=1`)).status(), "owner own edit view").toBe(200);
      expect((await r(outsider).get(`/api/collaborations/${postPub}?edit=1`)).status(), "outsider edit view").toBe(404);
      expect((await anon.request.get(`/api/collaborations/${postPub}?edit=1`)).status(), "anon edit view").toBe(401);
    });

    // ── Public read is intentionally public, but must not leak owner PII ──────
    await test.step("post public read: open by design, no owner PII", async () => {
      const res = await r(outsider).get(`/api/collaborations/${postPub}`);
      expect(res.status()).toBe(200);
      const body = await res.text();
      expect(body, "no owner email").not.toContain(owner.email);
      expect(body, "no owner id").not.toContain(owner.id);
    });

    // ── Resource: update (PATCH) — owner only, no operator bleed ──────────────
    await test.step("post update: cross-user/operator/anon denied, owner allowed", async () => {
      const patch = (who: { id: string }) => r(who).patch(`/api/collaborations/${postPub}`, { headers: SO, data: { post: PROJECT(`Authz Pub ${tag}`) } });
      expect((await patch(outsider)).status(), "outsider PATCH").toBe(404);
      expect((await patch(admin)).status(), "operator PATCH (no bleed)").toBe(404);
      expect((await anon.request.patch(`/api/collaborations/${postPub}`, { headers: SO, data: { post: PROJECT("x") } })).status(), "anon PATCH").toBe(401);
      expect((await patch(owner)).status(), "owner PATCH control").toBe(200);
    });

    // ── Resource: members roster — owner/members only ─────────────────────────
    await test.step("members roster: outsider/anon denied, owner allowed", async () => {
      expect((await r(outsider).get(`/api/collaborations/${postPub}/members`)).status(), "outsider members").toBe(404);
      expect((await anon.request.get(`/api/collaborations/${postPub}/members`)).status(), "anon members").toBe(401);
      expect((await r(owner).get(`/api/collaborations/${postPub}/members`)).status(), "owner members control").toBe(200);
    });

    // ── Resource: enquiry thread — enquirer + owner only ──────────────────────
    await test.step("thread read/write: outsider/operator/anon denied, participants allowed", async () => {
      expect((await r(outsider).get(`/api/collaborations/threads/${threadId}`)).status(), "outsider read thread").toBe(404);
      expect((await r(admin).get(`/api/collaborations/threads/${threadId}`)).status(), "operator read thread").toBe(404);
      expect((await anon.request.get(`/api/collaborations/threads/${threadId}`)).status(), "anon read thread").toBe(401);
      // Outsider cannot inject a message into someone else's conversation.
      expect((await r(outsider).post(`/api/collaborations/threads/${threadId}`, { headers: SO, data: { body: "injected" } })).status(), "outsider post message").toBe(404);
      // Controls: both participants can read; the enquirer can post.
      expect((await r(applicant).get(`/api/collaborations/threads/${threadId}`)).status(), "enquirer read control").toBe(200);
      expect((await r(owner).get(`/api/collaborations/threads/${threadId}`)).status(), "owner read control").toBe(200);
      expect((await r(applicant).post(`/api/collaborations/threads/${threadId}`, { headers: SO, data: { body: "A real question." } })).status(), "enquirer post control").toBe(201);
    });

    // ── Resource: applications — accept/reject(owner), withdraw(applicant) ────
    await test.step("applications: wrong-role accept/withdraw denied, right-role allowed", async () => {
      const decide = (who: { id: string }, appId: string, action: string) => r(who).post(`/api/collaborations/applications/${appId}`, { headers: SO, data: { action } });
      // Outsider cannot accept (404 — existence never confirmed) nor withdraw (409 — not their pending request).
      expect((await decide(outsider, appA, "accept")).status(), "outsider accept").toBe(404);
      expect((await decide(admin, appA, "accept")).status(), "operator accept (no bleed)").toBe(404);
      expect((await decide(outsider, appA, "withdraw")).status(), "outsider withdraw").toBe(409);
      expect((await anon.request.post(`/api/collaborations/applications/${appA}`, { headers: SO, data: { action: "accept" } })).status(), "anon accept").toBe(401);
      // Controls: the applicant withdraws their own; the owner accepts the other.
      expect((await decide(applicant, appA, "withdraw")).status(), "applicant withdraw control").toBe(200);
      expect((await decide(outsider, appA2, "accept")).status(), "outsider accept #2").toBe(404);
      expect((await decide(owner, appA2, "accept")).status(), "owner accept control").toBe(200);
    });

    // ── Resource: lifecycle status — owner only (run last; it mutates status) ─
    await test.step("status change: cross-user/operator/anon denied, owner allowed", async () => {
      const status = (who: { id: string }, action: string) => r(who).post(`/api/collaborations/${postPub}/status`, { headers: SO, data: { action } });
      expect((await status(outsider, "close")).status(), "outsider close").toBe(404);
      expect((await status(admin, "close")).status(), "operator close (no bleed)").toBe(404);
      expect((await anon.request.post(`/api/collaborations/${postPub}/status`, { headers: SO, data: { action: "close" } })).status(), "anon close").toBe(401);
      expect((await status(owner, "pause")).status(), "owner pause control").toBe(200);
    });

    // ── Resource: draft delete — owner only ──────────────────────────────────
    await test.step("draft delete: outsider/anon denied, owner allowed", async () => {
      expect((await r(outsider).delete(`/api/collaborations/${postDraft}`, { headers: SO })).status(), "outsider delete").toBe(404);
      expect((await anon.request.delete(`/api/collaborations/${postDraft}`, { headers: SO })).status(), "anon delete").toBe(401);
      expect((await r(owner).delete(`/api/collaborations/${postDraft}`, { headers: SO })).status(), "owner delete control").toBe(200);
    });

    for (const c of ctxOf.values()) await c.close();
    await anon.close();
  });
});

// ── Remaining-gap coverage: self-scoped lists, report visibility oracle, and
// membership removal/leave by membership id. ───────────────────────────────
test.describe.serial("collaborations IDOR: me / matches / reports / membership", () => {
  const SO = { "sec-fetch-site": "same-origin" };

  test("self-scoped lists, report oracle, and membership removal are authorized", async ({ browser }) => {
    const tag = Math.random().toString(36).slice(2, 8);
    const owner = await createUser(`GOwner ${tag}`, "done");
    const member = await createUser(`GMember ${tag}`, "done");
    const leaver = await createUser(`GLeaver ${tag}`, "done");
    const enquirer = await createUser(`GEnq ${tag}`, "done");
    const outsider = await createUser(`GOut ${tag}`, "done");

    const ctxOf = new Map<string, Awaited<ReturnType<typeof browser.newContext>>>();
    for (const u of [owner, member, leaver, enquirer, outsider]) {
      const c = await browser.newContext();
      await signIn(c, u, { onboarded: true });
      ctxOf.set(u.id, c);
    }
    const anon = await browser.newContext();
    const r = (u: { id: string }) => ctxOf.get(u.id)!.request;

    // Setup: published post (capacity 2), a separate draft, two accepted members, one enquiry thread.
    const TITLE = `Gap Pub ${tag}`;
    const mk = async (publish: boolean, title: string, count = 1) => {
      const res = await r(owner).post("/api/collaborations", {
        headers: SO,
        data: { publish, post: { category: "project", title, summary: "Synthetic post for gap authz testing.", roles: [{ title: "Dev", count }] } },
      });
      expect(res.status(), await res.text()).toBe(201);
      return (await res.json()).id as string;
    };
    const postPub = await mk(true, TITLE, 2);
    const postDraft = await mk(false, `Gap Draft ${tag}`);

    const applyAccept = async (who: { id: string }) => {
      const a = await r(who).post(`/api/collaborations/${postPub}/apply`, { headers: SO, data: { intro: "Gap intro synthetic.", motivation: "Gap motivation synthetic." } });
      expect(a.status(), await a.text()).toBe(201);
      const appId = (await a.json()).id as string;
      const d = await r(owner).post(`/api/collaborations/applications/${appId}`, { headers: SO, data: { action: "accept" } });
      expect(d.status(), await d.text()).toBe(200);
    };
    await applyAccept(member);
    await applyAccept(leaver);

    const enq = await r(enquirer).post(`/api/collaborations/${postPub}/enquiry`, { headers: SO, data: { body: "Is a designer needed?" } });
    expect(enq.status(), await enq.text()).toBe(201);
    const enqThread = (await enq.json()).threadId as string;

    // ── /api/collaborations/me — self-scoped, no ID to tamper ────────────────
    await test.step("me: anon rejected; outsider's list omits others' posts", async () => {
      expect((await anon.request.get("/api/collaborations/me?view=mine")).status(), "anon me").toBe(401);
      const mine = await r(outsider).get("/api/collaborations/me?view=mine");
      expect(mine.status()).toBe(200);
      expect(await mine.text(), "outsider must not see owner's post").not.toContain(TITLE);
    });

    // ── /api/collaboration/matches — self-scoped, consent-gated ──────────────
    await test.step("matches: anon rejected", async () => {
      expect((await anon.request.get("/api/collaboration/matches")).status(), "anon matches").toBe(401);
    });

    // ── /api/collaborations/reports — only reportable if the reporter can see it
    await test.step("reports: unseen targets are 404 (no existence oracle)", async () => {
      const rep = (who: { id: string }, data: object) => r(who).post("/api/collaborations/reports", { headers: SO, data });
      // Private draft the reporter can't see → 404, not 201.
      expect((await rep(outsider, { targetType: "post", targetId: postDraft, reason: "spam" })).status(), "report private draft").toBe(404);
      // A thread the reporter isn't part of → 404.
      expect((await rep(outsider, { targetType: "thread", targetId: enqThread, reason: "spam" })).status(), "report foreign thread").toBe(404);
      expect((await anon.request.post("/api/collaborations/reports", { headers: SO, data: { targetType: "post", targetId: postPub, reason: "spam" } })).status(), "anon report").toBe(401);
      // Control: a public post the reporter can see → 201.
      expect((await rep(outsider, { targetType: "post", targetId: postPub, reason: "spam" })).status(), "report public post control").toBe(201);
    });

    // ── Membership removal by membership id — owner removes, member leaves ────
    await test.step("membership removal: only owner removes; only self leaves", async () => {
      const [{ id: memberMembershipId }] = (
        await sql.query("SELECT id FROM collab_members WHERE post_id = $1 AND user_id = $2 AND status = 'active'", [postPub, member.id])
      ).rows as { id: string }[];
      const remove = (who: { id: string }, memberId: string) => r(who).post(`/api/collaborations/${postPub}/remove`, { headers: SO, data: { memberId } });

      // Even WITH the membership id, a non-owner cannot remove a member.
      expect((await remove(outsider, memberMembershipId)).status(), "outsider remove").toBe(404);
      expect((await remove(enquirer, memberMembershipId)).status(), "non-member remove").toBe(404);
      expect((await anon.request.post(`/api/collaborations/${postPub}/remove`, { headers: SO, data: { memberId: memberMembershipId } })).status(), "anon remove").toBe(401);
      // Control: the owner removes the member.
      expect((await remove(owner, memberMembershipId)).status(), "owner remove control").toBe(200);
      // Control: a member leaves on their own (no memberId).
      expect((await r(leaver).post(`/api/collaborations/${postPub}/leave`, { headers: SO, data: {} })).status(), "member leave control").toBe(200);
    });

    for (const c of ctxOf.values()) await c.close();
    await anon.close();
  });
});

// ── 36-attack matrix regressions (2026-11-22): web-layer controls proven live against the isolated
// target, pinned here so a regression fails CI. Rows: #18/#25 clickjacking+headers, #23 XSS,
// #24 CSRF, #26 session hijacking/forgery, #19 IP spoofing vs limiter, #31 backdoor-style internal routes.
test.describe("attack-matrix regressions", () => {
  test("#25 clickjacking: pages refuse framing; #18 HSTS and nosniff present", async ({ request }) => {
    for (const path of ["/", "/login"]) {
      const res = await request.get(path);
      const h = res.headers();
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["content-security-policy"] ?? "", path).toContain("frame-ancestors 'none'");
      expect(h["x-content-type-options"], path).toBe("nosniff");
      expect(h["strict-transport-security"] ?? "", path).toContain("max-age=");
      expect(h["x-powered-by"], path).toBeUndefined();
    }
  });

  test("#23 XSS: script canaries in query strings are never reflected unescaped", async ({ request }) => {
    const x = encodeURIComponent('"><script>xss_canary_7731()</script>');
    for (const path of [`/login?callbackUrl=${x}`, `/login?error=${x}`, `/?q=${x}`, `/nonexistent-${x}`]) {
      const body = await (await request.get(path)).text();
      expect(body.includes("<script>xss_canary_7731"), path).toBe(false);
    }
  });

  test("#24 CSRF: a signed-in victim's cross-site writes are refused (403)", async ({ browser }) => {
    const A = await createUser("Csrf Victim", "done");
    const ctx = await browser.newContext();
    await signIn(ctx, A, { onboarded: true });
    const xs = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };
    for (const url of ["/api/collaborations", "/api/consents", "/api/widget-prefs", "/api/analytics"]) {
      expect((await ctx.request.post(url, { headers: xs, data: { a: 1 } })).status(), url).toBe(403);
    }
    // Simple (no-preflight) form-style request is refused too.
    const simple = await ctx.request.post("/api/collaborations", { headers: { ...xs, "content-type": "text/plain" }, data: "a=1" });
    expect(simple.status(), "text/plain cross-site").toBe(403);
    await ctx.close();
  });

  test("#26 session hijacking: forged / alg=none / oversized session cookies grant nothing", async ({ request }) => {
    for (const token of ["eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.", "garbage", "A".repeat(5000)]) {
      // Raw header: browsers cap cookies at 4 KB, an attacker's client does not.
      const headers = { cookie: `authjs.session-token=${token}; __Secure-authjs.session-token=${token}` };
      expect((await request.get(`/api/jobs/${randomUUID()}`, { headers })).status(), `forged len ${token.length}`).toBe(401);
      expect(await (await request.get("/api/auth/session", { headers })).json(), "no session").toBeNull();
    }
  });

  test("#19 IP spoofing: rotating X-Forwarded-For does not buy fresh rate-limit buckets", async ({ request }) => {
    let got429 = false;
    for (let i = 1; i <= 14 && !got429; i++) {
      const res = await request.post("/api/client-errors", {
        headers: { "x-forwarded-for": `203.0.113.${i}`, "x-real-ip": `198.51.100.${i}`, "sec-fetch-site": "same-origin" },
        data: { message: "probe", digest: "x" },
      });
      got429 = res.status() === 429;
    }
    expect(got429, "spoofed headers must share one bucket (limit 10/60s)").toBe(true);
  });

  test("#31 backdoor-style access: internal routes reject a wrong secret on every method", async ({ request }) => {
    const auth = { authorization: "Bearer wrong-secret" };
    for (const p of ["/api/internal/health-run", "/api/internal/queue-health", "/api/internal/integrations/status"]) {
      expect((await request.get(p, { headers: auth })).status(), `GET ${p}`).toBe(401);
    }
    for (const p of ["/api/internal/notify", "/api/internal/webhooks/dispatch"]) {
      expect((await request.post(p, { headers: auth, data: {} })).status(), `POST ${p}`).toBe(401);
    }
  });
});