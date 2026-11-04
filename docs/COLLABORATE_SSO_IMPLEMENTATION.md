# Collaborate sign-in with AI Tathastu

AI Tathastu is the identity provider; Collaborate is an OAuth 2.0 client with
its own database and sessions. The two apps share no code, cookies or
database. They talk over HTTPS only, through the contract below.

- AI Tathastu: `https://www.aitathastu.com` (Vercel)
- Collaborate: `https://collaborate.aitathastu.com` (Vercel frontend, Render backend)

No secret appears in this document. Never paste secret values into tickets,
chat, commits or logs.

## 1. The contract

Authorization Code grant (RFC 6749) with PKCE S256 (RFC 7636). Required for
Collaborate.

| Step | Who | Request |
|---|---|---|
| 1. Start | Collaborate server | Creates `state` and a PKCE `code_verifier`, stores both in a short-lived HttpOnly cookie, redirects the browser to the authorize URL. Collaborate's start route is `/api/auth/tathastu/start`. |
| 2. Authorize | Browser → AI Tathastu | `GET https://www.aitathastu.com/integrations/authorize?client_id=collaborate&redirect_uri=<callback>&state=<state>&code_challenge=<S256>&code_challenge_method=S256[&prompt=none\|consent]` |
| 3. Callback | AI Tathastu → browser → Collaborate | `302 <callback>?code=<one-time code>&state=<state>` or `<callback>?error=<code>&error_description=…&state=<state>` |
| 4. Token | Collaborate server → AI Tathastu | `POST https://www.aitathastu.com/api/integrations/sso/token` |
| 5. Verify | Collaborate server | Verify the ES256 JWT with the JWKS, then create Collaborate's own session. |
| 6. Profile | Collaborate server → AI Tathastu | `GET https://www.aitathastu.com/api/integrations/v1/profile` with `Authorization: Bearer <access_token>` |

### Callback URL

```
https://collaborate.aitathastu.com/api/auth/tathastu/callback
```

It must match `INTEGRATION_COLLABORATE_REDIRECT_URIS` exactly, as a string:
scheme, host, path, and no trailing slash, query or fragment.

### Authorize (`/integrations/authorize`)

- `client_id=collaborate`, plus `redirect_uri`, `state` (at most 500 characters), `code_challenge` (43 base64url characters) and `code_challenge_method=S256`.
- Signed out: the user is sent to AI Tathastu's login, then back to this request.
- First visit: a consent screen where the user picks what Collaborate may see. Every optional scope starts off.
- Later visits, with the app still linked: no screen. Straight back with a code.
- `prompt=consent`: show the consent screen again.
- `prompt=none`: never show any AI Tathastu screen. The callback gets one of:
  - `code`: the user is signed in and has approved Collaborate.
  - `error=login_required`: there is no AI Tathastu session.
  - `error=consent_required`: the user is signed in but hasn't approved Collaborate, or disconnected it. Consent is never granted silently.
- Other `prompt` values are ignored.
- Errors are redirected only to a registered callback. An unknown app or callback gets an error page on AI Tathastu and no redirect.
- `error=temporarily_unavailable`: the app is switched off. That means its client secret is missing, the signing key is missing, or the `collaborate_profile_api` flag is off.
- Codes are 256-bit random values, stored only as SHA-256 hashes. Each is valid for 60 seconds and single use. It is bound to the client, user, redirect URI, PKCE challenge and the user's session version.

### Token (`POST /api/integrations/sso/token`)

Client authentication, one of:
- `Authorization: Basic base64(urlencode(client_id) ":" urlencode(client_secret))`
- `client_id` and `client_secret` in the body

Body (form-encoded or JSON): `grant_type=authorization_code`, `code`, `redirect_uri` (identical to step 2), `code_verifier`.

Response `200`, `Cache-Control: no-store`:

```json
{ "access_token": "<ES256 JWT>", "token_type": "Bearer", "expires_in": 900,
  "scope": "profile:read", "user": { "id": "<uuid>", "email": "…", "name": "…" } }
```

Errors (`{ "error", "error_description" }`):

