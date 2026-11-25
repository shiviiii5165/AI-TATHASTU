# Cross-app profile sync rollout (AI Tathastu → Collaborate, Avsar)

Every step below that touches production needs the owner's explicit approval at that step. Nothing here runs by itself:
signup provisioning, weekly backfill and scheduled repair are each off until their setting is turned on.

## What ships

| Repo | Commit(s) | Database change |
|---|---|---|
| Collaborate | `7b0ec3d` | none |
| Avsar | `e9e3ad0`, `8f7163f` | `0010_ait_webhooks.sql` (new table `ait_webhook_deliveries`, RLS on) |
| AI Tathastu | `25938b9`, `b5bb281`, `bbcc572`, `c5cefc4` | `0036_integration_sync_state.sql` (2 new tables, 5 new columns; additive) |

## Settings

AI Tathastu (Vercel):

| Name | Value | When |
|---|---|---|
| `INTEGRATION_AVASAR_WEBHOOK_URL` | `https://avsar.aitathastu.com/api/webhooks/tathastu` | step 4 |
| `INTEGRATION_AVASAR_WEBHOOK_SECRET` | new random secret, 32+ bytes | step 4 |
| `AVASAR_AUTO_PROVISION` | `1` (new signups get a private Avsar profile) | step 9 |
| `AVASAR_AUTO_PROVISION_BACKFILL` | `1` only if the weekly job should backfill; otherwise use the script | optional |
| `COLLABORATE_AUTO_REPAIR`, `AVASAR_AUTO_REPAIR` | `1` (daily repair of linked users without a confirmed profile) | step 10 |
| `COLLABORATE_AUTO_PROVISION` | already `1` | unchanged |

Avsar: `AVSAR_AIT_WEBHOOK_SECRET` = the same value as `INTEGRATION_AVASAR_WEBHOOK_SECRET`. Until it is set the endpoint
answers 503 and AI Tathastu keeps retrying (nothing is lost). Collaborate: nothing new.

Secrets go through each host's secret store, never chat, email or git.

## Steps

1. **Avsar database:** back up, then apply `0010` (`npm run db:migrate` with the production URL in the shell only).
   Check: `SELECT to_regclass('public.ait_webhook_deliveries');` is not null.
2. **AI Tathastu database:** back up, then apply `0036` by hand, like 0025–0035 (do **not** run `drizzle migrate`; see the
   migration ledger note): `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f src/db/migrations/0036_integration_sync_state.sql`.
   Check: `integration_sync_state` and `integration_consent_log` exist; `integration_consents.source` exists.
3. **Deploy** Avsar, then Collaborate, then AI Tathastu (receivers first, so the sender never meets an old receiver).
4. **Set the Avsar webhook secret** on both sides (table above). Verify: an unsigned `POST` to the Avsar endpoint returns 401.
5. **Dry runs** (each needs `AIT_APPROVED_WRITE_HOST=<the AI Tathastu database host>` for that one command):
   ```
   npx tsx --conditions=react-server scripts/integration-sync.ts report
   npx tsx --conditions=react-server scripts/integration-sync.ts policy-v2 --client collaborate
   npx tsx --conditions=react-server scripts/integration-sync.ts repair --client collaborate --limit 500
   ```
   In Collaborate, with an export of active AI Tathastu user ids (`SELECT id FROM users WHERE deleted_at IS NULL`, one per line):
   ```
   npx tsx scripts/cleanup-orphan-auto-profiles.mts --active-ids active-ids.txt
   ```
   Expected on 2026-11-21: cleanup erases 18 and flags 1 for review; policy-v2 changes 39; repair re-sends 40.
6. **Collaborate cleanup** (approval): same command with `--apply`. Delete the id export afterwards.
7. **Career Intelligence off on automatic consents** (approval): `policy-v2 --client collaborate --apply --send`.
   Collaborate receives the narrower consent and drops readiness, gaps and activity.
8. **Collaborate repair** (approval): `repair --client collaborate --apply --send`. The 3 missing profiles are created now
   that their leftover shells are gone; the other 37 are updated. Check Admin → Intelligence → Integrations: 40 synced.
9. **Avsar test batch** (approval): `backfill --client avasar --users <3 ids from the dry run> --apply --send`.
   Check each answered `created`, Avsar shows 3 new private profiles, and the admin page shows them synced.
   Then set `AVASAR_AUTO_PROVISION=1` so new signups get Avsar too.
10. **Full Avsar backfill** (separate approval): `backfill --client avasar --limit 10 --apply --send`, repeated until the
    dry run shows 0 candidates. It resumes where it stopped. Then turn on `COLLABORATE_AUTO_REPAIR` and `AVASAR_AUTO_REPAIR`.
11. **Reconcile** (read-only): `reconcile --client avasar`. Prints counts only, every account in one bucket:
    `deleted` (skipped), `eligible` (backfill would provision), `alreadySynced`, `inFlight`, `onboardingIncomplete`
    (`--send` skips these; the daily dispatch sends them), `failed`, `conflict`, `unconfirmed`. The buckets sum to
    `total`. `backfill` prints the same report as its preview and again at the end. Retry `failed` and `unconfirmed`
    with `repair --client avasar --apply --send` (dry run first). Done when `eligible`, `failed` and `unconfirmed` are 0.

Avsar needs its migration `0013_ait_unlinked_at` (one nullable column, `candidate_profiles.ait_unlinked_at`) before
the build that writes it is deployed. It is the disconnect tombstone: after `integration.revoked`, a delayed or retried
`profile.updated` built before the disconnect is ignored (`IGNORED_BEFORE_UNLINK`); a fresh one after a relink is imported.
Rollback: `ALTER TABLE candidate_profiles DROP COLUMN ait_unlinked_at;` (old builds ignore it).

## Rollback

- Stop new work: unset `AVASAR_AUTO_PROVISION`, `*_AUTO_REPAIR`, `AVASAR_AUTO_PROVISION_BACKFILL`, and the Avsar webhook URL.
- Code: redeploy the previous builds. Old code ignores the new columns and tables.
- Schema (only if needed): the rollback statements are in the header of each migration.
- Data: provisioning only creates consent rows (logged with source `auto_provision`/`backfill`) and private profiles;
  `integration.revoked` removes them per app. Cleanup (step 6) and policy-v2 (step 7) are not reversible: back up first.
