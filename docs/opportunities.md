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

## Internships (Avsar is authoritative)

Audit (2026-11-11): Avsar exposes **no** API through which another product can list its published opportunities. Its routes are auth, documents, health and export; opportunities are created and listed through Avsar's own server actions.

AI Tathastu therefore shows a truthful "not available here yet" state and hands students to Avsar through `/integrations/launch/avasar`. It never shows its own internship listings in Avsar's place.

To enable real internship matches, Avsar needs a partner endpoint (an Avsar change, needing separate approval). It should be authorised per student through the existing OAuth relationship and return only internships that are:

- published and active;
- within their publication dates;
- visible to that student.

Each result needs a stable id, an `updated_at` and a deep link for application hand-off. Applications stay in Avsar. Then implement `fetchAvsarInternships` in `src/lib/opportunities/avsar.ts` with caching, a stale state and withdrawn/deleted handling.
