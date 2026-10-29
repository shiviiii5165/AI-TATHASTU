"""Stage 6 — persist candidates to profile_facts (origin = resume, unconfirmed)."""

from __future__ import annotations

import logging
from dataclasses import replace
from typing import Any, List

import psycopg2.extras

from db import jsonb
from profile_urls import URL_FIELDS, route_contact_url
from resume.deterministic import Candidate
from resume.text import Document

log = logging.getLogger("worker.resume.persist")

UNCERTAIN_OCR_PENALTY = 0.8


def route_contacts(candidates: List[Candidate]) -> List[Candidate]:
    """Contact URLs from either tier go to `website` or their platform field (the
    AI tier can put a LeetCode link in `website`); one value per URL field."""
    out: List[Candidate] = []
    seen_contact = set()
    for c in candidates:
        if c.group == "contact" and c.field in URL_FIELDS and isinstance(c.value, str):
            field, value = route_contact_url(c.field, c.value)
            if field is None or field in seen_contact:
                continue
            seen_contact.add(field)
            c = replace(c, field=field, value=value)
        out.append(c)
    return out


def persist(cur: Any, user_id: str, doc: Document, candidates: List[Candidate]) -> int:
    # Serialise persists per user: two overlapping delete+insert transactions
    # (two resumes finishing together) would otherwise both survive as duplicates.
    cur.execute("SELECT pg_advisory_xact_lock(hashtextextended('resume_persist:' || %s, 0))", (user_id,))
    # A new extraction replaces the previous one's *unreviewed* facts; anything
    # the user already confirmed, edited or rejected is left alone.
    cur.execute(
        "DELETE FROM profile_facts WHERE user_id = %s AND origin = 'resume' AND confirmation = 'unconfirmed'",
        (user_id,),
    )
    rows = []
    for c in route_contacts(candidates):
        page = doc.page_info(c.start)
        method, confidence, validation = c.method, c.confidence, c.validation
        if page and page.method == "ocr":
            method = "ocr" if method == "deterministic" else f"ocr+{method}"
            if page.uncertain:
                confidence *= UNCERTAIN_OCR_PENALTY
                if validation == "validated":
                    validation = "unresolved"
        rows.append(
            (
                user_id, c.group, c.field, c.record_key,
                jsonb(c.raw), jsonb(c.value),
                c.evidence[:500], jsonb(doc.locate(c.start, c.end)),
                method, "resume", round(confidence, 3), validation, "unconfirmed",
            )
        )
    if rows:
        psycopg2.extras.execute_values(
            cur,
            """INSERT INTO profile_facts
                 (user_id, field_group, field_name, record_key, extracted_value, normalized_value,
                  source_evidence, location, extraction_method, origin, confidence, validation_status, confirmation)
               VALUES %s""",
            rows,
        )
    return len(rows)
