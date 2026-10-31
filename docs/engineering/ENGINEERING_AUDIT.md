# Engineering audit (2026-10-31)

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

## Open findings

| Sev | Finding | Evidence | Needed to close |
|---|---|---|---|
| P1 | Capacity is unproven beyond a small local load | LOAD_TEST_REPORT | Staging Neon, separate load generators |
| P1 | No live verification of any integration or AI quality | CONNECTOR_RELIABILITY_REPORT, AI_QUALITY_REPORT | Staging credentials |
| P1 | Under-18 safeguards promised but not enforced; faculty/alumni role self-selected; deletion is soft | §65.4, source | Product/legal decisions |
| P2 | Simultaneous double-save of a review can still duplicate hand-added entries | Sequential retries are handled; no DB constraint | Partial unique index, after checking existing rows |
| P2 | AI telemetry table is read by the admin page but nothing writes it | Grep: no writer in `src` or `worker` | Write from `provider_router` |
| P2 | Kaggle imports only page 1 of datasets and competitions | `connectors/kaggle.py:21-22` | Decide if more is needed; add bounded paging |
| P2 | No cleanup of aborted R2 uploads | No lifecycle rule or code found | R2 lifecycle rule (account access) |
| P2 | Demo opportunities naming real institutions are shown as real | Migration 0014 | Product decision |
| P3 | 110 lint warnings; `test/db.ts` and the E2E stack swallow "syntax error" and "already exists" during migration | Source | Tidy-up |

Fixed findings are in IMPLEMENTATION_CHANGELOG.
