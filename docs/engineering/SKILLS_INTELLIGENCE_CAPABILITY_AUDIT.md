# Skills Intelligence: capability audit

Audited from the code (`worker/intelligence/*`, `worker/connectors/*`, `worker/skills_catalog.py`, `src/lib/dashboard/*`), not from the UI. The engine is `worker/intelligence/career_engine.py`: pure and deterministic, with no LLM in scoring, gaps, recommendations or roadmap.

| Capability | State before | State now | Notes |
|---|---|---|---|
| Evidence ingestion: resume | Implemented | Unchanged | `worker/resume/*`, facts with origin `resume` (claims) |
| GitHub | Implemented | Unchanged | Repositories, languages, bytes, recency → verified evidence |
| LinkedIn | Implemented (OIDC / scrape) | Unchanged | Treated as **claims** (`CLAIM_ORIGINS`) |
| LeetCode / HackerRank | Implemented | Display fixed | Stats feed ERIS problem-solving; language and DSA skill facts. They were shown as honours (fixed) |
| Projects, certifications, education | Implemented | Unchanged | Certification is a +5 supporting signal only |
| User-submitted evidence | **Missing** | **New** | Roadmap milestone submissions (pending until the engine confirms them) |
| Provenance per evidence item | Implemented | Unchanged | Kind, source, label, ref, timestamp per skill (`SkillEvidenceRef`); facts keep origin, confidence, validation status and user |
| Duplicate evidence | Implemented | Unchanged | One tally per (skill, record); projects unified across sources (`projects.unify`) |
| Alias normalisation | Implemented | **Extended** | `skills_catalog.CATALOG` → `skill_aliases`; 18 specialist skills and their aliases added |
| Claimed / inferred / verified | Implemented | Unchanged | Inferred skills never get a score |
| Proficiency vs confidence vs coverage | Implemented, separate | Unchanged | Documented in `career_engine.py` and `SCORING_MODEL.md` |
| Role competency frameworks | 10 roles real; 10 new roles **partial** (generic skills only) | **All 20 role-specific** | See `CAREER_COMPETENCY_COVERAGE.md` |
| Gap analysis (not detected / claimed / below level / met) | Implemented | Unchanged | `GapState`: missing, unverified, inferred, underdeveloped, met, not_assessed. A sparse profile gives "not assessed", not a gap |
| Learning recommendations | Implemented | Unchanged | Only link-checked catalogue courses; otherwise "learn by building" |
| Roadmap generation | Implemented | **Personalised further** | Stable milestone ids; role-specific deliverable context |
| Milestone progress and validation | **Missing** | **New** | `roadmap_milestone_submissions` + `lib/roadmap/progress.ts` |
| Refresh on new evidence | Implemented (job queue, idempotency keys, weekly cron) | Extended | A submission queues one idempotent `compute_intelligence` |
| Incremental recomputation | **Not implemented** | Unchanged | Each run recomputes the whole user, which is cheap and pure. Per-skill incremental updates were not added (see limitations) |
| Mocked / hardcoded | Old `quickActions` panel (removed from the dashboard); `generate_next_best_actions` has one fixed "Connect with research peers" action | Unchanged | Next Actions is out of scope |
| Not verifiable here | Production data quality, live connector behaviour | — | No production access was used |

## Limitations
- A submitted link is **not read automatically**. It completes a milestone only if the same work also reaches the engine through a connected source (for example a repository in the connected GitHub account). There's no reviewer or mentor workflow to approve arbitrary links yet; the status stays honest at "Submitted for review" or "Needs more evidence".
- The new specialist skills can only be detected where sources mention them (resume text, project descriptions, repository topics). GitHub reports languages, not libraries, so for example "Graph Neural Networks" is mostly a claim or a description-based signal, capped at 49 unless backed by other evidence.
- An alias that some user's data already auto-created as an `other` skill (for example "GNN") keeps its old mapping, because seeding is `ON CONFLICT DO NOTHING`. A one-off alias remap would need a reviewed data migration; none was run.
