"""Skill graph: normalize skill mentions to canonical `skills` rows and
compute evidence strength per (skill, fact)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

import psycopg2.extras

from db import fetch_all
from intelligence.config import STRENGTH
from skills_catalog import CATALOG, alias_key

_seeded = False


def seed(cur: Any) -> None:
    """Idempotently loads the catalog into skills/skill_aliases (once per process)."""
    global _seeded
    if _seeded:
        return
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO skills (canonical_name, category) VALUES %s ON CONFLICT (canonical_name) DO NOTHING",
        [(name, cat) for name, cat, _a, _amb in CATALOG],
    )
    ids = {r["canonical_name"]: r["id"] for r in fetch_all(cur, "SELECT id, canonical_name FROM skills")}
    # First mapping wins, as in skills_catalog.alias_map; one row per alias (ON CONFLICT DO UPDATE can't touch a row twice).
    by_alias: Dict[str, str] = {}
    for name, _cat, aliases, _amb in CATALOG:
        by_alias.setdefault(alias_key(name), ids[name])
    for name, _cat, aliases, _amb in CATALOG:
        for a in aliases:
            by_alias.setdefault(alias_key(a), ids[name])
    pairs = list(by_alias.items())
    # The catalogue is authoritative for its own aliases. An alias first seen as an unknown mention (GitHub's
    # "Dockerfile" language, say) was auto-created as its own skill; once the catalogue maps it, the alias moves
    # to the catalogue skill instead of staying stuck on the accidental one.
    psycopg2.extras.execute_values(
        cur,
        "INSERT INTO skill_aliases (alias, skill_id) VALUES %s ON CONFLICT (alias) DO UPDATE SET skill_id = EXCLUDED.skill_id",
        pairs,
    )
    _seeded = True


class SkillIndex:
    """alias → skill id, inserting unknown skills as category 'other'."""

    def __init__(self, cur: Any) -> None:
        self.cur = cur
        self.by_alias: Dict[str, str] = {
            r["alias"]: r["skill_id"] for r in fetch_all(cur, "SELECT alias, skill_id FROM skill_aliases")
        }
        self.names: Dict[str, str] = {
            r["id"]: r["canonical_name"] for r in fetch_all(cur, "SELECT id, canonical_name FROM skills")
        }

    def resolve(self, mention: str) -> Optional[str]:
        name = re.sub(r"\s+", " ", mention).strip(" .,;:()[]")
        if not name or len(name) > 60:
            return None
        key = alias_key(name)
        if key in self.by_alias:
            return self.by_alias[key]
        self.cur.execute(
            """WITH ins AS (
                 INSERT INTO skills (canonical_name, category) VALUES (%s, 'other')
                 ON CONFLICT (canonical_name) DO NOTHING RETURNING id)
               SELECT id FROM ins UNION ALL SELECT id FROM skills WHERE canonical_name = %s LIMIT 1""",
            (name, name),
        )
        skill_id = self.cur.fetchone()[0]
        self.cur.execute("INSERT INTO skill_aliases (alias, skill_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (key, skill_id))
        self.by_alias[key] = skill_id
        self.names[skill_id] = name
        return skill_id

    def canonical(self, mention: str) -> Optional[str]:
        """The canonical spelling of a mention. Read-only: a new spelling keeps its own name and adds no row."""
        name = re.sub(r"\s+", " ", mention).strip(" .,;:()[]")
        if not name or len(name) > 60:
            return None
        skill_id = self.by_alias.get(alias_key(name))
        return self.names.get(skill_id, name) if skill_id else name


@dataclass
class Evidence:
    skill_id: str
    fact_id: Optional[str]
    source: str
    strength: float


def _values(value: Any) -> List[str]:
    if isinstance(value, list):
        return [str(v) for v in value]
    if isinstance(value, str):
        return [v for v in re.split(r",|;|\||/(?!\w*\.)", value) if v.strip()]
    return []


def fact_strength(fact: Dict[str, Any]) -> float:
    if fact["origin"] == "resume":
        return STRENGTH["resume_confirmed"]
    return STRENGTH["self_reported"]  # user_entered and anything else


def github_language_strength(repo_count: int) -> float:
    # "0.7 scaled by usage": one repo → 0.42, three or more → full 0.7.
    return round(STRENGTH["github_language"] * min(1.0, 0.4 + 0.2 * repo_count), 3)


def collect(
    facts: Iterable[Dict[str, Any]],
    index: SkillIndex,
    repo_languages: Dict[str, int],
    lexicon_scan,
) -> List[Evidence]:
    """
    One Evidence per (skill, fact). Sources: skills facts, project
    technologies, lexicon hits in experience/project descriptions, and
    GitHub languages (scaled by how many repos use them).
    """
    out: List[Evidence] = []
    seen = set()

    def add(mention: str, fact: Dict[str, Any], source: str, strength: float) -> None:
        skill_id = index.resolve(mention)
        if skill_id and (skill_id, fact["id"]) not in seen:
            seen.add((skill_id, fact["id"]))
            out.append(Evidence(skill_id, fact["id"], source, strength))

    for f in facts:
        group, field, value = f["field_group"], f["field_name"], f["normalized_value"]
        if group == "skills" and field == "skill":
            if f["origin"] == "github":
                add(str(value), f, "github", github_language_strength(repo_languages.get(str(value), 1)))
            else:
                add(str(value), f, f["origin"], fact_strength(f))
        elif group == "projects" and field == "technologies" and f["origin"] != "github":
            for tech in _values(value):
                add(tech, f, f["origin"], fact_strength(f))
        elif field == "description" and group in ("experience", "projects") and f["origin"] != "github":
            for canonical in lexicon_scan(str(value)):
                add(canonical, f, f["origin"], fact_strength(f))
    return out


def summarize(evidence: List[Evidence], names: Dict[str, str], categories: Dict[str, str]) -> List[Dict[str, Any]]:
    by_skill: Dict[str, Tuple[float, set]] = {}
    for e in evidence:
        total, sources = by_skill.get(e.skill_id, (0.0, set()))
        by_skill[e.skill_id] = (total + e.strength, sources | {e.source})
    rows = [
        {
            "name": names[sid],
            "category": categories.get(sid, "other"),
            "evidenceStrength": round(min(1.0, total), 3),
            "sources": sorted(sources),
            # A resume is the user's own claim. Verified means a source we read directly.
            "verificationStatus": "verified" if "github" in sources else "claimed" if "resume" in sources else "self_reported",
        }
        for sid, (total, sources) in by_skill.items()
    ]
    return sorted(rows, key=lambda r: (-r["evidenceStrength"], r["name"]))
