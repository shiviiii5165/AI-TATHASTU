# Integrating with AI Tathastu (Collaborate, Tathastu Meet)

For the developers of **Collaborate** (`collaborate.aitathastu.com`) and **Tathastu Meet** (`connect.aitathastu.com`).

AI Tathastu is the identity provider and the source of truth for a user's professional profile. Your app:

1. Signs users in with **"Sign in with AI Tathastu"**, using the OAuth 2.0 authorization-code flow (PKCE recommended).
2. Gets a **15-minute access token**: an ES256 JWT whose audience is your app.
3. Reads the user's **`ProfessionalProjectionV1`** profile with that token, filtered by what the user agreed to share with you.
4. Receives **signed webhooks** when the profile changes or the user disconnects your app.

Base URL: `https://www.aitathastu.com`

| | |
| --- | --- |
| `client_id` | `collaborate` or `meet` |
| Authorization | `GET /integrations/authorize` (browser) |
| Token | `POST /api/integrations/sso/token` (your server) |
| Profile | `GET /api/integrations/v1/profile` (your server) |
| Public keys | `GET /api/integrations/jwks` |
| Token issuer (`iss`) | `https://www.aitathastu.com` |

Never call the token or profile endpoints from a browser. They are server-to-server only and send no CORS headers.

---

## 0. What we exchange before you start

You send us:

- Your **redirect URI(s)**, exact. Registered for Collaborate: `https://collaborate.aitathastu.com/api/auth/tathastu/callback`.
- Your **webhook URL**, optional but needed for push sync. Registered for Collaborate: `https://collaborate.aitathastu.com/api/webhooks/tathastu`.

We send you, through a secret manager and never by chat or email:

- `client_secret`: authenticates your server at the token endpoint.
- `webhook_secret`: verifies the webhooks we send you.

The integration is also behind a feature flag on our side (`collaborate_profile_api`, `meet_profile_api`). While it's off, every endpoint answers `403`, and the authorize page tells the user it isn't available yet.

---

## 1. Start sign-in

When the user clicks "Sign in with AI Tathastu", generate:

- `state`: a random value you store in the user's session (CSRF protection).
- PKCE (required): `code_verifier` = 43–128 random URL-safe characters, and `code_challenge` = `BASE64URL(SHA-256(code_verifier))`.

Then redirect the browser to:

```
https://www.aitathastu.com/integrations/authorize
  ?client_id=collaborate
  &redirect_uri=https%3A%2F%2Fcollaborate.aitathastu.com%2Fauth%2Faitathastu%2Fcallback
  &state=RANDOM_STATE
  &code_challenge=BASE64URL_SHA256
  &code_challenge_method=S256
```

What happens on our side:

- A user who isn't signed in to AI Tathastu signs in first (Google, LinkedIn or email link), then returns here.
- On the **first visit**, the user sees an approval screen and chooses what your app may see. Identity is always shared. Skills, projects, ERIS score, experience, education, achievements and activity all **start switched off**; scopes your app asked for are labelled "Requested by <your app>", but only the user turns them on. Expect a new user to share little or nothing at first, and handle `null` sections gracefully.
- On **later visits**, the screen is skipped and the user goes straight back to you. Add `&prompt=consent` to show it again.

We then redirect to your `redirect_uri`:

| Outcome | Query parameters |
| --- | --- |
| Approved | `?code=…&state=…` |
| User cancelled | `?error=access_denied&state=…` |
| Bad request or integration switched off | `?error=invalid_request\|temporarily_unavailable&error_description=…&state=…` |

**Check that `state` matches the value you stored before doing anything else.** An unregistered `redirect_uri` never gets a redirect; the user sees an error on our page instead.

## 2. Exchange the code for a token (server-side)

The code is single-use and expires after **60 seconds**.

```http
POST /api/integrations/sso/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=authorization_code
&code=THE_CODE
&redirect_uri=https%3A%2F%2Fcollaborate.aitathastu.com%2Fauth%2Faitathastu%2Fcallback
&code_verifier=THE_PKCE_VERIFIER
```

`client_id` and `client_secret` may be sent as form fields instead of Basic auth. A JSON body with the same fields also works. `redirect_uri` must be exactly the one used in step 1.

Response `200`:

```json
{
  "access_token": "eyJhbGciOiJFUzI1NiIsImtpZCI6...",
  "token_type": "Bearer",
  "expires_in": 900,
  "scope": "profile:read",
  "user": { "id": "4f1c…-uuid", "email": "asha@example.com", "name": "Asha Rao" }
}
```

