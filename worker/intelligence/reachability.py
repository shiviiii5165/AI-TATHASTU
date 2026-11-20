"""Which routes can produce independent (code-level) evidence for a competency, read from the extraction tables themselves.

A required competency with no route can never be `met` from repositories, however strong the student's work, so the
engine would show a permanent gap: a systematic false negative. tests/test_golden_roles.py reports these per role.
Routes:
  language   GitHub language statistics name it (a language in skills_catalog)
  package    a dependency file declares a package mapped to it (code_signals.PACKAGE_SKILLS)
  structure  repository structure shows it (code_signals.STRUCTURE_SKILLS: tests, CI, Dockerfile...)
  readme     a capability documented in the README of the student's own repository with code
  platform   only Kaggle / Stack Exchange / LeetCode / HackerRank activity (not counted as a code route)
"""

from __future__ import annotations

from typing import Dict, List, Set

from intelligence import code_signals
from skills_catalog import CATALOG, KIND

_LANGUAGES: Set[str] = {n for n, c, _a, _amb in CATALOG if c == "language"}


def _flatten(values) -> Set[str]:
    out: Set[str] = set()
    for v in values:
        if isinstance(v, str):
            out.add(v)
        else:
            out.update(_flatten(v))
    return out


_PACKAGE: Set[str] = _flatten(code_signals.PACKAGE_SKILLS.values())
_STRUCTURE: Set[str] = _flatten(code_signals.STRUCTURE_SKILLS.values())


def routes(competency: str) -> List[str]:
    found = []
    if competency in _LANGUAGES:
        found.append("language")
    if competency in _PACKAGE:
        found.append("package")
    if competency in _STRUCTURE:
        found.append("structure")
    if KIND.get(competency) == "capability":
        found.append("readme")
    return found


def unreachable_required() -> Dict[str, List[str]]:
    """role -> required competencies with no code route."""
    from intelligence.frameworks import CURRENT_ROLES, FRAMEWORKS

    out: Dict[str, List[str]] = {}
    for role in CURRENT_ROLES:
        missing = [r.competency for r in FRAMEWORKS[role].requirements if r.required and not routes(r.competency)]
        if missing:
            out[role] = missing
    return out
