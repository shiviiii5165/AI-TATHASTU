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
from resume.fields import FIELD_GROUPS
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
    # Common academic/CV headings. "other" isn't extracted; it only ends the section before it,
    # so a References or Hobbies block can't be read as more publications or projects.
    "research statement": "summary", "statement of purpose": "summary", "personal statement": "summary",
    "distinctions": "achievements", "honors and awards": "achievements", "honours and awards": "achievements",
    "awards and honors": "achievements", "awards and honours": "achievements", "recognition": "achievements",
    "workshops": "certifications", "workshops attended": "certifications", "seminars": "certifications",
    "conferences and workshops": "certifications", "workshops and seminars": "certifications",
    "faculty development programmes": "certifications", "faculty development programs": "certifications",
    "professional development": "certifications", "trainings and workshops": "certifications",
    "book chapters": "publications", "conference papers": "publications", "journal papers": "publications",
    "teaching experience": "experience", "academic experience": "experience", "research experience": "experience",
    "references": "other", "referees": "other", "reference": "other", "declaration": "other",
    "hobbies": "other", "interests": "other", "research interests": "other", "areas of interest": "other",
    "professional membership": "other", "professional memberships": "other", "memberships": "other",
    "personal details": "contact", "personal profile": "summary", "strengths": "other",
    "languages known": "languages",
}


def header_group(line: str) -> Optional[str]:
    """Section group for a heading line, or None. "Achievements and Distinctions" or
    "Skills & Tools" fall back to their first part when the whole phrase isn't known."""
    key = _header_key(line)
    if not key:
        return None
    group = HEADERS.get(key)
    if group is None and " and " in key and _looks_like_heading(line):
        group = HEADERS.get(key.split(" and ", 1)[0])
    return group


_MINOR_WORDS = {"and", "of", "the", "in", "for", "to", "on", "with", "a", "an"}


def _looks_like_heading(line: str) -> bool:
    """ALL CAPS or Title Case with no sentence punctuation: "Achievements and Distinctions",
    not "Research and development of a parser."""
    if re.search(r"[.,;!?]\s*$|\d", line):
        return False
    words = re.findall(r"[A-Za-z]+", line)
    return bool(words) and all(w[0].isupper() or w.lower() in _MINOR_WORDS for w in words)


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
        group = header_group(stripped) if 0 < len(stripped) <= 50 and "|" not in stripped else None
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
# "Jun 2023", "10 Jun 2023", "June, 2023", "06/2023", "2023".
DATE = rf"(?:(?:\d{{1,2}}\s+)?{MONTHS}\.?,?\s+\d{{4}}|\d{{1,2}}/\d{{4}}|\d{{4}})"
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
            if CELL_SEP in line:
                if not _is_label_row(_cells(line)):
                    out.extend(_education_row(line, base))
                key, have = None, set()  # a table row is a whole entry; don't let later lines join it
                continue
            if NOTE_LINE.match(line):
                continue  # "M.Tech Dissertation: ..." describes an entry, it isn't one
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


NOTE_LINE = re.compile(r"^\s*[\w.() ]{0,30}?\b(?:dissertation|thesis|project|coursework|courses|minor|specialization)\s*:", re.IGNORECASE)
PAREN = re.compile(r"\(([^()]{3,80})\)")


