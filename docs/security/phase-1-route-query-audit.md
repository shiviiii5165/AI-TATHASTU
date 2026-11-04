# Phase 1: route, Server Action and query audit

Audited 2026-11-01 against the uncommitted working tree on `main` (base `c767e1d`, 60 changed paths). Everything here comes from reading code. Nothing was run against Vercel, Neon, R2 or Render, so no row below is PREVIEW or PRODUCTION VERIFIED.

**Keep this file out of public places.** It describes open weaknesses.

Coverage: every route handler and every Server Action was read in full, including the inline `"use server"` functions. Query scope was checked for all listed web libraries and worker handlers. Not read line by line: React components, admin page bodies below their guards, `worker/intelligence/compute.py` internals beyond its queries, and `worker/resume/verify.py`.

Legend: **Auth** S = session via `auth()`, DAL = `dal.ts` guard (also rejects deleted users), I = internal bearer, C = cron or internal bearer, T = signed token, none = public. **Limit** shows limit/window and what happens if the limiter's database is down: L = per-instance fallback, D = deny.

## 1. Route handlers (28 files)

| Route | Auth | Owner boundary | Validation | Limit | CORS | Data / exposure | Tests |
|---|---|---|---|---|---|---|---|
| `GET,POST /api/auth/[...nextauth]` | Auth.js | n/a | Auth.js | Magic link 5/15m per address, 60/15m per IP, D. OAuth start: none | none | Session cookie | `auth.test`, `rate-limit.test` |
| `GET /api/auth/embed-token` | S, no deleted check | Session user | Origin allowlist | 60/1h, L | none | 15-min HS256 token | `profile/v1/me` |
| `GET /api/profile/v1/me` | S or T | Token subject or session; no user param | Module allowlist | 120/1m, L | Allowlist, no credentials | Profile; `activeUser` check | Yes |
| `GET /api/integrations/v1/profile` | T (ES256) | Token subject; consent re-read | Claims | 120/1m, L | none | Consent-filtered projection | `integrations.test` |
| `POST /api/integrations/sso/token` | Client secret, constant-time | Code bound to client, user, redirect | Grant fields | 120/1m IP or client, L | none | ES256 token. PKCE only if challenge was sent | `integrations.test` |
| `GET /api/integrations/jwks` | none | Public keys | n/a | none, cacheable | `*` | Public keys only | `integrations.test` |
| `GET /api/connectors/github/start` | DAL | Cookie binds user+state | `from` allowlist | **none** | none | Redirect | none |
| `GET /api/connectors/github/callback` | DAL | Cookie user == session; state constant-time | State, code | **none** | none | Sealed token stored | none |
| `GET /api/connectors/orcid/start` | DAL | As GitHub | `from` parsed | **none** | none | Redirect | none |
| `GET /api/connectors/orcid/callback` | DAL | As GitHub | State, code | **none** | none | iD and name sealed | none |
| `GET /api/dashboard/status` | DAL | Session user | none needed | **none** (two reads per poll) | none | Readiness only | Yes |
| `GET /api/jobs/[id]` | S | `getJobForUser` scopes to owner; 404 otherwise | UUID regex | 600/1m, L | none | Status; worker errors hidden | **No cross-user test** |
| `GET /api/collaboration/matches` | S + `viewerFor` | `discoverableBy` | none needed | 60/1m, L | none | Name, role, institution, department | `discovery.test` |
| `GET /api/search` | S + `viewerFor` | People: `discoverableBy`; projects: owner. **Skills: global** | Trim, 100 chars, LIKE escaped | 60/1m, L | none | See P1-08 | Yes |
| `GET /api/academic/institutions` | S | Verified catalogue | Trim, 100 chars | 120/1m, L | none | Public catalogue | `academic.test` |
| `POST /api/analytics` | S | Own id; dropped without consent | Zod strict | 60/1m, L | none | Allowlisted fields | none |
| `POST /api/consents` | DAL | Session user | Zod | 60/1m, L | none | **Can queue paid jobs, P1-01** | `reliability-writes` |
| `POST,GET /api/widget-prefs` | DAL | Session user | Zod; GET unlimited | 120/1m POST, L | none | Own prefs | none |
| `GET /api/session/refresh` | S | Session user | `toLocalPath` | 60/1m, L | none | Redirect | Yes |
| `POST /api/upload/resume` | DAL step | Key built from session id | Zod, 10 MB, mime, sha256 | 30/1h, L | none | Presigned PUT, 5 min | none |
| `POST /api/upload/resume/complete` | DAL step | Key built from session id | Zod + HEAD check | 60/1h, L | none | Job id | Yes |
| `POST /api/contact` | none | n/a | Zod, escaped, header-safe | 5/1m per IP hash, L; 503 in prod without IP | none | Emails support inbox | Yes |
| `POST /api/yora/chat` | S + deleted check | Own rows; `similarPeople` for others | 2000 chars | 30/1m, L | none | Rule-based, no LLM | Yes |
| `POST /api/internal/notify` | I | Job id only; recipient from DB | UUID | n/a | none | Email | Yes |
| `POST /api/internal/profile-updated` | I | userId in body, trusted caller | UUID | n/a | none | Webhook queue | none |
| `GET,POST /api/internal/webhooks/dispatch` | C | System | n/a | n/a | none | Counts | none |
| `GET /api/internal/queue-health` | C | System | n/a | n/a | none | Counts | Yes |
| `GET /api/internal/integrations/status` | I | System | n/a | n/a | none | Fingerprints, no values | none |

