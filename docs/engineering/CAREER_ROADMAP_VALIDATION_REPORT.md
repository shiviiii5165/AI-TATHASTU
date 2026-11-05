# Career Roadmap: personalisation, milestone states, validation

## Personalisation
- Milestones are built from the selected role's framework minus the skills the user's evidence already shows at level, ordered by prerequisites and priority (`career_engine.build_roadmap`).
- Different roles give different milestone sets. Tested: ML Engineer vs Robotics Engineer (ROS) vs LLM Application Engineer (RAG).
- Deliverables carry role context (`ROLE_PROJECT_CONTEXT`). For example, PyTorch for a speech engineer is "a public project using PyTorch in a speech pipeline (transcription or voice)".
- "Current / Short / Mid / Long Term" are only visual stage labels. Their content is the user's foundation, build and deepen stages.

## Stable identity
`milestone_id(role, skill) = "<role>:<skill-slug>"`, identical in Python (engine v2) and TypeScript (`lib/roadmap/progress.ts`, which also covers views written by engine v1). Saved submissions keep matching across recomputes.

## States (`lib/roadmap/progress.ts`)
| State | Rule |
|---|---|
| Completed | The engine's evidence shows the skill at its expected level (`done` / `completed`). The only path to completion |
| Submitted for review | The user submitted evidence after the last engine run |
| Needs more evidence | The engine ran after the submission and the skill still isn't at level |
| Active | The first open milestone whose prerequisites are complete (the highlighted next step) |
| Upcoming | Everything else |

User-reported completion is never treated as proof: a submission can't complete a milestone or change the progress figure.

## Persistence and flow
1. **Submit evidence** in the roadmap card calls `submitRoadmapEvidence`, a server action that requires an onboarded user.
2. `submitMilestoneEvidence` checks the milestone is on the user's current roadmap and not already completed, accepts only `https://` links (no credentials), and allows at most 100 submissions per user. It inserts into `roadmap_milestone_submissions` (unique per user, milestone and link) and queues one idempotent `compute_intelligence` job.
3. The engine recomputes from all sources. If the work reached it (for example a new repository in the connected GitHub), the skill can reach its level and the milestone becomes Completed. Progress then increases, the path redraws to the new value, and the next milestone becomes Active. Gaps and recommendations refresh in the same run.
4. Submissions persist in Postgres across sessions. The roadmap is computed per job, not per render.

## Progress
`progress` is the engine's weighted coverage of the role's skills at level, clamped to 0–1. It's never advanced automatically or estimated. The path animation starts at zero and stops exactly on that value, and is skipped under reduced motion.

## Migration
`0025_roadmap_milestone_submissions.sql` only adds things (new table and indexes); `DROP TABLE` reverses it. **It was not applied to production.** It must be applied before deploying this code. Until then, the dashboard query fails safely (it logs and shows no submissions), but submitting would fail.

## Tests
- `src/lib/roadmap/progress.test.ts`: states, next milestone, submission doesn't complete or move progress, completion from evidence, clamping.
- `src/lib/roadmap/submissions.test.ts` (PGlite): validation, persistence, idempotency, one queued job, refusal for completed milestones.
- `worker/tests/test_career_coverage.py`: per-role differences, stable ids, progress equals coverage.

## Gap
There's no automatic reading of arbitrary submitted links and no reviewer approval flow yet.
