# AI Tathastuu

> **Next-generation AI-powered career acceleration and intelligence platform.**<br>
> Next.js 16 (App Router, Partial Prerendering, Turbopack, React 19) · Auth.js v5 · Drizzle ORM + PostgreSQL / Neon · Tailwind CSS v4 + shadcn/ui · Python 3.12 Intelligence Worker.

---

## Overview

AI Tathastu is a unified career acceleration platform designed to extract, unify, and amplify candidate capability. It bridges real developer/student evidence (GitHub repositories, Kaggle notebooks, Stack Exchange, verified resumes) into structured skills, predictive ERIS readiness scores, adaptive widgets, and career opportunities.

The frontend is built with a **mobile-first, minimalist white-theme visual design system** audited for viewports from 320px up to 1440px+, adhering to strict accessibility (WCAG 2.2 AA) and responsive standards.

---

## Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Tathastu Next.js 16                          │
│   (App Router, Turbopack, PPR Streaming, React 19, Tailwind CSS v4)    │
└───────────────────┬────────────────────────────────┬───────────────────┘
                    │                                │
         ┌──────────▼──────────┐          ┌──────────▼──────────┐
         │ PostgreSQL / Neon   │          │ Python 3.12 Worker  │
         │ (Drizzle ORM, PGlite│          │ (FastAPI, Groq LLM, │
         │  migrations)        │          │  Tesseract OCR)     │
         └──────────▲──────────┘          └──────────▲──────────┘
                    │                                │
                    └────────────────────────────────┘
```

- **Frontend & App Server:** [Next.js 16.1.1](https://nextjs.org/) with React 19, App Router, Partial Prerendering (PPR), Turbopack, and Tailwind CSS v4.
- **Authentication:** [Auth.js v5](https://authjs.dev/) with JWT sessions, Drizzle adapter, OAuth (Google, LinkedIn OIDC), and passwordless magic links (Resend or SMTP).
- **Database & Data Access:** PostgreSQL (Neon serverless in production, local `pg` or in-memory PGlite for tests) with [Drizzle ORM](https://orm.drizzle.team/).
- **Storage:** Cloudflare R2 / S3-compatible object storage with direct browser presigned PUT uploads and SHA-256 checksum verification.
- **Background Worker:** Python 3.12 FastAPI service handling async resume parsing, Groq LLM extraction, Tesseract OCR, connector sync, and ERIS intelligence scoring.
- **Design System:** Minimalist white-first interface, coral/pink/orange accents, typography hierarchy, safe area insets, no-emoji house design doctrine, and full viewport responsiveness (320px–1440px).

---

## Quick Start

### Prerequisites
- Node.js 20+ and npm 10+
- Python 3.12+ (for background worker)
- PostgreSQL database (or Neon connection string)

### 1. Environment Setup

```bash
cp .env.example .env.local
```

Configure the essential keys in `.env.local`:
- `DATABASE_URL`: Postgres connection string (e.g. Neon or local Postgres)
- `AUTH_SECRET`: Random 32+ character secret for Auth.js JWTs
- `CONNECTOR_TOKEN_KEY`: 32-byte hex key for AES-256-GCM token sealing
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`: Storage config
- `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_LINKEDIN_ID`, `AUTH_LINKEDIN_SECRET` (optional OAuth)
- `RESEND_API_KEY` or SMTP credentials (for email magic links)

### 2. Database Migrations

```bash
npm install
npm run db:migrate          # Direct PostgreSQL migration (port 5432)
# or
npm run db:migrate:http     # Over Neon HTTPS endpoint (for networks blocking port 5432)
```

### 3. Launch Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application.

### 4. Background Worker (Optional for local full pipeline)

See [worker/README.md](./worker/README.md) for detailed worker configuration:

