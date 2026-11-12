# Career Intelligence Engine v4

Supersedes the proficiency rules in `SCORING_MODEL.md` and extends `CAREER_INTELLIGENCE_ENGINE_V3.md`. The code is the
source of truth: `worker/intelligence/career_engine.py` (module docstring), `code_signals.py`, `project_intent.py`,
`learning.py`, `frameworks.py` and `frameworks/role_frameworks.json`.

## Root causes v4 addresses

| Symptom on the dashboard | Root cause in v3 | v4 change |
|---|---|---|
| ML skills "No work examples yet" although the student's code uses them | Repositories were read for language bytes, topics and description only; `requirements.txt` etc. were invisible | GitHub sync reads dependency files, root structure (tests, CI, Dockerfile, Kubernetes, Terraform) and README skill names (`code_signals`, migration 0031) |
| "Dockerfile", "PLpgSQL" listed as skills | No aliases for GitHub linguist names; `skills.seed` used `ON CONFLICT DO NOTHING`, so an auto-created alias could never be corrected | Aliases added; catalogue aliases now overwrite auto-created ones |
| Several skills at exactly "70% Proficient" | Repository metadata capped at 70, so any language with 5+ recent repos hit the cap | Points plus behavioural evidence gates; the UI shows level steps and the evidence basis, not a percentage |
| A topic tag counted as demonstrated use | Topics and descriptions scored like code | Topics, descriptions and README mentions are "repository mentions" and stop at Working |
| "70% Proficient" next to "1 of 4 required skills met" | Skill Proficiency listed all skills; the roadmap counted the role's required ones, and nothing said so | Skill Proficiency defaults to "For <goal>" with the expected level marked on each bar |
| Thin, generic role lists; no references | 3–6 required skills per role, no capabilities, `references: []` | Framework v4: 20 roles, 87 competencies, capabilities, role-specific rationale, specialisation tracks, behavioural level criteria, 32 link-checked public references |
| What the student wants to build was ignored | Only a 120-character "other direction" field existed, and the engine never read it | "What you want to build" card → `goals/project_intent` fact → deterministic phrase rules → project requirements in the gap inventory and roadmap |
| Courses chosen by keyword, many links dead | Hand-written skill→course map over a DB catalogue where ~18 of ~50 links passed | Curated catalogue (121 resources) with level windows, focus, prerequisites and outcomes; selection by written rule; only link-checked resources offered |
| Fixed foundation/build/deepen stages; spliced sentences | Template stages; project context concatenated into the task | Stages are layers of the dependency graph over career + project gaps, with purpose, completion criteria and what they unlock |
| Submitted milestone evidence did nothing | The engine never read `roadmap_milestone_submissions` | Each submission is reviewed: read if it is one of the student's synced repositories, otherwise the student is told why it can't be read |

## Evidence and proficiency

Evidence basis per skill, strongest first: `assessed` > `demonstrated` (code) > `repository_mention` > `described` >
`claimed`. Role rows use `not_found` when nothing shows the skill; the UI calls that "Not shown yet", never missing ability.
We never produce "verified experience": employment can't be verified.

Points (0–100): code repositories 25 for the first + up to 15 more; repository mentions up to 10; code volume up to 10;
recency up to 10; engineering signals (tests, CI, documented evaluation) up to 10; described projects/jobs and platform
activity 12.5 each, at most 30; verified certification +5. Under 1.5 KB of a language is a trace, not code.

Gates (the published `evidenceForLevel` in the framework file):

- **Working at most:** nothing independent shows it, or repositories only name it.
- **Proficient** needs one of: code in 2+ repositories; code plus tests/CI/evaluation or work experience; 2+ platforms; or a 3-star assessment.
- **Advanced** needs one of: code in 3+ repositories plus tests/CI/evaluation or work experience; or a 4-star assessment.

Each skill carries `levelBasis`, `levelCap` and `nextLevel` in words.

A capability (Model Evaluation, Data Preparation, Model Deployment…) is never a dependency, so its README description in a
repository that contains code counts as code-depth evidence. Tools and concepts named in a README stay mentions.

## Attribution (added during validation, 2026-11-12/13)

Repository evidence counts as the student's own work only in attributable repositories. The engine classifies each
repository as follows (`code_signals.contribution`; commit counts come from GitHub's contributors API during sync):

- **confirmed:** at least 50% of commits are the student's, or at least 25% with 20 or more commits.
- **owned:** the repository is under the student's account and there are no commit counts, or there are counts but zero
  commits are linked to the student (usually an unlinked git email).
- **unconfirmed:** everything else.

The rules that follow from it:

- Only confirmed or owned repositories count as implementation. Technology in other repositories is `detected`, stops at
  Working, and is never treated as independent evidence for the role or for alignment.
- Advanced needs at least one confirmed repository.
- Tests and CI count as engineering signals only in attributable repositories. A README that mentions evaluation is never one.
- Practice skills (Software Testing, CI/CD, Docker, Kubernetes, Terraform) stop at Working on repository files alone.
- Project intent: a rule matched only by an ambiguous word is a `possible` reading. It comes with a clarifying question
  and is never added to the gap inventory or roadmap.

## Framework review (2026-11-13, internal)

| Role | Change |
|---|---|
| Edge & Federated AI | Federated Learning is now a specialisation |
| AI Infrastructure | Requires Terraform (Working) and CUDA understanding (Foundational); distributed training code is supporting |
| AI Evaluation & Safety | AI Safety expected at Working |
| Robotics | C++ expected at Proficient |
| Data Scientist | Pandas is supporting (Data Preparation remains required) |
| Multimodal AI | NLP and Embeddings are supporting |
| Speech, Graph, Edge | References added |

This is still an internal draft (`draft_unreviewed`), not an external expert review.

## One result for every card

`gapInventory` is the complete list: primary-goal competencies, project requirements, and the prerequisites they build on.
Every row has a category (`meets`, `needs_practice`, `proof_needed`, `foundation`, `not_shown`, `possibly`,
`not_assessed`), a reason, the evidence considered, an action and a demonstration. Priority groups, in order:

1. Foundations of required skills.
2. Skills both career and project need.
3. Other career requirements.
4. Project-only skills.
5. Supporting skills.

Skills to develop, Skill Gaps, Learning Paths, Where you stand and the roadmap all read this one result through
`src/lib/dashboard/intelligence.ts`. Secondary goals are stored compact (`compact: true`, `open: []`). Readers derive open
rows with `openRows()` (TS) or `eris.open_rows_of()` (Python).

## Limits (also shown to students in "What this is based on")

- No source code is read. A dependency shows use, not skill or authorship.
- Collaborator repositories count as the student's.
- Repositories are read only after migration 0031 is applied and the student's next GitHub sync runs. Until then every
  repository reports "files not read yet", and code-depth evidence comes only from language statistics.
- The project-intent rules cover common AI project types; anything else is reported as too vague, never guessed.
- Frameworks are a draft by our team (`draft_unreviewed`), informed by references, not an industry standard.
- Link checks are point-in-time. Re-run `python scripts/check_learning_links.py --curated` before release; a resource whose
  last check isn't "ok" is withheld.

## Rollout

1. Deploy the worker and the web app. Both work without migration 0031.
2. Apply migration 0031 (`code_repositories.code_signals jsonb`, nullable), then restart the worker, which checks for the
   column once per process.
3. Profiles are rewritten as engine v4 on their next recalculation (any sync, resume or profile change, or a backfill).
   v3 documents keep rendering until then.
