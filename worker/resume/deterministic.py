"""Stage 3 — deterministic parsing: sections, contact details, education
entries, dates and lexicon skills. Every candidate carries the exact matched
substring as evidence and its char span in Document.text."""

from __future__ import annotations

import re
import unicodedata
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from profile_urls import classify as classify_url
from skills_catalog import CATALOG

# Regex-exact fields (email, URL) vs heuristics (name, institution).
EXACT = 0.95
HEURISTIC = 0.75
LEXICON_OUTSIDE_SKILLS = 0.8


@dataclass
class Candidate:
    group: str
    field: str
    value: Any  # normalized value (what we store as normalized_value)
    raw: str  # as written (extracted_value)
    evidence: str  # verbatim substring of Document.text
    start: int
    end: int
    method: str = "deterministic"
    confidence: float = EXACT
    record_key: Optional[str] = None
    validation: str = "validated"


@dataclass
class Section:
    group: str
    header: str
    start: int  # first char after the header line
    end: int

    def text(self, doc_text: str) -> str:
        return doc_text[self.start : self.end]


# ─── Sections ───────────────────────────────────────────────────────────────

HEADERS: Dict[str, str] = {
    "summary": "summary", "profile": "summary", "about me": "summary", "objective": "summary",
    "professional summary": "summary", "career objective": "summary",
    "education": "education", "academic background": "education", "academics": "education",
    "educational qualifications": "education", "qualifications": "education",
    "experience": "experience", "work experience": "experience", "professional experience": "experience",
    "employment": "experience", "internships": "experience", "internship": "experience",
    "work history": "experience", "experience and internships": "experience", "employment history": "experience",
    "work profile": "experience", "professional background": "experience", "career history": "experience",
    "relevant experience": "experience", "industry experience": "experience", "internship experience": "experience",
    "positions of responsibility": "experience", "leadership experience": "experience", "volunteer experience": "experience",
    "volunteering": "experience", "training and internships": "experience", "industrial training": "experience",
    "trainings": "certifications", "training": "certifications", "licenses and certifications": "certifications",
    "certifications and courses": "certifications", "courses and certifications": "certifications",
    "online courses": "certifications", "certificates and courses": "certifications",
    "personal information": "contact", "contact details": "contact", "links": "contact",
    "academic details": "education", "education and training": "education", "academic qualifications": "education",
    "projects undertaken": "projects", "major projects": "projects", "technical projects": "projects",
    "project experience": "projects", "project work": "projects", "research projects": "projects",
    "technical skills and tools": "skills", "key skills": "skills", "skills and interests": "skills",
    "core competencies": "skills", "competencies": "skills", "areas of expertise": "skills", "expertise": "skills",
    "extracurricular activities": "achievements", "extra curricular activities": "achievements",
    "co curricular activities": "achievements", "activities": "achievements", "scholarships": "achievements",
    "research publications": "publications", "papers and publications": "publications",
    "projects": "projects", "personal projects": "projects", "academic projects": "projects",
    "key projects": "projects", "selected projects": "projects",
    "skills": "skills", "technical skills": "skills", "core skills": "skills", "skill set": "skills",
    "technologies": "skills", "tools and technologies": "skills", "tech stack": "skills",
    "certifications": "certifications", "certificates": "certifications", "courses": "certifications",
    "achievements": "achievements", "awards": "achievements", "honors": "achievements",
    "honours": "achievements", "awards and achievements": "achievements", "accomplishments": "achievements",
    "publications": "publications", "research": "publications", "papers": "publications",
    "languages": "languages", "spoken languages": "languages",
    "contact": "contact", "contact information": "contact",
}


def _header_key(line: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z& ]", " ", line.lower()).replace("&", " and ")).strip()


INLINE_HEADER = re.compile(r"^\s*([A-Za-z& ]{3,40}?)\s*[:|]\s*(\S.*)$")


def find_sections(text: str) -> List[Section]:
    """
    Headers on their own line ("Skills") or inline ("Skills: Python, SQL",
    "Skills | ROS, C++" from a DOCX table). An inline header's section starts
    right after the delimiter.
    """
    found: List[Tuple[str, str, int, int]] = []  # group, header, line_start, content_start
    pos = 0
    for line in text.split("\n"):
        stripped = line.strip().rstrip(":")
        group = HEADERS.get(_header_key(stripped)) if 0 < len(stripped) <= 40 else None
        if group:
            found.append((group, stripped, pos, pos + len(line) + 1))
        else:
            m = INLINE_HEADER.match(line)
            group = HEADERS.get(_header_key(m.group(1))) if m else None
            if m and group:
                found.append((group, m.group(1).strip(), pos, pos + m.start(2)))
        pos += len(line) + 1
    sections = []
    for i, (group, header, _line_start, content_start) in enumerate(found):
        end = found[i + 1][2] if i + 1 < len(found) else len(text)
        sections.append(Section(group, header, content_start, end))
    return sections


