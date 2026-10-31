# Connector reliability

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

Timeouts are from source. "Live" means an actual provider call. **No provider was called this round.**

| Source | Timeout | Paging | Duplicate/race handling | Live status |
|---|---|---|---|---|
| GitHub | 20 s calls; OAuth 10 s | Link header, up to 200 scanned, 100 kept | Atomic replace; fence added | §45 earlier; not re-run |
| ORCID | 10 s OAuth | Not reviewed | Atomic replace | Not tested |
| LinkedIn (OIDC, Apify) | 180 s Apify | Single profile | Consent parking | Blocked: needs login |
| Kaggle | Default 30 s | **Page 1 only** | Atomic replace | Not tested |
| Stack Exchange | Default 30 s | Top tags only, by design | Atomic replace | Not tested |
| LeetCode, HackerRank | 15 s LeetCode; HackerRank not reviewed | Single profile | Atomic replace | LeetCode §45 earlier |
| Portfolio via Firecrawl | 90 s | One page | URL validated at connect; Firecrawl fetches | Not tested |

## Fixed
- Double-submits queue one sync (`queueConnectorSync`). **Verified locally.**
- One sync per connection runs at a time. **Verified locally on real SQL.**
- Stale run can't write facts. **Verified locally (unit).**

## Not done
Incremental sync and checkpointing don't exist: each sync rebuilds a source. Token refresh, rate-limit behaviour against real providers, and the private-IP check on DNS-resolved names were not exercised.
