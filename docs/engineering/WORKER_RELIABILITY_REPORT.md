# Worker reliability

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

## Fixed
| Sev | Defect | Reproduced | Test |
|---|---|---|---|
| P1 | Queue threads in one process shared an id, so fencing couldn't stop a stale sibling overwriting a newer result | Yes: identical `locked_by`, test failed before the fix | `test_queue_sql.py` on real Postgres |
| P2 | `finish_sync` didn't check job ownership | Source | `test_fencing.py` |
| P2 | Hung job renewed its lock forever (now capped, default 30 min) | Source | `test_fencing.py` |
| P2 | Failed resume couldn't be retried; duplicate syncs | Earlier round | `reliability-writes.test.ts`, `test_queue_sql.py` |

## Crash recovery (Verified locally, real `server.py`, 2 threads, 15 s lock, no AI)
| Run | Jobs | Killed with running | Result | Rate |
|---|---|---|---|---|
| Yesterday | 200 | 2 | 200 done, 0 stuck, max 2 attempts | 9.2/s |
| Final code, contended machine | 200 | 2 | 200 done, 0 stuck, max 2 attempts | 3.75/s |

These rates are upper bounds with no provider calls. Real AI jobs will be much slower.

## Existing, confirmed from source
`SKIP LOCKED` claims, lease heartbeats, jittered backoff, max attempts, graceful stop. `failed` acts as the dead letter with `last_error`.

## Gaps
- A hung thread is reclaimed but the thread itself isn't killed, so it reduces concurrency until restart. Python threads can't be force-stopped safely; needs a process-level watchdog.
- No separate CPU and I/O pools.
- Queue wait during web load, provider-limit behaviour and memory under real jobs: Not tested.
- No BullMQ or Redis queue: nothing here shows Postgres is the bottleneck.