**CSRF:** cookie-authenticated POST routes rely on the Auth.js SameSite=Lax session cookie; they don't check `Origin`. Server Actions rely on Next's built-in Origin check. **Request size:** no route sets its own limit, so platform defaults apply (not verified on Vercel). **Error handling:** routes without `guarded()` answer Next's bare 500 on a database outage: `notify`, `profile-updated`, `dispatch`, `integrations/status`, `embed-token`, and the connector start routes.

## 2. Server Actions

No action trusts a client-supplied user id. All write with the id from the session.

| File | Actions | Guard | Limit | Notes |
|---|---|---|---|---|
| `(auth)/login` | `signInWithProvider` | Public | Magic link only | `toLocalPath` on redirect |
| `integrations/authorize` | `approveIntegration`, `denyIntegration` | `auth()`; deny has none (no user data) | **none** | Query re-validated server-side. No deleted check |
| `settings/privacy` | `savePrivacyConsents`, `deleteMyAccount` | Onboarded / current user | **none** | P1-01 |
| `settings/integrations` | `saveIntegrationConsent`, `syncIntegration`, `disconnectIntegration` | Onboarded | **none** | `syncIntegration` runs a global dispatch, P1-03 |
| `dashboard` | `updateWidgetPref`, `refreshGithub` | Onboarded | **none** | P1-03 |
| `connections` | `connectWithForm` (limited 20/1h, L), `disconnect`, `allowLinkedInImport`, `connectLinkedIn` | Connector user | Partial | `allowLinkedInImport` can queue Apify, P1-01 |
| `onboarding/actions` | `saveCareerDirection`, `savePriorities`, `saveResumeReview`, `continueFromStep` | Step guard | **none** | Fact ids filtered by owner, `actions.ts:117` |
| `onboarding/persona-actions` | `choosePersona`, `submitFacultyProfile`, `submitMentorship`, `submitAlumniProfile`, `submitProfessionalProfile`, `submitGiveBack`, `saveResearch` | Step guard + role | **none** | Persona enum cannot grant admin |
| `onboarding/basic-profile` | `saveProfileDraft`, `submitBasicProfile`, inline `saveName` | Step guard | **none** | |
| `onboarding/review-consent` | `generateProfile` | Step guard | **none** | One-shot idempotency key |
| `onboarding/resume` | `setExternalAiConsent` | Current user + step | **none** | **P1-01** |
| `(dashboard)/layout`, `onboarding/layout` | Inline sign-outs (3) | None needed | none | Sign-out only |
| `support/tickets/[id]` | Inline `handleStudentReply` | Current user + `canAccessTicket`, re-checked in the action | **none** | 5000-char cap. `id` not UUID-checked (500 on junk) |
| `admin-mfa` | `startEnrollment`, `submitCode` | Operator | 5/15m, D | Phase 0 defects, fixed in Phase 2 |
| `admin/students` | `revokeStudentSessionsAction`, `executeStudentDeletionAction` | `requireAdmin` + permission | **none** | |
| `admin/tickets` | 4 actions; inline `handleCreate` on `tickets/new` | `requireAdmin` + permission (page and action) | **none** | P1-07 |
| `admin/emails` | `saveTemplateVersionAction`, `sendTestEmailAction`, `triggerOutboxDeliveryAction` | `requireAdmin` + permission | **none** | |
| `admin/ai-ops` | `updateBudgetPolicyAction`; inline wrapper on `costs` | `requireAdmin` + permission | **none** | Unvalidated numbers; P1-02 |
| `admin/flags` | `toggleFlagAction` | `requireAdmin` + permission | **none** | Audited |
| `admin/institutions` | `approveInstitution`, `mergeInstitution`, `rejectInstitution` | `requireAdmin` **only** | **none** | **No permission check, no audit**, P1-06 |

All 21 admin pages plus the layout call `requireAdmin` or `requireAdminPermission`. No API route exposes admin data.

