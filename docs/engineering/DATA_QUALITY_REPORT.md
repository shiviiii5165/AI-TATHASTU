# Data quality

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

| Area | Finding | Status |
|---|---|---|
| Provenance | Facts carry `origin`, `extraction_method`, `confidence`, `source_evidence` | Verified from source |
| Fabrication guard | LLM values need a quote found in the source (`resume/verify.py`) | Unit tested; live Not tested |
| URLs | Platform URLs routed away from `website` | Tested (§60) |
| Duplicates | One-sync dedupe; connector facts rebuilt atomically per source; hand-added re-save fixed | Tested; simultaneous saves can still race |
| Stale overwrite | Expired connector run could overwrite newer facts | **Fixed**, test_fencing.py |
| Null handling | Dashboard shows unavailable values, not invented ones | Source (`dashboard/stats.ts`) |
| Opportunities | Seeded demo rows name real institutions | **Open**, product decision |

**Not tested:** completeness on real profiles, field accuracy against labelled data, freshness in production. These need real consented data.
