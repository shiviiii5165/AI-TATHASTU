# Application performance

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

## Frontend (Verified locally; `load/web-vitals.mts`, median of 3, machine contended)
Mobile = 390 px, 4x CPU, 1.6 Mbps, 150 ms. This is the Playwright harness, not Lighthouse, so don't compare directly with §65.

| Route | Desktop LCP / TBT | Mobile LCP / TBT | CLS mobile | JS mobile |
|---|---|---|---|---|
| / | 232 / 49 | 1452 / 261 | 0 | 174 KB |
| /login | 400 / 1 | 388 / 79 | 0 | 222 KB |
| /dashboard | 608 / 9 | 1656 / 138 | 0 | 247 KB |
| /profile | 564 / 0 | 1332 / 146 | 0 | 223 KB |
| /projects | 524 / 12 | 1276 / 130 | 0 | 230 KB |
| /skills | 540 / 3 | 1404 / 161 | 0.017 | 223 KB |
| /people | 512 / 0 | 1344 / 142 | 0 | 225 KB |
| /learning | 504 / 0 | 1300 / 143 | 0 | 223 KB |

All within the common LCP < 2.5 s and CLS < 0.1 thresholds locally, with no hydration errors. Without real network distance to India these are optimistic. **No frontend code was changed:** nothing here justified it. INP and field vitals: Not tested.

## API
Latency is in LOAD_TEST_REPORT. Improvements: dashboard no longer runs a population count per load; polling and write routes return 503 rather than an empty 500; every guarded response has `X-Request-Id`.

**SLO status:** read p95 ≤ 300 ms and write p95 ≤ 500 ms were met locally at up to 100 sessions on an idle machine (156 / 94 ms), but not on the contended rerun (997 / 583 ms). Cached-dashboard p95 was not measured separately. None measured on staging.
