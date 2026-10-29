# AI Tathastu — Admin Platform & Operating System Audit

**Date:** October 2026  
**Auditor:** Principal Software & Security Architecture Team  
**Workspace:** `E:\dev\ai-tathastu`  
**Git Branch:** `main` (clean baseline tracking `github/main`)

---

## 1. Executive Summary

This audit evaluates the current AI Tathastu architecture against the requirements for a production-grade **Super Admin Control Center, Support Operations, Email Template Studio, AI Observability & Platform Management OS**.

The existing application is a high-performance Next.js 16 (App Router) platform featuring multi-persona onboarding, Drizzle ORM on PostgreSQL with PGVector, Auth.js v5 authentication, and Python worker intelligence pipelines. However, administrative capabilities are currently limited to a single institution verification screen (`/admin/institutions`). 

This document details the existing architecture, identifies reusable components and architectural patterns, exposes security and operational gaps, and defines the blueprint for building the unified Admin Operating System.

---

## 2. Codebase Baseline & Inventory

### 2.1 Framework & Runtime
- **Next.js:** `16.4.2` with Turbopack, Partial Prerendering (PPR), Cache Components enabled.
- **React:** `19.3.0`.
- **Database & ORM:** PostgreSQL (Neon serverless in production, local PGlite in automated test environments), Drizzle ORM `0.45.4`, Drizzle Kit `0.31.11`.
- **Styling & Design System:** Tailwind CSS v4 (`@tailwindcss/turbopack`), Lucide React icons (`1.61.0`), Radix UI primitives.
- **Validation:** Zod `^4.6.7`.
- **Testing:** Vitest `5.0.3` (19 test files, 170 unit/integration tests), Playwright `1.64.0` (21 E2E tests).
- **Worker / AI Backend:** Python 3.11 worker (`worker/`) running on FastAPI/Uvicorn with Celery/Redis-style queues and `provider_router.py` managing Groq, Gemini, and OpenRouter multi-key rotations.