| Status | `error` | Meaning |
|---|---|---|
| 401 | `invalid_client` | Unknown client or wrong secret |
| 403 | `unauthorized_client` | Collaborate's flag is off |
| 400 | `unsupported_grant_type` / `invalid_request` | Wrong grant, or missing code / redirect_uri |
| 400 | `invalid_grant` | Code is wrong, expired, already used, for another client, or for another redirect; the PKCE verifier is wrong; or the user disconnected, was deleted, or had sessions revoked since the code was issued |
| 429 | `slow_down` | 120 requests per minute per client IP (honour `Retry-After`) |
| 503 | `temporarily_unavailable` | The signing key is unavailable on AI Tathastu. Retry later. The code is spent, so the user must restart sign-in. |

There are no refresh tokens. The access token lasts 15 minutes. **Don't use it as
Collaborate's session.** Create Collaborate's own session when sign-in
completes. To refresh data later, use webhooks, or send the user through
authorize again: it's silent once linked.

### Access token (JWT)

- Header: `alg: ES256`, `kid: <current key id>`, `typ: JWT`.
- Claims: `iss = https://www.aitathastu.com`, `aud = collaborate`, `sub` = the AI Tathastu user UUID (stable, and the key to link accounts on), `email`, `name`, `scope = profile:read`, `sv` (session version), `iat`, `exp`, `jti`.
- To verify, require `alg` ES256 only, `iss` exact, `aud` exact, and `exp`. Pick the key by `kid` from the JWKS.

### JWKS (`GET /api/integrations/jwks`)

- Public, no authentication, CORS `*`, `Cache-Control: public, max-age=3600`.
- Publishes the public half of the current signing key, plus any retired public keys during a rotation. Never private material.
- Rendered on every request, never at build time. It used to be prerendered at build, which froze `503 {"keys":[]}` into production builds that had no key.
- If the key is missing or invalid: `503 {"keys":[],"error":"signing_key_unavailable"}` with `no-store`. The reason is logged on Vercel as `[jwks] integration signing key unavailable: <reason>`, without key material.
- When the key loads, AI Tathastu checks that its `x`/`y` belong to its private scalar `d` before publishing.

### Profile (`GET /api/integrations/v1/profile`)

- `Authorization: Bearer <access_token>`. Returns `ProfessionalProjectionV1` for `sub`.
- Sections the user didn't share are `null` and listed in `privacy.masked`. Projects the user hid are left out.
- `401` once the user disconnects Collaborate, is deleted, or signs out everywhere (session version change), even with an unexpired token.

### Webhooks (AI Tathastu → Collaborate)

- `POST INTEGRATION_COLLABORATE_WEBHOOK_URL`, e.g. `https://collaborate.aitathastu.com/api/webhooks/tathastu`.
- Headers:
  - `X-AIT-Event`: `profile.updated` or `integration.revoked`
  - `X-AIT-Delivery`: a UUID (deduplicate on it)
  - `X-AIT-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`
- The receiver must check the HMAC in constant time and reject `t` older than 5 minutes.
- Failed deliveries are retried with backoff. A daily cron sweep (`CRON_SECRET`) also retries them.

## 2. Two ways in

**A. From the AI Tathastu dashboard.** The sidebar, the mobile drawer and
Settings → Integrations have **Open Collaborate**, which goes to
`/integrations/launch/collaborate`. That route:

1. Requires an AI Tathastu session. If there is none, it sends the user to login and comes back.
2. Checks that Collaborate is switched on (client secret, signing key, flag). If not, it goes to `/settings/integrations?unavailable=collaborate`, which shows a notice.
3. Redirects (303) to `https://collaborate.aitathastu.com/api/auth/tathastu/start`.

Collaborate then runs the normal flow. AI Tathastu already has the session and
the consent, so authorize returns a code with no screen, and the user lands in
Collaborate signed in. The first time, the user sees the consent screen once.
The launch route grants nothing by itself and puts no code or secret in the
browser.

**B. Opening Collaborate directly.** Collaborate's login page shows **Continue
with AI Tathastu**, linking to its own `/api/auth/tathastu/start`. The user
signs in to AI Tathastu if needed, approves once, and returns signed in.
Collaborate can try `prompt=none` first to check silently and fall back to
the normal flow on `login_required` / `consent_required`.

This button is a **Collaborate-side change**. Per the Collaborate audit, it is
not yet on its logged-out login page, and failed sign-ins (`?auth_error=`) aren't
shown to the user.

