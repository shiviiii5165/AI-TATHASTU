# Deployment

AI Tathastu runs as three pieces:

| Piece | Where | What it runs |
| --- | --- | --- |
| Web app | Vercel (`www.aitathastu.com`) | Next.js: onboarding, dashboard, APIs. Deploys on every push to `main`. |
| Worker | Render free Web Service (`https://ai-tathastu.onrender.com`) | `worker/server.py`: resume extraction, connector sync, `compute_intelligence`. Deploys when `worker/**` changes (`render.yaml`). |
| Database | Neon Postgres | Shared by both. Migrations are applied by hand (below), never on deploy. |

Uploaded resumes go straight from the browser to Cloudflare R2.

CI (`.github/workflows/ci.yml`) runs typecheck, lint, Vitest, the Playwright E2E and the worker tests on every push and PR to `main`. It needs no secrets.

---

## Security follow-ups

**Before deploying session revocation:** apply `0019_session_version.sql` to production first. Every `users` read and session check selects the new column, so code deployed ahead of the migration takes sign-in down.

**Before deploying the LinkedIn check:** sign up once with a new LinkedIn account on a preview. New LinkedIn identities now need `email_verified: true`; accounts that are already linked are unaffected.

**Before deploying account deletion and recovery codes:** apply `0021_account_deletion_and_mfa_recovery.sql` first. Deletion now keeps its state in `account_deletions` and finishes from the daily cron, so a user whose cleanup failed never has to sign in again. `/api/internal/queue-health` raises `account_deletions` when one keeps failing or is more than three days old. Point your uptime monitor at it.

**Before deploying AI spend limits:** apply `0022_ai_spend_enforcement.sql` and `0023_paid_work_hardening.sql` before the web app and worker. Without 0023 queueing a recompute fails. Without it the worker refuses every AI, Firecrawl and Apify call and jobs fall back to rules. Check the limits at `/admin/ai-ops/costs` (defaults: $1 a day and $5 a month per user). The rates in `worker/ai_budget.py` are placeholders on the high side: set real ones with `AI_MODEL_PRICES`, `AI_FIRECRAWL_CALL_USD` and `AI_APIFY_CALL_USD` on Render, and compare the page with provider billing after a week.

**Before deploying the auth and RBAC hardening:** apply `0024_auth_code_session_version.sql` first, then:
- Confirm Collaborate and Meet send PKCE. It's now required; `docs/collaborate-integration-prompt.md` already tells Collaborate to, Meet is unconfirmed. For an app that doesn't yet, set `INTEGRATION_<ID>_PKCE_OPTIONAL=1` until it does.
- Run `SELECT u.email, m.role, m.is_active FROM admin_team_members m JOIN users u ON u.id = m.user_id WHERE u.is_admin`. Those rows now limit `is_admin` users, who were all full super-admins before. Fix any that don't reflect intent. `ADMIN_EMAILS` always stays super-admin.
- Operators must sign in again daily, and everyone with a session older than this deploy must once on reaching `/admin`.

**Turning on admin two-factor:** apply `0020_admin_mfa.sql` and `0021`, set `ADMIN_MFA_SECRET` in Vercel (`openssl rand -base64 32`, different from `AUTH_SECRET`), deploy, then have every operator set up an authenticator app at `/admin-mfa` while the flag is off, and save their recovery codes. Setup needs a sign-in from the last 15 minutes. Then set `ADMIN_MFA_REQUIRED=1`. With the flag on and no valid key, nobody can pass the check.

**Lost authenticator:** a recovery code, typed where the 6-digit code goes, removes the authenticator and signs that person out everywhere, so they sign in and set up again. **Last-resort lockout (no authenticator, no codes):** unset `ADMIN_MFA_REQUIRED` in Vercel and redeploy, which takes the second factor off for all operators, have them re-enroll, then set it back. For one person, a database operator can instead run `DELETE FROM admin_mfa WHERE user_id = '...'`. Both bypass the audit log, so record them by hand.

**Rotating `ADMIN_MFA_SECRET`:** set the old value as `ADMIN_MFA_SECRET_PREVIOUS` and a new `ADMIN_MFA_SECRET`, deploy, wait 12 hours for proofs to expire, then clear the previous value.

**DNS at BigRock.** Mail is sent from Gmail addresses, so nothing legitimate sends as `@aitathastu.com`. Publish this so the domain can't be spoofed. If Resend or another service sends from the domain, use that service's SPF and DKIM records and start DMARC at `p=none` instead.

