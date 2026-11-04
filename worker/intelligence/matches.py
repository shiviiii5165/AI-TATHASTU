"""`compute_matches`: scores a user against the other side and stores the
pairs in `matches`. A student is matched against every faculty member and
alum; a faculty member or alum against every student. Only onboarded,
non-deleted users take part. Display (and consent) is the web app's job.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any, Dict, List

import psycopg2.extras

from db import fetch_all, fetch_one, jsonb
from intelligence.matching import (
    MAX_PER_STUDENT, MIN_SCORE, Alum, Faculty, Student, score_alum, score_faculty,
)
from jobs import Job, assert_still_owner

log = logging.getLogger("worker.matches")

PEOPLE_SQL = """
SELECT u.id::text, u.role::text AS role, u.company, u.job_title, u.institution_id::text, u.specialization_id::text,
       i.canonical_name AS institution_name, sp.canonical_name AS specialization_name,
       o.career_roles, o.career_role, o.research_interests, o.expertise_areas, o.mentorship, o.give_back
  FROM users u
  JOIN onboarding_state o ON o.user_id = u.id AND o.current_step = 'done'
  LEFT JOIN institutions i ON i.id = u.institution_id
  LEFT JOIN specializations sp ON sp.id = u.specialization_id
 WHERE u.deleted_at IS NULL AND u.role::text = ANY(%(roles)s) {extra}
"""


def _students(cur: Any, only: str | None = None) -> List[Student]:
    rows = fetch_all(cur, PEOPLE_SQL.format(extra="AND u.id = %(only)s" if only else ""), {"roles": ["student"], "only": only})
    skills: Dict[str, List[str]] = defaultdict(list)
    if rows:
        for r in fetch_all(
            cur,
            """SELECT DISTINCT e.user_id::text AS user_id, s.canonical_name FROM skill_evidence e
                 JOIN skills s ON s.id = e.skill_id WHERE e.user_id = ANY(%(ids)s::uuid[])""",
            {"ids": [r["id"] for r in rows]},
        ):
            skills[r["user_id"]].append(r["canonical_name"])
    return [
        Student(
            id=r["id"], roles=list(r["career_roles"] or ([r["career_role"]] if r["career_role"] else [])),
            skills=skills[r["id"]], institution_id=r["institution_id"], institution_name=r["institution_name"],
            specialization_id=r["specialization_id"], specialization_name=r["specialization_name"],
        )
        for r in rows
    ]


def _mentors(cur: Any, only: str | None = None):
    rows = fetch_all(cur, PEOPLE_SQL.format(extra="AND u.id = %(only)s" if only else ""), {"roles": ["faculty", "alumni"], "only": only})
    out = []
    for r in rows:
        if r["role"] == "faculty":
            out.append(Faculty(
                id=r["id"], interests=list(r["research_interests"] or []), expertise_areas=list(r["expertise_areas"] or []),
                capacity=int((r["mentorship"] or {}).get("capacity") or 0), institution_id=r["institution_id"],
                specialization_id=r["specialization_id"],
            ))
        else:
            out.append(Alum(
                id=r["id"], company=r["company"], job_title=r["job_title"], career_role=r["career_role"],
                institution_id=r["institution_id"], specialization_id=r["specialization_id"], give_back=r["give_back"] or {},
            ))
    return out


def _pair(mentor, student: Student):
    if isinstance(mentor, Faculty):
        return ("faculty", *score_faculty(mentor, student))
    return ("alumni", *score_alum(mentor, student))


def process_compute_matches(conn: Any, job: Job) -> None:
    with conn, conn.cursor() as cur:
        assert_still_owner(cur, job)  # One transaction, so this covers the writes below too.
        me = fetch_one(cur, "SELECT role::text AS role FROM users WHERE id = %s AND deleted_at IS NULL", (job.user_id,))
        if not me:
            return
        rows = []
        if me["role"] == "student":
            students = _students(cur, only=job.user_id)
            if not students:
                return  # not onboarded yet
            student = students[0]
            scored = [(m, *_pair(m, student)) for m in _mentors(cur)]
            scored = sorted((s for s in scored if s[2] >= MIN_SCORE), key=lambda s: -s[2])[:MAX_PER_STUDENT]
            rows = [(student.id, m.id, kind, score, jsonb(reasons)) for m, kind, score, reasons in scored]
            cur.execute("DELETE FROM matches WHERE student_id = %s", (job.user_id,))
        else:
            mentors = _mentors(cur, only=job.user_id)
            if not mentors:
                return
            mentor = mentors[0]
            for student in _students(cur):
                kind, score, reasons = _pair(mentor, student)
                if score >= MIN_SCORE:
                    rows.append((student.id, mentor.id, kind, score, jsonb(reasons)))
            cur.execute("DELETE FROM matches WHERE mentor_id = %s", (job.user_id,))
        if rows:
            psycopg2.extras.execute_values(
                cur,
                """INSERT INTO matches (student_id, mentor_id, kind, score, reasons) VALUES %s
                   ON CONFLICT (student_id, mentor_id) DO UPDATE SET kind = EXCLUDED.kind, score = EXCLUDED.score,
                     reasons = EXCLUDED.reasons, computed_at = now()""",
                rows,
            )
    log.info("matches for %s (%s): %d pairs", job.user_id, me["role"], len(rows))
