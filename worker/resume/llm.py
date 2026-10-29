"""Stage 4 — LLM recovery, only for groups the deterministic pass left thin.

Only the relevant section's text is sent (never the whole resume), and only
with `external_ai` consent. Each returned field must quote its evidence; the
quote is verified in code (verify.py) before it becomes a candidate.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple

import provider_router
from resume import verify
from resume.deterministic import Candidate, Section
from resume.fields import FIELD_GROUPS, REPEATABLE
from resume.text import Document
from skills_catalog import alias_key

log = logging.getLogger("worker.resume.llm")

MAX_SECTION_CHARS = 6000
IDENTITY_CHARS = 1500
CONF_EXACT_SPAN = 0.7
CONF_FUZZY_SPAN = 0.6
# Groups that only exist as LLM output; recovered whenever their section exists.
LLM_ONLY = ("experience", "projects", "certifications", "achievements", "publications", "languages")

EVIDENCE_RULES = """Rules:
- Use only what is explicitly written. Never infer, guess, translate, summarize or fill gaps from general knowledge.
- For every field you extract, you MUST provide in "evidence_span" the exact verbatim quote from the resume that supports it, copied character-for-character (at most 200 characters), and the quote must contain the value. If you cannot find a quote, leave the field null.
- "value" is the field as written, trimmed. Keep dates as written (e.g. "Jun 2023", "Present").
- One entry per distinct item (one per degree, job, project, certification, award, publication...).
- Return EVERY key in the schema. If a single-value field is not written, use null. If a whole section (e.g. Experience) is absent from the resume, return an empty array [] for it. Never omit a key."""

SYSTEM = "You extract structured facts from one section of a student's resume.\n" + EVIDENCE_RULES

# Whole-document extraction: garbage text layers, scans and images (plan Stage 4 fallback).
FULL_SYSTEM = (
    "You are an expert resume parser. Read the attached resume and extract ALL information into the requested "
    "JSON schema: identity, contact and online presence (email, phone, LinkedIn, GitHub, LeetCode, HackerRank, "
    "Kaggle, ORCID, Stack Overflow profile links in their own fields; `website` only for a personal site/portfolio), education, "
    "experience, projects, skills, certifications, awards/achievements, publications and languages.\n" + EVIDENCE_RULES
)
VISION_USER = (
    "You are an expert resume parser. Read the attached resume image(s) and extract ALL information into the requested "
    "JSON schema. Scan every page completely, top to bottom and both columns if the layout has two: experience, "
    "internships, projects and certifications are often in the lower half or on later pages. Do not stop after the header."
)

# Words that show a section exists even when its heading isn't recognised.
SECTION_HINTS = {
    "experience": re.compile(r"\b(intern(ship)?|work(ed)? (at|as|with)|employ(ed|ment)|company|pvt\.? ?ltd|limited|llc|inc\.|"
                             r"responsibilit(y|ies)|role:|position|job|volunteer)\b", re.I),
    "projects": re.compile(r"\b(project|built|developed|implemented|designed|github\.com/[\w-]+/[\w-]+)\b", re.I),
    "certifications": re.compile(r"\b(certif(ied|icate|ication)|coursera|udemy|nptel|edx|datacamp|course completion|credential)\b", re.I),
    "achievements": re.compile(r"\b(award|winner|won|rank(ed)?|hackathon|medal|scholarship|achievement|finalist)\b", re.I),
    "publications": re.compile(r"\b(published|journal|conference|proceedings|arxiv|doi|ieee|springer)\b", re.I),
}
TARGETED_USER = "Extract only the {label} section from this resume, every entry. Return {{\"entries\": [...]}}; [] only if there truly is none."
TARGETED_VISION_USER = (
    "Look at the whole resume image(s), every page, top to bottom, both columns. Extract only the {label} section, "
    "every entry. Return {{\"entries\": [...]}}; [] only if there truly is none."
)
LABELS = {"experience": "Experience (jobs, internships, volunteering, positions of responsibility)",
          "projects": "Projects", "certifications": "Certifications and courses",
          "achievements": "Awards and achievements", "publications": "Publications"}
MAX_TARGETED_TEXT_CHARS = 12000
MAX_FULL_TEXT_CHARS = 15000
# Vision facts whose quote can't be found in any extracted text: kept for the
# user to check, never trusted (validation 'unresolved', low confidence).
CONF_VISION_MATCHED = 0.65
CONF_VISION_UNMATCHED = 0.4


FIELD_OBJ = {
    "anyOf": [
        {
            "type": "object",
            "additionalProperties": False,
            "required": ["value", "evidence_span"],
            "properties": {"value": {"type": "string"}, "evidence_span": {"type": "string"}},
        },
        {"type": "null"},
    ]
}


def _entry_schema(group: str) -> Dict[str, Any]:
    fields = FIELD_GROUPS[group]
    return {
        "type": "object",
        "additionalProperties": False,
        "required": fields,
        "properties": {f: FIELD_OBJ for f in fields},
    }


def full_schema() -> Dict[str, Any]:
    """All 10 groups: repeatable ones as arrays of entries, the rest as one object."""
    props = {g: ({"type": "array", "items": _entry_schema(g)} if g in REPEATABLE else _entry_schema(g)) for g in FIELD_GROUPS}
    return {"type": "object", "additionalProperties": False, "required": list(FIELD_GROUPS), "properties": props}


def schema_for(group: str) -> Dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["entries"],
        "properties": {
            "entries": {"type": "array", "items": _entry_schema(group)},
        },
    }


def plan_recovery(doc: Document, candidates: List[Candidate], sections: List[Section]) -> List[Tuple[str, int, int]]:
    """(group, start, end) slices of Document.text that need an LLM pass."""
    out: List[Tuple[str, int, int]] = []
    by_group: Dict[str, List[Candidate]] = {}
    for c in candidates:
        by_group.setdefault(c.group, []).append(c)

    def section_slices(group: str) -> List[Tuple[str, int, int]]:
        return [(group, s.start, min(s.end, s.start + MAX_SECTION_CHARS)) for s in sections if s.group == group and s.end > s.start]

    name = next((c for c in by_group.get("identity", []) if c.field == "full_name"), None)
    if not name or name.confidence < 0.85:
        out.append(("identity", 0, min(len(doc.text), IDENTITY_CHARS)))

    edu = by_group.get("education", [])
    complete = {c.record_key for c in edu if c.field == "institution"} & {c.record_key for c in edu if c.field == "degree"}
    if not complete:
        out.extend(section_slices("education"))

    if len(by_group.get("skills", [])) < 3:
        out.extend(section_slices("skills"))

    for group in LLM_ONLY:
        out.extend(section_slices(group))
    return out


def recover(doc: Document, group: str, start: int, end: int, consent: bool, user_prefix: str = "") -> List[Candidate]:
    source = doc.text[start:end]
    if not source.strip():
        return []
    result = provider_router.route_llm(
        system=SYSTEM,
        user=(user_prefix + "\n" if user_prefix else "")
        + f"Section: {group}\nFields: {', '.join(FIELD_GROUPS[group])}\n\nText:\n<<<\n{source}\n>>>",
        schema=schema_for(group),
        consent_granted=consent,
        purpose=f"resume:{group}",
        accept=lambda r: isinstance(r, dict) and isinstance(r.get("entries"), list),
    )

    method = f"llm:{result.provider}"
    out: List[Candidate] = []
    entries = result.data["entries"] if group in REPEATABLE else result.data["entries"][:1]
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        key = str(uuid.uuid4()) if group in REPEATABLE else None
        for field in FIELD_GROUPS[group]:
            item = entry.get(field)
            if not isinstance(item, dict):
                continue
            cand = _verified(source, start, group, field, item, key, method)
            if cand:
                out.append(cand)
    return out


def _verified(
    source: str, offset: int, group: str, field: str, item: Dict[str, Any], key: Optional[str], method: str
) -> Optional[Candidate]:
    value = str(item.get("value") or "").strip()
    span = str(item.get("evidence_span") or "")[: verify.MAX_SPAN]
    hit = verify.find_evidence(source, span)
    if not hit:
        log.info("rejected %s.%s: evidence not found in source", group, field)
        return None
    s, e, ratio = hit
    evidence = source[s:e]
    if not verify.value_supported(value, evidence):
        log.info("rejected %s.%s: value not supported by its evidence", group, field)
        return None
    if not verify.type_valid(field, value):
        log.info("rejected %s.%s: failed type check", group, field)
        return None
    return Candidate(
        group=group,
        field=field,
        value=value,
        raw=value,
        evidence=evidence,
        start=offset + s,
        end=offset + e,
        method=method,
        confidence=CONF_EXACT_SPAN if ratio == 1.0 else CONF_FUZZY_SPAN,
        record_key=key,
    )


def extract_full(doc: Document, consent: bool, images: Sequence[str] = (), report: Optional[Dict[str, Any]] = None) -> List[Candidate]:
    """
    One call for the whole resume: from page images (vision) when given,
    otherwise from the full text. Text results must quote the text exactly
    (same verification as section recovery). Vision results are checked
    against whatever text exists (OCR); a vision fact whose quote can't be
    found is kept only as low-confidence 'unresolved' for the user to verify,
    and only if its value appears in its own quote and passes type checks.
    """
    if images:
        result = provider_router.route_llm(
            system=FULL_SYSTEM, user=VISION_USER, schema=full_schema(), images=images,
            consent_granted=consent, purpose="resume:full:vision", accept=_is_full_shape,
        )
        method = f"llm:{result.provider}-vision"
    else:
        result = provider_router.route_llm(
            system=FULL_SYSTEM,
            user="Resume text:\n<<<\n" + doc.text[:MAX_FULL_TEXT_CHARS] + "\n>>>",
            schema=full_schema(), consent_granted=consent, purpose="resume:full:text", accept=_is_full_shape,
        )
        method = f"llm:{result.provider}"

    data, omitted = normalize_full(result.data)
    if report is not None:
        report["omitted"] = omitted
    if omitted:
        log.info("%s/%s omitted groups %s (treated as empty; retried if the text suggests them)", result.provider, result.model, omitted)
    out: List[Candidate] = []
    for group, fields in FIELD_GROUPS.items():
        raw = data[group]
        entries = raw if isinstance(raw, list) else [raw]
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            key = str(uuid.uuid4()) if group in REPEATABLE else None
            for field in fields:
                item = entry.get(field)
                if not isinstance(item, dict):
                    continue
                cand = _verified(doc.text, 0, group, field, item, key, method)
                if cand is None and images:
                    cand = _unmatched_vision(group, field, item, key, method)
                if cand is not None and images and cand.start >= 0:
                    cand.confidence = CONF_VISION_MATCHED
                if cand:
                    out.append(cand)
    return out


def _is_full_shape(r: Dict[str, Any]) -> bool:
    return isinstance(r, dict) and any(g in r for g in FIELD_GROUPS)


def normalize_full(data: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Code-side schema enforcement for a whole-document result (providers in
    JSON mode don't guarantee the schema): every group present with the right
    shape. Returns the normalized dict and the groups the model omitted.
    """
    out: Dict[str, Any] = {}
    omitted: List[str] = []
    for group, fields in FIELD_GROUPS.items():
        raw = data.get(group, None) if isinstance(data, dict) else None
        if group not in (data or {}):
            omitted.append(group)
        entries = raw if isinstance(raw, list) else [raw] if isinstance(raw, dict) else []
        clean = []
        for entry in entries:
            if isinstance(entry, dict):
                clean.append({f: (entry.get(f) if isinstance(entry.get(f), dict) else None) for f in fields})
        out[group] = clean if group in REPEATABLE else (clean[0] if clean else {f: None for f in fields})
    return out, omitted