Errors follow OAuth conventions: `{ "error": "...", "error_description": "..." }`.

| Status | `error` | Meaning |
| --- | --- | --- |
| 400 | `invalid_grant` | Code unknown, expired, already used, wrong `redirect_uri`, or PKCE mismatch |
| 400 | `unsupported_grant_type` / `invalid_request` | Bad request |
| 401 | `invalid_client` | Wrong `client_id` or `client_secret` |
| 403 | `unauthorized_client` | The integration is switched off |

Use `user.id` (also the token's `sub`) as the stable key for the user in your database. Don't use email: users can change it.

## 3. Validate the JWT

The token is an **ES256** JWT signed with our private key. You verify it with our public keys. You can't mint tokens, and neither can the other app.

| Claim | Value |
| --- | --- |
| `iss` | `https://www.aitathastu.com` |
| `aud` | your `client_id` (`collaborate` or `meet`), and only that |
| `sub` | AI Tathastu user id (UUID) |
| `email`, `name` | as known at sign-in |
| `scope` | `profile:read` |
| `iat`, `exp` | `exp - iat = 900` (15 minutes) |
| `jti` | unique token id |
| header `kid` | key id; match it against the JWKS |

Node (with [`jose`](https://github.com/panva/jose)):

```ts
import { createRemoteJWKSet, jwtVerify } from "jose";

const JWKS = createRemoteJWKSet(new URL("https://www.aitathastu.com/api/integrations/jwks"));

export async function verifyAitToken(token: string) {
  const { payload } = await jwtVerify(token, JWKS, {
    issuer: "https://www.aitathastu.com",
    audience: "collaborate", // your client_id
    algorithms: ["ES256"],
  });
  return { userId: payload.sub!, email: payload.email as string | null };
}
```

Python (PyJWT):

```python
import jwt
jwks = jwt.PyJWKClient("https://www.aitathastu.com/api/integrations/jwks")
key = jwks.get_signing_key_from_jwt(token).key
claims = jwt.decode(token, key, algorithms=["ES256"], audience="meet", issuer="https://www.aitathastu.com")
```

The JWKS may be cached for an hour. **Always select the key by the token's `kid`** (`createRemoteJWKSet` and `PyJWKClient` do), because the set can hold more than one key. During a rotation, the old public key stays published for at least an hour after we switch, so tokens and cached key sets keep verifying. If you see an unknown `kid`, refetch the JWKS once before rejecting the token.

Create your own app session from the verified token. Don't keep the access token as the session: it expires after 15 minutes. When you need fresh data, send the user through step 1 again (it's instant once approved) or rely on webhooks.

## 4. Read the profile

```http
GET /api/integrations/v1/profile
Authorization: Bearer <access_token>
If-None-Match: W/"…"          (optional; 304 if unchanged)
```

The endpoint returns the token's user and nobody else. There is no user parameter.

| Status | Meaning |
| --- | --- |
| 200 | `ProfessionalProjectionV1` (below) |
| 304 | Unchanged since your `If-None-Match` ETag |
| 401 | Token missing, invalid or expired, **or the user disconnected your app** (access ends immediately, not at `exp`) |
| 403 | Integration switched off |
| 503 | Temporary; retry after `Retry-After` seconds |

### `ProfessionalProjectionV1`

Every section except `identity` and `privacy` is `null` when the user hasn't shared it, and its name is listed in `privacy.masked`. Treat `null` as "not shared", never as "empty". Phone numbers and resume files are never included.

```jsonc
{
  "schema": "ProfessionalProjectionV1",
  "version": 1,
  "audience": "collaborate",
  "generatedAt": "2026-10-22T09:30:00.000Z",

  // Always shared.
  "identity": {
    "id": "4f1c…",                 // = token sub
    "email": "asha@example.com",
    "name": "Asha Rao",
    "headline": "ML engineer building RAG systems",
    "avatarUrl": "https://…",
    "careerRole": { "id": "ml_engineer", "label": "ML Engineer" },
    "careerRoleOther": null,
    "location": { "city": "Pune", "country": "India" },
    "university": "IIT Madras",
    "persona": "student",          // "student" | "faculty" | "alumni"
    "department": null,            // faculty
    "academicTitle": null,         // faculty, e.g. "Assistant Professor"
    "company": null,               // alumni (current employer)
    "jobTitle": null,              // alumni
    "graduationYear": null         // alumni
  },

  // scope: education
  "education": [
    { "institution": "IIT Madras", "degree": "B.Tech", "fieldOfStudy": "Computer Science",
      "dates": "2022 – 2026", "grade": "8.9 CGPA", "sources": ["resume"] }
  ],

  // scope: skills (+ eris for erisReadiness)
  "skills": {
    "items": [
      { "name": "PyTorch", "category": "ml_framework", "evidenceStrength": 0.9,
        "verified": true, "verificationStatus": "verified", "sources": ["resume", "github"],
        // added 2026-11 (optional): the engine's evidence-based score; both null when not assessed
        "proficiency": 62, "level": "Proficient" }
    ],
    "erisReadiness": {             // null unless the user shares the ERIS score
      "score": 0.63,               // 0–1
      "role": "ml_engineer",
      "byRole": { "ml_engineer": 0.63 },
      "gaps": [{ "skill": "Kubernetes", "readiness": 0.2, "weight": 0.8 }],
      "computedAt": "2026-10-22T09:12:00.000Z"
    }
  },

  // scope: projects (the user can also hide individual projects)
  "projects": [
    { "key": "p_3fa1c2…",          // stable id for upserts
      "title": "Resume Parser", "description": "…", "technologies": ["Python", "PyTorch"],
      "links": ["https://github.com/asha/resume-parser"], "status": "matched", "sources": ["resume", "github"] }
  ],

  // scope: experience
  "experience": [
    { "organization": "Acme AI", "role": "ML Engineer intern", "dates": "May 2025 – Jul 2025",
      "description": "…", "sources": ["resume"] }
  ],

  // scope: achievements (achievements, certifications, publications). Since 2026-11-11 LeetCode /
  // HackerRank stats are no longer listed here; they are coding activity (see activity.coding).
  "achievements": [
    { "type": "certification", "title": "Deep Learning Specialization", "issuer": "Coursera",
      "date": "2025", "description": null, "url": null, "sources": ["resume"] }
  ],

  // scope: activity
  "activity": {
    "connectedSources": ["github", "leetcode"],
    "github": {
      "repositories": 22,
      "recent": [{ "name": "asha/resume-parser", "url": "https://github.com/asha/resume-parser",
                   "stars": 14, "languages": ["Python"], "lastCommitAt": "2026-10-20T10:00:00.000Z" }]
    },
    "profileUpdatedAt": "2026-10-22T09:12:00.000Z",
    // Added 2026-11-11, optional (older payloads omit it: treat as unknown, not as zero).
    // From the platform's public profile API. A count the platform did not return is null, never 0;
    // contest results are separate from solved counts. [] = no coding platform connected.
    "coding": [
      { "source": "leetcode",
        "solved": { "total": 120, "easy": 70, "medium": 45, "hard": 5 },
        "contest": { "rating": 1610, "attended": 8, "topPercentage": 22.5 },   // or null
        "profileRef": "leetcode.com/u/asha",
        "verification": "public_profile_import" }   // proves the numbers came from the platform, not account ownership
    ]
  },

  // scope: eris (added 2026-11, optional; older consumers may ignore it). What the user is working
  // towards, so an app can find people who can help. null and listed in masked when not shared.
  "goals": {
    "targetRole": { "id": "ml_engineer", "label": "ML Engineer" },
    "needs": [{ "skill": "PyTorch", "priority": "High", "state": "missing", "expectedLevel": "Working" }],
    "assessed": true,              // false: too little evidence to assess; needs is then [] (not "no gaps")
    "assessedAt": "2026-11-10T08:00:00.000Z",   // added 2026-11-11, optional; null when not assessed
    "collaborationIntents": ["collaborate", "people_mentors"]
  },

  "privacy": {
    "scopes": { "skills": true, "projects": true, "eris": false, "experience": true,
                "education": true, "achievements": true, "activity": false },
    "masked": ["activity", "skills.erisReadiness"],
    "hiddenProjects": 1,           // projects the user chose to keep from you
    "consentUpdatedAt": "2026-10-22T09:00:00.000Z"
  }
}
```

`sources` tell you where a value came from: `resume`, `user_entered`, `github`, `kaggle`, `leetcode`, `hackerrank`, `stack_exchange`, `portfolio` or `linkedin_scrape`. A skill with `verified: true` is backed by evidence from a connected source or confirmed by the user.

**When a section becomes `null`, delete what you stored from it.** The user has withdrawn consent.

## 5. Webhooks

If you gave us a webhook URL, we `POST` to it:

| Event | When | `data` |
| --- | --- | --- |
| `profile.updated` | The user confirmed new facts, their ERIS score or projects were recomputed, they changed what they share with you, or they pressed "Sync profile" | `{ userId, reason, profile }`, where `profile` is a full `ProfessionalProjectionV1`, already filtered by consent |
| `integration.revoked` | The user disconnected your app | `{ userId }` |

```http
POST /api/webhooks/tathastu
Content-Type: application/json
User-Agent: AI-Tathastu-Webhooks/1
X-AIT-Event: profile.updated
X-AIT-Delivery: 0b5e…-uuid
X-AIT-Signature: t=1761125400,v1=5f2b…hex

{"id":"0b5e…","type":"profile.updated","createdAt":"…","data":{"userId":"4f1c…","reason":"profile_recomputed","profile":{…}}}
```

### Verify the signature

`v1` is `HEX(HMAC-SHA256(webhook_secret, "<t>.<raw request body>"))`:

1. Read the **raw body bytes**. Don't re-serialize parsed JSON.
2. Reject the request if `t` is more than 5 minutes from your clock (replay protection).
3. Compare signatures in constant time.

Node:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyAitWebhook(rawBody: string, header: string | null, secret: string) {
  const m = header?.match(/^t=(\d+),v1=([0-9a-f]{64})$/);
  if (!m) return false;
  const [, t, v1] = m;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return timingSafeEqual(Buffer.from(v1, "hex"), Buffer.from(expected, "hex"));
}

// Next.js route handler
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifyAitWebhook(raw, req.headers.get("x-ait-signature"), process.env.AIT_WEBHOOK_SECRET!)) {
    return new Response("bad signature", { status: 401 });
  }
  const event = JSON.parse(raw);
  // dedupe on event.id, then upsert event.data.profile or delete on integration.revoked
  return new Response(null, { status: 204 });
}
```

Python:

```python
import hmac, hashlib, time