def _education_row(line: str, base: int) -> List[Candidate]:
    """
    One education entry from a table row ("M.Tech (CSE) | LPU, Phagwara | 2024–2026 | CGPA 9.31").
    The institution is its whole cell (a regex over free text would cut "University Grants
    Commission" to "University"); the qualification is the first other cell, and a bracket after
    it is the field of study. Dates and grade come from the remaining cells.
    """
    key = str(uuid.uuid4())
    cells = _cells(line)
    out: List[Candidate] = []
    offsets, cursor = [], 0
    for cell in cells:
        idx = max(line.find(cell, cursor), 0)
        offsets.append(base + idx)
        cursor = idx + len(cell)

    def add(field_name: str, value: str, start: int, conf: float) -> None:
        out.append(Candidate("education", field_name, value, value, value, start, start + len(value), confidence=conf, record_key=key))

    inst_i = next((i for i, c in enumerate(cells) if INSTITUTION.search(c)), None)
    if inst_i is not None:
        value = PAREN.sub("", cells[inst_i]).strip(" ,")
        if value and value in cells[inst_i]:
            add("institution", value, offsets[inst_i] + cells[inst_i].index(value), HEURISTIC)
    qual_i = next((i for i, c in enumerate(cells) if i != inst_i and c and not _looks_like_date(c) and not GRADE.search(c)), None)
    if qual_i is not None:
        cell = cells[qual_i]
        m = DEGREE.search(cell)
        degree = m.group(1) if m else PAREN.sub("", cell).strip(" ,")
        if degree and degree in cell:
            add("degree", degree, offsets[qual_i] + cell.index(degree), 0.85 if m else HEURISTIC)
        paren = PAREN.search(cell)
        # "(Computer Science)" or a hyphenated stream like "(Non-Medical)"; not "(CBSE)" or "(2024)".
        if paren and (len(paren.group(1).split()) >= 2 or "-" in paren.group(1)) and not re.search(r"\d", paren.group(1)):
            study = " ".join(paren.group(1).split())
            if study in cell:
                add("field_of_study", study, offsets[qual_i] + cell.index(study), HEURISTIC)
    for i, cell in enumerate(cells):
        if i in (inst_i, qual_i):
            continue
        for c in _dates_and_grade(cell, offsets[i], key):
            if c.field not in {x.field for x in out}:
                out.append(c)
    return out if any(c.field in ("institution", "degree") for c in out) else []


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
# Numbered list items: "[3] R. Singh, ...", "2. Built ...", "(4) ...". Not "2024 – 2026" or "3.5 CGPA".
NUMBERED = re.compile(r"^\s*(?:\[\d{1,3}\]|\(\d{1,3}\)|\d{1,2}[.)](?!\d))\s+")
# A line ending like this finished its sentence; anything else may wrap onto the next line.
# Not ':' or ';': "Coordinator for CSE476:" and "crime scenarios;" wrap mid-sentence.
ENDS_SENTENCE = re.compile(r"[.!?]['\"”’)]*\s*$")
CELL_SEP = " | "  # resume/text.py writes table rows this way
WRAP_RATIO = 0.75


def _cells(line: str) -> List[str]:
    return [c.strip() for c in line.split(CELL_SEP)]


def _is_label_row(cells: List[str]) -> bool:
    """A table's column-label row: short cells, no digits, no lists ("Year", "Institution / Board")."""
    filled = [c for c in cells if c]
    return len(filled) >= 2 and all(len(c.split()) <= 4 and not re.search(r"[\d,;()@]", c) for c in filled)


# Which field a labelled column fills, per group: first pattern that matches the label wins.
COLUMN_FIELDS: Dict[str, List[Tuple[str, str]]] = {
    "certifications": [("date", r"date|year|when|duration|period"), ("issuer", r"issu|organi[sz]|\bby\b|provider|platform|institut|body|authority"),
                       ("name", r"certif|course|program|name|title|training|workshop|credential")],
    "achievements": [("date", r"date|year|when"), ("description", r"desc|detail|remark"), ("title", r"award|title|achiev|name|honou?r|position")],
    "publications": [("date", r"date|year"), ("url", r"doi|link|url"), ("venue", r"venue|journal|conference|publish|proceed|book"),
                     ("title", r"title|paper|article")],
    "experience": [("dates", r"date|period|duration|year|tenure"), ("organization", r"organi[sz]|company|employer|institut|firm"),
                   ("role", r"role|position|designation|title"), ("description", r"desc|responsib|work|detail")],
    "projects": [("technologies", r"tech|stack|tools"), ("url", r"link|url|repo"), ("description", r"desc|detail"), ("title", r"project|title|name")],
}
DATE_CELL = re.compile(r"[\w\s.,/–—-]{1,32}")
YEAR = re.compile(r"\b(?:19|20)\d{2}\b")


