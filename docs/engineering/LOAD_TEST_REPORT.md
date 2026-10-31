# Load test report

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

**Everything here is Verified locally only. Nothing is production capacity.** k6, Docker, Postgres and Node shared one machine, against this brief's explicit requirement of a separate generator, so these runs can't count as capacity evidence.

## Workload model (Estimated from `load/journeys.js`, not from production traffic)
| Dimension | Value |
|---|---|
| Think time | 3–8 s per step |
| Requests per session | ~0.2 req/s, ~12/min |
| Read/write in default journey | ~88/12 |
| DB transactions per request | ~5.4 measured |
| Dashboard polling | Only while personalizing (~status route) |
| AI, uploads, classroom | **Not in the model**: no production data |

At 50,000 sessions this gives ~10,000 req/s and ~54,000 queries/s. **Estimated, and the first number to challenge.**

## Results (p50/p95/p99 ms)
Idle machine (2026-10-30):
| Instances | Sessions | req/s | Read | Write | Fail | 5xx | Net errors |
|---|---|---|---|---|---|---|---|
| 1 | 100 | 19.5 | 30/156/665 | 40/94/457 | 0% | 0 | 0 |
| 4 | 250 | 48.1 | 48/153/276 | 31/88/112 | 0.16% | 0 | 12 |
| 4 | 500 | 77.4 | 67/8379/14062 | 39/4174/9041 | 0.21% | 0 | 26 |
| 4 | 1000 | 19.1 | 31467/59995/59996 | 32604/57619/59995 | **28.26%** | 21 | 844 |
| 4, spike | 200→1000 | 127.8 | 47/387/723 | 25/165/370 | 0.35% | 0 | 89 |
| 4, writes | 250 | 61.5 | 119/5960/7551 | 41/3312/4715 | 0.33% | 0 | 32 |
| 4, soak 5 min | 250 | 62.1 | 22/665/2253 | 11/430/1347 | 0.22% | 0 | 45 |

Final code, contended machine (2026-10-31; E2E took 14 min against 2.6 min the day before):
| Instances | Sessions | req/s | Read | Write | Fail | 5xx | Net errors | Isolation checks / leaks |
|---|---|---|---|---|---|---|---|---|
| 1 | 100 | 18.3 | 257/997/1287 | 188/583/724 | 0.14% | 0 | 4 | 1356 / 0 |
| 4 | 250 | 40.3 | 501/2433/4866 | 362/1514/2738 | 0.16% | 0 | 10 | 3025 / 0 |
| 4, soak 5 min | 250 | 31.7 | 3464/11305/19295 | 2547/5662/7727 | 0.58% | 0 | 61 | 4873 / 0 |

**The two days aren't comparable, so no before/after improvement is claimed.** An intermediate run with expired session cookies was discarded as invalid: every request was rejected. It exposed a harness flaw, now fixed.

## Bottleneck
Postgres peaked at 9 active queries with no deadlocks. The limit is on the app or host side: CPU on this machine, with results swinging widely from run to run. Per-process CPU, event-loop delay and pool wait were not captured, so it's not more exact than that.

## Not tested
2,500+ sessions, search-heavy and AI-heavy mixes, DB latency injection, recovery after overload, Neon, Vercel scaling, cost.

## Supported-concurrency decision
**Stable on idle local stack: 100 sessions.** Production: **no supported figure yet.** 50,000: **unverified**. Distributed validation needs staging, generators and spend approval.

## 100-person classroom decision: not ready
No classroom code exists, so nothing can be benchmarked. Proposed if the product goes ahead: a managed or self-hosted SFU such as LiveKit for media, its data channel or a separate service for signaling, presence, chat and hand raising, Next.js only for issuing short-lived join tokens with role permissions, and recording through the SFU's egress into R2. Benchmarks to build: one presenter to 100; interactive audio; multi-camera; reconnect storm; poor networks; recording. Cost and vendor need owner approval.

## Operating cost
**Not estimated.** No plan prices were verified and no capacity was measured on real infrastructure, so any figure would be invented. Inputs for a quote: ~10,000 req/s (Vercel), ~54,000 queries/s (Neon), AI tokens per job (unmeasured), worker count.
