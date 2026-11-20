# AVSAR Collaborations

A team-building marketplace inside AVSAR (`/opportunities?cat=collaborations`), with public discovery at `/collaborations`.

## Flow

Publish → Discover → Apply (or ask a question first) → Owner accepts → Team conversation → Complete.

| Who | Can |
|---|---|
| Visitor | Browse Discover and open any published collaboration. Nothing else. |
| Signed-in, onboarded user | Create/edit/publish own posts; apply; ask up to 3 unanswered questions per post; withdraw; leave a team; report; block (owners). |
| Owner | Everything on their own posts: status changes, accept/reject, remove members, block applicants/enquirers. |
| Accepted member | Team roster and team conversation; leave. |
| `collaborations.moderate` (super_admin, support_admin) | Review reports, read reported conversations (logged), suspend/restore/remove listings, hide messages. |
| `collaborations.manage` (super_admin) | Ownership transfer, clearing owner-review flags, faculty/alumni creator verification. |

Faculty-led / Alumni-led labels come only from `collab_creator_verifications`, granted in Admin → Collaborations →
Faculty & alumni. The persona picked at sign-up never counts (an unverified faculty/alumni persona posts as
"Community-led").

## Data (migration `0034_collaborations.sql`)

Tables: `collab_posts`, `collab_members`, `collab_applications`, `collab_threads`, `collab_messages`, `collab_reads`,
`collab_notifications`, `collab_reports`, `collab_moderation_actions`, `collab_blocks`, `collab_creator_verifications`.
RLS is enabled on all of them with no policies (Supabase API roles see nothing; the app connects as owner).

Atomic operations are SQL functions that lock the post row: `collab_apply`, `collab_decide_application`
(capacity can't be exceeded by concurrent acceptances), `collab_end_membership`. Team size is always counted from
active `collab_members` rows.

Retention: nothing is deleted automatically. Expired, closed, completed and removed collaborations keep their
members, requests, messages and moderation history. Former members lose conversation access immediately; messages
stay for the remaining team. Removal by a moderator is a permanent suspension (not a row delete).

## Required operations before production

1. **Apply the migration** (by hand, like 0025–0033; do not run `drizzle migrate` against production while the
   ledger is out of sync). The file is additive and idempotent.
2. **Schedule the lifecycle job daily**: `POST /api/internal/collaborations/lifecycle` with
   `Authorization: Bearer $CRON_SECRET`. On Vercel add to `vercel.json` → `crons`:
   `{ "path": "/api/internal/collaborations/lifecycle", "schedule": "11 6 * * *" }`.
   Without it, listings never expire, no renewal reminders are sent and orphaned teams are never flagged.
   The job is idempotent.
3. Grant `collaborations.moderate` to any non-super-admin moderators via custom permissions if needed.

## Lifecycle

`draft → recruiting ⇄ paused`, `recruiting → team_full` (automatic at capacity, reopens when someone leaves),
`→ in_progress → completed`, `→ closed` (reopenable), `→ expired` (60 days without renewal; renewable while the
deadline hasn't passed), `suspended` (moderation only). Reminders on days 45 and 55.

Owner recovery: the daily job flags active collaborations whose owner account was deleted, or whose owner hasn't
managed a team with members for 90 days. An administrator verifies, then transfers to an active member or clears the
flag. Nothing is transferred or closed automatically.

## Known limits

- Conversations poll (15 s while open); there is no websocket push, typing indicator or file sharing.
- Notifications are in-app only (`collab_notifications`); no email is sent.
- Search uses Postgres full-text (`simple` config) plus a title substring match.
