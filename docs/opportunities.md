# Research opportunities and internships

## Research opportunities (independent of Avsar)

Code: `src/lib/opportunities/` (ingest, feed, canonical, fit, recommend). Tables: `opportunity_sources`, `opportunities` (migration 0028).

Only rows with `status = 'active'`, `last_verified_at` within 30 days, no passed `deadline_at` and a real source URL are shown (`recommendableWhere`). The six rows seeded by migration 0014 were fabricated; 0028 marks them `origin = 'legacy_seed'`, `status = 'unverified'`, so they never appear. No row is ever deleted.

### Adding a source

1. Pick an official page or feed (university, lab, research organisation, government programme). Scholarly metadata (e.g. OpenAlex papers, researcher profiles) is not a vacancy source.
2. Review its terms and robots.txt. Record the review in `terms_reviewed_at` and `terms_note`. A fetched source cannot be enabled without it (database constraint).
3. Insert a row in `opportunity_sources`:
   - `kind = 'rss'` or `'json_feed'` with `url`: fetched by `npm run opportunities:refresh`, at most once per `min_fetch_interval_minutes` (default 6h, minimum 1h), after a robots.txt check.
   - `auto_verify = true` only if the source publishes open vacancies exclusively. Otherwise entries arrive as `unverified` and need review before they are shown.
   - `kind = 'manual'` for official pages without a feed: an operator adds listings with `addCuratedListing`, after opening the page and confirming the opening. That confirmation time becomes `last_verified_at`.
4. Set `enabled = true`.

### Lifecycle

`npm run opportunities:refresh` (schedule it, e.g. every 6 hours) refreshes enabled sources, then:

- expires listings whose published deadline has passed;
- demotes active listings not re-verified in 30 days to `unverified`;
- marks entries a source stops listing as `withdrawn`.

A failed fetch only records a short code in `last_error`; existing listings are left unchanged. Dedupe uses `(source_id, external_id)` within a source and `canonical_url` across sources.

### Fit

`fit.ts` returns one of four states: strong fit, potential fit, not eligible, or insufficient information. It never returns a percentage.

- **Demonstrated** skills are the Intelligence Engine's Proficient/Advanced assessments; all other profile skills count as **listed**.
- **Eligibility** is decided only from a structured `eligible_levels` restriction that the listing published. Free-text eligibility is shown for the student to check.
- Nothing is sent to sources, and providers never learn who viewed a listing.


## Automated discovery (2026-11-11)

**Collection methods:**

| Kind | How it works |
|---|---|
| `rss` / `json_feed` | Official feeds, read by the existing feed parser |
| `page_monitor` | An official listing page, parsed by a source-specific adapter (`src/lib/opportunities/adapters.ts`) written against that page's real markup. It throws if the page is redesigned, so a redesign is recorded as a failure and never mass-withdraws listings |
| `manual` | Exception-only curation (`addCuratedListing`) |

**Sources:** the catalogue is `src/lib/opportunities/catalogue.ts`; each entry records what was verified.

- Register the sources with `npm run opportunities:sources`.
- Enable them with `npm run opportunities:sources -- --confirm-terms` after you confirm each site's terms of use.
- Both commands need `AIT_APPROVED_WRITE_HOST` set to exactly the target database host.

**Outcomes:**

| Outcome | Stored status | When |
|---|---|---|
| VERIFIED | `active` | The source is trusted, plus an explicit Open status, a future published deadline, or a rolling call |
| NEEDS_REVIEW | `unverified` | No date or status published, or the source isn't auto-verified |
| REJECTED | `expired` / `withdrawn` | Marked Closed, deadline passed, the link returns 404/410, or no longer listed by a complete-listing source |

Only VERIFIED listings within the 30-day verification TTL are shown, and the dashboard and YORA share one query (`recommendableWhere`).

**Absence semantics:** `withdraw_on_absence` is true only for pages that list every open position (IISc, IIT Kharagpur, IIT Hyderabad). Rolling feeds such as Max Planck's are false: an entry that disappears from them is not treated as withdrawn, and simply stops being re-verified (it goes stale after 30 days).

**Filtering:** an `include_pattern` keeps research roles only. For example, it drops IT/administrative jobs from the MPG feed and managers or field staff from IIT project pages.

**Scheduling:** `GET /api/internal/opportunities/refresh` (Bearer `CRON_SECRET` or `INTERNAL_API_SECRET`). On each pass it:

- refreshes every enabled source that is due (interval of 6 hours by default), with a 10-minute lease so runs never overlap, and exponential backoff after failures (capped at 24 hours);
- applies the lifecycle rules;
- checks up to 20 links.

It is idempotent: calling it often still fetches each source at most once per interval. `vercel.json` runs it daily at 05:41 UTC, because Vercel's Hobby plan allows daily crons only. To get the 6-hour target, either upgrade to Vercel Pro and change the schedule to `0 */6 * * *`, or have any existing scheduler (for example the Render worker) call the endpoint every 6 hours with `INTERNAL_API_SECRET`.

**Not automated yet:** reading the advertisement PDFs, so required skills and detailed eligibility are not extracted. Cards therefore show the published title, department, deadline and link, and fit is "Not enough information" until skills are available. No AI processing is applied to source content.

**Sources checked and not used:**

| Source | Reason |
|---|---|
| IIT Kanpur DoRD | 403 to automated requests (not bypassed) |
| IIT Madras ICSR | Obfuscated dynamic links |
| IIT Bombay IRCC | Results and withdrawals mixed with adverts; no dates |
| IISER Tirupati | Feeds return HTTP 500 |
| jobs.ac.uk | Current official feed URLs not confirmable |
| EURAXESS | No documented feed |
| UK university job RSS feeds | Mostly non-research staff roles |
## Internships (Avsar is authoritative)

Audit (2026-11-11): Avsar exposes **no** API through which another product can list its published opportunities. Its routes are auth, documents, health and export; opportunities are created and listed through Avsar's own server actions.

AI Tathastu therefore shows a truthful "not available here yet" state and hands students to Avsar through `/integrations/launch/avasar`. It never shows its own internship listings in Avsar's place.

To enable real internship matches, Avsar needs a partner endpoint (an Avsar change, needing separate approval). It should be authorised per student through the existing OAuth relationship and return only internships that are:

- published and active;
- within their publication dates;
- visible to that student.

Each result needs a stable id, an `updated_at` and a deep link for application hand-off. Applications stay in Avsar. Then implement `fetchAvsarInternships` in `src/lib/opportunities/avsar.ts` with caching, a stale state and withdrawn/deleted handling.