def _looks_like_date(cell: str) -> bool:
    return bool(DATE_CELL.fullmatch(cell) and YEAR.search(cell) and len(cell.split()) <= 6)


def _is_marker(line: str) -> bool:
    return bool(BULLET.match(line) or NUMBERED.match(line))


# Groups whose list items are the entries themselves; a short label over such a list
# ("Communicated", "International") groups entries and isn't one. In experience and
# projects the same short line over bullets is the entry's title.
ITEM_GROUPS = ("publications", "achievements", "certifications")


def _logical_lines(section_text: str, base: int, group: str = "") -> List[Tuple[str, int, int, bool]]:
    """
    Joins visual lines back into the lines the author wrote: (text, start, end, is_marker).

    PDF text wraps long bullets and titles onto several lines. A line continues the
    previous one when it isn't a list marker or a table row, and either it starts in
    lower case or the previous line ran to the text width (WRAP_RATIO of the longest
    line) without ending its sentence. Table rows (" | ") and
    date-only lines always stand alone. Short labels that introduce a list
    ("Communicated", "Book Chapters") are dropped.
    """
    raw: List[Tuple[str, int]] = []
    pos = base
    for line in section_text.split("\n"):
        if line.strip():
            raw.append((line, pos))
        pos += len(line) + 1
    # A wrapped line ran out of width: it is nearly as long as the longest line around it.
    # A short unpunctuated bullet ("Built dashboards for 4 teams") ended on its own.
    width = max((len(l.strip()) for l, _ in raw if "|" not in l), default=0)

    out: List[List] = []
    for i, (line, start) in enumerate(raw):
        stripped = line.strip()
        marker = _is_marker(line)
        nxt = raw[i + 1][0] if i + 1 < len(raw) else ""
        if (group in ITEM_GROUPS and not marker and _is_marker(nxt) and len(stripped.split()) <= 4 and not ENDS_SENTENCE.search(stripped)
                and not DATE_RANGE.search(stripped) and "|" not in stripped and not header_group(stripped)):
            continue  # a sub-heading over a list ("Communicated"), not an entry
        prev = out[-1] if out else None
        continues = (
            prev is not None and not marker and "|" not in stripped and "|" not in prev[0]
            and not DATE_RANGE.fullmatch(stripped.strip(" ()"))
            and (stripped[:1].islower()
                 or (not ENDS_SENTENCE.search(prev[0]) and prev[4] >= WRAP_RATIO * width))
        )
        if continues:
            prev[0] = prev[0].rstrip() + " " + stripped
            prev[2] = start + len(line)
            prev[4] = len(stripped)
        else:
            out.append([line, start, start + len(line), marker, len(stripped)])
    return [(t, s, e, m) for t, s, e, m, _ in out]


def _column_field(group: str, label: str) -> Optional[str]:
    for field_name, pattern in COLUMN_FIELDS.get(group, []):
        if re.search(pattern, label, re.IGNORECASE):
            return field_name
    return None


