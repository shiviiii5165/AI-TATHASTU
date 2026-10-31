# Database performance

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

All figures: **Verified locally**, single `EXPLAIN ANALYZE` runs, 20k users and 200k jobs. Not Neon; cold-cache runs vary widely.

| Query | Before | After | Change |
|---|---|---|---|
| Worker claim | 28.5 ms | 0.03 ms | Migration 0018 |
| Lock expiry | 16 ms | 0.007 ms | Migration 0018 |
| People, student, rows of 24 | 4 rows, 3 ms | 24 rows, 24–30 ms | Exact sort (correctness) |
| People, mentor | not comparable | 101 ms | Exact sort |
| Dashboard count, mentor | 51 ms warm (390 ms cold), every load | Cached 5 min; one primary-key lookup per load (6 ms cold) | `network-count.ts` |
| Dashboard count, student | 5 ms every load | Cached 5 min | `network-count.ts` |

## People strategy benchmark (20k users, 15% eligible)

| Strategy | Recall@24 | Time |
|---|---|---|
| Exact (current) | 24/24 by definition | 30 ms |
| HNSW default | returned 4 rows | 3 ms |
| HNSW `strict_order` iterative | 24/24 | 33 ms |
| HNSW `relaxed_order`, ef 100 | 13/24 | 1,729 ms (one cold run) |
| Strict with only 13 eligible | 13/13 | 130 ms |

**Decision:** keep exact. Strict iterative shows no gain at this size and needs a transaction per query plus pgvector ≥ 0.8 on Neon, which isn't confirmed. Re-test at 200k+ users. Privacy filters are the same SQL under every strategy.

## Migrations
- All 19 apply from empty on real Postgres after the 0017 fix. **Verified locally.** Not run on Neon.
- 0018: additive. On a large table, create it with `CONCURRENTLY` by hand first.
- `db:migrate:http` has no transactions, so a mid-migration failure leaves partial changes. Use a Neon branch first.

## Not done
Connection budget can't be measured locally: production uses Neon HTTP, not a pool. Unused-index audit, retention for `jobs` and `analytics_events`, and keyset pagination for admin lists were not done.
