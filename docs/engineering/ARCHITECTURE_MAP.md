# Architecture map (verified from repository)

Evidence labels: **Verified locally**, **Verified on staging** (none exist yet), **Estimated**, **Not tested**. Local means Docker Postgres 17 + pgvector 0.8.7, 20,000 synthetic users, stubbed providers, everything on one contended Windows machine. See also `AI_TATHASTU_SYSTEM_AUDIT.md` §65–67.

```
Browser -> Vercel (Next.js 16, Auth.js v5 JWT sessions, proxy gate)
             |- Neon Postgres over HTTP driver (Drizzle; one round trip per query; db.batch for atomic writes)
             |- Cloudflare R2 (browser PUT via 5-minute presigned URL; server HEAD to confirm)
             |- SMTP / Resend (magic links, notices)
             '- wake ping -> Render free web service (Python)
                               |- 2 queue threads by default (WORKER_CONCURRENCY), polling the jobs table
                               |- Neon direct connection (psycopg2, FOR UPDATE SKIP LOCKED)
                               '- GitHub, ORCID, Kaggle, Stack Exchange, LeetCode, HackerRank, Firecrawl, Apify,
                                  Groq -> Gemini -> OpenRouter
```

- **Cron:** one daily Vercel job, `/api/internal/webhooks/dispatch`, also purges expired rows.
- **Region:** Neon in us-east-2 (host name in `.env.local`); Render Ohio (§44); no `regions` in `vercel.json`. **Indian users are therefore served from the US: Not tested, but this is the first thing to measure.**
- **Redis:** Upstash variables exist in `.env.local`; no code uses them.
- **Queue:** Postgres only. Rate limits: Postgres. Caches: one per-instance aggregate cache (`dashboard/network-count.ts`).
- **Classroom:** no code exists.

## Changes this round
Worker threads now have separate identities; DB queries have deadlines; 13 API routes rate-limited or guarded; `/api/internal/queue-health` added. No new services or dependencies.