def _row_candidates(group: str, line: str, start: int, labels: Optional[List[str]]) -> List[Candidate]:
    """
    One entry from a table row. Columns are mapped by their labels when the table
    has a label row ("Certification | Issued by | Date"); otherwise the first cell
    is the title, a cell that is only a date is the date, and a certificate's
    second cell is its issuer. Unlabelled leftovers go to the description where
    the group has one. All 'unresolved', 0.5, like every section_entries fact.
    """
    key = str(uuid.uuid4())
    cells = _cells(line)
    fields: Dict[str, Tuple[str, int]] = {}
    offsets, cursor = [], 0
    for cell in cells:
        idx = line.find(cell, cursor)
        offsets.append(start + max(idx, 0))
        cursor = max(idx, 0) + len(cell)

    def put(field_name: str, i: int) -> None:
        if cells[i] and field_name not in fields:
            fields[field_name] = (cells[i], offsets[i])

    for i, cell in enumerate(cells):
        mapped = _column_field(group, labels[i]) if labels and i < len(labels) else None
        if mapped:
            put(mapped, i)
        elif i == 0:
            put(TITLE_FIELD[group], i)
        elif _looks_like_date(cell):
            put("dates" if group == "experience" else "date", i)
        elif group == "certifications" and i == 1:
            put("issuer", i)
        elif "description" in FIELD_GROUPS.get(group, []):
            put("description", i)

    out: List[Candidate] = []
    for field_name, (value, off) in fields.items():
        if field_name == "dates":
            m = DATE_RANGE.search(value)
            if m:
                for part in ("start", "end"):
                    out.append(Candidate(group, f"{part}_date", m.group(part), m.group(part), m.group(0), off + m.start(), off + m.end(),
                                         confidence=GENERIC_CONFIDENCE, record_key=key, validation="unresolved"))
            continue
        if field_name not in FIELD_GROUPS.get(group, []):
            continue
        out.append(Candidate(group, field_name, value[:200], value, value, off, off + len(value),
                             confidence=GENERIC_CONFIDENCE, record_key=key, validation="unresolved"))
    return out


def section_entries(text: str, sections: List[Section], groups: Tuple[str, ...] = GENERIC_GROUPS) -> List[Candidate]:
    """
    Splits each section into entries over its logical (unwrapped) lines.

    Flat lists, where the section opens with a list item (awards, publications,
    certificates as bullets or [1] [2]), give one entry per item. Otherwise a
    non-item line after an item or a long description line starts a new entry
    ("Role, Company" then its bullets), as does a second date range. First line →
    title field, the rest → description, a date range → start/end dates. All
    'unresolved', 0.5.
    """
    out: List[Candidate] = []
    for section in (s for s in sections if s.group in groups):
        logical = _logical_lines(section.text(text), section.start, section.group)
        flat = bool(logical) and logical[0][3]
        entries: List[List[Tuple[str, int]]] = []
        current: List[Tuple[str, int]] = []
        saw_body = False
        labels: Optional[List[str]] = None
        for line, start, end, is_item in logical:
            if CELL_SEP in line:
                # A table row is a whole entry by itself; a label row names the columns after it.
                if current:
                    entries.append(current)
                    current, saw_body = [], False
                cells = _cells(line)
                if _is_label_row(cells):
                    labels = cells
                else:
                    out.extend(_row_candidates(section.group, line, start, labels))
                continue
            has_dates = bool(DATE_RANGE.search(line))
            if flat:
                # In a list of items, an unmarked line belongs to the item above it.
                new_entry = bool(current) and is_item
            else:
                new_entry = bool(current) and not is_item and (
                    saw_body or (has_dates and any(DATE_RANGE.search(l) for l, _ in current)))
            if new_entry:
                entries.append(current)
                current, saw_body = [], False
            current.append((text[start:end], start))
            saw_body = saw_body or (is_item and not flat) or len(line.split()) > 14
        if current:
            entries.append(current)

        for lines in entries:
            key = str(uuid.uuid4())
            group = section.group
            title_line, title_start = lines[0]
            lead = len(title_line) - len(NUMBERED.sub("", BULLET.sub("", title_line), count=1).lstrip())
            raw_title = title_line[lead:].rstrip()  # may span wrapped lines; the value is unwrapped
            title = " ".join(raw_title.split())
            t_off = title_start + lead
            out.append(Candidate(group, TITLE_FIELD[group], title[:200], raw_title, raw_title, t_off, t_off + len(raw_title),
                                 confidence=GENERIC_CONFIDENCE, record_key=key, validation="unresolved"))
            # A line that is only a date range belongs to the dates, not the description.
            body = [(l, s0) for l, s0 in lines[1:] if not DATE_RANGE.fullmatch(l.strip(" ()"))]
            if body and group in ("experience", "projects", "achievements"):
                first_l, first_s = body[0]
                last_l, last_s = body[-1]
                evidence = text[first_s:last_s + len(last_l)]
                desc = " ".join(" ".join(BULLET.sub("", l).split()) for l, _ in body)
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
