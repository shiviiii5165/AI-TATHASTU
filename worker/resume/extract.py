"""`resume_extract` handler: Stages 1–6 of the resume pipeline, multi-tiered.

Text tiers, cheapest first:
  1. Embedded text layer (PyMuPDF / python-docx / plain text).
  2. Forced OCR of every page (Tesseract) when that layer is garbage, e.g.
     fonts without a Unicode map that extract as "1 1 1 1".
  3. Whole-document AI extraction when the text is still unusable, the
     rule-based pass finds nothing, many PDF text blocks extract blank
     (unmapped fonts), or no name/email is readable: page images to a vision
     model (Gemini, then OpenRouter) for PDFs and images, otherwise the full
     text. If that call fails, each detected section is extracted on its own.
Otherwise: rules + per-section LLM recovery (only the section's text is sent).
Then, for every path: sections the text clearly mentions (internship,
project, certificate…) but nothing was extracted for are retried with a
targeted request, and sections still empty fall back to rules-only entries
(unresolved, for the user to review), never to "nothing found".

All AI output goes through code-side evidence verification. No AI call is
made without the user's external_ai consent.

Not yet implemented from the plan, deliberately left out rather than faked:
ClamAV scanning (files.scan_status stays 'pending'), the cross-user hash
cache, and the job_diagnostics / fact_conflicts tables (diagnostics are
logged; conflicts are marked validation_status = 'conflicting').
"""

from __future__ import annotations

import logging
from collections import Counter
from typing import Any, Dict, List, Tuple

import provider_router
from db import fetch_one, has_consent
from jobs import Job, NeedsReview
from resume import deterministic, llm
from resume.deterministic import Candidate
from resume.intake import IntakeError, intake
from resume.persist import persist
from resume.quality import is_text_usable, needs_whole_document, text_stats
from resume.text import Document, OcrUnavailable, extract
from resume.vision import render_pages
from storage import read_object

log = logging.getLogger("worker.resume")

# Groups retried without textual hints when we only have page images.
VISION_RETRY_GROUPS = ("experience", "projects", "certifications")


def process_resume_extract(conn: Any, job: Job) -> None:
    file_id = job.payload.get("fileId")
    with conn, conn.cursor() as cur:
        file = fetch_one(
            cur,
            "SELECT id, storage_key, mime, sha256 FROM files WHERE id = %s AND user_id = %s",
            (file_id, job.user_id),
        )
        consent = has_consent(cur, job.user_id, "external_ai")
    if not file:
        raise NeedsReview(f"file {file_id} not found for this user")

    data = read_object(file["storage_key"])  # storage errors propagate and are retried
    facts, doc, diag = extract_facts(data, file["mime"], file["sha256"], consent)
    if not facts:
        raise NeedsReview(diag.get("reason") or "nothing could be extracted from this file")

    with conn, conn.cursor() as cur:  # Stage 6 — persist
        n = persist(cur, job.user_id, doc, facts)
    log.info("file %s: saved %d facts %s via %s; methods=%s", file_id, n,
             dict(Counter(f.group for f in facts)), diag["tier"], dict(Counter(f.method for f in facts)))


def extract_facts(data: bytes, mime: str, sha256: str, consent: bool) -> Tuple[List[Candidate], Document, Dict[str, Any]]:
    """Stages 1–5 without the database: used by the job handler and benchmark_kaggle.py."""
    try:
        info = intake(data, mime, sha256)  # Stage 1
    except IntakeError as exc:
        raise NeedsReview(f"intake: {exc}") from exc

    doc = _best_text(data, info.kind)  # Stage 2
    usable = is_text_usable(doc.text)
    diag: Dict[str, Any] = {
        "kind": info.kind, "chars": len(doc.text), "usable": usable, "blank_ratio": round(doc.blank_ratio, 2),
        "ocr": doc.used_ocr, "consent": consent, "retried": [], "rules_only": [],
    }
    log.info("%s, %d chars, usable=%s, blank blocks=%.0f%% %s", info.kind, len(doc.text), usable, doc.blank_ratio * 100,
             {k: round(v, 2) if isinstance(v, float) else v for k, v in text_stats(doc.text).items()})

    candidates, sections = deterministic.run(doc.text) if doc.text else ([], [])  # Stage 3
    diag["sections"] = sorted({s.group for s in sections})
    images: List[str] = []

    if not consent:
        diag["tier"] = "rules"
        facts = list(candidates)
    else:  # Stages 4 + 5
        reason = needs_whole_document(usable, doc.blank_ratio, candidates)
        diag["reason"] = reason
        if reason:
            images = render_pages(data, info.kind) if (not usable or doc.blank_ratio > 0 or not doc.text) else []
            facts, diag["tier"] = _whole_document(doc, sections, candidates, usable, images, diag)
        else:
            facts, diag["tier"] = _section_recovery(doc, candidates, sections), "sections"
        facts = _retry_missing(doc, sections, facts, images if not usable else [], diag)

    # Rules-only entries for sections that still have nothing.
    present = {f.group for f in facts}
    missing = tuple(g for g in deterministic.GENERIC_GROUPS if g not in present)
    if missing:
        extra = deterministic.section_entries(doc.text, sections, missing)
        diag["rules_only"] = sorted({c.group for c in extra})
        facts = facts + extra
    return facts, doc, diag


