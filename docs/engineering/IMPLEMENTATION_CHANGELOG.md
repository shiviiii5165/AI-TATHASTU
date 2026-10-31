# Implementation changelog

Round of 2026-10-30 is in audit §66. This round (2026-10-31):

| Change | Files | Why | Verification |
|---|---|---|---|
| Unique worker identity per thread | `worker/worker.py` | Fencing was ineffective between threads | `test_queue_sql.py`, failed first |
| Job time cap on heartbeat | `worker/worker.py` | Hung job held its lock forever | `test_fencing.py` |
| Ownership check in sync finish | `worker/connectors/common.py` | Stale sync overwrote facts | `test_fencing.py` |
| Cached network count | `src/lib/dashboard/network-count.ts`, `stats.ts` | Full count on each dashboard | `network-count.test.ts` (matches exact query) |
| Queue health endpoint | `src/app/api/internal/queue-health/route.ts` | No queue alerting | `route.test.ts` |
| Request ids and route logs | `src/lib/api-guard.ts` | Failures untraceable | `api-guard.test.ts` |
| SSO token rate limit | `src/app/api/integrations/sso/token/route.ts` | Route coverage | **No dedicated test** |
| Load tools | `load/journeys.js`, `web-vitals.mts`, `mint-tokens.mts` | Harness validity, vitals | Used in runs |
| Reports | `docs/engineering/*` | Requested | n/a |