def missing_hinted_groups(text: str, facts: List[Candidate]) -> List[str]:
    """Groups with no facts although the text shows signs of them: retry candidates."""
    have = {c.group for c in facts}
    return [g for g, rx in SECTION_HINTS.items() if g not in have and rx.search(text or "")]


def targeted(doc: Document, sections: List[Section], group: str, consent: bool, images: Sequence[str] = ()) -> List[Candidate]:
    """Retry one group alone: its detected section(s), else the whole text; or page images."""
    if images:
        result = provider_router.route_llm(
            system=FULL_SYSTEM, user=TARGETED_VISION_USER.format(label=LABELS[group]), schema=schema_for(group),
            images=images, consent_granted=consent, purpose=f"resume:retry:{group}:vision",
            accept=lambda r: isinstance(r, dict) and isinstance(r.get("entries"), list),
        )
        method = f"llm:{result.provider}-vision"
        out: List[Candidate] = []
        for entry in result.data["entries"]:
            if not isinstance(entry, dict):
                continue
            key = str(uuid.uuid4())
            for field in FIELD_GROUPS[group]:
                item = entry.get(field)
                if isinstance(item, dict):
                    cand = _verified(doc.text, 0, group, field, item, key, method) or _unmatched_vision(group, field, item, key, method)
                    if cand:
                        if cand.start >= 0:
                            cand.confidence = CONF_VISION_MATCHED
                        out.append(cand)
        return out

    slices = [(s.start, s.end) for s in sections if s.group == group and s.end > s.start]
    if not slices:
        slices = [(0, min(len(doc.text), MAX_TARGETED_TEXT_CHARS))]
    out = []
    for start, end in slices:
        out.extend(recover(doc, group, start, min(end, start + MAX_TARGETED_TEXT_CHARS), consent,
                           user_prefix=TARGETED_USER.format(label=LABELS[group])))
    return out