### 2.2 Entry Points, Routing & Middleware
- **Middleware Proxy:** [`src/proxy.ts`](file:///e:/dev/ai-tathastu/src/proxy.ts) wraps Auth.js Edge config, matching `/admin/:path*`, `/onboarding/:path*`, `/dashboard/:path*`, and `/settings/:path*`.
- **Authorization Check in Proxy:** [`src/auth.config.ts`](file:///e:/dev/ai-tathastu/src/auth.config.ts) inspects JWT claims:
  - If a user accesses `/admin/*` without `auth.admin === true` and without an email in `ADMIN_EMAILS`, the proxy rewrites to `/404` (fail-closed, stealth routing so the admin interface is never advertised to unauthorized users).
- **Secondary DB Verification:** [`src/lib/admin.ts`](file:///e:/dev/ai-tathastu/src/lib/admin.ts) exports `isAdmin(user)` and `requireAdmin()`, which re-checks `users.isAdmin` and `isAdminEmail(user.email)` against the database on every server action or page load.

### 2.3 Existing Admin Touchpoints
- **Layout:** [`src/app/admin/layout.tsx`](file:///e:/dev/ai-tathastu/src/app/admin/layout.tsx) — Minimal top banner with BrandLogo and "Admin" badge.
- **Institutions Review:** [`src/app/admin/institutions/page.tsx`](file:///e:/dev/ai-tathastu/src/app/admin/institutions/page.tsx) and [`src/app/admin/institutions/actions.ts`](file:///e:/dev/ai-tathastu/src/app/admin/institutions/actions.ts) — Allows admins to approve, merge, or reject user-submitted academic institutions.
- **Component:** [`src/components/admin/pending-institution-row.tsx`](file:///e:/dev/ai-tathastu/src/components/admin/pending-institution-row.tsx).

### 2.4 Existing Database Schema (`src/db/schema.ts`)
The schema contains 34 tables:
- **Identity & Accounts:** `users`, `accounts`, `sessions`, `verificationTokens`, `consents`, `onboardingState`.
- **Profile & Intelligence:** `profileFacts`, `files`, `jobs`, `connections`, `codeRepositories`, `skills`, `skillAliases`, `skillEvidence`, `unifiedProjects`, `erisScores`, `profileViews`, `widgetPrefs`, `featureFlags`, `integrationConsents`, `integrationAuthCodes`, `webhookOutbox`, `institutions`, `campuses`, `degrees`, `specializations`, `analyticsEvents`, `matches`, `roadmaps`, `githubScores`, `collaborationEmbeddings`, `learningResources`, `opportunities`, `rateLimits`.
- **Key Observation:** The `users` table already contains `isAdmin: boolean` and `deletedAt: timestamp`. The `webhookOutbox` table already implements a robust transactional outbox pattern.

### 2.5 Existing Email System
- **Transport:** [`src/lib/email.ts`](file:///e:/dev/ai-tathastu/src/lib/email.ts) supports Nodemailer SMTP with 3 sender profiles (`auth` for magic links, `system` for onboarding/welcome, `support` for alerts and replies).
- **Templates:** [`src/lib/email/templates.ts`](file:///e:/dev/ai-tathastu/src/lib/email/templates.ts) has hand-crafted HTML/text templates for magic links, welcome, and resume processing.
- **Gaps:** Templates are hardcoded in TypeScript. There is no template registry, no visual or variable editor, no version history, no outbox tracking table, no bounce/complaint webhook processing, and no test-send interface.

### 2.6 Existing AI & LLM Architecture
- **Worker Routing:** [`worker/provider_router.py`](file:///e:/dev/ai-tathastu/worker/provider_router.py) pools Groq, Gemini, and OpenRouter API keys with circuit breakers, fallbacks, and rate limit tracking.
- **Next.js AI:** [`src/app/api/yora/chat/route.ts`](file:///e:/dev/ai-tathastu/src/app/api/yora/chat/route.ts) provides keyword and vector-assisted student career chat.
- **Gaps:** Zero administrative observability. Admins cannot view real-time latency p95, error rates, token consumption, provider circuit-breaker trips, cost estimates, or enforce budget limits and feature kill-switches from the web UI.

---

## 3. Security, Gaps & Risks Analysis

| Domain | Current Implementation | Identified Gap / Risk | Architectural Fix |
| :--- | :--- | :--- | :--- |
| **RBAC & Authorization** | Binary `isAdmin` boolean + `ADMIN_EMAILS` check | No role differentiation (e.g., support agents have full DB access or nothing; no content editor or AI ops roles). | Implement granular action/resource-level permissions and admin roles (`super_admin`, `support_admin`, `support_agent`, `ai_ops`, `finance_admin`, `content_editor`, `security_auditor`). |
| **Audit Trail** | None for admin actions | Privileged operations (modifying users, approving templates, toggling feature flags) leave no append-only audit trail. | Implement `admin_audit_logs` table with actor, action, resource, target, diff, IP, and timestamp. |
| **Support Operations** | Inbound contact form forwards via SMTP to gmail | No ticket tracking, SLAs, assignment, internal notes, student conversation history, or resolution state machine. | Implement complete Support Ticket subsystem (`support_tickets`, `support_messages`, `support_slas`). |
| **Email Studio** | Hardcoded code templates in `templates.ts` | Non-technical staff cannot edit or preview templates; changes require redeployment. | Build server-backed Email Template Studio with variable registry, version history (`draft` → `published`), and HTML sanitization. |
| **Email Delivery** | Synchronous SMTP calls inside request lifecycles | Transient SMTP failure causes request errors; no retry policy, no dead-letter queue, no delivery tracking. | Create `email_delivery` transactional outbox with idempotency keys, retry backoff, and webhook delivery status. |
| **Student Management** | None (only direct DB query) | No safe UI to inspect accounts, review linked sources, suspend accounts, revoke sessions, or process GDPR/privacy deletions. | Implement Student Management module with safeguarded deletion workflow and session revocation. |
| **AI Observability** | Blind worker execution | Unknown token usage, hidden costs, unmonitored provider downtime or rate limits. | Implement Provider & Model Registry, live health telemetry, cost analytics, and budget guardrails. |
| **CMS & Knowledge Base** | Landing page copy is code-based | No ability to publish maintenance alerts, system announcements, or support KB articles. | Implement CMS Announcements & Knowledge Base modules. |

---

## 4. Reusable Architecture & Patterns

1. **Transactional Outbox:** The existing [`webhookOutbox`](file:///e:/dev/ai-tathastu/src/db/schema.ts#L552) pattern provides a proven template for durable asynchronous message delivery.
2. **Server-Side Authorization:** The `requireAdmin()` pattern in [`src/lib/admin.ts`](file:///e:/dev/ai-tathastu/src/lib/admin.ts) will be extended to `requireAdminPermission(permission)`.
3. **Fail-Closed Testing:** The [`src/test/setup.ts`](file:///e:/dev/ai-tathastu/src/test/setup.ts) environment guarantees that automated tests run in complete isolation with PGlite without external credentials.
4. **Design Tokens & UI:** The existing editorial-minimal design language, Radix UI components, and Lucide icons allow building a responsive, accessible, professional admin dashboard matching the AI Tathastu brand.