## 3. Environment variables (names only)

### AI Tathastu (Vercel, Production)

| Name | Required | Notes |
|---|---|---|
| `INTEGRATION_JWT_PRIVATE_KEY` | Yes | One-line EC P-256 private JWK with `kid` (`node scripts/integration-key.mjs`). Paste the JSON **without** the surrounding quotes. Mark it Sensitive. |
| `INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS` | Rotation only | JSON array of retired **public** JWKs |
| `INTEGRATION_COLLABORATE_CLIENT_SECRET` | Yes | See §4. Mark it Sensitive. |
| `INTEGRATION_COLLABORATE_REDIRECT_URIS` | Strongly recommended | `https://collaborate.aitathastu.com/api/auth/tathastu/callback`. If unset, only that same path on the Collaborate origin is accepted. |
| `INTEGRATION_COLLABORATE_WEBHOOK_URL` | For push sync | Collaborate's receiver URL |
| `INTEGRATION_COLLABORATE_WEBHOOK_SECRET` | With the webhook URL | A separate random secret, different from the client secret |
| `INTEGRATION_COLLABORATE_ORIGIN` | No | Local development only |
| `INTEGRATION_COLLABORATE_PKCE_OPTIONAL` | No | Leave unset. Collaborate sends PKCE. |
| `CRON_SECRET`, `INTERNAL_API_SECRET` | Yes | Webhook retry sweep; status endpoint |

Database feature flag: `collaborate_profile_api`.

### Collaborate (Render backend, and wherever its server code runs)

Names as read by Collaborate's `src/integrations/tathastu/client.ts`, per its
audit. That file also reads `AI_TATHASTU_*` aliases, so confirm which ones it
actually uses.

| Name | Value |
|---|---|
| `AIT_ISSUER` | `https://www.aitathastu.com` |
| `AIT_CLIENT_ID` | `collaborate` |
| `AIT_CLIENT_SECRET` | **The same value** as AI Tathastu's `INTEGRATION_COLLABORATE_CLIENT_SECRET` |
| `AIT_REDIRECT_URI` | `https://collaborate.aitathastu.com/api/auth/tathastu/callback` |
| `AIT_AUTHORIZE_URL` | `https://www.aitathastu.com/integrations/authorize` |
| `AIT_TOKEN_URL` | `https://www.aitathastu.com/api/integrations/sso/token` |
| `AIT_JWKS_URL` | `https://www.aitathastu.com/api/integrations/jwks` |
| `AIT_PROFILE_URL` | `https://www.aitathastu.com/api/integrations/v1/profile` |
| `AIT_WEBHOOK_SECRET` | **The same value** as AI Tathastu's `INTEGRATION_COLLABORATE_WEBHOOK_SECRET` |
| `TATHASTU_INTEGRATION_MODE` | `live` (the default is a mock adapter) |

## 4. Provisioning the client secret

Do this on a trusted machine. Don't paste the output anywhere except the two
secret stores.