def verify_ait_webhook(raw_body: bytes, header: str, secret: str) -> bool:
    try:
        parts = dict(p.split("=", 1) for p in header.split(","))
        t, v1 = int(parts["t"]), parts["v1"]
    except Exception:
        return False
    if abs(time.time() - t) > 300:
        return False
    expected = hmac.new(secret.encode(), f"{t}.".encode() + raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(v1, expected)
```

### Delivery rules

- **Respond 2xx within 10 seconds.** Queue the work and process it afterwards if needed.
- **Failures are retried** after 1 min, 5 min, 30 min, 2 h and 12 h, then dropped (6 attempts in total). A 3xx counts as a failure; we don't follow redirects.
- **At-least-once delivery.** Deduplicate on `X-AIT-Delivery` (the event `id`).
- **Bursts coalesce.** Several changes in quick succession may arrive as one `profile.updated`. The payload is built when it's sent, so it's always the latest profile; you never need to merge partial updates.
- **On `integration.revoked`:** delete the user's AI Tathastu data, end their app session if you can, and stop calling the profile endpoint for them (it returns 401).

## 6. Local development

Point your app at a local AI Tathastu (`http://localhost:3000`) and ask us to set these in its `.env.local`:

```
INTEGRATION_COLLABORATE_CLIENT_SECRET=dev-secret-at-least-32-characters-long
INTEGRATION_COLLABORATE_REDIRECT_URIS=http://localhost:4000/api/auth/tathastu/callback
INTEGRATION_COLLABORATE_WEBHOOK_URL=http://localhost:4000/api/webhooks/tathastu
INTEGRATION_COLLABORATE_WEBHOOK_SECRET=dev-webhook-secret
```

`http://` redirect URIs are accepted only for `localhost` and `127.0.0.1`. Local issuers still use `iss: https://www.aitathastu.com`.

The end-to-end test `e2e/integrations.spec.ts` in the AI Tathastu repo walks through the whole flow and is a working reference.

## 7. Checklist

- [ ] `state` generated per sign-in and checked on the callback
- [ ] PKCE `S256` (recommended)
- [ ] Code exchanged server-side with Basic auth; `client_secret` never reaches the browser
- [ ] JWT verified against the JWKS: `alg ES256`, `iss`, `aud = your client_id`, `exp`
- [ ] Users keyed by `sub` (UUID), not email
- [ ] `null` sections treated as "not shared", and stored copies deleted
- [ ] Webhook signature verified over the raw body; 5-minute timestamp window; dedupe on delivery id
- [ ] `integration.revoked` deletes the user's AI Tathastu data
