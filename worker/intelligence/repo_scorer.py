"""GitHub repository impact scores (github_scores).

Privacy: the privacy policy covers "public repository metadata" only, so
nothing beyond metadata (name, description, languages, topics, stars, forks)
is ever sent to an AI provider, and only with the user's external_ai consent.
README and source files are not fetched. Without consent, or when the LLM
fails, the score is a labelled heuristic estimate.

Performance: scoring makes no DB calls (run it outside a transaction), runs a
bounded number of repos concurrently, and skips repos whose score is newer
than their last push (cache keyed on repo identity + last push time).
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

log = logging.getLogger("worker.repo_scorer")

REPO_SCORE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "impact_score": {"type": "integer", "minimum": 0, "maximum": 100},
        "rationale": {"type": "string"},
    },
    "required": ["impact_score", "rationale"],
}

# Marks heuristic rationales, so a repo scored without consent is re-scored
# once the user grants it.
HEURISTIC_PREFIX = "Estimated from repository metadata"
MAX_CONCURRENCY = 4
LLM_TIMEOUT_S = 15.0


def heuristic_impact_score(
    repo_name: str,
    description: Optional[str],
    languages: Dict[str, Any],
    topics: List[str],
    stars: int,
    forks: int,
) -> Dict[str, Any]:
    """Deterministic estimate from metadata only; the rationale says so."""
    score = 70
    reasons: List[str] = []

    langs_lower = [str(l).lower() for l in languages.keys()]
    topics_lower = [str(t).lower() for t in topics]

    if any(l in langs_lower for l in ("python", "c++", "cuda", "rust")):
        score += 8
        reasons.append("systems/ML languages")
    if any(t in topics_lower for t in ("deep-learning", "machine-learning", "pytorch", "transformers", "xgboost", "llm")):
        score += 9
        reasons.append("ML topics")
    if len(languages) >= 2:
        score += 4
        reasons.append("multiple languages")
    if stars > 30:
        score += 5
    elif stars > 10:
        score += 3
    if stars > 10:
        reasons.append(f"{stars} stars")
    if forks > 5:
        score += 3
        reasons.append(f"{forks} forks")

    final_score = min(98, max(65, score))
    detail = ", ".join(reasons) if reasons else "limited metadata"
    return {"impact_score": final_score, "rationale": f"{HEURISTIC_PREFIX}: {detail}."}


def score_repository(repo: Dict[str, Any], *, allow_external_ai: bool) -> Dict[str, Any]:
    """Scores one repo. LLM (metadata only) with consent, heuristic otherwise or on failure."""
    from provider_router import route_llm

    args = (
        repo["repo_name"],
        repo.get("description"),
        repo.get("languages") or {},
        repo.get("topics") or [],
        repo.get("stars") or 0,
        repo.get("forks") or 0,
    )
    if not allow_external_ai:
        return heuristic_impact_score(*args)

    name, description, languages, topics, stars, forks = args
    prompt = (
        "Estimate the engineering impact of this GitHub repository from its public metadata only.\n"
        f"Repository: {name}\n"
        f"Description: {description or 'None provided'}\n"
        f"Languages: {list(languages.keys())}\n"
        f"Topics: {topics}\n"
        f"Stars: {stars}, Forks: {forks}\n\n"
        "Provide 'impact_score' (0-100 integer) and 'rationale' (one concise sentence starting with the score). "
        "Do not claim to have read the code."
    )
    try:
        res = route_llm(
            system="You evaluate code repositories from metadata. Output strictly valid JSON.",
            user=prompt,
            schema=REPO_SCORE_SCHEMA,
            consent_granted=True,
            purpose="repo_impact_score",
            timeout=LLM_TIMEOUT_S,
        )
        if isinstance(res.data, dict) and "impact_score" in res.data:
            return res.data
    except Exception as exc:  # noqa: BLE001 - one repo's failure never fails the job
        log.warning("LLM repo scoring failed for %s (%s); using heuristic", name, exc)
    return heuristic_impact_score(*args)


def repos_needing_scores(cur: Any, user_id: str, *, allow_external_ai: bool) -> List[Dict[str, Any]]:
    """Repos with no score, a score older than their last push, or (with consent) a heuristic score."""
    from db import fetch_all

    return fetch_all(
        cur,
        """SELECT r.id, r.repo_name, r.description, r.languages, r.topics, r.stars, r.forks
             FROM code_repositories r
             LEFT JOIN github_scores s ON s.user_id = r.user_id AND s.repo_id = r.id::text
            WHERE r.user_id = %s
              AND (s.id IS NULL
                   OR (r.last_commit_at IS NOT NULL AND s.updated_at < r.last_commit_at)
                   OR (%s AND s.rationale LIKE %s))""",
        (user_id, allow_external_ai, HEURISTIC_PREFIX + "%"),
    )


def score_repos(repos: List[Dict[str, Any]], *, allow_external_ai: bool) -> List[Dict[str, Any]]:
    """Scores repos with at most MAX_CONCURRENCY in flight. No DB access."""
    if not repos:
        return []
    with ThreadPoolExecutor(max_workers=min(MAX_CONCURRENCY, len(repos))) as pool:
        results = list(pool.map(lambda r: score_repository(r, allow_external_ai=allow_external_ai), repos))
    return [{"repo": r, **res} for r, res in zip(repos, results)]


def save_scores(cur: Any, user_id: str, scored: List[Dict[str, Any]]) -> None:
    now = datetime.now(timezone.utc)
    for s in scored:
        cur.execute(
            """INSERT INTO github_scores (repo_id, user_id, repo_name, impact_score, rationale, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (user_id, repo_id) DO UPDATE SET
                 repo_name = EXCLUDED.repo_name,
                 impact_score = EXCLUDED.impact_score,
                 rationale = EXCLUDED.rationale,
                 updated_at = EXCLUDED.updated_at""",
            (str(s["repo"]["id"]), user_id, s["repo"]["repo_name"], s["impact_score"], s["rationale"], now),
        )