## 3. Query boundaries

Scoped to the session or job user, verified: `dal.ts`, `connectors/connections.ts`, `connectors/cards.ts`, `connectors/linkedin.ts`, `consent/store.ts`, `dashboard/prefs.ts`, `integrations/consent.ts`, `onboarding/advance.ts`, `onboarding/user-facts.ts`, `profile/unified.ts`, `uploads/register.ts`, the dashboard pages (achievements, learning, projects, dashboard, skills, settings/integrations).

Cross-user by design, verified as gated: `discovery.ts` (consent and role in SQL), `people.ts`, `matches.ts` (mentor-scoped), `dashboard/network-count.ts` (counts only), `worker/intelligence/matches.py` (scores only `discoverable` populations).

Global shared data: `academic/catalog.ts` (verified institutions; pending rows per creator), `feature-flags.ts`, `skills`, `skill_aliases`, `learning_resources`, `opportunities`.

Administrative bypass, by design and behind `requireAdmin`: `admin/students.ts`, `admin/tickets.ts`, `admin/email-engine.ts`, `admin/ai-ops.ts`, `admin/audit.ts`, admin pages.

Worker: every handler query filters on `job.user_id`; `load_connection` also matches connection id and user id, and `resume/extract.py:56` matches file id and user id. Fencing (`assert_still_owner`) is on `compute.py:298`, `extract.py:69` and `finish_sync`. **Missing on** `connectors/github.py:120` and `intelligence/matches.py:81`. Fixed in Phase 2.

## 4. Storage, external calls and jobs

**R2:** keys are `resumes/<userId>/<sha256>.<ext>`, always built from the session id (`uploads/resume.ts:42`). Presigned PUTs sign type, length and SHA-256, TTL 5 minutes. Operations: presign, HEAD and DELETE (web); HEAD and GET (worker). Public bucket access and CORS: **BLOCKED, needs Cloudflare evidence**.

**External fetches (web):** GitHub token, user and grant (10 s timeout); ORCID; worker wake URL; webhook delivery to env-configured URLs (`redirect: manual`, 10 s); Resend/SMTP. **Worker:** Groq, Gemini, OpenRouter, Firecrawl, Apify, GitHub, Kaggle, Stack Exchange, ORCID, LeetCode, HackerRank, app notify. All hosts are fixed except Firecrawl's target URL. No worker call bounds its response size (P1-10).

**Jobs:** `resume_extract`, `connector_sync`, `compute_intelligence`, `compute_matches`, `generate_roadmap` (legacy). Claimed with `FOR UPDATE SKIP LOCKED`, 3 attempts, 30-minute heartbeat cap.

## 5. New confirmed findings

Severity is my judgement from code. Reproductions are written so they can become tests.

