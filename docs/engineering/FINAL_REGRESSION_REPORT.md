# Final regression report

Local only: no production database, deploy, commit or push. Base `main` @ `4e93266` plus the working tree.

## Results (after all changes)
| Check | Result |
|---|---|
| `npm test` (vitest), full suite, run 1 | **62 files, 705 tests passed, 0 failed** (22.1 s) |
| `npm test`, full suite, run 2 | **62 files, 705 tests passed, 0 failed** (20.8 s) |
| `pytest` (worker) | **269 passed**, 38 skipped (DB-backed tests needing a live Postgres), 0 failed |
| `npm run typecheck` | Pass |
| `npm run lint` | 0 errors, 99 warnings (all pre-existing unused-variable warnings in untouched files) |
| `npm run build` | Compiled successfully; 109/109 static pages |

## New regression tests
- `growth-development-row.test.ts`: bar width equals the real score (clamped, never padded), the `%` shown is the real one, the animation is a transform with a stagger, reduced motion is handled, no bar for unassessed skills, colours are stable, and the Yora panel is gone while the Yora modal stays wired.
- `lib/roadmap/progress.test.ts`, `lib/roadmap/submissions.test.ts`: see the roadmap report.
- `lib/profile/coding-activity.test.ts`: LeetCode record kept, classified as coding activity, exact Easy 1 / Medium 2 / Hard 1 / Total 4 breakdown, not treated as an honour, missing counts stay unknown rather than 0.
- `worker/tests/test_career_coverage.py`: all 20 roles mapped to canonical skills, specialist gaps covered, frameworks distinct, aliases normalise, prerequisites canonical, roadmaps differ by role, ids stable, progress equals coverage.

## Earlier failures (674 passed / 2 failed, three suites failing)
That run took **202 s**, with individual suites at 85–89 s; the same suite now runs in about 21 s. Findings:
- `profile/v1/me` IDOR test: **a real regression from the earlier pass** (the ML Engineer label had been renamed). Fixed by restoring the label; it passes now.
- `account-lock` "stops at the limit…": the test makes 301 sequential DB writes against a time-windowed rate limit. Under heavy load the loop can cross a window boundary, so more than 300 attempts succeed. It passed in isolation and in both full runs above. The cause is the test's dependence on wall-clock time under load. The test itself wasn't changed (out of scope); using fake timers would remove the flakiness.
- `backfill-safety`, `discovery`, `academic` suite-level failures: each needs a fresh in-memory PGlite with every migration in `beforeAll`. At 85–89 s per suite in that run they hit setup timeouts. They passed in isolation and in both full runs. The likely cause is CPU contention on the machine at the time; it couldn't be reproduced afterwards.

## Screenshots
None taken: no browser session was run in this environment. The visual results (colours, curve and caption placement at 4-column xl width, mobile) still need checking by eye before release.

## Remaining issues
- Migration `0025` must be applied before deploying.
- Submitted links aren't read automatically (see the roadmap report).
- No incremental per-skill recompute (a full pure recompute per job).
- Lint warnings are pre-existing.