def section_at(sections: List[Section], pos: int) -> Optional[Section]:
    return next((s for s in sections if s.start <= pos < s.end), None)


# ─── Patterns ───────────────────────────────────────────────────────────────

EMAIL = re.compile(r"(?<![\w.+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}(?![\w-])")
PHONE = re.compile(r"(?<![\w+])(\+?\d[\d\s().-]{7,18}\d)(?![\w])")
URL = re.compile(
    r"(?<![\w@])((?:https?://)?(?:www\.)?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:com|in|io|dev|ai|org|net|me|co|app|xyz|tech|page|site)(?:/[^\s,;|)]*)?)",
    re.IGNORECASE,
)
MONTHS = r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
DATE = rf"(?:{MONTHS}\.?\s+\d{{4}}|\d{{1,2}}/\d{{4}}|\d{{4}})"
DATE_RANGE = re.compile(
    rf"(?P<start>{DATE})\s*(?:-|–|—|to|till)\s*(?P<end>{DATE}|present|current|now|ongoing)", re.IGNORECASE
)

DEGREES = [
    r"B\.?\s?Tech", r"M\.?\s?Tech", r"B\.?\s?E\.?", r"M\.?\s?E\.?", r"B\.?\s?Sc", r"M\.?\s?Sc", r"B\.?\s?S\.?",
    r"M\.?\s?S\.?", r"B\.?\s?A\.?", r"M\.?\s?A\.?", r"BCA", r"MCA", r"MBA", r"Ph\.?\s?D", r"Dual Degree",
    r"Integrated M\.?\s?Tech", r"Bachelor(?:'s)? of [A-Z][A-Za-z ]+", r"Master(?:'s)? of [A-Z][A-Za-z ]+",
    r"Diploma(?: in [A-Z][A-Za-z ]+)?", r"Class (?:X|XII|10|12)(?:th)?", r"HSC", r"SSC",
]
DEGREE = re.compile(r"(?<![A-Za-z])(" + "|".join(DEGREES) + r")(?![A-Za-z])")
INSTITUTION = re.compile(
    r"((?:[A-Z][\w&.'-]*\s+){0,6}(?:University|Institute|College|School|Academy|Vidyalaya|Polytechnic)"
    r"(?:\s+(?:of|for)\s+(?:[A-Z][\w&.'-]*\s*){1,5})?(?:,\s*[A-Z][A-Za-z ]+)?|"
    r"(?:IIT|NIT|IIIT|BITS|IISc|IIM)\s*[A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]+)?)"
)
GRADE = re.compile(r"((?:CGPA|GPA|CPI|SGPA)\s*[:\-]?\s*\d+(?:\.\d+)?\s*(?:/\s*\d+(?:\.\d+)?)?|\d{2}(?:\.\d+)?\s*%)", re.IGNORECASE)
def _is_name_token(token: str) -> bool:
    """Capitalised word of letters (any script, so "Ånanya" and "शिवम" count) plus ' . -"""
    first = token[0]
    starts_ok = first.isalpha() and (first.isupper() or first.lower() == first.upper())  # caseless scripts
    return starts_ok and all(ch.isalpha() or ch in "'.-" or unicodedata.category(ch).startswith("M") for ch in token)


def _norm_phone(raw: str) -> Optional[str]:
    digits = re.sub(r"\D", "", raw)
    if not 10 <= len(digits) <= 15:
        return None
    return ("+" if raw.strip().startswith("+") else "") + digits


# ─── Extractors ─────────────────────────────────────────────────────────────