```bash
cd worker
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

---

## Core Application Structure

| Directory / File | Description |
|---|---|
| `src/app/` | Next.js App Router pages, layouts, route handlers, and server actions. |
| `src/app/page.tsx` | Public landing page with responsive hero, features, and social proof. |
| `src/app/about`, `/contact`, `/team` | Informational pages with responsive layouts and collapse-at-1024px navigation. |
| `src/app/(auth)/` | Authentication pages (`/login`, `/signup`) with safe redirect guards. |
| `src/app/onboarding/` | 6-step guided onboarding workflow with server-validated progression. |
| `src/app/(dashboard)/` | Authenticated dashboard and core modules (`/profile`, `/skills`, `/projects`, etc.). |
| `src/app/(dashboard)/settings/` | User settings, security, notifications, and privacy permissions (`/settings/privacy`). |
| `src/components/` | Modular UI components (shadcn/ui, connectors, resume upload, dashboard widgets). |
| `src/db/` | Drizzle ORM schema (`schema.ts`), migrations, and database clients (`client.ts`, `local.ts`). |
| `src/lib/` | DAL (`dal.ts`), safe redirects (`safe-redirect.ts`), connectors, cryptography, and utilities. |
| `src/styles/` | Global CSS (`globals.css`) and modular responsive stylesheets (`about.css`, `contact.css`, etc.). |
| `worker/` | Python background worker for resume ingestion, OCR, LLM extraction, and ERIS scoring. |
| `e2e/` | Playwright test suites (core flows, responsive viewports, privacy, auth, onboarding). |

---

## Key Flows & Specifications

### 1. 6-Step Guided Onboarding
1. **Target Role Selection:** Choose primary career trajectories and track profiles.
2. **Priorities & Preferences:** Set location, compensation, work style, and industry preferences.
3. **Basic Profile & Identity:** Name, handle, contact details, and career summaries.
4. **Resume Upload & AI Review:** Presigned direct R2 upload with hash verification, async worker extraction, and side-by-side verification review.
5. **Connectors:** Integrations with GitHub, Kaggle, Stack Exchange, and personal portfolios with encrypted token storage.
6. **Consents & Intelligence Generation:** Granular privacy consent records, trigger of the ERIS intelligence computation, and transition to `/dashboard`.

### 2. Mobile-First Responsive Design
- Fully responsive across **320px, 360px, 390px, 430px, 768px, 1024px, 1280px, and 1440px**.
- Bottom mobile navigation bar with touch-friendly tap targets (>= 44x44px).
- Safe area inset handling (`env(safe-area-inset-bottom)`), preventing notch or home-bar clipping.
- Zero horizontal overflows across all public and authenticated routes.
- Adherence to the no-emoji design doctrine and clean, contrast-compliant typography.

### 3. Intelligence Engine & ERIS Scores
- `compute_intelligence` consolidates facts, project commits, skills, and resume signals into single unified profiles.
- Outputs predictive readiness scores, dynamic skill evidence maps, and personalized dashboard widgets.
- Widgets dynamically adapt based on eligibility, freshness, and user preferences (pin / dismiss).

---

## Verification & Testing Suite

All tests can be executed locally without external cloud dependencies:

```bash
# TypeScript type checking
npm run typecheck

# ESLint inspection
npm run lint

# Vitest unit & integration tests (runs on in-memory PGlite with full migrations)
npm test

# Python worker unit tests
python3 -m unittest discover -s worker/tests -v

# Playwright responsive viewport regression suite (tests 8 screen widths)
npx playwright test e2e/responsive-viewports.spec.ts

# Full end-to-end Playwright test suite
npm run test:e2e

# Production Turbopack build
npm run build
```

---

## Security & Best Practices

- **Safe Redirects:** All auth callbacks and post-login destinations pass through `toLocalPath` to prevent open-redirect vulnerabilities.
- **Encrypted Token Vault:** Third-party OAuth tokens and connector credentials are encrypted using AES-256-GCM with authenticated tags before storing in the database.
- **Direct-to-Storage Uploads:** Resumes are hashed in the browser and uploaded directly to Cloudflare R2 via presigned URLs, avoiding payload bottlenecks on serverless endpoints.
- **Append-Only Consents:** User consents are tracked immutably with timestamped policy versions.
- **Accessibility:** Built according to WCAG 2.2 AA standards with keyboard navigable elements and high-contrast color tokens.

---

## License

Private and proprietary. All rights reserved.
