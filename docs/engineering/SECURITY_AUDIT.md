# Security audit

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

## Fixed (verified locally)
| Sev | Issue | Test |
|---|---|---|
| P1 | Unlimited magic-link email to any address | Unit + browser; 5 of 7 sent |
| P1 | Stale worker writes across threads (data integrity) | Real SQL |
| P2 | Spoofable client IP off Vercel | `rate-limit.test.ts` |
| P2 | No limit on search, Yora, analytics, institutions, SSO token | Limiter tested; route wiring not individually |
| P2 | Unbounded search text | Source |

## Checked, no new defect
- Cross-user isolation under load: 0 leaks in 9,254 checks in the final round, and a positive control proved checks detect exposure.
- Other users' jobs return 404. `/me` has no user parameter. Consent filter is the same across strategies.
- Logs added this round hold timings, status and route path, with no SQL, query strings or personal data.
- Rate-limit keys hold hashes of email and IP.

## Open
| Sev | Issue |
|---|---|
| P1 | Under-18 safeguards, role verification, hard deletion: product/legal |
| P2 | Server actions (ticket replies, connector forms) have no per-user rate limit |
| P2 | `publicUrl` blocks literal IPs but not names resolving to private IPs. Firecrawl does the fetch, so exposure depends on Firecrawl |
| P3 | Vercel header behaviour rests on documentation; not live-verified |

**Not performed:** penetration test, dependency audit, OAuth callback tests against real providers, prompt-injection red team.
