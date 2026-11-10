"""`compute_intelligence` handler.

Reads the user's usable facts (confirmed/edited, plus API-sourced facts that
weren't rejected) and rewrites:
  skill_evidence           one row per (skill, fact)
  unified_projects         CV projects matched to GitHub repos
  eris_scores              one row per target role
  roadmaps, github_scores, collaboration_embeddings
  profile_views            the precomputed dashboard document

Three phases, so no transaction stays open across network calls:
  1. read      short transaction: inputs, consent, skill/project resolution
  2. external  no transaction: AI provider and embedding calls (only with the
               user's external_ai consent), bounded-concurrency repo scoring
  3. write     short transaction: all outputs at once, fenced on job ownership

Recomputing is idempotent: each run replaces the user's previous output.
Stage durations are logged per job (`stage=... ms=...`).
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import psycopg2.extras

from db import EXTERNAL_AI_FULL_SCOPE_SINCE, enqueue_compute_matches, fetch_all, fetch_one, has_consent, jsonb
from intelligence import career_engine, eris, projects, skills, widgets
import ai_budget
from intelligence.collaboration import build_collaboration_embedding, embedding_fingerprint, save_collaboration_embedding
from intelligence.config import persona_intents
from intelligence.repo_scorer import repos_needing_scores, save_scores, score_repos
from intelligence.roadmap import generate_next_best_actions, save_roadmap
from jobs import Job, assert_still_owner
from resume.deterministic import _PATTERNS

log = logging.getLogger("worker.intelligence")

API_ORIGINS = ("github", "kaggle", "stack_exchange", "portfolio", "leetcode", "hackerrank", "orcid", "linkedin_oidc", "linkedin_scrape")
VIEW_VERSION = 1


def lexicon_scan(text: str) -> List[str]:
    """Canonical skills named in free text (unambiguous patterns only)."""
    return sorted({canonical for canonical, pattern, section_only in _PATTERNS if not section_only and pattern.search(text)})


def is_newer(computed_at: Optional[str], than: datetime) -> bool:
    try:
        return bool(computed_at) and datetime.fromisoformat(computed_at) > than
    except (TypeError, ValueError):
        return False


def roles_of(state: Dict[str, Any]) -> List[str]:
    return list(state["career_roles"] or ([state["career_role"]] if state["career_role"] else []))


def with_engine_assessment(summary: List[Dict[str, Any]], intelligence: Dict[str, Any]) -> List[Dict[str, Any]]:
    """view.skills, with the engine's status and level, so /profile and integrations can't disagree with it."""
    assessed = {s["name"]: s for s in intelligence["skills"]}
    known = {row["name"] for row in summary}
    # Skills shown only by repositories have no fact row, so they aren't in the summary yet.
    rows = summary + [
        {"name": s["name"], "category": s["category"], "evidenceStrength": round((s["proficiency"] or 0) / 100, 3), "sources": sorted({e["source"] for e in s["evidence"]})}
        for s in intelligence["skills"] if s["name"] not in known
    ]
    out = []
    for row in rows:
        skill = assessed.get(row["name"])
        if skill:
            row = {**row, "verificationStatus": skill["status"], "proficiency": skill["proficiency"], "level": skill["level"], "confidence": skill["confidence"]}
        out.append(row)
    return out


class _StageTimer:
    def __init__(self, job: Job) -> None:
        self.job = job
        self.last = time.monotonic()

    def mark(self, stage: str, **extra: Any) -> None:
        now = time.monotonic()
        details = " ".join(f"{k}={v}" for k, v in extra.items())
        log.info("compute_intelligence job=%s stage=%s ms=%d %s", self.job.id, stage, (now - self.last) * 1000, details)
        self.last = now


def process_compute_intelligence(conn: Any, job: Job) -> None:
    user_id = job.user_id
    now = datetime.now(timezone.utc)
    timer = _StageTimer(job)

    # ── 1. Read inputs; resolve skills and projects (DB only, short) ────────
    with conn, conn.cursor() as cur:
        skills.seed(cur)
        user = fetch_one(
            cur,
            """SELECT name, university, degree, role::text AS role, department, academic_title, company, job_title,
                      graduation_year FROM users WHERE id = %s""",
            (user_id,),
        )
        state = fetch_one(
            cur,
            """SELECT career_role, career_role_other, career_roles, priorities, research_interests, expertise_areas,
                      mentorship, give_back FROM onboarding_state WHERE user_id = %s""",
            (user_id,),
        )
        if not user or not state:
            log.info("user %s has no profile/onboarding state; nothing to compute", user_id)
            return
        facts = fetch_all(
            cur,
            """SELECT id, field_group, field_name, record_key, normalized_value, extracted_value, origin, confirmation,
                      source_evidence, created_at
                 FROM profile_facts
                WHERE user_id = %s AND superseded_by IS NULL
                  AND (confirmation IN ('confirmed', 'edited')
                       OR (origin = ANY(%s) AND confirmation <> 'rejected'))""",
            (user_id, list(API_ORIGINS)),
        )
        repos = fetch_all(
            cur,
            "SELECT id, repo_name, url, description, languages, topics, stars, last_commit_at FROM code_repositories WHERE user_id = %s",
            (user_id,),
        )
        resources = fetch_all(cur, "SELECT title, provider, url, description FROM learning_resources WHERE url IS NOT NULL")
        connections = fetch_all(cur, "SELECT source_id, status, last_sync_at FROM connections WHERE user_id = %s", (user_id,))
        # The user's current answer, re-read on every run (and every retry),
        # so a revoked consent stops external calls immediately.
        # Used only for repository scoring and the people-matching embedding: purposes the consent text has
        # disclosed since EXTERNAL_AI_FULL_SCOPE_SINCE, so an earlier, resume-only grant doesn't cover them.
        ai_ok = has_consent(cur, user_id, "external_ai", min_version=EXTERNAL_AI_FULL_SCOPE_SINCE)

        index = skills.SkillIndex(cur)
        repo_count: Dict[str, int] = {}
        for r in repos:
            for lang in (r["languages"] or {}):
                repo_count[lang] = repo_count.get(lang, 0) + 1
        evidence = skills.collect(facts, index, repo_count, lexicon_scan)
        categories = {r["id"]: r["category"] for r in fetch_all(cur, "SELECT id, category FROM skills")}

        def canonical(mention: str) -> Optional[str]:
            sid = index.resolve(mention)
            return index.names.get(sid) if sid else None

        unified = projects.unify(projects.records_from(facts, repos, canonical))
        to_score = repos_needing_scores(cur, user_id, allow_external_ai=ai_ok)
        previous = fetch_one(cur, "SELECT view->>'embeddingFingerprint' AS fingerprint FROM profile_views WHERE user_id = %s", (user_id,))
        has_embedding = fetch_one(cur, "SELECT 1 AS yes FROM collaboration_embeddings WHERE user_id = %s", (user_id,)) is not None
    timer.mark("read", facts=len(facts), repos=len(repos), external_ai=ai_ok)

    # ── Pure computation ────────────────────────────────────────────────────
    # Skills, gaps, learning and roadmap: one deterministic model, with no LLM to invent any of it.
    intelligence = career_engine.compute(
        user=user, roles=roles_of(state), facts=facts, repos=repos, resources=resources,
        canonical=index.canonical, lexicon_scan=lexicon_scan,
        categories={index.names[sid]: cat for sid, cat in categories.items() if sid in index.names}, now=now,
    )
    skill_summary = with_engine_assessment(skills.summarize(evidence, index.names, categories), intelligence)

    roles = roles_of(state)
    project_techs = [u.technologies for u in unified]
    eris_by_role: Dict[str, Dict[str, Any]] = {}
    problem_solving = eris.problem_solving_score(facts)
    for analysis in intelligence["roles"]:
        result = eris.score_role(analysis, project_techs, problem_solving)
        if result:
            eris_by_role[analysis["role"]] = result
    primary_eris = next((eris_by_role[r] for r in roles if r in eris_by_role), None)
    primary_role_with_eris = next((r for r in roles if r in eris_by_role), None)

    persona = user["role"] or "student"
    github = next((c for c in connections if c["source_id"] == "github"), None)
    connected = {c["source_id"] for c in connections}
    resume_done = any(f["origin"] == "resume" for f in facts)
    if persona == "faculty":
        checks = [
            {"id": "faculty_profile", "label": "Add your department and title", "done": bool(user["department"] and user["academic_title"])},
            {"id": "research", "label": "Add research interests", "done": bool(state["research_interests"])},
            {"id": "orcid", "label": "Connect ORCID", "done": "orcid" in connected},
            {"id": "mentorship", "label": "Set your mentoring capacity", "done": "capacity" in (state["mentorship"] or {})},
            {"id": "resume", "label": "Add your CV", "done": resume_done},
        ]
    elif persona == "alumni":
        checks = [
            {"id": "alumni_profile", "label": "Add your degree and class year", "done": bool(user["degree"] and user["graduation_year"])},
            {"id": "work", "label": "Add your current role", "done": bool(user["company"] and user["job_title"])},
            {"id": "linkedin", "label": "Connect LinkedIn", "done": "linkedin" in connected},
            {"id": "give_back", "label": "Choose how to give back", "done": any((state["give_back"] or {}).values())},
            {"id": "resume", "label": "Add your resume", "done": resume_done},
        ]
    else:
        checks = [
            {"id": "basic_profile", "label": "Add your university and degree", "done": bool(user["university"] and user["degree"])},
            {"id": "resume", "label": "Review your resume fields", "done": resume_done},
            {"id": "github", "label": "Connect GitHub", "done": github is not None},
            {"id": "skills", "label": "Have 3 or more evidenced skills", "done": len(skill_summary) >= 3},
            {"id": "projects", "label": "Have a project on record", "done": bool(unified)},
        ]
    completeness = round(sum(c["done"] for c in checks) / len(checks), 2)
    gaps = primary_eris["breakdown"]["gaps"] if primary_eris else []
    recent = sorted((r for r in repos if r["last_commit_at"]), key=lambda r: r["last_commit_at"], reverse=True)[:5]
    widget_list = widgets.score_widgets(
        priorities=persona_intents(persona, state),
        role=roles[0] if roles else None,
        persona=persona,
        groups_with_data={f["field_group"] for f in facts},
        last_sync={c["source_id"]: c["last_sync_at"] for c in connections},
        eligible={
            "eris_readiness": primary_eris is not None,
            "job_matches": len(skill_summary) >= 3,
            "skill_gaps": bool(gaps),
            "github_activity": github is not None,
            "profile_completeness": completeness < 1,
        },
        data={
            "eris_readiness": {"role": primary_role_with_eris, "score": primary_eris["score"], "gaps": gaps}
            if primary_eris else None,
            "skill_gaps": {"role": primary_role_with_eris, "gaps": gaps} if gaps else None,
            "github_activity": {
                "repos": [
                    {
                        "name": r["repo_name"], "url": r["url"], "stars": r["stars"],
                        "languages": sorted(r["languages"] or {}, key=(r["languages"] or {}).get, reverse=True)[:3],
                        "lastCommitAt": r["last_commit_at"].isoformat(),
                    }
                    for r in recent
                ],
                "lastSyncAt": github["last_sync_at"].isoformat() if github and github["last_sync_at"] else None,
            } if recent else None,
            "profile_completeness": {"percent": round(completeness * 100), "checks": checks},
            # job_matches, project_ideas, collaboration, mentors, research: their
            # module integrations (Phase 4) supply data; until then they render "empty".
        },
        now=now,
    )

    gaps_and_paths = career_engine.legacy_gaps_and_paths(intelligence)
    roadmap = career_engine.legacy_roadmap(intelligence["roadmap"])
    next_actions = generate_next_best_actions(
        {"career_role": roles[0] if roles else None, "github_connected": github is not None}, gaps_and_paths["gaps"], completeness,
    )
    timer.mark("engine", skills=len(intelligence["skills"]), recommendations=len(intelligence["recommendations"]))

    # ── 2. External calls; no transaction held ──────────────────────────────
    ai_use = ai_budget.current_use()
    skill_names = [s["name"] for s in intelligence["skills"]]
    goals = list(state["career_roles"] or []) + list(state["priorities"] or [])
    project_titles = [u.canonical_title for u in unified]
    fingerprint = embedding_fingerprint(user, skill_names, project_titles, goals, allow_external_ai=ai_ok)
    # Reuse only a vector the provider really made for this exact text and consent. A local fallback
    # is free to rebuild, and has to stay eligible for an upgrade when the provider is back.
    reuse_embedding = ai_ok and has_embedding and bool(previous) and previous["fingerprint"] == fingerprint
    embedding, embedding_summary = None, ""
    succeeded_before = ai_use.succeeded
    if not reuse_embedding:
        embedding, embedding_summary = build_collaboration_embedding(user, skill_names, project_titles, goals, allow_external_ai=ai_ok)
    embedding_is_dense = reuse_embedding or (ai_ok and ai_use.succeeded > succeeded_before)
    repo_scores = score_repos(to_score, allow_external_ai=ai_ok)
    timer.mark("external", repos_scored=len(repo_scores))

    view = {
        "version": VIEW_VERSION,
        "computedAt": now.isoformat(),
        "trigger": job.payload.get("trigger"),
        "persona": persona,
        "identity": {
            "name": user["name"],
            "university": user["university"],
            "degree": user["degree"],
            "careerRole": roles[0] if roles else state["career_role_other"],
        },
        "goals": {"primaryRole": roles[0] if roles else None, "roles": roles,
                  "roleOther": state["career_role_other"], "priorities": state["priorities"] or []},
        "skills": skill_summary[:50],
        "intelligence": intelligence,
        "skillGapsAndPaths": gaps_and_paths,
        "nextActions": next_actions,
        "embeddingFingerprint": fingerprint if embedding_is_dense else None,
        # What this result was computed from, so anyone can tell whether it is current.
        "sources": {
            "engineVersion": career_engine.ENGINE_VERSION,
            "facts": len(facts),
            "latestFactAt": max((f["created_at"] for f in facts if f.get("created_at")), default=now).isoformat() if facts else None,
            "repositories": len(repos),
            "latestPushAt": max((r["last_commit_at"] for r in repos if r["last_commit_at"]), default=now).isoformat() if any(r["last_commit_at"] for r in repos) else None,
        },
        # Whether AI really produced part of this run, not merely whether it was allowed to.
        "aiAssisted": ai_ok and ai_use.succeeded > 0,
        # Consent was given, but some AI step fell back to rules (a budget limit or a provider outage).
        "aiDegraded": ai_ok and ai_use.failed > 0,
        "projects": [
            {"canonicalTitle": u.canonical_title, "technologies": u.technologies, "status": u.status,
             "matchConfidence": u.match_confidence, "signals": u.signals}
            for u in unified
        ],
        "erisScore": {
            "overall": primary_eris["score"] if primary_eris else None,
            "byRole": {r: v["score"] for r, v in eris_by_role.items()},
            "gaps": gaps,
        },
        "readinessIndicators": {
            "resumeLinked": resume_done,
            "connectorsCount": len(connections),
            "confirmedFacts": len(facts),
            "profileComplete": completeness,
        },
        "widgets": widget_list,
    }

    # ── 3. Write all outputs atomically (short) ─────────────────────────────
    with conn, conn.cursor() as cur:
        assert_still_owner(cur, job)
        cur.execute("SELECT view->>'computedAt' AS computed_at FROM profile_views WHERE user_id = %s FOR UPDATE", (user_id,))
        current = cur.fetchone()
        if current and is_newer(current[0], now):
            log.info("compute_intelligence job=%s found a newer result; keeping it", job.id)
            return
        cur.execute("DELETE FROM skill_evidence WHERE user_id = %s", (user_id,))
        if evidence:
            psycopg2.extras.execute_values(
                cur,
                "INSERT INTO skill_evidence (user_id, skill_id, fact_id, source, evidence_strength) VALUES %s",
                [(user_id, e.skill_id, e.fact_id, e.source, e.strength) for e in evidence],
            )
        cur.execute("DELETE FROM unified_projects WHERE user_id = %s", (user_id,))
        if unified:
            psycopg2.extras.execute_values(
                cur,
                """INSERT INTO unified_projects
                     (user_id, canonical_title, source_fact_ids, match_confidence, technologies, status, timeline_end)
                   VALUES %s""",
                [
                    (user_id, u.canonical_title, u.fact_ids, u.match_confidence, u.technologies, u.status,
                     u.timeline_end.date() if u.timeline_end else None)
                    for u in unified
                ],
                template="(%s, %s, %s::uuid[], %s, %s::text[], %s, %s)",
            )
        cur.execute("DELETE FROM eris_scores WHERE user_id = %s", (user_id,))
        for role, result in eris_by_role.items():
            cur.execute(
                "INSERT INTO eris_scores (user_id, role, score, breakdown_json, computed_at) VALUES (%s, %s, %s, %s, %s)",
                (user_id, role, result["score"], jsonb(result["breakdown"]), now),
            )
        save_roadmap(cur, user_id, roadmap)
        if embedding is not None:
            save_collaboration_embedding(cur, user_id, embedding, embedding_summary)
        save_scores(cur, user_id, repo_scores)
        cur.execute(
            """INSERT INTO profile_views (user_id, view, updated_at) VALUES (%s, %s, %s)
               ON CONFLICT (user_id) DO UPDATE SET view = EXCLUDED.view, updated_at = EXCLUDED.updated_at""",
            (user_id, jsonb(view), now),
        )
        # The profile changed: rescore this user's student ↔ mentor matches.
        enqueue_compute_matches(cur, user_id, "profile_recomputed")
    timer.mark("write")
    log.info(
        "intelligence for %s: %d facts, %d skills, %d projects (%d matched), eris=%s, top widgets=%s",
        user_id, len(facts), len(skill_summary), len(unified), sum(u.status == "matched" for u in unified),
        {r: v["score"] for r, v in eris_by_role.items()}, [w["id"] for w in widget_list[:3]],
    )