def chunked(doc: Document, sections: List[Section], consent: bool) -> List[Candidate]:
    """Whole-document extraction failed: extract each detected section on its own."""
    out: List[Candidate] = []
    for s in sections:
        if s.group in FIELD_GROUPS and s.group not in ("contact",) and s.end > s.start:
            try:
                out.extend(recover(doc, s.group, s.start, min(s.end, s.start + MAX_SECTION_CHARS), consent))
            except provider_router.NeedsReviewError as exc:
                log.warning("chunk %s failed: %s", s.group, exc)
    return out


def _unmatched_vision(group: str, field: str, item: Dict[str, Any], key: Optional[str], method: str) -> Optional[Candidate]:
    value = str(item.get("value") or "").strip()
    span = str(item.get("evidence_span") or "").strip()[: verify.MAX_SPAN]
    if not span or not verify.value_supported(value, span) or not verify.type_valid(field, value):
        log.info("rejected %s.%s (vision): unsupported or invalid", group, field)
        return None
    return Candidate(
        group=group, field=field, value=value, raw=value, evidence=span, start=-1, end=-1,
        method=method, confidence=CONF_VISION_UNMATCHED, record_key=key, validation="unresolved",
    )


def merge(deterministic: List[Candidate], recovered: List[Candidate]) -> List[Candidate]:
    """
    LLM output only fills gaps. Same field, same value: the deterministic fact
    gains confidence (two methods agree). Same field, different value: both
    are kept and marked `conflicting` for the user to resolve; neither wins.
    """
    out = list(deterministic)
    det_by_field = {(c.group, c.field): c for c in deterministic if c.group not in REPEATABLE}
    det_skills = {alias_key(str(c.value)) for c in deterministic if c.group == "skills"}
    det_edu = [c for c in deterministic if c.group == "education"]

    for c in recovered:
        if c.group not in REPEATABLE:
            existing = det_by_field.get((c.group, c.field))
            if not existing:
                out.append(c)
            elif verify.normalize(str(existing.value)) == verify.normalize(c.value):
                existing.confidence = max(existing.confidence, 0.9)
            else:
                existing.validation = c.validation = "conflicting"
                out.append(c)
        elif c.group == "skills":
            if alias_key(c.value) not in det_skills:
                det_skills.add(alias_key(c.value))
                out.append(c)
        elif c.group == "education":
            # Attach to a deterministic entry naming the same institution, if any.
            match = next(
                (d for d in det_edu if d.field == "institution" and c.field == "institution"
                 and verify.value_supported(d.value, c.value)),
                None,
            )
            if match:
                c_key = c.record_key
                for other in recovered:
                    if other.record_key == c_key:
                        other.record_key = match.record_key
                continue  # the institution itself is already there
            have = {(d.record_key, d.field) for d in out if d.group == "education"}
            if (c.record_key, c.field) not in have:
                out.append(c)
        else:
            out.append(c)
    return out
