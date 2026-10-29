# AI Tathastu — Admin Operating System Implementation Plan

**Roadmap:** Phased Implementation from Baseline to Production-Ready  
**Workspace:** `E:\dev\ai-tathastu`  
**Execution Strategy:** Non-breaking incremental phases, zero regressions, fail-closed tests, and verified quality gates.

---

## Phase 0: Baseline & Architectural Foundation (Completed)
- [x] Codebase discovery and architecture audit ([`docs/admin-platform/audit.md`](file:///e:/dev/ai-tathastu/docs/admin-platform/audit.md)).
- [x] Systems specification and RBAC design ([`docs/admin-platform/architecture.md`](file:///e:/dev/ai-tathastu/docs/admin-platform/architecture.md)).
- [x] Acceptance criteria definition ([`docs/admin-platform/acceptance-criteria.md`](file:///e:/dev/ai-tathastu/docs/admin-platform/acceptance-criteria.md)).
- [x] Clean Git working baseline on `main`.

---

## Phase 1: Admin Shell, RBAC & Security Foundation
- [ ] **Database Schema:** Define `admin_team_members` and `admin_audit_logs` in `src/db/schema.ts` (or modular `src/db/schema-admin.ts` exported via `schema.ts`).
- [ ] **RBAC Service:** Create `src/lib/admin/rbac.ts` providing `hasPermission()`, `getAdminRole()`, `requireAdminPermission(permission)`.
- [ ] **Audit Logging Service:** Create `src/lib/admin/audit.ts` to log all administrative actions with actor metadata, resource, target ID, and client IP/user-agent.
- [ ] **Admin Layout & Navigation:** Upgrade [`src/app/admin/layout.tsx`](file:///e:/dev/ai-tathastu/src/app/admin/layout.tsx) with a responsive sidebar containing all 17 modules, breadcrumbs, search shortcut, and user role indicators.
- [ ] **Admin Overview Dashboard:** Build `/admin/page.tsx` showing platform pulse metrics (tickets, students, AI usage, email delivery rates, security alerts).

---

## Phase 2: Support Operations & Ticket Lifecycle
- [ ] **Database Schema:** Add `support_tickets`, `support_messages`, `support_slas` to Drizzle schema.
- [ ] **Ticket Service:** Create `src/lib/admin/tickets.ts` handling ticket creation, assignment, status transitions, SLA calculations, and thread retrieval.
- [ ] **Admin Ticket Management UI:**
  - `/admin/tickets/page.tsx`: Filterable table (status, priority, category, assignee), search, pagination, bulk actions.
  - `/admin/tickets/[id]/page.tsx`: Full conversation thread, public reply box, private internal note tab (amber-styled), assignment selector, status state machine buttons.
  - `/admin/tickets/new/page.tsx`: Manual ticket creation form for phone/chat requests.
- [ ] **Student-Facing Support Integration:**
  - `/support/tickets/page.tsx` & `/support/tickets/[id]/page.tsx`: Protected student portal to submit inquiries and view public replies (internal notes strictly filtered out).

---

## Phase 3: Email Template Studio & Outbox Delivery Center
- [ ] **Database Schema:** Add `email_templates`, `email_template_versions`, `email_deliveries`, `email_delivery_events`.
- [ ] **Template Engine:** Create `src/lib/admin/email-engine.ts` with zero-eval variable replacement, validation, escaping, and test-send rendering.
- [ ] **Starter Templates Library:** Seed complete default templates (Welcome, Magic Link, Ticket Received, Agent Reply, Ticket Resolved, Security Alert, AI Failure Alert, Maintenance Notice, Newsletter).
- [ ] **Template Studio UI:**
  - `/admin/emails/templates/page.tsx`: Template directory by category with status badges (`draft`, `published`).
  - `/admin/emails/templates/[id]/page.tsx`: Rich split-screen editor (HTML body, plain text alternative, subject, preheader, live device preview, test email trigger).
- [ ] **Email Delivery Center UI:**
  - `/admin/emails/deliveries/page.tsx`: Live delivery outbox table (`queued`, `processing`, `delivered`, `bounced`, `failed`), retry controls, and latency stats.
  - `/admin/emails/settings/page.tsx`: Global brand variables (logo, colors, footer, support phone/email).

---

## Phase 4: Notification Rules Engine & SLA Automation
- [ ] **Database Schema:** Add `notification_rules` and `notification_preferences`.
- [ ] **Rules Service:** Create `src/lib/admin/rules.ts` supporting event triggers, condition matching, cooldowns, and template dispatch.
- [ ] **Admin UI:** `/admin/automation/page.tsx` with visual rule builder, enabled toggles, and execution logs.

---

## Phase 5: Student & Account Management
- [ ] **Student Directory UI:** `/admin/students/page.tsx` with search by ID, name, email, university, verification status, and linked sources.
- [ ] **Student Detail & Safeguards:** `/admin/students/[id]/page.tsx`:
  - Profile inspection, linked GitHub/LinkedIn metadata.
  - Session revocation action (invalidates Auth.js session cookies).
  - Account restriction/suspension with mandatory reason and expiration.
  - Safe 2-step deletion workflow with impact preview and audit logging.

---

## Phase 6: AI Observability & Budget Controls
- [ ] **Provider & Model Telemetry:** Create `src/lib/admin/ai-ops.ts` integrating with worker key pools (Groq, Gemini, OpenRouter), tracking latency, errors, token estimates.
- [ ] **AI Operations UI:**
  - `/admin/ai-ops/providers/page.tsx`: Real-time provider health status cards, circuit breaker state, error rates, model routing controls.
  - `/admin/ai-ops/costs/page.tsx`: Daily/monthly token usage graphs, cost estimation, budget utilization, and threshold alert policies.

---

## Phase 7: CMS, Knowledge Base & Newsletter Management
- [ ] **Knowledge Base UI:** `/admin/kb/page.tsx` (article management, category tagging, public vs. internal visibility).
- [ ] **CMS Announcements:** `/admin/cms/page.tsx` (banner announcements, scheduled maintenance notices).
- [ ] **Newsletter Module:** `/admin/newsletter/page.tsx` (consent-tracked subscriber directory, campaign drafts, safe inactive state if delivery unconfigured).

---

## Phase 8: Quality Gates, Testing & Hardening
- [ ] **Unit Tests:** `src/lib/admin/*.test.ts` (RBAC permission evaluation, ticket state transitions, template engine sanitization, variable substitution, outbox retry logic).
- [ ] **Integration Tests:** Admin actions, student note privacy isolation, session revocation, audit logging.
- [ ] **Security Tests:** Unauthorized access denial (404/403), CSRF, XSS in ticket replies and templates.
- [ ] **Regression & Production Build:** Typecheck, lint, Vitest unit suite, Playwright E2E suite, Next.js build.

