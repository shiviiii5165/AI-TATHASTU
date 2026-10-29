# AI Tathastu — Admin Platform Acceptance Criteria

**Standard:** Production-Grade Verification Specifications  
**Compliance Level:** Strict (Automated & Manual Verifiable Criteria)

---

## 1. Authentication, RBAC & Security Gates

- [ ] **Stealth Unauthorized Routing:** Any request to `/admin/*` by an unauthenticated user or a non-admin user must return a strict HTTP 404 (or rewrite to 404) without exposing admin page existence or metadata.
- [ ] **Action-Level Permission Enforcement:** Every mutation, server action, and privileged API route must evaluate the caller's specific permission (`support.tickets.reply`, `students.restrict`, `email.templates.publish`, etc.) server-side.
- [ ] **Audit Trail Completeness:** 100% of privileged administrator mutations (user updates, status changes, template publishing, flag toggles) must write an immutable entry to `admin_audit_logs`.
- [ ] **Credential Protection:** No API keys, SMTP passwords, OAuth client secrets, or session tokens may ever be returned in client components, JSON API responses, or logged to disk.

---

## 2. Support Operations & Ticket Lifecycle

- [ ] **Unique Identifier:** Every ticket receives a non-sequential, opaque public ID (e.g., `TATH-2026-XXXX`).
- [ ] **State Machine Validation:** Invalid state transitions (e.g., jumping from `New` directly to `Closed` without resolution notes) must be rejected with an actionable error.
- [ ] **Strict Internal Note Isolation:**
  - Messages marked `isInternalNote: true` must NEVER be returned to student-facing endpoints or rendered in the student portal.
  - Internal notes must be visually distinguished in the admin interface (e.g., amber container with a padlock badge).
- [ ] **SLA Calculation:** High-priority tickets calculate correct first-response deadlines and trigger visual warnings when within 1 hour of breach.
- [ ] **Public Reply Notification:** Submitting an agent public reply must automatically enqueue a branded transactional notification email to the requester.

---

## 3. Email Template Studio & Outbox Delivery

- [ ] **Zero-Eval Rendering:** Template variable interpolation must use strict string token replacement with automatic HTML entity escaping to prevent stored XSS.
- [ ] **Immutable Published Versions:** Editing a published template must create a new draft version. Published versions cannot be mutated in place.
- [ ] **Variable Validation:** Templates cannot be published if required variables (e.g., `{{student_name}}`, `{{tracking_url}}`) are invalid or undefined in the registry.
- [ ] **Transactional Outbox Delivery:** Outgoing emails are queued to `email_deliveries` in the database transaction and processed with exponential backoff on failure.
- [ ] **Starter Templates:** All 20 core application templates (Welcome, Magic Link, Ticket Acknowledgement, Agent Reply, Resolution, Security Alert, etc.) must exist as fully editable, valid templates.

---

## 4. Student & Account Management

- [ ] **Search & Filter:** Directory supports search across ID, full name, email, and university with server-side pagination.
- [ ] **Session Revocation:** Revoking a student's sessions must invalidate existing Auth.js session cookies and force re-authentication on their next request.
- [ ] **Account Restriction:** Suspending a student account requires a documented reason and duration; restricted accounts cannot log in or access protected student dashboard routes.
- [ ] **Safe Deletion Workflow:** Deleting an account requires a 2-step confirmation with impact summary (associated records, files, connections) and soft-tombstone retention according to legal policy.

---

## 5. AI Observability & Budget Controls

- [ ] **Live Telemetry:** Dashboard displays real-time health, error counts, and latency percentiles for configured providers (Groq, Gemini, OpenRouter).
- [ ] **Zero Secret Leakage:** Provider cards show key labels and connection health, NEVER raw API keys.
- [ ] **Budget Guardrails:** When configured budget thresholds are reached, the system emits an internal administrative alert and enables feature throttling where configured.

---

## 6. Regression & Quality Assurance

- [ ] **Zero TypeScript Errors:** `npm run typecheck` exits with code 0.
- [ ] **Zero ESLint Errors:** `npm run lint` exits with code 0.
- [ ] **Vitest Unit/Integration Suite:** 100% of existing and newly added test files pass with exit code 0.
- [ ] **Playwright E2E Suite:** Critical authentication, navigation, and responsiveness tests pass with exit code 0.
- [ ] **Next.js Production Build:** `npm run build` succeeds with all static and dynamic routes compiled without errors.