| ID | Sev | Finding | Evidence | Reproduction | Status |
|---|---|---|---|---|---|
| P1-01 | **High** | Toggling a consent queues paid work with no limit. Each false-to-true of `external_ai` inserts a new `resume_extract` with a random key, and `linkedin_scrape` a new `connector_sync`. Each resume job can make many LLM calls | `consent/store.ts:87-111`, `onboarding/resume/actions.ts:18`, `settings/privacy/actions.ts:19` | Call `setExternalAiConsent(true)` then `(false)` in a loop; job rows grow by one per cycle with no 429 | NOT FIXED, Phase 5 and 7 |
| P1-02 | **High** | No AI spend control exists, and the admin page implies one. `ai_cost_budgets` is seeded with an invented `spent_usd` of 18.42, and nothing writes spend or `ai_provider_telemetry`. The page says "Throttles on 100% breach"; the worker never reads the table | `admin/ai-ops.ts:100`, `admin/ai-ops/costs/page.tsx:55`, no worker reference | Set a hard limit of $0.01, run an extraction; it proceeds | NOT FIXED, Phase 7 |
| P1-03 | Med | User-triggerable work with no limit: `refreshGithub` (a new job each time one isn't already queued), `syncIntegration` (runs a global dispatch of up to 25 rows inline) | `dashboard/actions.ts:34`, `settings/integrations/actions.ts:48` | Call repeatedly | NOT FIXED, Phase 5 |
| P1-04 | Med | A tombstoned user can still sign in again, and routes using bare `auth()` don't check `deletedAt`: `embed-token`, `analytics`, `institutions`, `jobs`, `approveIntegration`, the authorize page | `auth.ts:106`, routes in section 1 | Tombstone a user, sign in with a magic link, call `/api/auth/embed-token` | Sign-in fixed in Phase 2 |
| P1-05 | Med | Embed tokens outlive session revocation by up to 15 minutes; only `deletedAt` is rechecked. Integration tokens check consent but not session version | `profile/v1/me/route.ts:40`, `embed-token.ts` | Revoke sessions, reuse the token | NOT FIXED, Phase 3 |
| P1-06 | Med | RBAC is inert. `requireAdmin` admits only global admins, and `isSuperAdmin` is true for every global admin regardless of `role`, so `hasPermission` always passes. Team-only members get 404 at the proxy. It fails closed, but an assigned lesser role limits nothing, and inactive flags don't apply to global admins. Institution actions have neither a permission check nor an audit entry | `admin.ts:21`, `rbac.ts:165,176`, `auth.config.ts:31`, `admin/institutions/actions.ts:34` | Give an `is_admin` user `role=support_agent`; flags still toggle | NOT FIXED, Phase 3 |
| P1-07 | Low | Public ticket replies email the acting agent, not the requester. Student replies stamp `firstResponseAt`. Ticket numbers use `Math.random` with 90,000 values. Search doesn't escape LIKE wildcards (admin only) | `admin/tickets/actions.ts:92`, `tickets.ts:67,149,324` | Reply as an agent; check the recipient | NOT FIXED, product bug |
| P1-08 | Med | Text from any user's resume or connector can become a row in the global `skills` table, which `/api/search` shows to every user and which survives account deletion | `intelligence/skills.py:61`, `search/route.ts:80` | Put a unique phrase in a skills section; search as another user | NOT FIXED, Phase 7 |
| P1-09 | Low | `recordAdminAudit` swallows every failure, so audit entries can vanish silently. It trusts `x-forwarded-for` and writes `127.0.0.1` when it's absent | `admin/audit.ts:25-26,39` | Make the insert fail; the action reports success | Deletion path fixed in Phase 2; the rest in Phase 10 |
| P1-10 | Low | Worker HTTP helpers read responses with no size limit, and `gzip.decompress` is unbounded. Hosts are fixed, so this needs a compromised or malicious provider | `connectors/common.py:43-45`, `provider_router.py:200` | Serve a large gzip from a stub | NOT FIXED, Phase 6 |
| P1-11 | Low | `emailDeliveries` processing has no atomic claim, so two concurrent runs can send twice | `admin/email-engine.ts:268` | Run two concurrently | NOT FIXED, Phase 12 |

**Correction to Phase 0:** I reported that an audit failure makes a deletion report a false failure. `recordAdminAudit` swallows its errors, so the real defect is that the audit entry is silently lost (P1-09).

**Leads checked and dismissed:** resume URLs reaching a scraper (`route_contact_url` only stores facts; nothing fetches them). Ticket BOLA (`canAccessTicket` runs on both render and action, though it has no test). Open redirect in `session/refresh` (`toLocalPath` rejects `//`, backslashes and other origins).

## 6. BOLA/IDOR test matrix

"Automated" means a test asserts another user is refused or filtered.

| Object | Entry points | Boundary | Automated |
|---|---|---|---|
| Job | `/api/jobs/[id]`, `getJobForUser` | `userId` in WHERE | Added: `tenant-isolation.test.ts` |
| Connection | `disconnect`, `refreshGithub`, connector callbacks | `userId` + `sourceId` | Added for `disconnectSource`. Callbacks: **gap** |
| Consent | All consent writers | Session id | Added |
| Widget prefs | Route + action | Session id | Added |
| Profile fact | `saveResumeReview` | `userId` + `origin` + state | Added (query boundary). Action-level: **gap** |
| Profile | `/api/profile/v1/me`, integrations profile | Token subject | Existing tests |
| Resume file | Upload routes | Key from session | Added (key derivation) |
| Search | `/api/search` | `discoverableBy`, owner filter | Existing |
| People, matches | `collaboration/matches`, Yora, `/people` | `discoverableBy` | Existing |
| Support ticket | `support/tickets/[id]` page + action | `canAccessTicket` | **Gap: not exported** |
| Integration consent | `settings/integrations` | Session id + enum | Existing partial |
| Auth code | `sso/token` | Client + user + redirect + PKCE | Existing |
| Embed token | `profile/v1/me` | Subject + origin | Existing |
| Admin student | `admin/students/[id]` | `requireAdmin` | Existing (`admin.test`) |

## 7. Decisions needed elsewhere

- **F13/RLS:** web uses `neon-http` with no per-transaction identity and the worker uses `psycopg2`. Identity context would need a transaction wrapper on every query. Assessment continues in Phase 9.
- **Roles:** `DATABASE_URL` and `WORKER_DATABASE_URL` privileges: **BLOCKED, needs Neon evidence**.
- **Receivers:** whether Collaborate and Meet verify the webhook signature is outside this repo: **BLOCKED**.
