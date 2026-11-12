"""One evidence model behind Skill Proficiency, Skills to develop, Learning Paths, Career Roadmap and the Skill Graph.

Pure and deterministic: no database, no network, no LLM. The same evidence gives the same output, so every number
can be explained and tested, and nothing can be invented. Every dashboard component reads this one result.

EVIDENCE (what we can see, per skill)
  code          a public repository's code uses it: GitHub language statistics, a dependency file that declares the
                package (requirements.txt, package.json...), or structure such as tests, CI or a Dockerfile
                (intelligence/code_signals.py). Shows use, not depth, and not who wrote which part.
  mention       a repository names it in topics, description or README, but its code doesn't show it (or wasn't read)
  described     the student's own resume or profile describes it in a project or job
  platform      activity on a platform we read directly (Kaggle, Stack Exchange, LeetCode, HackerRank)
  assessment    a platform assessment score (HackerRank badges)
  claim         only listed in a skills section; a claimed certification; a completed course. Never earns a level.

evidenceBasis per skill, strongest first: assessed > demonstrated (code) > repository_mention > described > claimed.
"not_found" is used for role requirements with no evidence at all. We never produce "verified experience": we have
no way to verify employment, and resume experience is self-reported.

PROFICIENCY (0-100, or None = "Not assessed"; version in ENGINE_VERSION; bump it when any of this changes)
  points    code repositories 25 for the first + 15 x min(1, (n-1)/3) (under 1.5 KB of a language is a trace, not code); repository mentions 10 x min(1, n/3); code volume 10 x log-scaled bytes;
            recency of code (10 within 6 months, 5 within 18) x min(1, n/2); engineering signals (tests, CI, documented
            evaluation) 10 x min(1, repos/2); described projects or jobs and platform activity 12.5 each, at most 30;
            verified certification +5 (supporting only)
  gates     the level is capped unless the evidence meets the behavioural criteria for it (frameworks evidenceForLevel):
              Working max   nothing independent shows it, or repositories only name it without code using it
              Proficient    needs code in 2+ repositories, or code in one plus tests/CI/evaluation or work experience,
                            or activity on 2+ platforms, or an assessment of 3+ stars
              Advanced      needs code in 3+ repositories plus tests/CI/evaluation or work experience, or 4+ stars
  assessment  a platform assessment sets the score to stars/5 x 100 when that is higher
A skill-list mention earns nothing; a completed course is learning, not proficiency.

Every skill carries levelBasis (the evidence in words), levelCap (why it can't go higher yet) and nextLevel (what would
raise it).

Per role (framework in intelligence/frameworks/role_frameworks.json, DRAFT / UNREVIEWED), each required or supporting
competency is `met` only when its level reaches the expected level AND its evidence meets the framework's requirement
(required: evidence we read ourselves; supporting: described work counts). Specialisation tracks are reported
separately and never affect alignment or ERIS. The alignment state follows explicit rules (ALIGNMENT_RULES).

Measures, never blended:
  proficiency  how well the evidence says you use a skill
  confidence   how many independent kinds of source back it
  alignment    per role: a rule-based state, never a percentage
  ERIS score   per role: how much of the framework the evidence backs (alignment_score), not a hiring probability

These weights and the role frameworks are our own judgement, written down so they can be challenged. They are not an
industry standard or job-market data.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Set, Tuple

from intelligence import code_signals, learning, project_intent
from intelligence.frameworks import (
    COMPETENCIES, FRAMEWORKS, LEVEL_FLOOR, ROLE_LABELS, RoleFramework, framework_for, framework_meta, level_criteria, references_for,
)
from intelligence.skill_graph import SKILL_ONTOLOGY, determine_relationship
from skills_catalog import KIND

# 2: specialist skills and role-specific frameworks for the 20-direction catalog; stable milestone ids.
# 3: structured draft frameworks, evidence states, alignment states, gap types, roadmap without time estimates.
# 4: code signals (dependency files, structure, README), evidence gates per level with written basis, framework v4
#    (capabilities, specialisation tracks, rationale), project intent, one complete gap inventory, curated and
#    link-checked learning catalogue, dependency-layered roadmap with completion criteria, data coverage report.
ENGINE_VERSION = 4
MAX_EVIDENCE_PER_SKILL = 8
MAX_GRAPH_NODES = 18
UNVERIFIED_CAP = 49
PROFICIENT_CAP = 74
TRACE_BYTES = 1500
LEVELS = ((75, "Advanced"), (50, "Proficient"), (25, "Working"), (0, "Foundational"))
LEVEL_NAMES = ("Foundational", "Working", "Proficient", "Advanced")

VERIFIED_ORIGINS = {"kaggle", "stack_exchange", "leetcode", "hackerrank"}
CLAIM_ORIGINS = {"resume", "user_entered", "linkedin_scrape", "linkedin_oidc", "portfolio", "orcid"}

ROADMAP_BASIS = "Ordered by what each skill builds on and how central it is to your goal and project. No time estimates: they'd depend on hours we don't know you have."

# Kept for older readers and tests: the v3 hand-written course map is replaced by the curated catalogue (learning.py).
COURSES: Dict[str, List[Tuple[str, str]]] = {}

PREREQUISITES: Dict[str, List[str]] = {name: list(c["prerequisites"]) for name, c in COMPETENCIES.items() if c.get("prerequisites")}


def level_for(score: Optional[float]) -> str:
    if score is None:
        return "Not assessed"
    return next(name for floor, name in LEVELS if score >= floor)


def priority_for(weight: float) -> str:
    """Display bucket for a framework weight. Ordering itself uses the priority keys below, not this."""
    return "High" if weight >= 0.8 else "Medium" if weight >= 0.6 else "Low"


def _plural(n: int, one: str, many: Optional[str] = None) -> str:
    return f"{n} {one if n == 1 else (many or one + 's')}"


def _join(items: Sequence[str]) -> str:
    items = list(items)
    return items[0] if len(items) == 1 else f"{', '.join(items[:-1])} and {items[-1]}" if items else ""


# ─── Evidence → skills ──────────────────────────────────────────────────────


@dataclass
class _Tally:
    name: str
    category: str = "other"
    repos: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    code_repos: Set[str] = field(default_factory=set)      # implementation: code use in repositories attributable to the student
    confirmed_repos: Set[str] = field(default_factory=set)  # of those, where GitHub's commit counts confirm most commits are theirs
    detected_repos: Set[str] = field(default_factory=set)   # code use seen, but in repositories we can't attribute to the student
    meta_repos: Set[str] = field(default_factory=set)
    quality_repos: Dict[str, List[str]] = field(default_factory=dict)
    bytes: int = 0
    last_code_push: Optional[datetime] = None
    described: Set[str] = field(default_factory=set)
    experience: Set[str] = field(default_factory=set)
    platform: Set[str] = field(default_factory=set)
    claimed: bool = False
    certified: bool = False
    credential_claimed: bool = False
    courses: Set[str] = field(default_factory=set)
    assessment: Optional[float] = None
    evidence: List[Dict[str, Any]] = field(default_factory=list)
    fact_refs: List[Tuple[str, str]] = field(default_factory=list)

    def add(self, kind: str, source: str, label: str, ref: Any, at: Any, fact: bool = False, depth: Optional[str] = None) -> None:
        item = {"kind": kind, "source": source, "label": str(label)[:160], "ref": str(ref) if ref else None, "at": _iso(at)}
        if depth:
            item["depth"] = depth
        self.evidence.append(item)
        if fact and ref and (str(ref), source) not in self.fact_refs:
            self.fact_refs.append((str(ref), source))


def _iso(value: Any) -> Optional[str]:
    if isinstance(value, datetime):
        return value.isoformat()
    return value if isinstance(value, str) else None


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _as_list(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(v) for v in value]
    return [v.strip() for v in str(value or "").replace(";", ",").replace("|", ",").split(",") if v.strip()]


def _record_titles(facts: Iterable[Dict[str, Any]]) -> Dict[Tuple[str, str], str]:
    titles: Dict[Tuple[str, str], str] = {}
    for f in facts:
        if f["field_name"] in ("title", "role", "name", "organization") and f.get("record_key"):
            titles.setdefault((f["field_group"], f["record_key"]), str(f["normalized_value"]))
    return titles


def _kb(size: int) -> str:
    return f"{size / 1_000_000:.1f} MB" if size >= 1_000_000 else f"{max(1, round(size / 1000))} KB"


def build_skills(
    facts: List[Dict[str, Any]],
    repos: List[Dict[str, Any]],
    canonical: Callable[[str], Optional[str]],
    lexicon_scan: Callable[[str], List[str]],
    categories: Dict[str, str],
    now: datetime,
    learning_records: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Dict[str, Any]]:
    tallies: Dict[str, _Tally] = {}

    def tally(mention: str) -> Optional[_Tally]:
        name = canonical(mention)
        if not name:
            return None
        return tallies.setdefault(name, _Tally(name=name, category=categories.get(name, "other")))

    login = code_signals.login_from_facts(facts)
    for repo in repos:
        key = str(repo.get("id") or repo.get("repo_name"))
        pushed = repo.get("last_commit_at")
        signals = repo.get("code_signals")
        read = code_signals.was_read(signals)
        contrib = code_signals.contribution(signals, str(repo.get("repo_name") or ""), login)
        contributed = contrib in ("confirmed", "owned")
        # Tests, CI or a documented evaluation say something about the student only in a repository that is theirs.
        quality = code_signals.quality_flags(signals) if contributed else []
        found: Dict[str, Dict[str, Any]] = {}

        def note(mention: str, depth: str, label: str, size: int = 0) -> None:
            name = canonical(mention)
            if not name:
                return
            row = found.setdefault(name, {"depth": depth, "labels": [], "size": 0})
            if depth == "code":
                row["depth"] = "code"
            if label not in row["labels"]:
                row["labels"].append(label)
            row["size"] += size

        for lang, size in (repo.get("languages") or {}).items():
            size = int(size) if isinstance(size, (int, float)) else 0
            # A few hundred bytes of a language (a config script, a stray file) is incidental, not use.
            if size and size < TRACE_BYTES:
                note(lang, "meta", f"a few lines of {lang}", size)
            else:
                note(lang, "code", f"{_kb(size)} of {lang}" if size else f"{lang} code", size)
        # Topics are free-form tags ("awesome-list"), so only known skills count, and GitHub hyphenates them.
        for topic in repo.get("topics") or []:
            for spelling in {str(topic), str(topic).replace("-", " ")}:
                name = canonical(spelling)
                if name and categories.get(name, "other") != "other":
                    note(name, "meta", "tagged in topics")
        for name in lexicon_scan(str(repo.get("description") or "")):
            note(name, "meta", "named in the description")
        has_code = bool(repo.get("languages"))
        for skill, depth, label in code_signals.evidence_from_signals(signals):
            # A capability (evaluating models, preparing data, deploying) is never a dependency, so its README description
            # in a repository that contains code is the closest we can get to seeing it done. Tools and concepts named
            # in a README stay mentions: for them, the dependency files are the evidence.
            if depth == "readme" and has_code and contributed and KIND.get(canonical(skill) or skill) == "capability":
                note(skill, "code", "documented in the README of a repository with code")
            else:
                note(skill, "code" if depth == "code" else "meta", label)

        for name, row in found.items():
            t = tallies.setdefault(name, _Tally(name=name, category=categories.get(name, "other")))
            if key not in t.repos:
                t.repos[key] = repo
            depth = row["depth"]
            if depth == "code" and not contributed:
                depth = "detected"  # the technology is in the code, but we can't say the code is the student's
            if depth == "code":
                t.code_repos.add(key)
                if contrib == "confirmed":
                    t.confirmed_repos.add(key)
                if quality:
                    t.quality_repos[key] = quality
                if isinstance(pushed, datetime) and (t.last_code_push is None or _aware(pushed) > _aware(t.last_code_push)):
                    t.last_code_push = pushed
            elif depth == "detected":
                t.detected_repos.add(key)
            else:
                t.meta_repos.add(key)
            if depth == "code":
                t.bytes += row["size"]
            suffix = "" if depth != "meta" or not read else " (not found in its dependency files)"
            extra = f"; {', '.join(quality)}" if depth == "code" and quality else ""
            owner_note = {"confirmed": "; most commits are yours", "owned": "; your repository", "unconfirmed": "; contribution not confirmed"}[contrib] if depth != "meta" else ""
            t.add("repository", "github", f"{repo.get('repo_name') or 'Repository'}: {', '.join(row['labels'][:3])}{extra}{owner_note}{suffix}", repo.get("url"), pushed, depth=depth)

    titles = _record_titles(facts)
    for f in facts:
        group, name, value, origin = f["field_group"], f["field_name"], f["normalized_value"], f["origin"]
        at, ref = f.get("created_at"), f.get("id")
        record = f.get("record_key")
        if origin == "github":
            continue  # the repositories above are the source, and they carry sizes, dates and code signals
        if group == "skills" and name == "skill":
            t = tally(str(value))
            if not t:
                continue
            if origin in VERIFIED_ORIGINS:
                t.platform.add(f"{origin}:{record}")
                t.add("platform", origin, f.get("source_evidence") or f"Activity on {origin}", ref, at, fact=True)
            else:
                t.claimed = True
                t.add("claim", origin, "Listed in your skills", ref, at, fact=True)
        elif group == "projects" and name == "technologies":
            for tech in _as_list(value):
                t = tally(tech)
                if t and f"project:{record}" not in t.described:
                    t.described.add(f"project:{record}")
                    t.add("project", origin, titles.get(("projects", record or ""), "Project"), ref, at, fact=True)
        elif group in ("experience", "projects") and name == "description":
            for skill in lexicon_scan(str(value)):
                t = tally(skill)
                if t and f"{group}:{record}" not in t.described and f"project:{record}" not in t.described:
                    t.described.add(f"{group}:{record}")
                    if group == "experience":
                        t.experience.add(str(record))
                    t.add("experience" if group == "experience" else "project", origin, titles.get((group, record or ""), group.title()), ref, at, fact=True)
        elif group == "certifications" and name == "name":
            for skill in lexicon_scan(str(value)):
                t = tally(skill)
                if t:
                    t.credential_claimed = True
                    t.add("certification", origin, f"{value} (certification you listed)", ref, at, fact=True)
        elif record == "hackerrank:stats" and isinstance(f.get("extracted_value"), dict):
            for badge, stars in (f["extracted_value"].get("badges") or {}).items():
                t = tally(str(badge).replace("Problem Solving", "Data Structures and Algorithms"))
                if t and isinstance(stars, (int, float)) and stars > 0:
                    t.assessment = max(t.assessment or 0, min(100.0, stars / 5 * 100))
                    t.add("assessment", "hackerrank", f"{badge}: {stars} of 5 stars", ref, at, fact=True)

    for rec in learning_records or []:
        if not (rec["kind"] == "certification" or (rec["kind"] == "course" and rec.get("status") == "completed")):
            continue
        for skill in list(rec.get("skills") or []) or lexicon_scan(str(rec.get("title") or "")):
            t = tally(str(skill))
            if not t:
                continue
            at = rec.get("completed_at") or rec.get("created_at")
            if rec["kind"] == "certification" and rec.get("verification") == "verified":
                t.certified = True
                t.add("certification", rec.get("source") or "learning_record", f"{rec['title']} (verified certification)", rec.get("id"), at)
            elif rec["kind"] == "certification":
                t.credential_claimed = True
                t.add("certification", rec.get("source") or "learning_record", f"{rec['title']} (certification, not verified)", rec.get("id"), at)
            else:
                t.courses.add(str(rec.get("id") or rec["title"]))
                t.add("course", rec.get("source") or "learning_record", f"Completed course: {rec['title']}", rec.get("id"), at)

    return {name: _score(t, now) for name, t in tallies.items()}


# Practices whose repository evidence is the presence of files (a tests folder, a CI workflow, a Dockerfile, manifests).
# Files show the practice is set up, not how well it's done, so on repository evidence alone these stop at Working.
PRACTICE_SKILLS = {"Software Testing", "CI/CD", "Docker", "Kubernetes", "Terraform"}


def _gates(t: _Tally) -> Tuple[int, Optional[str], Optional[str]]:
    """(cap, why it's capped, what would lift the cap). The behavioural criteria from frameworks evidenceForLevel."""
    code, quality, experience = len(t.code_repos), len(t.quality_repos), len(t.experience)
    stars = t.assessment or 0
    if t.name in PRACTICE_SKILLS and code and not (t.described or t.platform or t.assessment is not None):
        return UNVERIFIED_CAP, ("Your repositories show it set up (its files are there), but how well it's done isn't something we can read from files, "
                                "so it stops at Working."), "Describe how you used it in a project or job, or take an assessment."
    if code == 0 and not t.platform and t.assessment is None:
        if t.detected_repos:
            return UNVERIFIED_CAP, ("It's in the code of repositories we can't attribute to you (collaborator or organisation repositories without commit "
                                    "counts showing the work is mostly yours), so it stops at Working."), \
                "Use it in a repository under your own account, or one where most commits are yours."
        if t.repos:
            return UNVERIFIED_CAP, "Repositories name it, but no repository's code or dependency files show it in use, so it stops at Working.", \
                "Use it in a repository's code: once a dependency file or the language statistics show it, it can go further."
        return UNVERIFIED_CAP, "Only your own descriptions show it, so it stops at Working.", \
            "Put work that uses it in a public repository, or take an assessment, so we can see it ourselves."
    if not (code >= 2 or (code >= 1 and (quality or experience)) or len(t.platform) >= 2 or stars >= 60):
        return UNVERIFIED_CAP, "Code in one of your repositories so far, so it stops at Working.", "Use it in a second repository, or add tests, CI or a written evaluation to this one."
    if not ((code >= 3 and (quality or experience) and t.confirmed_repos) or stars >= 80):
        return PROFICIENT_CAP, "Advanced needs sustained, attributable use with engineering quality, so it stops at Proficient.", \
            ("Use it in three or more of your repositories with tests, CI or a documented evaluation (or show it in work experience), with at least one "
             "where GitHub's commit counts show most commits are yours.")
    return 100, None, None


def _months_ago(dt: datetime, now: datetime) -> int:
    return max(0, int((now - _aware(dt)).days / 30.4))


def _score(t: _Tally, now: datetime) -> Dict[str, Any]:
    code = len(t.code_repos)
    detected = len(t.detected_repos - t.code_repos)
    meta_only = len(t.meta_repos - t.code_repos - t.detected_repos)
    quality = len(t.quality_repos)
    records = len(t.described) + len(t.platform)
    # Independent evidence of the student's own capability: their code, platform activity or an assessment. A technology
    # detected in someone else's repository, or a tag, is evidence the technology is there, not that the student can use it.
    independent = bool(t.code_repos or t.platform or t.assessment is not None)

    score: Optional[float] = None
    parts: Dict[str, float] = {}
    cap, cap_reason, lift = 100, None, None
    if t.repos or records or t.assessment is not None:
        if code:
            # One repository whose code uses it is Working by the published rule (evidenceForLevel); more repositories add up to 40.
            parts["codeRepositories"] = round(25 + 15 * min(1.0, (code - 1) / 3), 1)
        if detected:
            parts["detectedInRepositories"] = round(15 + 5 * min(1.0, (detected - 1) / 2), 1)
        if meta_only:
            parts["repositoryMentions"] = round(10 * min(1.0, meta_only / 3), 1)
        if t.bytes > 0:
            parts["codeVolume"] = round(10 * min(1.0, math.log10(max(t.bytes, 1)) / 6), 1)
        if t.last_code_push is not None:
            months = _months_ago(t.last_code_push, now)
            recency = round((10 if months <= 6 else 5 if months <= 18 else 0) * min(1.0, code / 2), 1)
            if recency:
                parts["recency"] = recency
        if quality:
            parts["engineeringSignals"] = round(10 * min(1.0, quality / 2), 1)
        if records:
            # Two or more described projects or jobs reach Working by the published rule; never more than 30 on their own words.
            parts["described"] = round(min(30.0, 12.5 * records), 1)
        if t.certified:
            parts["certification"] = 5.0
        score = sum(parts.values())
        cap, cap_reason, lift = _gates(t)
        if score > cap:
            score = float(cap)
        if t.assessment is not None and t.assessment > score:
            parts["assessment"] = t.assessment
            score = t.assessment
            cap, cap_reason, lift = 100, None, None
        score = round(max(1.0, min(100.0, score)), 1)

    kinds = sum([bool(t.code_repos), bool(t.detected_repos or t.meta_repos), bool(t.described), bool(t.platform), t.assessment is not None, t.claimed, t.certified or t.credential_claimed, bool(t.courses)])
    confidence = {0: 0.0, 1: 0.35, 2: 0.6, 3: 0.8}.get(kinds, 0.9)
    if not independent:
        confidence = min(confidence, 0.35)

    if t.assessment is not None or t.platform:
        basis = "assessed"
    elif code:
        basis = "demonstrated"
    elif detected:
        basis = "detected"
    elif t.repos:
        basis = "repository_mention"
    elif t.described:
        basis = "described"
    else:
        basis = "claimed"
    evidence_state = "demonstrated" if independent else "unverified" if (t.described or t.repos) else "claimed"

    level_basis: List[str] = []
    if code:
        confirmed = len(t.confirmed_repos)
        level_basis.append(f"Code that uses it in {_plural(code, 'of your repositories', 'of your repositories')}"
                           + (f" ({confirmed} with most commits confirmed as yours)" if confirmed else ""))
    if detected:
        level_basis.append(f"In the code of {_plural(detected, 'repository', 'repositories')} we can't attribute to you")
    if meta_only:
        level_basis.append(f"Named in {_plural(meta_only, 'other repository', 'other repositories')} (topics, description or README), but not seen in their code")
    if t.last_code_push is not None:
        months = _months_ago(t.last_code_push, now)
        level_basis.append("Used in code pushed this month" if months == 0 else f"Most recent code use pushed {_plural(months, 'month')} ago")
    if quality:
        level_basis.append(f"{_plural(quality, 'repository', 'repositories')} using it also {'has' if quality == 1 else 'have'} tests, CI or a documented evaluation")
    if t.described:
        level_basis.append(f"Described in {_plural(len(t.described), 'of your projects or jobs', 'of your projects or jobs')}".replace("1 of your projects or jobs", "1 of your projects or jobs"))
    if t.platform:
        level_basis.append(f"Activity on {_join(sorted({p.split(':')[0].replace('_', ' ').title() for p in t.platform}))}")
    if t.assessment is not None:
        level_basis.append(f"Assessment score {round(t.assessment / 20, 1)} of 5 stars")
    if t.certified:
        level_basis.append("A verified certification (adds a little; never enough on its own)")
    if t.claimed:
        level_basis.append("Listed in your skills (a listing doesn't count towards the level)")
    if t.credential_claimed:
        level_basis.append("A certification you listed (not verified, so it doesn't count)")
    if t.courses:
        level_basis.append(f"{_plural(len(t.courses), 'completed course')} (learning, not proof of practice)")

    level = level_for(score)
    if score is None:
        next_level = "Use it in a project. Code in a public repository is the clearest evidence; a project on your resume that describes it also counts."
        cap_reason = None
    elif level == "Advanced":
        next_level, cap_reason = None, None
    else:
        target = LEVEL_NAMES[LEVEL_NAMES.index(level) + 1]
        # A gate below the next level's floor is what stands in the way, whether or not the score has reached it yet.
        if lift and cap < LEVEL_FLOOR[target]:
            next_level = lift
        else:
            next_level = f"More of the same raises it towards {target}: code in more repositories, recent pushes, tests or CI, and projects that describe it."
            cap_reason = None

    evidence = sorted(t.evidence, key=lambda e: (e.get("depth") != "code", e["kind"] == "claim", -(datetime.fromisoformat(e["at"]).timestamp() if e.get("at") else 0)))
    return {
        "name": t.name,
        "category": t.category,
        "kind": KIND.get(t.name, "unknown"),
        "status": "verified" if independent else "claimed",
        "confirmedRepositories": len(t.confirmed_repos),
        "detectedRepositories": detected,
        "evidenceState": evidence_state,
        "evidenceBasis": basis,
        "proficiency": score,
        "level": level,
        "confidence": confidence,
        "scoreParts": parts,
        "levelBasis": level_basis,
        "levelCap": cap_reason,
        "nextLevel": next_level,
        "codeRepositories": code,
        "evidenceCount": len(t.evidence),
        "evidence": evidence[:MAX_EVIDENCE_PER_SKILL],
        "lastEvidenceAt": max((e["at"] for e in t.evidence if e.get("at")), default=None),
        "credential": "verified" if t.certified else "claimed" if t.credential_claimed else None,
        "coursesCompleted": len(t.courses),
        "_factRefs": t.fact_refs,
    }


def infer_skills(skills: Dict[str, Dict[str, Any]], canonical: Callable[[str], Optional[str]]) -> Dict[str, Dict[str, Any]]:
    """What the ontology suggests from demonstrated skills. A pointer, never a score, and never from a claim alone."""
    found: Dict[str, Dict[str, Any]] = {}
    for name, skill in skills.items():
        if skill["proficiency"] is None:
            continue
        for target, _weight in SKILL_ONTOLOGY.get(name, []):
            resolved = canonical(target) or target
            if resolved in skills:
                continue
            entry = found.setdefault(resolved, {
                "name": resolved, "category": "other", "kind": KIND.get(resolved, "unknown"), "status": "inferred", "evidenceState": "inferred",
                "evidenceBasis": "inferred", "proficiency": None, "level": "Not assessed", "confidence": 0.0, "scoreParts": {}, "levelBasis": [],
                "levelCap": None, "nextLevel": None, "codeRepositories": 0, "evidenceCount": 0, "evidence": [], "lastEvidenceAt": None,
                "credential": None, "coursesCompleted": 0, "inferredFrom": [],
            })
            entry["inferredFrom"].append(name)
    return found


# ─── Role gaps ──────────────────────────────────────────────────────────────

GAP_TYPE = {
    "met": "completed",
    "underdeveloped": "insufficient_proficiency",
    "missing": "missing_competency",
    "inferred": "insufficient_evidence",
    "not_assessed": "not_assessed",
}

EVIDENCE_NEEDED = {
    "independent": "work we can see for ourselves: a public repository, platform activity or an assessment",
    "described": "a project or work experience that uses it, or work we can see for ourselves",
}

# Student-facing gap categories (one vocabulary for every card). Missing evidence is never called missing ability.
CATEGORY = {
    "meets": "Meets expected level",
    "needs_practice": "More practice needed",
    "proof_needed": "Practical proof needed",
    "foundation": "Foundation to build first",
    "not_shown": "Not shown yet",
    "possibly": "Possibly relevant",
    "not_assessed": "Not assessed yet",
}
CATEGORY_ORDER = ("foundation", "not_shown", "needs_practice", "proof_needed", "possibly", "not_assessed", "meets")


def _state(skill: Optional[Dict[str, Any]], name: str, expected: int, evidence_requirement: str, inferred: Dict[str, Any], has_evidence_base: bool) -> Tuple[str, str]:
    score = skill["proficiency"] if skill else None
    evidence_state = _evidence_state(skill) if skill else None
    evidence_ok = bool(skill) and (evidence_state == "demonstrated" if evidence_requirement == "independent" else score is not None)
    if not has_evidence_base:
        state = "not_assessed"
    elif score is not None and score >= expected and evidence_ok:
        state = "met"
    elif score is not None and score >= expected:
        state = "unverified"
    elif score is not None:
        state = "underdeveloped"
    elif skill:
        state = "unverified"
    elif name in inferred:
        state = "inferred"
    else:
        state = "missing"
    gap_type = GAP_TYPE.get(state) or ("insufficient_evidence" if score is not None else "claimed_unverified")
    return state, gap_type


def _category(row: Dict[str, Any], unblocks: Sequence[str]) -> str:
    state = row["state"]
    if state == "met":
        return "meets"
    if state == "not_assessed":
        return "not_assessed"
    if state == "inferred":
        return "possibly"
    # A requirement that needs work we can check, backed only by the student's own words: proof is the blocker, whatever the level.
    if row.get("hasEvidence") and row.get("evidenceRequirement") == "independent" and row.get("evidenceState") != "demonstrated":
        return "proof_needed"
    if state == "underdeveloped":
        return "needs_practice"
    if state == "unverified":
        return "proof_needed"
    return "foundation" if unblocks else "not_shown"


def _action(category: str, skill: str, next_level: Optional[str], builders: Sequence[str], basis: Optional[str] = None) -> Optional[str]:
    """Student-facing next step. The concrete project to build is in the row's `demonstration`."""
    if category == "meets":
        return None
    if category == "not_assessed":
        return "Add a resume or connect GitHub so this can be assessed."
    if category == "proof_needed":
        if basis == "detected":
            return (f"{skill} is in the code of a repository we can't attribute to you. Use it in a repository of your own, "
                    "or one where most commits are yours, so it counts as your work.")
        if basis == "repository_mention":
            return f"Your repositories name {skill}, but their code doesn't show it in use yet. Use it in a repository's code."
        return f"We found {skill} in your profile, but need to see it in practice. Show it in a project we can check."
    if category == "possibly":
        return f"Your related skills suggest {skill}, but nothing shows it yet. Build something that uses it directly."
    if category == "needs_practice":
        return next_level or f"You've started using {skill}. Build a more substantial project to show the next level."
    if category == "foundation":
        return f"Start here: {_join(list(builders)[:3])} build{'s' if len(builders) == 1 else ''} on {skill}. Learn it, then show it in a small project."
    return f"Learn {skill}, then build something that shows it."


def _why_matters(fw: RoleFramework, req_tier: str, skill: str, rationale: str, prerequisite_for: List[str]) -> str:
    head = f"A required skill for {fw.label}" if req_tier == "required" else f"A supporting skill for {fw.label}"
    body = rationale.rstrip(".") if rationale else COMPETENCIES.get(skill, {}).get("description", "").rstrip(".") or skill
    tail = f" {_join(prerequisite_for)} build{'s' if len(prerequisite_for) == 1 else ''} on it." if prerequisite_for else ""
    return f"{head}: {body[0].lower() + body[1:] if body else skill}.{tail}"


def _priority_key(row: Dict[str, Any]) -> Tuple:
    """Required before supporting; then what unblocks the most other open skills; then importance; then shortfall."""
    return (0 if row["tier"] == "required" else 1, -len(row["unblocks"]), -row["weight"], -(row["expected"] - (row["proficiency"] or 0)), row["skill"])


def _priority_reason(row: Dict[str, Any]) -> str:
    parts = ["Required for this goal" if row["tier"] == "required" else "Supporting skill (optional for the goal)"]
    if row["unblocks"]:
        parts.append(f"needed before {_join(row['unblocks'])}")
    if row["proficiency"] is None:
        parts.append("no assessed evidence yet")
    elif row["proficiency"] < row["expected"]:
        parts.append(f"currently {row['level']}, expected {row['expectedLevel']}")
    else:
        parts.append("level reached but needs work we can see for ourselves")
    return "; ".join(parts) + "."


ALIGNMENT_LABELS = {
    "not_enough_evidence": "Not enough evidence to assess",
    "early": "Early alignment",
    "developing": "Developing alignment",
    "strong": "Strong alignment",
    "requirements_demonstrated": "Requirements adequately demonstrated",
}

ALIGNMENT_RULES = (
    "not_enough_evidence: nothing to read yet, or no competency in the framework has any evidence (even a claim). "
    "requirements_demonstrated: every required competency is met (expected level, demonstrated evidence). "
    "strong: every required competency has an assessed level, at least half are met, and every required competency with no "
    "required prerequisite (the foundations) is met. "
    "developing: at least one required competency is met, or at least half have an assessed level. "
    "early: anything else with some evidence. Supporting and specialisation competencies never raise the state."
)


def alignment(rows: List[Dict[str, Any]], has_evidence_base: bool) -> Dict[str, Any]:
    """The role-alignment state, by the documented ALIGNMENT_RULES. Counts competencies, never evidence volume."""
    required = [r for r in rows if r["tier"] == "required"]
    names = {r["skill"] for r in required}
    met = [r for r in required if r["state"] == "met"]
    # Assessed from evidence of the student's own capability. A level resting only on their own descriptions, or on a
    # technology detected in a repository we can't attribute to them, doesn't move alignment.
    assessed = [r for r in required if r["proficiency"] is not None and r.get("evidenceState", "demonstrated") == "demonstrated"]
    foundations = [r for r in required if not (set(PREREQUISITES.get(r["skill"], [])) & names)]
    any_evidence = any(r["hasEvidence"] for r in rows)

    if not has_evidence_base or not any_evidence:
        state = "not_enough_evidence"
    elif len(met) == len(required):
        state = "requirements_demonstrated"
    elif len(assessed) == len(required) and 2 * len(met) >= len(required) and all(r["state"] == "met" for r in foundations):
        state = "strong"
    elif met or 2 * len(assessed) >= len(required):
        state = "developing"
    else:
        state = "early"

    critical = [r["skill"] for r in sorted(required, key=_priority_key) if r["state"] != "met" and r["proficiency"] is None]
    return {
        "state": state,
        "label": ALIGNMENT_LABELS[state],
        "required": len(required),
        "requiredMet": len(met),
        "requiredAssessed": len(assessed),
        "requiredClaimedOnly": sum(1 for r in required if r["gapType"] == "claimed_unverified"),
        "requiredMissing": sum(1 for r in required if r["state"] == "missing"),
        "supportingMet": sum(1 for r in rows if r["tier"] == "supporting" and r["state"] == "met"),
        "supporting": sum(1 for r in rows if r["tier"] == "supporting"),
        "criticalGaps": critical,
        "foundationsMet": all(r["state"] == "met" for r in foundations),
    }


# ─── ERIS — Intelligence Score ──────────────────────────────────────────────
#
# How much of the selected role's competency framework the student's evidence currently backs, 0-100.
# For each framework competency (required and supporting, counted once), with its framework weight w:
#   attainment = min(1, proficiency / expected)          when the engine scored it
#   credit     = attainment                              evidence meets the framework's requirement
#              = attainment * DESCRIBED_ONLY_FACTOR      only the student's own descriptions back a competency
#                                                        that needs independent evidence
#              = 0                                       no engine score (listed only, suggested, missing)
#   score = round(100 * sum(w * credit) / sum(w))
# Not a proficiency, not the alignment state, not a probability of being hired. None (never 0) when the role
# can't be assessed, alignment is "not enough evidence", or no competency has a score.

SCORE_VERSION = 1
DESCRIBED_ONLY_FACTOR = 0.5


def _credit_kind(row: Dict[str, Any]) -> str:
    if row.get("proficiency") is None:
        return "none"
    if row.get("state") == "met" or row.get("evidenceRequirement") != "independent" or row.get("evidenceState") == "demonstrated":
        return "evidenced"
    return "described"


def _credit(row: Dict[str, Any]) -> float:
    kind = _credit_kind(row)
    if kind == "none" or not row.get("expected"):
        return 0.0
    attained = min(1.0, max(0.0, float(row["proficiency"])) / float(row["expected"]))
    return attained * DESCRIBED_ONLY_FACTOR if kind == "described" else attained


def _weighted(rows: List[Dict[str, Any]]) -> Optional[int]:
    valid = [r for r in rows if (r.get("weight") or 0) > 0]
    total = sum(r["weight"] for r in valid)
    if not total:
        return None
    return int(round(100 * sum(r["weight"] * _credit(r) for r in valid) / total + 1e-9))


def alignment_score(rows: List[Dict[str, Any]], has_evidence_base: bool, alignment_state: str) -> Optional[Dict[str, Any]]:
    if not has_evidence_base or alignment_state == "not_enough_evidence":
        return None
    unique: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        key = str(r["skill"]).strip().lower()
        if key not in unique or _credit(r) > _credit(unique[key]):
            unique[key] = r
    deduped = list(unique.values())
    if not any(_credit_kind(r) != "none" for r in deduped):
        return None
    value = _weighted(deduped)
    if value is None:
        return None
    required = [r for r in deduped if r.get("tier", "required") == "required"]
    supporting = [r for r in deduped if r.get("tier") == "supporting"]
    counts = {"evidenced": 0, "described": 0, "none": 0}
    for r in deduped:
        counts[_credit_kind(r)] += 1
    return {
        "value": value,
        "version": SCORE_VERSION,
        "required": {"score": _weighted(required), "competencies": len(required)},
        "supporting": {"score": _weighted(supporting), "competencies": len(supporting)},
        "counts": counts,
    }


def _evidence_state(skill: Dict[str, Any]) -> str:
    """Older callers (ERIS tests, stored skills) may lack evidenceState: verified means demonstrated, else claimed."""
    return skill.get("evidenceState") or ("demonstrated" if skill.get("status") == "verified" else "claimed")


def _row(name: str, req_tier: str, weight: float, expected_level: str, evidence_requirement: str, skill: Optional[Dict[str, Any]],
         inferred: Dict[str, Any], has_evidence_base: bool) -> Dict[str, Any]:
    expected = LEVEL_FLOOR[expected_level]
    state, gap_type = _state(skill, name, expected, evidence_requirement, inferred, has_evidence_base)
    competency = COMPETENCIES.get(name, {})
    kind = (skill or {}).get("kind") or KIND.get(name, "concept")
    criteria = level_criteria(name, kind if kind != "unknown" else "concept")
    score = skill["proficiency"] if skill else None
    return {
        "skill": name,
        "kind": kind,
        "tier": req_tier,
        "required": req_tier == "required",
        "weight": weight,
        "priority": priority_for(weight),
        "expected": expected,
        "expectedLevel": expected_level,
        "expectedCriterion": criteria.get(expected_level),
        "currentCriterion": criteria.get(level_for(score)) if score is not None else None,
        "evidenceRequirement": evidence_requirement,
        "proficiency": score,
        "level": level_for(score),
        "confidence": skill["confidence"] if skill else 0.0,
        "evidenceState": _evidence_state(skill) if skill else ("inferred" if name in inferred else "missing"),
        "evidenceBasis": (skill or {}).get("evidenceBasis") or ("inferred" if name in inferred else "not_found"),
        "levelBasis": list((skill or {}).get("levelBasis") or [])[:4],
        "nextLevel": (skill or {}).get("nextLevel"),
        "hasEvidence": bool(skill),
        "state": state,
        "gapType": gap_type,
        "insufficientEvidence": state in ("unverified", "inferred", "not_assessed"),
        "demonstration": None if state == "met" else competency.get("demonstration"),
        "evidence": [e["label"] for e in (skill["evidence"] if skill else [])[:3]],
        "inferredFrom": list((inferred.get(name) or {}).get("inferredFrom") or []),
    }


def _link_rows(rows: List[Dict[str, Any]], rationale: Dict[str, str], fw: Optional[RoleFramework]) -> None:
    names = {r["skill"] for r in rows}
    by_name = {r["skill"]: r for r in rows}
    for r in rows:
        r["prerequisites"] = [p for p in PREREQUISITES.get(r["skill"], []) if p in names]
    for r in rows:
        r["prerequisiteFor"] = sorted(o["skill"] for o in rows if r["skill"] in o["prerequisites"])
        r["blockedBy"] = [p for p in r["prerequisites"] if by_name[p]["state"] != "met"] if r["state"] != "met" else []
        r["unblocks"] = [o for o in r["prerequisiteFor"] if by_name[o]["state"] != "met"] if r["state"] != "met" else []
        r["category"] = _category(r, r["unblocks"])
        r["categoryLabel"] = CATEGORY[r["category"]]
        r["action"] = _action(r["category"], r["skill"], r.get("nextLevel"), r["unblocks"], r.get("evidenceBasis"))
        if fw is not None:
            r["rationale"] = rationale.get(r["skill"], "")
            r["whyItMatters"] = _why_matters(fw, r["tier"], r["skill"], r["rationale"], r["prerequisiteFor"])


def analyze_role(role: str, skills: Dict[str, Dict[str, Any]], inferred: Dict[str, Dict[str, Any]], has_evidence_base: bool, canonical: Callable[[str], Optional[str]]) -> Optional[Dict[str, Any]]:
    fw = framework_for(role)
    if not fw:
        return None

    rows = []
    rationale = {}
    for req in fw.requirements:
        name = canonical(req.competency) or req.competency
        rationale[name] = req.rationale
        rows.append(_row(name, req.tier, req.weight, req.expected_level, req.evidence_requirement, skills.get(name), inferred, has_evidence_base))
    _link_rows(rows, rationale, fw)

    open_rows = sorted((r for r in rows if r["state"] != "met"), key=_priority_key)
    for rank, r in enumerate(open_rows, 1):
        r["priorityRank"] = rank
        r["priorityReason"] = _priority_reason(r)

    tracks = []
    for spec in fw.specialisations:
        track_rows = []
        for req in fw.specialisation_requirements:
            if req.track != spec["track"]:
                continue
            name = canonical(req.competency) or req.competency
            row = _row(name, "specialisation", req.weight, req.expected_level, req.evidence_requirement, skills.get(name), inferred, has_evidence_base)
            row["rationale"] = req.rationale
            row["category"] = _category(row, [])
            row["categoryLabel"] = CATEGORY[row["category"]]
            row["action"] = _action(row["category"], name, row.get("nextLevel"), [], row.get("evidenceBasis"))
            row["prerequisites"] = PREREQUISITES.get(name, [])
            track_rows.append(row)
        tracks.append({"track": spec["track"], "description": spec.get("description", ""), "skills": track_rows,
                       "met": sum(1 for r in track_rows if r["state"] == "met"), "total": len(track_rows)})

    total = sum(r["weight"] for r in rows)
    met = sum(r["weight"] for r in rows if r["state"] == "met")
    role_alignment = alignment(rows, has_evidence_base)
    meta = framework_meta()
    return {
        "role": role,
        "label": fw.label,
        "framework": {
            "version": meta["version"], "status": meta["status"], "reviewed": meta["reviewed"], "responsibilities": list(fw.responsibilities),
            "completionCriteria": fw.completion_criteria, "summary": fw.summary, "distinguishingFocus": fw.distinguishing_focus,
            "practicalCapabilities": list(fw.practical_capabilities), "projectContext": fw.project_context,
            "references": [{"title": r["title"], "publisher": r["publisher"], "kind": r["kind"], "url": r["url"], "checkedAt": r["checkedAt"]} for r in references_for(role)],
        },
        "coverage": round(met / total, 3) if total else 0.0,
        "assessed": has_evidence_base,
        "alignment": role_alignment,
        "alignmentScore": alignment_score(rows, has_evidence_base, role_alignment["state"]),
        "skills": rows,
        "open": open_rows,
        "specialisations": tracks,
        "counts": {state: sum(1 for r in rows if r["state"] == state) for state in ("met", "underdeveloped", "unverified", "inferred", "missing", "not_assessed")},
        "categoryCounts": {c: sum(1 for r in rows if r["category"] == c) for c in CATEGORY},
    }


# ─── Project intent ─────────────────────────────────────────────────────────

PROJECT_EXPECTED = {"core": "Working", "supporting": "Foundational"}


def analyze_project(intent: Dict[str, Any], skills: Dict[str, Dict[str, Any]], inferred: Dict[str, Dict[str, Any]], has_evidence_base: bool,
                    primary: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """The project's own requirements, assessed with the same evidence and states as the career rows."""
    out = dict(intent)
    if intent.get("status") != "analysed":
        out.update(rows=[], summary=None, careerOnly=[], projectOnly=[], overlap=[], closestRoles=[])
        return out
    tier_of = {r["skill"]: r["tier"] for r in (primary or {}).get("skills", [])}
    tier_of.update({r["skill"]: "specialisation" for t in (primary or {}).get("specialisations", []) for r in t["skills"] if r["skill"] not in tier_of})
    rows = []
    for req in intent["requirements"]:
        row = _row(req["skill"], "project", 1.0 if req["importance"] == "core" else 0.5, PROJECT_EXPECTED[req["importance"]], "described",
                   skills.get(req["skill"]), inferred, has_evidence_base)
        row.update(importance=req["importance"], why=req["why"], triggers=req["triggers"], careerTier=tier_of.get(req["skill"]))
        rows.append(row)
    _link_rows(rows, {}, None)
    for r in rows:
        r["whyItMatters"] = f"Your project needs it: {r['why'][0].lower() + r['why'][1:]}" if r.get("why") else "Your project needs it."
    core = [r for r in rows if r["importance"] == "core"]
    required = [r for r in (primary or {}).get("skills", []) if r["tier"] == "required"]
    project_names = {r["skill"] for r in rows}
    # The full rows go into the gap inventory; the project block keeps what the project card shows, so nothing is stored twice.
    keep = ("skill", "importance", "why", "triggers", "careerTier", "state", "category", "categoryLabel", "level", "expectedLevel", "proficiency")
    out.pop("requirements", None)
    out.update(
        _rows=rows,  # full rows for gap_inventory; compute() removes this key before storing
        rows=[{k: r[k] for k in keep if k in r} for r in rows],
        summary={"core": len(core), "coreReady": sum(1 for r in core if r["state"] == "met"), "supporting": len(rows) - len(core)},
        overlap=sorted(r["skill"] for r in rows if r["careerTier"] in ("required", "supporting")),
        projectOnly=sorted(r["skill"] for r in core if r["careerTier"] not in ("required", "supporting")),
        careerOnly=sorted(r["skill"] for r in required if r["skill"] not in project_names),
        closestRoles=project_intent.closest_roles(intent["requirements"], FRAMEWORKS, [r for r in ROLE_LABELS if r in FRAMEWORKS and FRAMEWORKS[r].status == "current"]),
    )
    return out


# ─── Gap inventory: every relevant skill, one list ──────────────────────────

def _inventory_reason(row: Dict[str, Any], role_label: Optional[str]) -> str:
    parts = []
    tier, importance = row.get("roleTier"), row.get("projectImportance")
    if tier == "required":
        parts.append(f"Required for {role_label}")
    elif tier == "supporting":
        parts.append(f"Supporting skill for {role_label}")
    if importance == "core":
        parts.append("central to your project")
    elif importance == "supporting":
        parts.append("useful for your project")
    if row.get("unblocks"):
        parts.append(f"needed before {_join(row['unblocks'][:3])}")
    if row["proficiency"] is None:
        parts.append("no assessed evidence yet")
    elif row["state"] != "met" and row["proficiency"] < row["expected"]:
        parts.append(f"currently {row['level']}, expected {row['expectedLevel']}")
    elif row["state"] != "met":
        parts.append("level reached on your own descriptions; needs work we can check")
    text = "; ".join(parts) or "Relevant to your goal"
    return text[0].upper() + text[1:] + "."


def gap_inventory(primary: Optional[Dict[str, Any]], project: Optional[Dict[str, Any]], skills: Dict[str, Dict[str, Any]],
                  inferred: Dict[str, Dict[str, Any]], has_evidence_base: bool) -> List[Dict[str, Any]]:
    """Career rows and project rows merged by skill (the stricter expectation wins), plus prerequisites neither lists
    that an open skill builds on. Ordered by an explained priority."""
    rows: Dict[str, Dict[str, Any]] = {}
    role_label = (primary or {}).get("label")
    for r in (primary or {}).get("skills", []):
        rows[r["skill"]] = {**r, "sources": ["career"], "roleTier": r["tier"], "projectImportance": None}
    for p in (project or {}).get("_rows") or (project or {}).get("rows", []):
        if p["skill"] in rows:
            merged = rows[p["skill"]]
            merged["sources"].append("project")
            merged["projectImportance"] = p["importance"]
            merged["projectWhy"] = p["why"]
            merged["triggers"] = p["triggers"]
            if p["expected"] > merged["expected"]:
                merged.update(expected=p["expected"], expectedLevel=p["expectedLevel"], expectedCriterion=p["expectedCriterion"], state=p["state"], gapType=p["gapType"])
        else:
            rows[p["skill"]] = {**p, "sources": ["project"], "roleTier": p.get("careerTier"), "projectImportance": p["importance"], "projectWhy": p["why"], "tier": "project", "weight": p["weight"]}
    # Prerequisites of open skills that neither list names (e.g. PyTorch for a project that needs fine-tuning).
    pending = [r["skill"] for r in rows.values() if r["state"] != "met"]
    while pending:
        name = pending.pop()
        for prereq in PREREQUISITES.get(name, []):
            if prereq in rows or prereq not in COMPETENCIES:
                continue
            row = _row(prereq, "prerequisite", 0.4, "Foundational", "described", skills.get(prereq), inferred, has_evidence_base)
            row.update(sources=["prerequisite"], roleTier=None, projectImportance=None, prerequisiteOf=[name],
                       whyItMatters=f"{name} builds on it: {COMPETENCIES[prereq]['description'][0].lower() + COMPETENCIES[prereq]['description'][1:]}")
            rows[prereq] = row
            if row["state"] != "met":
                pending.append(prereq)
    out = list(rows.values())
    _link_rows(out, {r["skill"]: r.get("rationale", "") for r in out}, None)
    for r in out:
        if r.get("sources") == ["prerequisite"] and r["state"] == "missing":
            r["category"], r["categoryLabel"] = "foundation", CATEGORY["foundation"]
            r["action"] = _action("foundation", r["skill"], r.get("nextLevel"), r["unblocks"] or r.get("prerequisiteOf", []))
        r["inventoryReason"] = _inventory_reason(r, role_label)
        if r.get("projectWhy") and "career" in r["sources"]:
            r["whyItMatters"] = f"{r.get('whyItMatters') or ''} Your project needs it too: {r['projectWhy'][0].lower() + r['projectWhy'][1:]}".strip()

    required = {r["skill"] for r in out if r.get("roleTier") == "required" and "career" in r["sources"]}
    project_core = {r["skill"] for r in out if r.get("projectImportance") == "core"}
    for r in out:
        r["priorityGroup"], r["priorityGroupLabel"] = _priority_group(r, required, project_core)
    out.sort(key=lambda r: (r["category"] == "meets", r["priorityGroup"], -len(r.get("unblocks") or []), CATEGORY_ORDER.index(r["category"]),
                            -(r.get("weight") or 0), -(r["expected"] - (r["proficiency"] or 0)), r["skill"]))
    rank = 0
    for r in out:
        if r["category"] != "meets":
            rank += 1
            r["inventoryRank"] = rank
    return out


PRIORITY_GROUPS = (
    "Foundation for required skills",
    "Needed by your career and your project",
    "Required for your career",
    "Needed by your project",
    "Supporting and optional",
)
PRIORITY_RULE = ("Foundations that required skills build on come first; then skills both your career and your project need; then the rest of the "
                 "career's required skills; then skills only your project needs; then supporting skills. Within a group, skills that unblock more "
                 "come first, then those with the biggest shortfall.")


def _priority_group(r: Dict[str, Any], required: Set[str], project_core: Set[str]) -> Tuple[int, str]:
    unblocks = set(r.get("unblocks") or []) | set(r.get("prerequisiteOf") or [])
    if unblocks & required:
        g = 0
    elif r.get("roleTier") == "required" and r.get("projectImportance") == "core":
        g = 1
    elif r.get("roleTier") == "required":
        g = 2
    elif r.get("projectImportance") == "core" or unblocks & project_core:
        g = 3
    else:
        g = 4
    return g, PRIORITY_GROUPS[g]


# ─── Learning recommendations ───────────────────────────────────────────────


def course_statuses(learning_records: Optional[List[Dict[str, Any]]]) -> Dict[str, str]:
    """Course title -> the student's furthest status (started / completed)."""
    rank = {"recommended": 0, "started": 1, "completed": 2}
    out: Dict[str, str] = {}
    for rec in learning_records or []:
        if rec["kind"] == "course" and rec.get("status") in rank:
            current = out.get(rec["title"])
            if current is None or rank[rec["status"]] > rank[current]:
                out[rec["title"]] = rec["status"]
    return out


def _why(row: Dict[str, Any], role_label: Optional[str]) -> str:
    target = f"{row['expectedLevel']} is expected"
    who = []
    if row.get("roleTier") in ("required", "supporting"):
        who.append(f"a {row['roleTier']} skill for {role_label}")
    if row.get("projectImportance"):
        who.append("needed by your project")
    if "prerequisite" in row.get("sources", []):
        who.append(f"what {_join(row.get('prerequisiteOf') or row.get('unblocks') or [])} build on")
    about = _join(who) or "relevant to your goal"
    if row["state"] == "underdeveloped":
        return f"Your evidence puts you at {row['level']}; it's {about} ({target})."
    if row["state"] == "inferred":
        return f"Only suggested by related skills so far; it's {about} ({target})."
    return f"No evidence of it yet; it's {about} ({target})."


def recommend(inventory: List[Dict[str, Any]], skills: Dict[str, Dict[str, Any]], role_label: Optional[str], roles: Sequence[str], now: datetime,
              learning_records: Optional[List[Dict[str, Any]]] = None, limit: int = 24) -> List[Dict[str, Any]]:
    """One recommendation per open gap that learning can close. A skill that is listed or described but not shown needs
    proof, not a course, so it gets none."""
    taken = course_statuses(learning_records)
    shown = {name for name, s in skills.items() if s["proficiency"] is not None}
    open_skills = {r["skill"] for r in inventory if r["category"] != "meets"}
    out = []
    for row in inventory:
        if row["state"] not in ("missing", "underdeveloped", "inferred") or row["category"] == "proof_needed":
            continue
        pick = learning.choose(row["skill"], row["level"] if row["proficiency"] is not None else None, row["expectedLevel"],
                               row["proficiency"] is not None, shown, open_skills, now, started={t for t, s in taken.items() if s == "started"})
        resource = pick["resource"]
        status = taken.get(resource["title"]) if resource else None
        demonstration = row.get("demonstration") or COMPETENCIES.get(row["skill"], {}).get("demonstration") or f"Publish a repository that uses {row['skill']}."
        out.append({
            "skill": row["skill"],
            "sources": row.get("sources", ["career"]),
            "tier": row.get("roleTier") or row.get("tier"),
            "projectImportance": row.get("projectImportance"),
            "targetLevel": row["expectedLevel"],
            "target": row["expected"],
            "current": row["proficiency"],
            "currentLevel": row["level"],
            "state": row["state"],
            "category": row["category"],
            "gapType": row["gapType"],
            "priority": row["priority"],
            "inventoryRank": row.get("inventoryRank"),
            "why": _why(row, role_label) + (" You've completed the course; now show the skill in practice." if status == "completed" else ""),
            "currentEvidence": row["evidence"],
            "roles": list(roles[:1]),
            "prerequisites": [{"skill": p, "met": skills.get(p, {}).get("proficiency") is not None} for p in PREREQUISITES.get(row["skill"], [])],
            "resource": resource,
            "alternative": pick["alternative"],
            "noResourceReason": pick["reason"],
            "courseStatus": status,
            "outcome": f"After it, you should be able to {resource['outcome']}." if resource else None,
            "demonstration": demonstration,
            "evidenceToShow": EVIDENCE_NEEDED[row["evidenceRequirement"]],
            "status": "not_started" if row["proficiency"] is None else "in_progress",
        })
    return out[:limit]


# ─── Roadmap ────────────────────────────────────────────────────────────────

THEMES = (
    ("foundations", {"Python", "SQL", "Git", "Bash", "C++", "TypeScript", "Linux", "Statistics", "Probability", "Linear Algebra", "Data Structures and Algorithms", "NumPy", "Pandas"}),
    ("data", {"Data Preparation", "Data Visualization", "Matplotlib", "Tableau", "Time Series Analysis", "Experimental Design"}),
    ("modelling", {"Machine Learning", "Model Evaluation", "scikit-learn", "Deep Learning", "PyTorch", "TensorFlow", "JAX", "Convolutional Neural Networks", "Transformers (architecture)", "Recommender Systems"}),
    ("llm", {"Large Language Models", "Prompt Engineering", "Embeddings", "Vector Databases", "Retrieval-Augmented Generation", "LangChain", "LlamaIndex", "AI Agents", "Fine-tuning", "Hugging Face Transformers", "LLM Evaluation", "Generative AI", "Diffusion Models"}),
    ("production", {"Model Deployment", "Model Monitoring", "Docker", "Kubernetes", "CI/CD", "Terraform", "AWS", "Google Cloud", "MLflow", "Weights & Biases", "Apache Airflow", "FastAPI", "REST APIs", "Software Testing", "vLLM", "Triton Inference Server", "TensorRT", "Next.js"}),
)
THEME_ORDER = ("foundations", "data", "modelling", "llm", "specialist", "safety", "production")
THEME_NAME = {"foundations": "programming and maths", "data": "working with data", "modelling": "modelling", "llm": "language models",
              "production": "deployment", "specialist": "specialist skills", "safety": "evaluation and safety"}
LAYER_TITLE = ("Build the foundations", "Build on them", "Bring it together", "Go deeper")

def _theme(skill: str) -> str:
    if skill in {"AI Safety", "Differential Privacy"}:
        return "safety"
    for name, members in THEMES:
        if skill in members:
            return name
    return "specialist"


def _dependency_order(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Prerequisites first, keeping priority order otherwise. Tolerates cycles by keeping input order."""
    present = {r["skill"]: r for r in rows}
    ordered: List[Dict[str, Any]] = []
    placed: Set[str] = set()
    visiting: Set[str] = set()

    def place(row: Dict[str, Any]) -> None:
        name = row["skill"]
        if name in placed or name in visiting:
            return
        visiting.add(name)
        for prereq in PREREQUISITES.get(name, []):
            if prereq in present:
                place(present[prereq])
        visiting.discard(name)
        placed.add(name)
        ordered.append(row)

    for row in rows:
        place(row)
    return ordered


def milestone_id(role: str, skill: str) -> str:
    """Stable across runs: the same role and skill always give the same id, so saved progress keeps matching."""
    return f"{role}:{re.sub(r'[^a-z0-9]+', '-', skill.lower()).strip('-')}"


def _objective(row: Dict[str, Any]) -> str:
    if row["gapType"] == "claimed_unverified":
        return f"Back up your {row['skill']} with work we can see"
    if row["gapType"] == "insufficient_evidence" and row["proficiency"] is not None:
        return f"Make your {row['skill']} work visible"
    if row["state"] == "underdeveloped":
        return f"Take {row['skill']} from {row['level']} to {row['expectedLevel']}"
    return f"Reach {row['expectedLevel']} in {row['skill']}"


def _normalise_url(url: str) -> str:
    return re.sub(r"^https?://(www\.)?", "", str(url or "").strip().lower()).rstrip("/").removesuffix(".git")


def _submission_check(role: str, row: Dict[str, Any], submissions: Sequence[Dict[str, Any]], repos: Sequence[Dict[str, Any]], skills: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """What happened to evidence the student submitted for this milestone. A submission is a claim: it never completes
    anything; we only read it if it's one of the student's synced repositories."""
    mine = [s for s in submissions if s.get("milestoneId") == milestone_id(role, row["skill"])]
    if not mine:
        return None
    latest = max(mine, key=lambda s: str(s.get("createdAt") or ""))
    url = _normalise_url(latest.get("evidenceUrl", ""))
    repo = next((r for r in repos if _normalise_url(r.get("url", "")) == url or (url.startswith("github.com/") and url.removeprefix("github.com/") == str(r.get("repo_name", "")).lower())), None)
    if not repo:
        return {"url": latest.get("evidenceUrl"), "status": "not_readable",
                "message": "We can't read this link automatically. Only repositories synced through your GitHub connection are read; push the work to one of them and sync."}
    shown = any(e.get("ref") == repo.get("url") and e.get("depth") == "code" for e in (skills.get(row["skill"]) or {}).get("evidence", []))
    return {"url": latest.get("evidenceUrl"), "status": "read", "repository": repo.get("repo_name"),
            "message": f"We read {repo.get('repo_name')}: its code shows {row['skill']}." if shown else
                       f"We read {repo.get('repo_name')}, but its dependency files and language statistics don't show {row['skill']} yet. Name the library in a dependency file, or describe the work in the README."}


def _milestone(row: Dict[str, Any], role: str, present: Set[str], context: Optional[str], recs: Dict[str, Dict[str, Any]], optional: bool,
               submission: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    competency = COMPETENCIES.get(row["skill"], {})
    task = competency.get("demonstration") or f"A public project using {row['skill']}."
    rec = recs.get(row["skill"])
    resource = rec.get("resource") if rec else None
    return {
        "id": milestone_id(role, row["skill"]),
        "skill": row["skill"],
        "state": row["state"],
        "category": row["category"],
        "gapType": row["gapType"],
        "tier": row.get("roleTier") or row.get("tier"),
        "sources": row.get("sources", ["career"]),
        "projectImportance": row.get("projectImportance"),
        "optional": optional,
        "done": row["state"] == "met",
        "requires": [p for p in PREREQUISITES.get(row["skill"], []) if p in present],
        "blockedBy": row.get("blockedBy", []),
        "objective": _objective(row),
        "why": row.get("whyItMatters") or row.get("inventoryReason"),
        "practicalTask": task,
        "context": context,
        "deliverable": task,
        "evidenceRequired": EVIDENCE_NEEDED[row["evidenceRequirement"]],
        "criterion": f"{row['skill']} reaches {row['expectedLevel']}, shown by {EVIDENCE_NEEDED[row['evidenceRequirement']]}",
        "levelBasis": row.get("levelBasis", []),
        "nextLevel": row.get("nextLevel"),
        "recommendedResource": {"title": resource["title"], "url": resource["url"], "provider": resource["provider"], "fitReason": resource["fitReason"]} if resource else None,
        "priorityReason": row.get("inventoryReason") or row.get("priorityReason"),
        "submissionCheck": submission,
        "estimateWeeks": None,
    }


def build_roadmap(analysis: Optional[Dict[str, Any]], position: Optional[str], recommendations: Optional[List[Dict[str, Any]]] = None,
                  inventory: Optional[List[Dict[str, Any]]] = None, project: Optional[Dict[str, Any]] = None,
                  submissions: Sequence[Dict[str, Any]] = (), repos: Sequence[Dict[str, Any]] = (), skills: Optional[Dict[str, Dict[str, Any]]] = None) -> Optional[Dict[str, Any]]:
    """Stages are layers of the dependency graph over what's still open on the path to the goal:
      path    open required competencies, open core project skills, and every open skill they build on
      layer   0 = nothing open underneath it; n = builds on something in layer n-1
      stage   one per layer, titled by what its skills are about; then an optional stage for supporting skills
    A stage is complete when every skill in it meets its expected level from evidence; the next stage builds on it.
    """
    if not analysis:
        return None
    role = analysis["role"]
    fw = framework_for(role)
    assert fw is not None
    recs = {r["skill"]: r for r in recommendations or []}
    rows = inventory if inventory is not None else [{**r, "sources": ["career"], "roleTier": r["tier"]} for r in analysis["skills"]]
    open_rows = [r for r in rows if r["state"] != "met"]
    open_names = {r["skill"] for r in open_rows}

    path: Set[str] = set()
    pending = [r["skill"] for r in open_rows if r.get("roleTier") == "required" or r.get("projectImportance") == "core"]
    while pending:
        name = pending.pop()
        if name in path:
            continue
        path.add(name)
        pending.extend(p for p in PREREQUISITES.get(name, []) if p in open_names)

    depth: Dict[str, int] = {}

    def layer(name: str, seen: Tuple[str, ...] = ()) -> int:
        if name in depth:
            return depth[name]
        below = [p for p in PREREQUISITES.get(name, []) if p in path and p not in seen]
        depth[name] = 0 if not below else 1 + max(layer(p, seen + (name,)) for p in below)
        return depth[name]

    for name in path:
        layer(name)
    ordered = _dependency_order(sorted(open_rows, key=lambda r: (r.get("inventoryRank") or 999, r["skill"])))
    present = {r["skill"] for r in rows}
    requirements_met = analysis["alignment"]["state"] == "requirements_demonstrated"
    context = (project or {}).get("text") and "your own project" or fw.project_context
    skills = skills or {}

    layers: Dict[int, List[Dict[str, Any]]] = {}
    for r in ordered:
        if r["skill"] in path:
            layers.setdefault(min(depth[r["skill"]], 3), []).append(r)
    # Everything open that isn't on the path: supporting skills, project extras, and the prerequisites they build on
    # (already in dependency order, so a prerequisite always comes before the skill that needs it).
    deepen = [r for r in ordered if r["skill"] not in path]

    stages: List[Dict[str, Any]] = []
    keys = ["foundation", "build", "apply", "advance"]
    for i, d in enumerate(sorted(layers)):
        # Within a layer nothing depends on anything else, so foundational themes go first, then the inventory's priority.
        items = sorted(layers[d], key=lambda r: (THEME_ORDER.index(_theme(r["skill"])), r.get("inventoryRank") or 999, r["skill"]))
        themes = []
        for r in items:
            if _theme(r["skill"]) not in themes:
                themes.append(_theme(r["skill"]))
        stages.append({"key": keys[i] if i < len(keys) else f"stage-{i + 1}", "title": LAYER_TITLE[min(i, len(LAYER_TITLE) - 1)], "themes": themes,
                       "optional": False, "items": items})
    if deepen:
        stages.append({"key": "deepen", "title": "Optional: go further" if requirements_met else "Round out the role (optional)", "themes": [], "optional": True, "items": deepen})

    out_stages = []
    for i, s in enumerate(stages):
        names = [r["skill"] for r in s["items"]]
        builds_on = sorted({p for r in s["items"] for p in PREREQUISITES.get(r["skill"], []) if p in path and p not in names})
        earlier = [st["key"] for st in stages[:i] if not st["optional"] and set(builds_on) & {r["skill"] for r in st["items"]}]
        nxt = next((st for st in stages[i + 1:] if not st["optional"]), None) if not s["optional"] else None
        project_count = sum(1 for r in s["items"] if r.get("projectImportance"))
        focus = _join([THEME_NAME[t] for t in s["themes"]])
        if s["optional"]:
            purpose = "Supporting skills: useful for the role but not required. They never hold back the required stages."
        elif i == 0:
            purpose = f"Covers {focus}. Nothing here waits on another skill you still need, so this is where to start."
        else:
            purpose = f"Covers {focus}. These build on {_join(builds_on[:4]) or 'earlier stages'}, so they come after them."
        out_stages.append({
            "key": s["key"],
            "title": s["title"],
            "focus": focus[0].upper() + focus[1:] if focus else None,
            "themes": s["themes"],
            "optional": s["optional"],
            "purpose": purpose,
            "skills": names,
            "buildsOn": builds_on,
            "requiresStages": earlier,
            "unlocks": nxt["key"] if nxt else None,
            "unlocksTitle": nxt["title"] if nxt else None,
            "projectSkills": project_count,
            "completionCriteria": (f"Complete when your work shows {_join(names[:5])}{' and the rest' if len(names) > 5 else ''} at the expected level, in work we can check "
                                   "(a public repository, platform activity or an assessment; a project you describe counts for supporting and project skills). "
                                   "Watching a course or submitting a link never completes a step on its own."),
            "milestones": [_milestone(r, role, present, context, recs, s["optional"], _submission_check(role, r, submissions, repos, skills)) for r in s["items"]],
            "estimateWeeks": None,
        })

    met_rows = [r for r in rows if r["state"] == "met" and (r.get("roleTier") in ("required", "supporting") or r.get("projectImportance"))]
    achievements = []
    for r in sorted(met_rows, key=lambda r: (r.get("roleTier") != "required", r["skill"])):
        sk = skills.get(r["skill"]) or {}
        achievements.append({
            "id": milestone_id(role, r["skill"]), "skill": r["skill"], "tier": r.get("roleTier"), "level": r["level"], "expectedLevel": r["expectedLevel"],
            "title": f"{r['skill']} at {r['level']}", "evidence": (r.get("evidence") or [None])[0], "evidenceAt": sk.get("lastEvidenceAt"),
            "basis": sk.get("evidenceBasis"), "forProject": bool(r.get("projectImportance")),
        })
    return {
        "role": role,
        "currentPosition": position,
        "progress": analysis["coverage"],
        "alignment": analysis["alignment"]["state"],
        "requirementsMet": requirements_met,
        "provisional": not analysis["assessed"] or analysis["alignment"]["state"] == "not_enough_evidence",
        "completed": [r["skill"] for r in analysis["skills"] if r["state"] == "met"],
        "completedMilestones": [{"id": a["id"], "skill": a["skill"], "tier": a["tier"]} for a in achievements],
        "achievements": achievements,
        "stages": out_stages,
        "project": {"text": project.get("text"), "status": project.get("status"), "core": (project.get("summary") or {}).get("core"),
                    "coreReady": (project.get("summary") or {}).get("coreReady")} if project and project.get("text") else None,
        "framework": framework_meta(),
        "assumption": ROADMAP_BASIS,
    }


def legacy_roadmap(roadmap: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """The roadmaps table's columns, which Yora also reads."""
    if not roadmap:
        return None
    core = [s for s in roadmap["stages"] if not s.get("optional")]
    optional = [s for s in roadmap["stages"] if s.get("optional")]

    def column(s: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not s:
            return {"title": "", "milestones": [], "timeline": "", "focus": ""}
        return {"title": s["title"], "milestones": [m["deliverable"] for m in s["milestones"]], "timeline": "", "focus": s["milestones"][0]["skill"]}

    return {"current_stage": roadmap["currentPosition"] or "Not stated", "short_term": column(core[0] if core else None),
            "mid_term": column(core[1] if len(core) > 1 else None), "long_term": column(optional[0] if optional else (core[2] if len(core) > 2 else None))}


# ─── Graph ──────────────────────────────────────────────────────────────────


def build_graph(skills: Dict[str, Dict[str, Any]], inferred: Dict[str, Dict[str, Any]], canonical: Callable[[str], Optional[str]]) -> Dict[str, Any]:
    """Edges are either two skills evidenced by the same repository or project, or a documented ontology relation."""
    ranked = sorted(skills.values(), key=lambda s: (-(s["proficiency"] or 0), -s["evidenceCount"], s["name"]))
    direct = ranked[:MAX_GRAPH_NODES]
    room = max(0, MAX_GRAPH_NODES - len(direct))
    extra = sorted(inferred.values(), key=lambda s: (-len(s["inferredFrom"]), s["name"]))[:room]
    nodes = direct + extra
    present = {n["name"] for n in nodes}

    edges: List[Dict[str, Any]] = []
    together: Dict[Tuple[str, str], Set[str]] = {}
    by_source: Dict[str, Set[str]] = {}
    for node in direct:
        for e in skills[node["name"]]["evidence"]:
            if e["kind"] in ("repository", "project", "experience"):
                by_source.setdefault(e["ref"] or e["label"], set()).add(node["name"])
    labels = {e["ref"] or e["label"]: e["label"].split(":")[0] for n in direct for e in skills[n["name"]]["evidence"]}
    for source, names in by_source.items():
        ordered = sorted(names)
        for i, a in enumerate(ordered):
            for b in ordered[i + 1:]:
                together.setdefault((a, b), set()).add(labels.get(source, source))
    for (a, b), labelset in sorted(together.items()):
        edges.append({"source": a, "target": b, "relationship": "used_together", "basis": "evidence", "evidence": sorted(labelset)[:3], "weight": len(labelset)})

    seen = {(e["source"], e["target"]) for e in edges} | {(e["target"], e["source"]) for e in edges}
    for name in sorted(present):
        for target, weight in SKILL_ONTOLOGY.get(name, []):
            resolved = canonical(target) or target
            if resolved in present and resolved != name and (name, resolved) not in seen:
                seen.add((name, resolved))
                edges.append({"source": name, "target": resolved, "relationship": determine_relationship(name, target), "basis": "ontology", "evidence": [], "weight": weight})

    return {
        "nodes": [
            {
                "id": n["name"], "name": n["name"], "category": n["category"], "kind": n.get("kind"), "status": n["status"], "level": n["level"],
                "proficiency": n["proficiency"], "confidence": n["confidence"], "evidenceCount": n["evidenceCount"],
                "evidence": n["evidence"][:4], "inferredFrom": n.get("inferredFrom", []),
            }
            for n in nodes
        ],
        "edges": edges,
        "totalSkills": len(skills) + len(inferred),
    }


# ─── Data coverage: what we read, and what we couldn't ──────────────────────


def data_coverage(facts: List[Dict[str, Any]], repos: List[Dict[str, Any]], learning_records: Optional[List[Dict[str, Any]]], intent: Dict[str, Any],
                  context: Dict[str, Any]) -> Dict[str, Any]:
    by_origin: Dict[str, int] = {}
    groups: Dict[str, Set[str]] = {}
    for f in facts:
        by_origin[f["origin"]] = by_origin.get(f["origin"], 0) + 1
        groups.setdefault(f["field_group"], set()).add(str(f.get("record_key") or f["id"]))
    read = sum(1 for r in repos if code_signals.was_read(r.get("code_signals")))
    private = sum(1 for r in repos if (r.get("code_signals") or {}).get("private"))
    github_connected = bool(context.get("githubConnected")) or bool(repos)
    platforms = sorted(o for o in by_origin if o in VERIFIED_ORIGINS)

    def src(id_: str, label: str, used: bool, detail: str, limits: Optional[List[str]] = None) -> Dict[str, Any]:
        return {"id": id_, "label": label, "status": "used" if used else "missing", "detail": detail, "limits": limits or []}

    resume = by_origin.get("resume", 0)
    projects = len({k for k in groups.get("projects", set())}) if facts else 0
    sources = [
        src("resume", "Resume", resume > 0, f"{_plural(resume, 'confirmed field')} read" if resume else "No confirmed resume fields yet.",
            ["Experience on a resume is self-reported; we can't verify employment."]),
        src("github", "GitHub repositories", bool(repos),
            (f"{_plural(len(repos), 'repository', 'repositories')} read for languages, topics and descriptions; dependency files, structure and README read for {read} of them."
             if repos else ("GitHub is connected but no repositories were found." if github_connected else "GitHub isn't connected.")),
            [l for l in [
                "We read repository metadata, dependency files and READMEs, not source code. Using a library shows it's used, not how well." if repos else None,
                "Repositories you collaborate on count as yours; we can't tell who wrote which part." if repos else None,
                f"{_plural(len(repos) - read, 'repository', 'repositories')} haven't had their files read yet; that happens on the next GitHub sync." if repos and read < len(repos) else None,
                f"{_plural(private, 'private repository', 'private repositories')} included because your GitHub connection grants access." if private else None,
                "Private repositories are included only if your GitHub connection grants access to them." if repos and not private else None,
            ] if l]),
        src("skills_list", "Skills you listed", "skills" in groups, "Used to know what you claim; a listing never earns a level on its own."),
        src("projects", "Projects on your profile", "projects" in groups, f"{_plural(projects, 'project')} on record (resume, profile and GitHub)." if projects else "No projects on record."),
        src("experience", "Work experience", "experience" in groups, "Descriptions are scanned for skills you used." if "experience" in groups else "No work experience on record."),
        src("education", "Education", "education" in groups or bool(context.get("degree")),
            "Shown as where you are now. Not used as evidence of skill level: we don't have course transcripts.", []),
        src("platforms", "Coding platforms", bool(platforms), f"Read from {_join([p.replace('_', ' ').title() for p in platforms])}." if platforms else "No coding platform connected (Kaggle, Stack Exchange, LeetCode, HackerRank)."),
        src("learning", "Courses and certifications", bool(learning_records), f"{_plural(len(learning_records or []), 'record')}; completed courses count as learning, never as proof of skill." if learning_records else "No courses or certifications recorded."),
        src("project_intent", "What you want to build", intent.get("status") == "analysed",
            {"analysed": "Read with phrase rules; each project skill lists the words that led to it.",
             "too_vague": "Too general to tell what the project needs yet.",
             "none": "Not written yet. Describe what you want to build to see what that project needs."}[intent.get("status") or "none"]),
    ]
    return {"sources": sources, "repositoriesRead": read, "repositories": len(repos),
            "limitations": [
                "A skill you haven't shown in work we can see is reported as 'not shown yet'. We can only judge what your evidence shows, not what you know.",
                "The role frameworks are a draft written by our team from public references, not an official standard.",
            ]}


# ─── Assembly ───────────────────────────────────────────────────────────────


def position_from(user: Dict[str, Any]) -> Optional[str]:
    """Only what the user's own record says, or None."""
    if user.get("job_title"):
        return " at ".join(p for p in (user["job_title"], user.get("company")) if p)
    if user.get("academic_title"):
        return " at ".join(p for p in (user["academic_title"], user.get("university")) if p)
    if user.get("degree"):
        return " at ".join(p for p in (user["degree"], user.get("university")) if p)
    return None


def evidence_ledger(skills: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Every (skill, profile fact) pair the engine used, for the skill_evidence projection. Strength is the skill's confidence."""
    return [
        {"skill": s["name"], "factId": fact_id, "source": source, "strength": s["confidence"]}
        for s in skills.values() for fact_id, source in s["_factRefs"]
    ]


def intent_from(facts: List[Dict[str, Any]], fallback: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """The student's project description: the newest confirmed goals/project_intent fact, else the onboarding 'other' text."""
    rows = sorted((f for f in facts if f["field_group"] == "goals" and f["field_name"] == "project_intent" and f.get("normalized_value")),
                  key=lambda f: str(f.get("created_at") or ""), reverse=True)
    if rows:
        return str(rows[0]["normalized_value"]), "profile"
    return (fallback, "onboarding_other") if fallback and fallback.strip() else (None, None)


def compute(
    *,
    user: Dict[str, Any],
    roles: List[str],
    facts: List[Dict[str, Any]],
    repos: List[Dict[str, Any]],
    resources: Optional[List[Dict[str, Any]]] = None,  # the database catalogue; superseded by learning_catalogue.json, kept so callers don't break
    canonical: Callable[[str], Optional[str]],
    lexicon_scan: Callable[[str], List[str]],
    categories: Dict[str, str],
    now: datetime,
    learning: Optional[List[Dict[str, Any]]] = None,
    intent_text: Optional[str] = None,
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    context = context or {}
    skills = build_skills(facts, repos, canonical, lexicon_scan, categories, now, learning)
    inferred = infer_skills(skills, canonical)
    # With nothing to read, every role skill would look "missing". That's not knowing, not a gap.
    has_evidence_base = bool(repos) or any(f["origin"] != "user_entered" or f["field_group"] in ("skills", "projects", "experience") for f in facts if f["field_group"] != "goals")

    analyses = [a for a in (analyze_role(r, skills, inferred, has_evidence_base, canonical) for r in roles) if a]
    primary = analyses[0] if analyses else None
    text, source = intent_from(facts, intent_text)
    intent = project_intent.analyse(text, lexicon_scan, lambda s: s in COMPETENCIES, source or "profile")
    project = analyze_project(intent, skills, inferred, has_evidence_base, primary)
    inventory = gap_inventory(primary, project, skills, inferred, has_evidence_base) if (primary or project.get("rows")) else []
    recommendations = recommend(inventory, skills, primary["label"] if primary else None, roles, now, learning) if has_evidence_base else []
    roadmap = build_roadmap(primary, position_from(user), recommendations, inventory, project, context.get("submissions") or [], repos, skills)
    project.pop("_rows", None)
    ledger = evidence_ledger(skills)
    public = {name: {k: v for k, v in s.items() if not k.startswith("_")} for name, s in skills.items()}

    # Skills are the same whatever the goal: role relevance lives on the role rows and inventory, never on the skill.
    ordered = sorted(public.values(), key=lambda s: (-(s["proficiency"] if s["proficiency"] is not None else -1), s["name"]))
    role_names = {r["skill"] for r in (primary or {}).get("skills", [])}
    return {
        "engineVersion": ENGINE_VERSION,
        "framework": {**framework_meta(), "alignmentRules": ALIGNMENT_RULES},
        "computedAt": now.isoformat(),
        "hasEvidenceBase": has_evidence_base,
        "skills": ordered,
        "inferred": sorted(inferred.values(), key=lambda s: s["name"]),
        "roles": analyses[:1] + [compact_analysis(a) for a in analyses[1:]],
        "unsupportedRoles": [r for r in roles if framework_for(r) is None],
        "project": project,
        "gapInventory": inventory,
        "recommendations": recommendations,
        "roadmap": roadmap,
        "graph": build_graph(public, inferred, canonical),
        "dataCoverage": data_coverage(facts, repos, learning, intent, {**context, "degree": user.get("degree")}),
        "counts": {
            "verified": sum(1 for s in public.values() if s["status"] == "verified"),
            "claimed": sum(1 for s in public.values() if s["status"] == "claimed"),
            "inferred": len(inferred),
            "assessed": sum(1 for s in public.values() if s["proficiency"] is not None),
            "roleSkills": len(role_names),
        },
        # Not part of the dashboard document: compute.py pops it to write the skill_evidence projection.
        "_ledger": ledger,
    }


COMPACT_ROW_FIELDS = ("skill", "tier", "weight", "priority", "expected", "expectedLevel", "evidenceRequirement", "proficiency", "level", "confidence",
                      "evidenceState", "hasEvidence", "state", "gapType", "insufficientEvidence", "category", "categoryLabel", "priorityRank")


def compact_analysis(analysis: Dict[str, Any]) -> Dict[str, Any]:
    """A secondary goal, for the goal picker: states and levels without the per-row explanations the primary goal carries.
    `open` is left empty (compact: true): readers derive it from `skills` (not met, by priorityRank), so rows aren't stored twice."""
    def slim(r: Dict[str, Any]) -> Dict[str, Any]:
        return {k: r[k] for k in COMPACT_ROW_FIELDS if k in r}
    fw = analysis["framework"]
    return {**analysis, "compact": True, "skills": [slim(r) for r in analysis["skills"]], "open": [],
            "framework": {"version": fw["version"], "status": fw["status"], "reviewed": fw["reviewed"], "responsibilities": fw["responsibilities"][:2],
                          "completionCriteria": fw["completionCriteria"], "summary": fw["summary"]},
            "specialisations": [{"track": t["track"], "met": t["met"], "total": t["total"]} for t in analysis["specialisations"]]}


def legacy_gaps_and_paths(intelligence: Dict[str, Any]) -> Dict[str, Any]:
    """The older view keys Yora and next actions read, now from the same source."""
    primary = intelligence["roles"][0] if intelligence["roles"] else None
    gaps = []
    if primary and primary["assessed"]:
        for row in primary["open"]:
            if not row["insufficientEvidence"] and row["tier"] == "required":
                gaps.append({"skill": row["skill"], "description": row["action"], "priority": f"{row['priority']} Priority", "action": row["action"]})
    return {"gaps": gaps, "learning_paths": []}


def role_label(role: str) -> str:
    return ROLE_LABELS.get(role, role.replace("_", " "))