def _best_text(data: bytes, kind: str) -> Document:
    """Text layer first; for PDFs with a garbage layer, OCR every page instead."""
    try:
        doc = extract(data, kind)
    except OcrUnavailable as exc:  # an image upload on a worker without Tesseract
        log.warning("%s; continuing without text", exc)
        return Document([], [])
    except Exception as exc:  # corrupt or encrypted files: not retryable
        raise NeedsReview(f"could not read {kind}: {type(exc).__name__}: {exc}") from exc

    if kind == "pdf" and not is_text_usable(doc.text):
        try:
            ocr = extract(data, "pdf", force_ocr=True)
            log.info("text layer unusable; OCR gave %d chars (usable=%s)", len(ocr.text), is_text_usable(ocr.text))
            if is_text_usable(ocr.text) or len(ocr.text.split()) > len(doc.text.split()):
                return ocr
        except OcrUnavailable as exc:
            log.warning("text layer unusable and %s", exc)
    return doc


def _whole_document(doc: Document, sections, candidates: List[Candidate], usable: bool, images: List[str], diag: Dict[str, Any]):
    """One AI pass over the whole resume (vision when we have pages); per-section chunks if it fails."""
    try:
        if images:
            log.info("multimodal: %d page image(s) to vision models", len(images))
            return llm.merge(candidates, llm.extract_full(doc, True, images, report=diag)), "vision"
        if usable:
            return llm.merge(candidates, llm.extract_full(doc, True, report=diag)), "full-text"
    except provider_router.NeedsReviewError as exc:
        log.warning("whole-document extraction failed (%s); falling back to per-section chunks", exc)
    if usable or sections:
        return llm.merge(candidates, llm.chunked(doc, sections, True)), "chunked"
    return list(candidates), "rules"


def _section_recovery(doc: Document, candidates: List[Candidate], sections) -> List[Candidate]:
    """Normal path: rules, then LLM only for thin groups, section text only."""
    recovered: List[Candidate] = []
    failures = 0
    plan = llm.plan_recovery(doc, candidates, sections)
    for group, start, end in plan:
        try:
            recovered.extend(llm.recover(doc, group, start, end, True))
        except (provider_router.NeedsReviewError, Exception) as exc:
            failures += 1
            log.warning("LLM recovery for %s failed: %s", group, exc)
    facts = llm.merge(candidates, recovered)
    if plan and failures == len(plan) and len(facts) < 3:
        raise NeedsReview("LLM providers unavailable and too little found deterministically")
    return facts


def _retry_missing(doc: Document, sections, facts: List[Candidate], images: List[str], diag: Dict[str, Any]) -> List[Candidate]:
    """Retry sections the text clearly mentions (or, image-only, the core ones) that came back empty."""
    if images:
        # No text to look for hints in: retry only core groups the model left
        # out entirely. An explicit [] is its answer that the section is absent
        # (the prompt requires []), so re-asking would only add cost.
        have = {f.group for f in facts}
        omitted = set(diag.get("omitted", VISION_RETRY_GROUPS))
        groups = [g for g in VISION_RETRY_GROUPS if g not in have and g in omitted]
    else:
        groups = llm.missing_hinted_groups(doc.text, facts)
    for group in groups:
        try:
            got = llm.targeted(doc, sections, group, True, images)
        except (provider_router.NeedsReviewError, Exception) as exc:
            log.warning("targeted retry for %s failed: %s", group, exc)
            continue
        diag["retried"].append(f"{group}:{len(got)}")
        log.info("targeted retry for %s: %d facts", group, len(got))
        facts = llm.merge(facts, got)
    return facts