```bash
# 32 random bytes, base64url: no + / = characters, so Basic auth is simple
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

1. Generate one value for the client secret and a **different** one for the webhook secret.
2. Put the client secret in **AI Tathastu Vercel Production** as `INTEGRATION_COLLABORATE_CLIENT_SECRET` (Sensitive), and in **Collaborate Render** as `AIT_CLIENT_SECRET`. These must be the exact same value: no quotes, spaces or newline.
3. Do the same for the webhook secret: `INTEGRATION_COLLABORATE_WEBHOOK_SECRET` on AI Tathastu, `AIT_WEBHOOK_SECRET` on Collaborate.
4. Compare the two sides by fingerprint, never by value.
   - AI Tathastu shows fingerprints at `GET /api/internal/integrations/status` (`Authorization: Bearer <INTERNAL_API_SECRET>`).
   - On Collaborate's side, compute `printf %s "$VALUE" | shasum -a 256 | cut -c1-8`.
5. Delete the values from your clipboard and terminal history.

To rotate the client secret, coordinate a maintenance window, change both
sides, and redeploy both. There is no overlap period for client secrets.

## 5. Production checklist

AI Tathastu:
- [ ] `INTEGRATION_JWT_PRIVATE_KEY` set for **Production** (not only Preview), unquoted, with a real `kid` (not `e2e-test-key` or `test-key`)
- [ ] `INTEGRATION_COLLABORATE_CLIENT_SECRET`, `…_REDIRECT_URIS`, `…_WEBHOOK_URL`, `…_WEBHOOK_SECRET` set
- [ ] Deployed a build that includes the dynamic JWKS route (redeploy after changing any variable)
- [ ] `GET /api/internal/integrations/status` → `ok: true`, `signingKey.loads: true`, the expected `kid`
- [ ] `GET /api/integrations/jwks` → `200`, one key with that `kid`, no `d`
- [ ] Flag on, once the steps above pass: `npm run flags -- on collaborate_profile_api`. This is a production database write, made by an operator.

Collaborate:
- [ ] `AIT_*` variables above set on Render; `TATHASTU_INTEGRATION_MODE=live`; redeployed
- [ ] "Continue with AI Tathastu" on the logged-out login page; `?auth_error=` shown to the user
- [ ] Hardcoded demo logins removed before public launch

## 6. Manual end-to-end test

1. **Fresh user, direct.** In a private window, open Collaborate → Continue with AI Tathastu → AI Tathastu login → consent screen → back in Collaborate signed in, with only the approved sections imported.
2. **Seamless, from the dashboard.** Still signed in to AI Tathastu, sign out of Collaborate only. In AI Tathastu, click **Open Collaborate**. You should land signed in with no AI Tathastu screen.
3. **Silent check.** Send Collaborate's start with `prompt=none` while signed out of AI Tathastu. Collaborate should receive `error=login_required`. Signed in but not approved, it should receive `consent_required`.
4. **Consent change.** Turn a section off in Settings → Integrations. After the next `profile.updated` webhook, or a re-fetch, it is `null` in Collaborate.
5. **Revocation.** Disconnect Collaborate in Settings → Integrations. Collaborate receives `integration.revoked`, profile calls return `401`, and the next launch shows the consent screen again.
6. **Account linking.** Sign in with an AI Tathastu account whose email matches an existing Collaborate password account. Collaborate must ask for the Collaborate password before linking (its anti-takeover rule).
7. **Independence.** With AI Tathastu unreachable, Collaborate's own email and password login still works.

## 7. Troubleshooting

| Symptom | Likely cause | Check |
|---|---|---|
| JWKS `503 {"keys":[],"error":"signing_key_unavailable"}` | Key missing, quoted or invalid in this deployment | Vercel logs `[jwks] …`; status endpoint `signingKey.error` |
| JWKS `503 {"keys":[]}` with no `error` field | An old build is still serving the prerendered response | Redeploy with this change |
| `error=temporarily_unavailable` at authorize | Client secret, signing key or flag missing | Status endpoint, flag |
| "The return address for Collaborate isn't registered" | `redirect_uri` doesn't match `…_REDIRECT_URIS` exactly | Trailing slash, `http` vs `https`, host |
| Token `401 invalid_client` | The secrets differ between the two sides | Compare fingerprints |
| Token `400 invalid_grant` | Code reused or over 60 seconds old, `redirect_uri` differs from authorize, PKCE verifier lost (flow cookie missing), or the user disconnected | Collaborate's flow cookie, clocks |
| Token `503 temporarily_unavailable` | Signing key unavailable | As for JWKS |
| Collaborate `TOKEN_VERIFICATION_FAILED` | JWKS unreachable, `iss`/`aud` mismatch, or a stale JWKS cache after rotation | `AIT_ISSUER` exact, `AIT_CLIENT_ID=collaborate` |
| Profile `401` with a fresh token | User disconnected or signed out everywhere | Settings → Integrations |
| Open Collaborate goes back to Integrations with a notice | App not switched on in this deployment | Same as `temporarily_unavailable` |

## 8. Consent and revocation

- Consent is stored per user and app. Optional scopes start off. Changes apply to the next profile read and the next webhook.
- Disconnecting (Settings → Integrations) revokes the link:
  - authorize shows consent again (and `prompt=none` answers `consent_required`)
  - unexchanged codes and live tokens stop working
  - `integration.revoked` is sent
- Signing out everywhere bumps the session version, which invalidates outstanding codes and tokens.
- Ordinary AI Tathastu sign-out does not sign the user out of Collaborate. There is no single logout. Collaborate's own session lasts until it expires.
