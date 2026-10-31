# Product capability matrix

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

Status reflects what ran in this environment. "E2E" means Playwright with PGlite, fake R2, a stand-in worker and no live providers.

| Capability | Entry point | Data | External | Tests | Status | Main risk |
|---|---|---|---|---|---|---|
| Landing, legal pages | `/`, legal routes | none | none | E2E | Working (local) | none known |
| Magic-link sign-in | `/login`, Auth.js | users, verification_tokens | SMTP/Resend | Unit + browser with fake SMTP | Working (local); real mail Not tested | SMTP quota |
| Google, LinkedIn sign-in | Auth.js | accounts | OAuth | Source only | Not tested live | Live config |
| Onboarding by persona | `/onboarding/*` | onboarding_state | none | E2E | Working (local) | Role self-selected |
| Resume upload | `/api/upload/resume*` | files, jobs | R2 | E2E + unit | Working (fake R2); real R2 Not tested | Orphaned uploads |
| Resume extraction and review | worker `resume/`, review page | profile_facts | LLM optional | pytest fixtures, E2E | Rules verified; live AI and OCR Not tested | Accuracy unmeasured on real resumes |
| Connectors | `/connections`, worker | connections, facts | Providers | pytest, E2E stand-in | Partial; §45 live checks for GitHub and LeetCode only | Provider changes |
| Intelligence and ERIS | worker `intelligence/` | eris_scores, profile_views | LLM optional | pytest; worker ran locally | Runs without AI; AI quality Not tested | Score validity |
| Dashboard, profile, projects, skills | pages | views, facts, repos | none | E2E, load | Working (local) | Scale on Neon unknown |
| People, matches | `/people`, `/api/collaboration/matches` | embeddings, consents | Embeddings | Unit, load isolation | Fixed under-return; working (local) | Exact sort is linear |
| Search | `/api/search` | users, skills, projects | none | Unit, load isolation | Working (local) | Wildcard scans |
| Yora | `/api/yora/chat` | several | none (rule-based) | Unit | Working (local) | Not an LLM |
| Learning, opportunities | pages | learning_resources, opportunities | none | E2E | Working (local) | Demo data shown as real |
| Integrations, SSO, webhooks | `/api/integrations/*` | consents, outbox | Partner apps | E2E | Working (local) | No partner test |
| Embed | `/api/auth/embed-token`, `/me` | profile | none | Load for `/me` | Partial | Flag-gated |
| Support tickets, contact | routes | tickets | Email | Unit | Partial | Ticket action untested |
| Admin console | `/admin/*` | admin tables | none | Partial | Unverified | AI-ops page has no data source |
| Classroom | none | none | none | none | **Not implemented** | See LOAD_TEST_REPORT |