def extract_contact(text: str) -> List[Candidate]:
    out: List[Candidate] = []
    email = EMAIL.search(text)
    if email:
        out.append(Candidate("contact", "email", email.group(0).lower(), email.group(0), email.group(0), email.start(), email.end()))

    for m in PHONE.finditer(text):
        raw = m.group(1)
        if DATE_RANGE.search(raw) or re.fullmatch(r"\d{4}\s*[-–]\s*\d{4}", raw.strip()):
            continue  # "2019 - 2023" is a date range, not a phone
        phone = _norm_phone(raw)
        if phone:
            out.append(Candidate("contact", "phone", phone, raw, raw, m.start(1), m.end(1)))
            break

    seen = set()
    for m in URL.finditer(text):
        raw = m.group(1)
        if "@" in text[max(0, m.start() - 1) : m.start()]:
            continue
        field_name, norm = classify_url(raw)
        if field_name is None:
            continue  # repo or problem links belong to projects, not contact
        if field_name == "website" and not re.match(r"(https?://|www\.)", raw, re.I):
            continue  # bare "node.js"-style words aren't a personal site
        if field_name in seen:
            continue
        seen.add(field_name)
        out.append(Candidate("contact", field_name, norm, raw, raw, m.start(1), m.end(1)))
    return out


def extract_name(text: str) -> List[Candidate]:
    """First short line made only of capitalized words: usually the name."""
    pos = 0
    for line in text.split("\n")[:5]:
        tokens = line.strip().split()
        if (
            2 <= len(tokens) <= 4
            and all(_is_name_token(t) for t in tokens)
            and not HEADERS.get(_header_key(line))
        ):
            start = pos + line.index(tokens[0])
            raw = " ".join(tokens)
            if text[start : start + len(raw)] == raw:
                value = raw.title() if raw.isupper() else raw
                return [Candidate("identity", "full_name", value, raw, raw, start, start + len(raw), confidence=HEURISTIC)]
        pos += len(line) + 1
    return []


def extract_education(text: str, sections: List[Section]) -> List[Candidate]:
    """
    Groups lines into entries: a line opens a new entry only when it repeats a
    field the current entry already has (a second institution, a second
    degree). Dates and grades attach to the entry they follow.
    """
    out: List[Candidate] = []
    for section in (s for s in sections if s.group == "education"):
        key: Optional[str] = None
        have: set = set()
        pos = section.start
        for line in section.text(text).split("\n"):
            base = pos
            pos += len(line) + 1
            inst, degree = INSTITUTION.search(line), DEGREE.search(line)
            if key is None or (inst and "institution" in have) or (degree and not inst and "degree" in have):
                if not inst and not degree and key is None:
                    continue  # stray line before the first entry
                key, have = str(uuid.uuid4()), set()
            if inst and "institution" not in have:
                raw = inst.group(1).strip().rstrip(",")
                start = base + inst.start(1)
                out.append(Candidate("education", "institution", raw, raw, raw, start, start + len(raw), confidence=HEURISTIC, record_key=key))
                have.add("institution")
            if degree and "degree" not in have:
                raw = degree.group(1).strip()
                start = base + degree.start(1)
                out.append(Candidate("education", "degree", raw, raw, raw, start, start + len(raw), confidence=0.85, record_key=key))
                have.add("degree")
            for c in _dates_and_grade(line, base, key):
                if c.field not in have:
                    out.append(c)
                    have.add(c.field)
    return out


def _dates_and_grade(chunk: str, base: int, key: str) -> List[Candidate]:
    out = []
    dr = DATE_RANGE.search(chunk)
    if dr:
        ev = dr.group(0)
        for part in ("start", "end"):
            out.append(Candidate("education", f"{part}_date", dr.group(part), dr.group(part), ev,
                                 base + dr.start(), base + dr.end(), record_key=key))
    grade = GRADE.search(chunk)
    if grade:
        raw = grade.group(1)
        out.append(Candidate("education", "grade", raw.strip(), raw, raw, base + grade.start(1), base + grade.end(1), record_key=key))
    return out


# Short or common-word aliases only count inside a Skills section ("CV" is
# usually curriculum vitae, "rest" is usually a word).
SECTION_ONLY_WORDS = {"rest", "node", "shell", "spark", "triton", "github", "segmentation", "forecasting",
                      "algorithms", "data structures", "transformers", "statistics", "probability", "simulation"}


def _lexicon_patterns() -> List[Tuple[str, re.Pattern, bool]]:
    out = []
    for canonical, _cat, aliases, ambiguous in CATALOG:
        for name in [canonical, *aliases]:
            # Short all-letter forms ("cv", "ml", "py", "Go") are ambiguous unless written as a
            # 3+ letter acronym ("SQL", "AWS", matched case-sensitively below). "C++"/"C#" aren't.
            short_word = name.isalpha() and (len(name) <= 2 or (len(name) <= 3 and not name.isupper()))
            section_only = ambiguous or short_word or name.lower() in SECTION_ONLY_WORDS
            pattern = re.compile(r"(?<![\w+#.])" + re.escape(name) + r"(?![\w+#])", 0 if name.isupper() and len(name) <= 4 else re.IGNORECASE)
            out.append((canonical, pattern, section_only))
    return out


