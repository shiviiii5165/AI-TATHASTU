-- PROPOSAL ONLY. Not applied. Run only with explicit approval, against the intended database.
-- Uses the existing data-management convention from lib/opportunities/ingest.ts (status 'withdrawn' + status_reason);
-- nothing is deleted. Each statement is scoped by URL and status so re-running it is a no-op.
BEGIN;

-- Removed at the official source (URL now returns the Max Planck job board home page), checked 2026-11-27.
UPDATE opportunities
   SET status = 'withdrawn', status_reason = 'No longer listed by the source (manual audit 2026-11-27)', updated_at = now()
 WHERE url = 'https://www.mpg.de/27089434/scientist-to-further-develop-the-israd-radiocarbon-database'
   AND status = 'active';

-- Deadlines stated on the official pages (checked 2026-11-27) but missing in the catalogue, so the existing
-- deadline gate hides each one once it passes. deadline_at = end of that day in the posting's timezone (CET).
UPDATE opportunities SET deadline = '30 November 2026', deadline_at = '2026-11-30T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.hzdr.de/db/Cms?pNid=head&pOid=79056&pContLang=en' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = '29 November 2026', deadline_at = '2026-11-29T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.hzdr.de/db/Cms?pNid=head&pOid=79032&pContLang=en' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = '15 January 2027', deadline_at = '2027-01-15T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.hzdr.de/db/Cms?pNid=head&pOid=79132&pContLang=en' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = 'January 5th 2027', deadline_at = '2027-01-05T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27064417/imprs-2027' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = '15 January 2027', deadline_at = '2027-01-15T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27091166/phd-positions-scattering-amplitudes-and-quantum-gravity' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = '18 December 2026, 23:59 CET', deadline_at = '2026-12-18T23:59:00+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27111732/imprs-idi-advert-2027' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = '4 January 2027', deadline_at = '2027-01-04T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27063337/phd-positions-in-gravity-at-the-extreme' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = 'December 1, 2026', deadline_at = '2026-12-01T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27057336/phd-student-m-f-d-community-ecology-stone-tool-use-and-social-behavior-in-gracile-capuchin-monkeys' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = '7 December 2026', deadline_at = '2026-12-07T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27088328/postdoc-fgh-26-01' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = 'December 31, 2026', deadline_at = '2026-12-31T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27087999/postdoctoral-position-so-phi-data-reduction-and-exploitation' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = 'December 6, 2026', deadline_at = '2026-12-06T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27104445/postdoctoral-position-fluid-mediated-collective-behaviour-in-animals-and-robots' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = 'December 11, 2026', deadline_at = '2026-12-11T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27081385/postdoctoral-position-the-sensory-ecology-of-worm-towers-178' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = 'December 31, 2026', deadline_at = '2026-12-31T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27088878/postdoctoral-researcher-bgc-12-2026' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = 'January 4th, 2027', deadline_at = '2027-01-04T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27060614/postdoc-tsiantis' AND deadline_at IS NULL;
UPDATE opportunities SET deadline = '6 December 2026', deadline_at = '2026-12-06T23:59:59+01:00', updated_at = now()
 WHERE url = 'https://www.mpg.de/27055198/senior-research-fellow-postdoc-constellations-of-global-dis-ordering' AND deadline_at IS NULL;

-- Check the row counts before COMMIT: 1 withdrawn, up to 16 deadlines set.
-- COMMIT;
ROLLBACK;
