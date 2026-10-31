# Observability

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

## Added
| Signal | How | Status |
|---|---|---|
| Slow and failed DB requests | `timedFetch`: duration and status | Unit tested; only on the Neon path |
| Slow (≥1 s) and failed routes | `guarded`: JSON log, route, ms, request id | Seen in E2E logs |
| Correlation | `X-Request-Id` on guarded routes and in 503 bodies | Unit level; **not** carried into worker jobs |
| Queue health | `GET /api/internal/queue-health`: 503 with reasons | Tested on real SQL via PGlite |

## Alert thresholds (in code)
Oldest job waiting > 15 min; job past its lock by > 5 min; > 25 failed jobs in an hour. Point an uptime monitor at it. **None is connected yet.**

## Gaps
No OpenTelemetry, per-route rate or percentile metrics, query counts, cache hit metrics, event-loop or CPU metrics, or AI provider metrics. An OTel exporter needs a backend choice and cost approval, so it wasn't added.