| Host | Type | Value |
| --- | --- | --- |
| `aitathastu.com` | TXT | `v=spf1 -all` |
| `_dmarc.aitathastu.com` | TXT | `v=DMARC1; p=reject; adkim=s; aspf=s` |
| `aitathastu.com` | CAA | `0 issue "letsencrypt.org"` (confirm Vercel's current issuers first; a wrong record blocks renewal) |

**Known and accepted for now:**

- `nodemailer` has high advisories fixed only after 10.1.3, while Auth.js accepts `^7.0.7 || ^8.0.5`. Upgrade when Auth.js widens the range.
- Account deletion is permanent and available in Settings → Privacy. Support message text stays (address removed), and the audit log keeps the user id and the admin's reason. Connected apps (Collaborate, Meet) aren't told, and Neon and R2 backups expire on their own schedule. Accounts soft-deleted before this change stay until an admin clicks "Finish Permanent Deletion".
- An upload URL issued just before deletion can still create a file for up to 5 minutes. Add an R2 lifecycle rule on `resumes/` as a backstop if that matters.
- Parser subprocesses have no secrets, but they do have network access. Tesseract and PyMuPDF run under the same container user.

---

## Environment variables

Never commit real values. `.env*` is gitignored except `.env.example`, which is the template.

### Vercel (web app)

Settings → Environment Variables, Production. Mark secrets as Sensitive.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Neon **pooled** URL (host contains `-pooler`), `?sslmode=require`. |
| `AUTH_SECRET` | Yes | `openssl rand -base64 33`. Rotating it signs everyone out. |
| `AUTH_TRUST_HOST` | No | `true`. Vercel sets the host itself; harmless to keep. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For Google sign-in | Redirect URI `https://www.aitathastu.com/api/auth/callback/google`. The button is hidden when unset. |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | For LinkedIn sign-in | OIDC app. Redirect URI `https://www.aitathastu.com/api/auth/callback/linkedin`. |
| `SMTP_HOST`, `SMTP_PORT` | Yes (email) | `smtp.gmail.com`, `465`. Shared by the three senders below. |
| `SMTP_HELLO_USER`, `SMTP_HELLO_PASSWORD` | Yes (email) | `hello.aitathastu@gmail.com` + its app password. Sends magic links. (`SMTP_USER` / `SMTP_PASSWORD` are still read as a fallback.) |
| `SMTP_INFO_USER`, `SMTP_INFO_PASSWORD` | Yes (email) | `info.aitathastu@gmail.com`. Sends welcome, resume ready and resume failed. |
| `SMTP_SUPPORT_USER`, `SMTP_SUPPORT_PASSWORD` | Yes (email) | `support.aitathastu@gmail.com`. Sends connector alerts; also the Reply-To on every other email. |
| `AUTH_EMAIL_FROM` | With email | `AI Tathastu <hello.aitathastu@gmail.com>`; must be the hello address (Gmail rewrites any other From). |
| `RESEND_API_KEY` | No | When set, magic links go through Resend instead of SMTP (needs a verified domain). |
| `INTEGRATION_JWT_PRIVATE_KEY` | For Collaborate/Meet | ES256 P-256 **private** JWK as one line of JSON with a `kid` (`node scripts/integration-key.mjs`). Paste it without surrounding quotes, and mark it Sensitive. Signs the apps' 15-minute access tokens; the public half is served at `/api/integrations/jwks`. Never the test key from `e2e/support/env.ts`. |
| `INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS` | During a rotation only | JSON array of retired **public** JWKs (no `d`), kept in the JWKS so live tokens still verify. See "Rotating the signing key". |
| `INTEGRATION_COLLABORATE_CLIENT_SECRET`, `INTEGRATION_MEET_CLIENT_SECRET` | For each app | `openssl rand -base64 32`. Give each app its own; an app without one can't sign users in. |
| `INTEGRATION_<APP>_REDIRECT_URIS` | Recommended | Exact callback URLs, comma-separated. Unset: any https path on the app's origin. |
| `INTEGRATION_<APP>_WEBHOOK_URL`, `INTEGRATION_<APP>_WEBHOOK_SECRET` | For push sync | Where `profile.updated` / `integration.revoked` go, and the HMAC secret the app verifies them with. |
| `CRON_SECRET` | With webhooks | At least 16 characters. Vercel Cron sends it as `Authorization: Bearer` to `/api/internal/webhooks/dispatch` daily (`vercel.json`). That sweep retries due webhooks and purges spent sign-in codes. |
| `INTERNAL_API_SECRET` | Yes (worker emails) | `openssl rand -base64 48`. **Same value on Render.** The worker uses it to call `/api/internal/notify`. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Yes (uploads) | R2 API token with Object Read & Write on this bucket. When unset, the resume step offers Skip only. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | For the GitHub connector | GitHub OAuth App. Callback `https://www.aitathastu.com/api/connectors/github/callback`. |
| `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET` | For faculty ORCID | Public API client from orcid.org/developer-tools, redirect URI `https://www.aitathastu.com/api/connectors/orcid/callback`. Without them the ORCID card says it isn't set up. `ORCID_BASE_URL=https://sandbox.orcid.org` for testing. |
| `ADMIN_EMAILS` | No | Comma-separated emails that can open `/admin`. `users.is_admin = true` also grants it (takes effect at the user's next sign-in). |
| `TRUST_PROXY_HEADERS` | Off-Vercel only | Set to `1` only behind a reverse proxy that overwrites `X-Forwarded-For` (e.g. Nginx, Cloudflare). Off-Vercel without it, client forwarding headers are never trusted; sensitive unauthenticated routes fail safely (503) rather than allowing spoofing bypass. |
| `CONNECTOR_TOKEN_KEY` | Yes | `openssl rand -base64 32`. **Same value on Render.** Encrypts connector credentials at rest; changing it makes stored connections unreadable. |
| `WORKER_WAKE_URL` | Yes on Render free | `https://ai-tathastu.onrender.com/health`. Pinged after a job is queued, to wake a sleeping worker. |
| `EMBED_JWT_SECRET` | Phase 4 embed | `openssl rand -base64 48`, at least 32 characters, different from `AUTH_SECRET`. |
| `EMBED_ALLOWED_ORIGINS` | Phase 4 embed | Exact pilot-site origins, comma-separated. When empty, no site can get embed tokens. |

Never set on Vercel: LLM or scraper keys (`GROQ_KEYS` and the rest below). They belong to the worker only.

### Render (worker)

Dashboard → the service → Environment. `render.yaml` lists these with `sync: false`.

| Variable | Required | Notes |
| --- | --- | --- |
| `WORKER_DATABASE_URL` | Yes | Neon **direct** URL (no `-pooler`): a long-lived connection for `FOR UPDATE SKIP LOCKED`. Falls back to `DATABASE_URL`. |
| `CONNECTOR_TOKEN_KEY` | Yes | Same value as Vercel. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Yes | Reads uploaded resumes. |
| `GROQ_KEYS` | Yes (AI extraction) | Comma-separated key pool; first in the text chain. |
| `GEMINI_KEYS` | Recommended | Text fallback and the primary vision model for scanned or designed PDFs. |
| `OPENROUTER_KEYS` | Recommended | Last-resort text and vision fallback. |
| `GROQ_MODELS`, `GEMINI_MODELS`, `OPENROUTER_MODELS`, `OPENROUTER_VISION_MODELS` | No | Model overrides (`model[:strict|json]`, tried in order). Defaults are in `worker/provider_router.py`. |
| `APIFY_TOKENS` | LinkedIn scrape | Apify token pool. `APIFY_LINKEDIN_ACTOR` overrides the actor (default `harvestapi~linkedin-profile-scraper`). |
| `FIRECRAWL_KEYS` | Portfolio connector | Firecrawl key pool. |
| `KAGGLE_KEYS` | No | `username:key`, used only by `worker/benchmark_kaggle.py`. The Kaggle connector uses each user's own key. |
| `STACK_EXCHANGE_KEY` | No | Raises the Stack Exchange quota; the connector works without it. |
| `INTERNAL_API_SECRET` | Yes (emails, webhooks) | Same value as Vercel. Without it the worker sends no emails and recomputed profiles don't reach Collaborate/Meet. |
| `APP_URL` | No | Default `https://www.aitathastu.com`; where the worker sends notification requests. |
| `LOG_LEVEL` | No | Default `INFO`. |
| `WORKER_ID`, `WORKER_LOCK_SECONDS` | No | Defaults `host:pid` and `300`. |

Render sets `PORT` itself. Never put SMTP credentials on Render: free web services can't open outbound SMTP connections (ports 25, 465 and 587 are blocked), so the worker asks the web app to send its emails. Without AI keys, or without the user's `external_ai` consent, extraction still runs but is rules-only.

### Local development

Copy `.env.example` to `.env.local`. The web app and the worker both read it (the worker from `../.env.local`). Fill in what you need from both tables above. Use the direct Neon URL for `WORKER_DATABASE_URL`, and leave `WORKER_WAKE_URL` empty when running the worker yourself.

Local-only options:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL=postgres://…@localhost…` | A localhost URL makes the app use node-postgres instead of Neon (e.g. Postgres in Docker). |
| `R2_ENDPOINT` | Any S3-compatible endpoint (MinIO) instead of R2. |
| `WORKER_LOCAL_STORAGE_DIR` | The worker reads `<dir>/<storage_key>` instead of R2. |

The E2E sets its own environment (`e2e/support/env.ts`) and needs nothing from `.env.local`.

---

## Commands

### Migrations

Generate a migration after changing `src/db/schema.ts`, review the SQL in `src/db/migrations/`, commit it, then apply it **before** deploying code that needs it:

```bash
npm run db:generate          # schema.ts → new SQL migration
npm run db:migrate:http      # apply pending migrations over HTTPS (Neon serverless driver)
npm run db:migrate           # same via drizzle-kit over TCP 5432, where that port isn't blocked
```

Both use `DATABASE_URL` from `.env.local` (or the environment), so check it points at the database you mean. Applied migrations are recorded in `drizzle.__drizzle_migrations`; re-running is a no-op.

### Feature flags (Phase 4)

```bash
npm run flags                          # list
npm run flags -- on pilot_site_embed   # enable; takes effect on the next request, no deploy
npm run flags -- off avasar_profile_api
```

### Worker, locally

```bash
cd worker
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py      # what Render runs: /health on $PORT + the queue loop
python worker.py      # queue loop only
pip install pytest && pytest -q   # unit tests (no DB, no network)
```

Scanned PDFs need Tesseract on the host (`brew install tesseract`).

### Tests

```bash
npm run typecheck
npm run lint
npm test                          # Vitest
npx playwright install chromium   # once per machine (locally it can use installed Chrome)
npm run test:e2e                  # full Phase 1–3 journey against a throwaway stack
```

### Integrations (Collaborate, Tathastu Meet)

Guide for the apps' developers: [docs/integration-guide.md](docs/integration-guide.md). To switch one on:

1. Set `INTEGRATION_JWT_PRIVATE_KEY` once, and the app's `INTEGRATION_<APP>_*` variables on Vercel; redeploy.
2. Give the app's team its client secret and webhook secret through a secret manager.
3. `npm run flags -- on collaborate_profile_api` (or `meet_profile_api`).

Users manage what each app sees at `/settings/integrations`. Every optional scope starts off; scopes the app asks for are labelled "Requested by <app>".

Registered for Collaborate (`client_id` `collaborate`):

| Setting | Value |
| --- | --- |
| `INTEGRATION_COLLABORATE_REDIRECT_URIS` | `https://collaborate.aitathastu.com/api/auth/tathastu/callback` (comma-separated list of exact URLs; no JSON, no quotes) |
| `INTEGRATION_COLLABORATE_WEBHOOK_URL` | `https://collaborate.aitathastu.com/api/webhooks/tathastu` (single URL) |
| Events | `profile.updated`, `integration.revoked` |
| Scopes | `skills`, `projects`, `eris`, `experience`, `education`, `achievements`, `activity`, all opt-in per user |

#### Checking the configuration without revealing it

```bash
npm run integrations:check            # .env.local
npm run integrations:check -- --remote   # the deployed app (GET /api/internal/integrations/status, Bearer INTERNAL_API_SECRET)
```

Both print, per variable: present or missing, format problems, and an 8-character SHA-256 **fingerprint** for shared secrets. To confirm two systems hold the same secret (Vercel and Render's `INTERNAL_API_SECRET`, or our client secret and Collaborate's), compare fingerprints, never values. On the other side, the fingerprint is `printf %s "$VALUE" | shasum -a 256 | cut -c1-8`.

#### Rotating the signing key (no downtime)

1. Generate a new key with `node scripts/integration-key.mjs`. It gets a new `kid`.
2. Put the **old** key's public part (its `kty`, `crv`, `x`, `y`, `kid`, without `d`) in `INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS` as a JSON array, set `INTEGRATION_JWT_PRIVATE_KEY` to the new key, and redeploy. The JWKS now publishes both keys, and new tokens use the new `kid`.
3. After at least 1 hour (the JWKS cache time, which is longer than the 15-minute token life), remove `INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS` and redeploy.

The apps need no change, because they select keys by `kid`.

#### Rotating an app's client or webhook secret (coordinated)

The token exchange and webhook signatures check exactly one secret per app, so each rotation is a short coordinated switch. Agree a time with the app's team first.

- **Client secret:**
  1. Set the new `INTEGRATION_<APP>_CLIENT_SECRET` on Vercel without redeploying yet.
  2. The app team stages the same value.
  3. At the agreed time, redeploy here and deploy there.
  4. Sign-ins that fail in the gap can simply be retried.
  5. Confirm by comparing fingerprints with `--remote`.
- **Webhook secret:** same procedure. Webhooks that fail in the gap are retried automatically (outbox backoff: 1 min, then 5 min, 30 min, 2 h and 12 h).
- **Never rotate one side alone.** If a secret leaks, rotate immediately and accept a few minutes of failed sign-ins over leaving it valid.

### Rate Limiting & Proxy Configuration

Rate limits protect endpoints from brute-force guessing and denial of service:
- **Authenticated routes** (`analytics`, `search`, `yora`, `upload`, etc.): Partitioned by server-verified user ID (`session.user.id` or `authz.user.id`). These are immune to IP rotation or spoofed headers.
- **Integration token exchange** (`/api/integrations/sso/token`): When client IP is available, throttles by IP bucket to slow guessing. If IP cannot be verified, partitioned by server-verified `client.id`.
- **Sensitive unauthenticated routes** (`/api/contact`, magic link sign-in): Rate-limited by verified client IP bucket (IPv4 canonical address, IPv6 canonical `/64` subnet prefix).

#### Platform-provided trusted headers:
1. **On Vercel (Production default)**: Vercel edge infrastructure manages client IP forwarding. The platform-provided `x-vercel-forwarded-for` header is prioritized because it cannot be spoofed by incoming client requests; `x-forwarded-for` (first hop) is used as fallback. `process.env.VERCEL` is automatically set by Vercel.
2. **On Custom Hosting**: If hosting behind a reverse proxy (e.g. Nginx, AWS ALB, Cloudflare), set `TRUST_PROXY_HEADERS=1`. **Condition:** The reverse proxy MUST be configured to overwrite `X-Forwarded-For`, `X-Real-IP`, or `CF-Connecting-IP` with the true connecting client socket address, stripping any incoming client-forged headers.
3. **Missing Proxy Configuration / Direct Connections Off-Vercel**: Forwarding headers are NEVER trusted by default. Client-supplied headers like `X-Forwarded-For` are ignored to prevent attackers from rotating fake IPs to bypass rate limits. To prevent global denial of service, requests do NOT share a global `"unknown"` bucket; instead, sensitive unauthenticated endpoints fail safely with `503 Service Unavailable` (or reject with origin verification error).
4. **IPv6 /64 Subnet Partitioning**: Residential and mobile IPv6 providers allocate at least a `/64` subnet to end users and rotate the bottom 64 bits (RFC 4941 / RFC 8981 privacy extensions). To prevent attackers with an IPv6 allocation from rotating interface IDs to bypass rate limits, IPv6 rate limits are keyed to the canonical `/64` subnet prefix.
5. **Privacy-Preserving Storage**: Raw IP addresses are NEVER logged or stored in the database. Rate limit keys store a one-way 32-character SHA-256 hash of the bucket key (`createHash("sha256").update(bucketKey).digest("hex").slice(0, 32)`).

### Email previews

```bash
npm run email:test                  # every template, from its real sender, to 720anant@gmail.com
npm run email:test -- you@example.com
```

Uses the `SMTP_*` credentials in `.env.local` and exits 1 if any send fails. Templates are in `src/lib/email/templates.ts`; senders in `src/lib/email.ts`.

### Verify Phase 2 output for a user

```bash
npm run verify:phase2 -- <user-id | email>
```

This is read-only. It checks that the user has a `profile_views` row with at least 3 widgets, skills (through `skill_evidence`) and `eris_scores` rows. It exits 1 if any check fails. Run it after a user finishes onboarding and the worker has processed `compute_intelligence`.

---

## Release checklist

1. CI is green on the commit.
2. Pending migrations are applied to Neon (`npm run db:migrate:http`).
3. Vercel and Render variables match the tables above. `CONNECTOR_TOKEN_KEY` is the same on both.
4. The R2 bucket CORS rule allows `PUT` from `https://www.aitathastu.com` (see README, "R2 bucket CORS").
5. OAuth redirect and callback URLs are registered for the production domain (Google, LinkedIn, GitHub).
6. After deploy, open `https://ai-tathastu.onrender.com/health` and get `200`.
7. Smoke test: `/login` loads; an unauthenticated `GET /api/profile/v1/me` returns `401`.
8. Sign up a test account, finish onboarding, and run `npm run verify:phase2 -- <email>`.

Before public launch, rotate every credential that has ever been shared outside the secret stores: Neon password, R2 keys, Gmail app password, `AUTH_SECRET`, OAuth client secrets, and API tokens. Rotating `CONNECTOR_TOKEN_KEY` means users must reconnect their sources.
