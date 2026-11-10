# Career Intelligence Engine v3

How AI Tathastu assesses a student against one of the 20 AI career pathways. The engine is
`worker/intelligence/career_engine.py`, run by the `compute_intelligence` job (`worker/intelligence/compute.py`).
It is pure and deterministic: no database, network or LLM. The dashboard only displays its output.

## 1. Canonical role registry

`worker/intelligence/frameworks/career_roles.json` is the one list of role ids and labels:

- 20 `current` roles (offered in onboarding).
- 3 `retired` roles: `ai_engineer`, `ai_product_founder` and `still_exploring`. They still validate and display for saved choices, but they are not offered.

These files read it:

- `src/lib/onboarding/catalog.ts` (web app; it is bundled from the worker folder).
- `worker/intelligence/frameworks.py`.
- `worker/intelligence/matching.py` (its duplicate label table was removed).

Ids are storage keys: retire a role, never rename one. `src/lib/onboarding/catalog.test.ts` and
`worker/tests/test_career_coverage.py` fail if the web app and the worker disagree.

## 2. Role frameworks (DRAFT / UNREVIEWED)

`worker/intelligence/frameworks/role_frameworks.json`, version `2026.11-draft.1`, status `draft_unreviewed`.

**Provenance.** The frameworks are the engine v2 weighted skill lists, restructured. They are the AI Tathastu
team's own judgement: no references, and no reviewer yet. Every assessment carries the status. The roadmap tells
the student the framework is a draft, not an industry standard.

**Shared competency definitions** (76). Each one has:

- Category.
- Description.
- What a practical demonstration looks like.
- Prerequisites.
- Evidence types: those that can establish a level, and those that can only support one.

**Per role.** Each role has:

- Responsibilities.
- Project context.
- Completion criteria.
- For each competency:
  - Tier: `required` (v2 weight ≥ 0.8) or `supporting`.
  - Expected level: Proficient (weight ≥ 0.9), Working (≥ 0.6), otherwise Foundational.
  - Evidence requirement: `independent` for required competencies, `described` for supporting ones.

**Validation.** `frameworks.validate()` runs at import, so the worker refuses to start on bad data. It checks for:

- Unknown competencies or prerequisites.
- Duplicates.
- Missing descriptions.
- Labels that differ from the registry.
- A current role with no framework.

**Adding authoritative sources later.** Fill `provenance.references` and `reviewedBy`/`reviewedAt`, adjust the data,
and bump `frameworkVersion`. No engine change is needed.

## 3. Evidence and proficiency

| Source | Evidence state | Adds to proficiency |
|---|---|---|
| Public repositories (languages, topics, description) | demonstrated | yes |
| Platform activity and assessments (Kaggle, Stack Exchange, LeetCode, HackerRank) | demonstrated | yes |
| Projects and work experience described by the student (resume or profile) | unverified | yes, capped at 49 |
| Skill listed on a resume or profile | claimed | no |
| Certification named on a resume | claimed (credential) | no |
| Verified certification (`learning_records`) | supporting | +5, only on top of other evidence |
| Completed course (`learning_records`) | learning | no |
| Related skills only (ontology) | inferred | never scored |

**Proficiency (0–100).** The formula is unchanged from v2 and documented in the module docstring. Levels:

- Foundational: any assessed score.
- Working: 25 and above.
- Proficient: 50 and above.
- Advanced: 75 and above.

A mention alone has no level ("Not assessed"); it is never shown as Foundational. Repository metadata alone stops
at Proficient, because we read metadata, not code.

**Duplicates.** Duplicate mentions of a skill count once, per source record.

**Evidence ledger.** Every fact the engine used becomes a `skill_evidence` row (skill, fact id, origin, strength =
the skill's confidence). That table is now a projection of the engine's ledger, so there is one evidence model.
Fact ids are always real profile fact ids; none are manufactured.

## 4. Role alignment (no percentages)

`career_engine.alignment()` counts only **required** competencies. A competency is `met` only when its level
reaches the expected level **and** its evidence meets the framework's requirement. The states:

- `not_enough_evidence`: nothing to read, or no framework competency has any evidence at all.
- `requirements_demonstrated`: every required competency is met.
- `strong`: every required competency has an assessed level, at least half are met, and every required
  competency with no required prerequisite (the foundations) is met.
- `developing`: at least one required competency is met, or at least half have an assessed level.
- `early`: anything else with some evidence.

Supporting competencies and evidence volume never raise the state. A profile made of descriptions alone can never
reach `requirements_demonstrated`, because required competencies need demonstrated evidence.

`coverage`, the weighted share of competencies met, is still computed for older readers and ERIS. It is no longer
displayed anywhere on the dashboard. The ERIS score is still computed and stored (see the limitations), but the
dashboard widget now shows the alignment state instead.

## 5. Gaps and prioritisation

Each competency row carries:

- `state`.
- `gapType`: `completed`, `missing_competency`, `insufficient_proficiency`, `claimed_unverified`,
  `insufficient_evidence` or `not_assessed`.
- Expected and current level, evidence, and evidence state.
- `whyItMatters`, `demonstration`.
- Prerequisites: `prerequisites`, `prerequisiteFor`, `blockedBy`.
- `priorityRank`, `priorityReason`.

Open gaps are ordered by:

1. Required before supporting.
2. Unblocks more open competencies.
3. Framework weight.
4. Shortfall.
5. Name, as a stable tie-break.

Met competencies never appear as gaps. Missing data is `missing` or `not_assessed`, never a zero score.

## 6. Roadmap

Stages come from the primary role's open competencies:

- **foundation**: open required competencies with no open prerequisite on the path.
- **build**: the remaining required ones.
- **deepen**: supporting competencies that no required one depends on. These are marked `optional`.

A supporting competency that a required one builds on (e.g. Vector Databases before RAG) moves onto the path, so no
step waits on an optional stage.

Each milestone has:

- Objective, why it matters, practical task and evidence required.
- Completion criterion and prerequisites, with `blockedBy`.
- A verified catalogue course, only when one exists and its link checks out.
- `estimateWeeks: null`.

**No time estimates.** The six-hours-a-week assumption is gone. When `requirementsMet`, every remaining milestone is
optional and the UI says the student's evidence covers the required skills. That is not a certification or a job
guarantee. Milestone ids (`role:skill-slug`) are unchanged, so saved submissions keep matching.

## 7. Certifications and learning records

Migration `0026_learning_records.sql` adds `learning_records`. It is additive and reversible with
`DROP TABLE learning_records`. Columns:

- `kind`: course or certification.
- `status`: recommended, started, completed or claimed.
- `verification`: unverified, verified or rejected.
- `source`, `source_fact_id`, `resource_id`, `skills`, and timestamps.

The worker reads the table only if it exists, so the worker can ship before the migration runs. Resume
certifications stay as profile facts. They are treated as claimed credentials and are not copied into the table.

## 8. Consent and privacy

Unchanged. The engine makes no AI calls. The consent gates, scope versions (`EXTERNAL_AI_FULL_SCOPE_SINCE`
2026-11-10), withdrawal and retry re-checks all stay where they were (`db.has_consent`, `provider_router`).
`load_learning_records` reads only the job's own user. A test checks that another user's records never appear.

## 9. Reliability

All outputs are written in one transaction, fenced on job ownership. A failure anywhere, including in the AI
provider or the engine, writes nothing, so the last good assessment stays.
`test_a_failed_recompute_keeps_the_last_good_assessment` covers this.
