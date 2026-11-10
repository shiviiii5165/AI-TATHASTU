"""Portfolio / personal site: Firecrawl → markdown → the resume pipeline's own
extractors (rules always; the LLM pass only with external_ai consent), with the
same evidence verification against the scraped markdown."""

from __future__ import annotations

import logging
from typing import Any, List

import ai_budget
import provider_router
from connectors.common import Facts, HttpError, finish_sync, http_json, load_connection, set_status
from db import EXTERNAL_AI_FULL_SCOPE_SINCE, has_consent
from jobs import Job, NeedsReview
from provider_router import KeyPool
from resume import deterministic, llm
from resume.deterministic import Candidate
from resume.text import Block, Document

log = logging.getLogger("worker.portfolio")

_pool = None


def _keys() -> KeyPool:
    global _pool
    if _pool is None:
        _pool = KeyPool("firecrawl", "FIRECRAWL_KEYS")
    return _pool


def scrape(url: str) -> str:
    """Markdown of the page's main content, rotating Firecrawl keys on 429/402 (credits)."""
    pool = _keys()
    for _ in range(max(len(pool.keys), 1)):
        key = pool.acquire()
        if key is None:
            break
        reservation = ai_budget.reserve_flat("firecrawl", "portfolio_scrape", ai_budget.flat_cost("AI_FIRECRAWL_CALL_USD", ai_budget.FIRECRAWL_CALL_USD), 90)
        try:
            out = http_json("POST", "https://api.firecrawl.dev/v1/scrape", {"Authorization": f"Bearer {key.secret}"},
                            {"url": url, "formats": ["markdown"], "onlyMainContent": True}, timeout=90)
            ai_budget.settle_used(reservation)
            return ((out or {}).get("data") or {}).get("markdown") or ""
        except HttpError as exc:
            ai_budget.settle_rejected(reservation)
            if exc.status in (402, 429):
                pool.report(key, 429, 600 if exc.status == 402 else 60)
                continue
            if exc.status in (401, 403):
                pool.report(key, 401)
                continue
            raise
        except Exception:
            ai_budget.settle_used(reservation)  # A timeout may have been billed. A second settle does nothing.
            raise
    raise RuntimeError("no Firecrawl key available (all rate limited or out of credits)")


def to_document(markdown: str) -> Document:
    return Document([Block(p.strip(), None, None) for p in markdown.split("\n\n") if p.strip()], [])


def candidates_to_facts(cands: List[Candidate], facts: Facts, prefix: str) -> Facts:
    for c in cands:
        facts.add(c.group, c.field, c.value, c.evidence, c.record_key, confidence=round(c.confidence, 3),
                  method=f"{prefix}+{c.method}", validation=c.validation)
    return facts


def sync_portfolio(conn: Any, job: Job) -> None:
    loaded = load_connection(conn, job, "portfolio")
    if not loaded:
        return
    row, cred = loaded
    with conn, conn.cursor() as cur:
        # Portfolio analysis is disclosed from EXTERNAL_AI_FULL_SCOPE_SINCE; an earlier resume-only grant doesn't cover it.
        consent = has_consent(cur, job.user_id, "external_ai", min_version=EXTERNAL_AI_FULL_SCOPE_SINCE)
    try:
        markdown = scrape(cred["url"])
    except HttpError as exc:
        set_status(conn, row["id"], "failed")
        if 400 <= exc.status < 500:
            raise NeedsReview(f"Firecrawl couldn't fetch {cred['url']}: {exc}") from exc
        raise
    if len(markdown.split()) < 20:
        set_status(conn, row["id"], "failed")
        raise NeedsReview("the site returned almost no readable text")

    doc = to_document(markdown)
    cands, _ = deterministic.run(doc.text)
    if consent:
        try:
            cands = llm.merge(cands, llm.extract_full(doc, consent))
        except provider_router.NeedsReviewError as exc:
            log.warning("portfolio LLM extraction failed, keeping rule-based facts: %s", exc)
    else:
        log.info("portfolio: no external_ai consent; rule-based extraction only")
    facts = candidates_to_facts(cands, Facts(job.user_id, "portfolio", "firecrawl"), "firecrawl")
    facts.add("contact", "website", cred["url"], f"Portfolio {cred['url']}")
    finish_sync(conn, job, row["id"], "portfolio", facts)
