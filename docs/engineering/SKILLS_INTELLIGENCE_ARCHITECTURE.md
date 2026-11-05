# Skills Intelligence: architecture (as built)

```
sources ──► profile_facts / code_repositories ──► compute_intelligence job (worker)
 resume, GitHub, LinkedIn,      (origin, record_key,          │  skills.SkillIndex (catalog-seeded aliases)
 LeetCode, HackerRank,           confidence, validation,      │  career_engine.compute()  ← pure, deterministic
 Kaggle, ORCID, user edits       confirmation, user_id)       │    build_skills → infer_skills → analyze_role(×roles)
                                                              │    → recommend → build_roadmap → build_graph
                                                              ▼
                                         profile_views.view.intelligence (IntelligenceDoc, engineVersion 2)
                                         roadmaps (legacy columns, read by Yora), eris_scores
                                                              │
 dashboard cards, /skills, /learning ◄────────────────────────┘
 roadmap_milestone_submissions (user claims) ──► lib/roadmap/progress.ts merges them for display only
```

## Evidence model
Each skill carries `evidence[]` items of `{kind, source, label, ref, at}`, plus `status` (verified / claimed / inferred), `proficiency` (0–100 or null), `confidence` and `evidenceCount`. Facts keep `origin`, `source_evidence`, `confidence`, `validation_status`, `confirmation` and `user_id`. Superseded facts stay for audit (`superseded_by`).

## Scoring
Unchanged and documented in `career_engine.py` and `SCORING_MODEL.md`:
- Only demonstrated use earns points: repositories, code volume, recency, described work, platform assessments.
- Claims alone are capped at 49.
- Repository metadata alone tops out at 70.
- Proficiency, confidence and role coverage are never blended.

## Role mapping
`worker/intelligence/config.py`:
- `ROLE_SKILLS` holds weighted canonical skills per role, and `ROLE_PROJECT_CONTEXT` holds the project setting per role.
- Expected level comes from weight: ≥0.9 → 50 (Proficient), ≥0.6 → 25 (Working), otherwise 10.
- One scoring path serves every role; there's no per-role scoring code.

## Roadmap
`build_roadmap` orders the role's open skills by prerequisites (`PREREQUISITES`) and splits them into three stages:
- **Foundation** (no open prerequisite)
- **Build** (High/Medium priority)
- **Deepen** (Low priority)

Each milestone has `id = "<role>:<skill-slug>"`, a deliverable, a criterion and an estimate. Progress is the role coverage.

## Refresh
- Connectors, onboarding, the weekly cron and roadmap submissions enqueue `compute_intelligence` with idempotency keys (`jobs.idempotency_key`), so a repeated trigger doesn't duplicate work.
- A run rereads the user's facts and repositories and rewrites the view. It's not incremental per skill: the engine is pure and runs in milliseconds per user, so a full recompute was kept rather than adding invalidation complexity.
- The view is computed per job, not per page render.