_PATTERNS = _lexicon_patterns()


def extract_skills(text: str, sections: List[Section]) -> List[Candidate]:
    found: Dict[str, Candidate] = {}
    for canonical, pattern, section_only in _PATTERNS:
        if canonical in found and found[canonical].confidence == EXACT:
            continue
        for m in pattern.finditer(text):
            sec = section_at(sections, m.start())
            in_skills = bool(sec and sec.group == "skills")
            if section_only and not in_skills:
                continue
            confidence = EXACT if in_skills else LEXICON_OUTSIDE_SKILLS
            prev = found.get(canonical)
            if not prev or confidence > prev.confidence:
                found[canonical] = Candidate("skills", "skill", canonical, m.group(0), m.group(0), m.start(), m.end(),
                                             confidence=confidence, record_key=str(uuid.uuid4()))
            if in_skills:
                break
    return list(found.values())


# Rules-only entries for sections the rules can't parse field by field. Used
# only when no AI result exists for the group (no consent / providers down):
# better an honest, user-reviewable entry than "NOTHING FOUND".
GENERIC_GROUPS = ("experience", "projects", "certifications", "achievements", "publications")
GENERIC_CONFIDENCE = 0.5
TITLE_FIELD = {"experience": "role", "projects": "title", "certifications": "name", "achievements": "title", "publications": "title"}
BULLET = re.compile(r"^\s*[-•▪◦*●○·➢►]\s*")


def section_entries(text: str, sections: List[Section], groups: Tuple[str, ...] = GENERIC_GROUPS) -> List[Candidate]:
    """
    Splits each section into entries: a new entry starts at a non-bullet line
    after a bullet/description line, or at a line with a date range once the
    current entry already has one. First line → title field, the rest →
    description, a date range → start/end dates. All 'unresolved', 0.5.
    """
    out: List[Candidate] = []
    for section in (s for s in sections if s.group in groups):
        entries: List[List[Tuple[str, int]]] = []
        current: List[Tuple[str, int]] = []
        saw_body = False
        pos = section.start
        for line in section.text(text).split("\n"):
            start = pos
            pos += len(line) + 1
            if not line.strip():
                continue
            is_bullet = bool(BULLET.match(line))
            has_dates = bool(DATE_RANGE.search(line))
            new_entry = current and not is_bullet and (saw_body or (has_dates and any(DATE_RANGE.search(l) for l, _ in current)))
            if new_entry:
                entries.append(current)
                current, saw_body = [], False
            current.append((line, start))
            saw_body = saw_body or is_bullet or len(line.split()) > 14
        if current:
            entries.append(current)

        for lines in entries:
            key = str(uuid.uuid4())
            group = section.group
            title_line, title_start = lines[0]
            title = BULLET.sub("", title_line).strip()
            t_off = title_start + title_line.index(title) if title in title_line else title_start
            out.append(Candidate(group, TITLE_FIELD[group], title[:200], title, title, t_off, t_off + len(title),
                                 confidence=GENERIC_CONFIDENCE, record_key=key, validation="unresolved"))
            body = [(l, s0) for l, s0 in lines[1:]]
            if body and group in ("experience", "projects", "achievements"):
                first_l, first_s = body[0]
                last_l, last_s = body[-1]
                evidence = text[first_s:last_s + len(last_l)]
                desc = " ".join(BULLET.sub("", l).strip() for l, _ in body)
                out.append(Candidate(group, "description", desc[:2000], evidence, evidence, first_s, last_s + len(last_l),
                                     confidence=GENERIC_CONFIDENCE, record_key=key, validation="unresolved"))
            for l, s0 in lines:
                m = DATE_RANGE.search(l)
                if m and group in ("experience",):
                    for part in ("start", "end"):
                        out.append(Candidate(group, f"{part}_date", m.group(part), m.group(part), m.group(0),
                                             s0 + m.start(), s0 + m.end(), confidence=GENERIC_CONFIDENCE, record_key=key,
                                             validation="unresolved"))
                    break
    return out


def run(text: str) -> Tuple[List[Candidate], List[Section]]:
    sections = find_sections(text)
    candidates = (
        extract_name(text)
        + extract_contact(text)
        + extract_education(text, sections)
        + extract_skills(text, sections)
    )
    return candidates, sections
