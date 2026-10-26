"""Unit tests for the pure parts of the worker (no DB, no network).

Run from worker/:  python -m unittest discover -s tests -v
"""

from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import provider_router  # noqa: E402
from intelligence import eris, projects, widgets  # noqa: E402
from resume import deterministic, llm, verify  # noqa: E402
from resume.text import Block, Document  # noqa: E402

RESUME = """PRIYA SHARMA
Bengaluru, India | priya.sharma@example.edu | +91 98765 43210
linkedin.com/in/priya-sharma | github.com/priyasharma
Education
Indian Institute of Technology Madras
B.Tech in Computer Science, CGPA 8.7/10
Jul 2021 - May 2025
Experience
Research Intern, Sample Labs
Jun 2024 - Aug 2024
Built a RAG evaluation harness in Python and PyTorch.
Projects
PaperQA Lite - question answering over arXiv using FAISS and FastAPI
github.com/priyasharma/paperqa-lite
Skills
Python, PyTorch, SQL, Docker, Go, scikit-learn
"""


def doc_of(text: str) -> Document:
    return Document([Block(p, 1, (0, 0, 100, 10)) for p in text.split("\n")], [])


class DeterministicTests(unittest.TestCase):
    def setUp(self) -> None:
        self.doc = doc_of(RESUME.strip())
        self.cands, self.sections = deterministic.run(self.doc.text)
        self.by = {(c.group, c.field): c for c in self.cands}

    def test_every_candidate_quotes_the_source_exactly(self) -> None:
        for c in self.cands:
            self.assertEqual(self.doc.text[c.start : c.end], c.evidence, (c.group, c.field))

    def test_sections(self) -> None:
        self.assertEqual([s.group for s in self.sections], ["education", "experience", "projects", "skills"])

    def test_contact(self) -> None:
        self.assertEqual(self.by[("contact", "email")].value, "priya.sharma@example.edu")
        self.assertEqual(self.by[("contact", "phone")].value, "+919876543210")
        self.assertEqual(self.by[("contact", "linkedin_url")].value, "https://linkedin.com/in/priya-sharma")
        self.assertEqual(self.by[("contact", "github_url")].value, "https://github.com/priyasharma")

    def test_date_range_is_not_a_phone(self) -> None:
        cands, _ = deterministic.run("Jane Doe\n2019 - 2023\nB.Tech")
        self.assertFalse([c for c in cands if c.field == "phone"])

    def test_name_from_all_caps_header(self) -> None:
        self.assertEqual(self.by[("identity", "full_name")].value, "Priya Sharma")

    def test_education_entry(self) -> None:
        edu = [c for c in self.cands if c.group == "education"]
        fields = {c.field: c.value for c in edu}
        self.assertIn("Indian Institute of Technology Madras", fields["institution"])
        self.assertEqual(fields["degree"], "B.Tech")
        self.assertEqual((fields["start_date"], fields["end_date"]), ("Jul 2021", "May 2025"))
        self.assertTrue(fields["grade"].startswith("CGPA 8.7"))
        self.assertEqual(len({c.record_key for c in edu}), 1)

    def test_skills_lexicon(self) -> None:
        skills = {c.value: c for c in self.cands if c.group == "skills"}
        self.assertTrue({"Python", "PyTorch", "SQL", "Docker", "scikit-learn", "Go"} <= set(skills))
        self.assertEqual(skills["Python"].confidence, deterministic.EXACT)  # found in Skills section
        # FAISS appears only in Projects; its alias maps to Vector Databases.
        self.assertEqual(skills["Vector Databases"].confidence, deterministic.LEXICON_OUTSIDE_SKILLS)

    def test_ambiguous_words_only_count_in_skills_section(self) -> None:
        cands, _ = deterministic.run("Experience\nWe had to go back and rest.\nSkills\nPython")
        names = {c.value for c in cands if c.group == "skills"}
        self.assertEqual(names, {"Python"})


    def test_inline_header_and_symbol_skills(self) -> None:
        cands, sections = deterministic.run("Arjun Mehta\nSkills | ROS, C++, OpenCV\nExperience\nWrote SQL daily")
        self.assertEqual([s.group for s in sections], ["skills", "experience"])
        skills = {c.value: c.confidence for c in cands if c.group == "skills"}
        self.assertEqual(skills["ROS"], deterministic.EXACT)
        self.assertEqual(skills["C++"], deterministic.EXACT)
        self.assertEqual(skills["SQL"], deterministic.LEXICON_OUTSIDE_SKILLS)  # acronym counts in prose


class VerifyTests(unittest.TestCase):
    SOURCE = "Research Intern, Sample Labs\nJun 2024 – Aug 2024\nBuilt a  RAG evaluation harness"

    def test_exact_after_normalization(self) -> None:
        s, e, ratio = verify.find_evidence(self.SOURCE, "Built a RAG evaluation harness")
        self.assertEqual(ratio, 1.0)
        self.assertEqual(self.SOURCE[s:e], "Built a  RAG evaluation harness")

    def test_dash_and_case_normalized(self) -> None:
        self.assertIsNotNone(verify.find_evidence(self.SOURCE, "jun 2024 - aug 2024"))

    def test_fuzzy_small_typo(self) -> None:
        hit = verify.find_evidence(self.SOURCE, "Built a RAG evaluaton harness")
        self.assertIsNotNone(hit)
        self.assertGreaterEqual(hit[2], verify.FUZZY_THRESHOLD)

    def test_fabricated_span_rejected(self) -> None:
        self.assertIsNone(verify.find_evidence(self.SOURCE, "Led a team of 12 engineers at Google"))

    def test_value_must_be_in_its_evidence(self) -> None:
        self.assertTrue(verify.value_supported("Sample Labs", "Research Intern, Sample Labs"))
        self.assertFalse(verify.value_supported("Google DeepMind", "Research Intern, Sample Labs"))

    def test_types(self) -> None:
        self.assertTrue(verify.type_valid("email", "a@b.co"))
        self.assertFalse(verify.type_valid("email", "not an email"))
        self.assertTrue(verify.type_valid("end_date", "Present"))
        self.assertFalse(verify.type_valid("start_date", "Summer"))


class FakeProvider(provider_router.Provider):
    def __init__(self, responses, keys=("k1",), name="fake", vision=False) -> None:
        self.name = name
        pool = provider_router.KeyPool(name, "UNUSED_ENV")
        pool.keys = [provider_router.Key(f"{name}_{i}", k) for i, k in enumerate(keys)]
        super().__init__(pool, [provider_router.Model("m", "strict", vision=vision)])
        self.responses = list(responses)
        self.used_keys = []
        self.calls = []

    def call(self, key, model, system, user, schema, images, timeout):
        self.used_keys.append(key.label)
        self.calls.append({"user": user, "images": list(images), "schema": schema})
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


class RouterTests(unittest.TestCase):
    def tearDown(self) -> None:
        provider_router.set_chain_for_tests(None)  # type: ignore[arg-type]

    def test_consent_required(self) -> None:
        with self.assertRaises(provider_router.ConsentRequired):
            provider_router.route_llm(system="", user="", schema={}, consent_granted=False, purpose="t")

    def test_rate_limited_key_cools_down_and_next_provider_used(self) -> None:
        first = FakeProvider([provider_router.RateLimited(60)])
        second = FakeProvider([{"entries": []}])
        provider_router.set_chain_for_tests([first, second])
        out = provider_router.route_llm(system="", user="", schema={}, consent_granted=True, purpose="t")
        self.assertEqual(out.data, {"entries": []})
        self.assertIsNone(first.pool.acquire())  # its only key is cooling down

    def test_all_fail_raises_needs_review(self) -> None:
        provider_router.set_chain_for_tests([FakeProvider([provider_router.AuthFailed("401")])])
        with self.assertRaises(provider_router.NeedsReviewError):
            provider_router.route_llm(system="", user="", schema={}, consent_granted=True, purpose="t")


    def test_groq_rate_limit_falls_back_to_gemini(self) -> None:
        groq = FakeProvider([provider_router.RateLimited(30)], name="groq")
        gemini = FakeProvider([{"entries": [1]}], name="gemini", vision=True)
        provider_router.set_chain_for_tests([groq, gemini])
        out = provider_router.route_llm(system="", user="x", schema={}, consent_granted=True, purpose="t")
        self.assertEqual((out.provider, out.data), ("gemini", {"entries": [1]}))
        self.assertEqual(len(groq.calls), 1)

    def test_key_rotation_after_rate_limit(self) -> None:
        groq = FakeProvider([provider_router.RateLimited(30), {"ok": 1}], keys=("a", "b"), name="groq")
        provider_router.set_chain_for_tests([groq])
        out = provider_router.route_llm(system="", user="", schema={}, consent_granted=True, purpose="t")
        self.assertEqual(out.data, {"ok": 1})
        self.assertEqual(groq.used_keys, ["groq_0", "groq_1"])  # a cooled down, b used

    def test_images_go_only_to_vision_models_gemini_first(self) -> None:
        groq = FakeProvider([{"never": 1}], name="groq")  # text-only
        openrouter = FakeProvider([{"or": 1}], name="openrouter", vision=True)
        gemini = FakeProvider([{"gem": 1}], name="gemini", vision=True)
        provider_router.set_chain_for_tests([groq, gemini, openrouter])
        out = provider_router.route_llm(system="", user="", schema={}, images=["aGk="], consent_granted=True, purpose="t")
        self.assertEqual(out.provider, "gemini")
        self.assertEqual(groq.calls, [])
        self.assertEqual(gemini.calls[0]["images"], ["aGk="])

    def test_retired_model_is_skipped_without_tripping_breaker(self) -> None:
        gone = FakeProvider([provider_router.ModelUnavailable("retired")], name="gemini", vision=True)
        gone.models.append(provider_router.Model("m2", "strict", vision=True))
        gone.responses.append({"ok": 1})
        provider_router.set_chain_for_tests([gone])
        out = provider_router.route_llm(system="", user="", schema={}, consent_granted=True, purpose="t")
        self.assertEqual((out.model, out.data), ("m2", {"ok": 1}))
        self.assertIn("m", gone.dead_models)
        self.assertTrue(gone.breaker.allow())
        self.assertEqual(len(gone.breaker.calls), 1)  # only m2's success was counted

    def test_model_spec_parsing_keeps_free_suffix(self) -> None:
        ms = provider_router.parse_models("nvidia/x:free:strict,gemini-2.5-flash,llama:json_object")
        self.assertEqual([(m.name, m.mode) for m in ms], [("nvidia/x:free", "strict"), ("gemini-2.5-flash", "json"), ("llama", "json")])

    def test_sanitize_strict_schema_ensures_additional_properties_false(self) -> None:
        raw_schema = {
            "type": "object",
            "properties": {
                "gaps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {"skill": {"type": "string"}},
                    },
                },
            },
        }
        sanitized = provider_router._sanitize_strict_schema(raw_schema)
        self.assertFalse(sanitized["additionalProperties"])
        self.assertIn("gaps", sanitized["required"])
        items = sanitized["properties"]["gaps"]["items"]
        self.assertFalse(items["additionalProperties"])
        self.assertIn("skill", items["required"])

    def test_needs_review_error_is_subclass_of_jobs_needs_review(self) -> None:
        from jobs import NeedsReview
        err = provider_router.NeedsReviewError("test")
        self.assertIsInstance(err, NeedsReview)
        self.assertIsInstance(err, provider_router.NeedsReviewError)


class LlmRecoveryTests(unittest.TestCase):
    def tearDown(self) -> None:
        provider_router.set_chain_for_tests(None)  # type: ignore[arg-type]

    def test_only_verified_fields_survive(self) -> None:
        doc = doc_of(RESUME.strip())
        _, sections = deterministic.run(doc.text)
        exp = next(s for s in sections if s.group == "experience")
        provider_router.set_chain_for_tests([FakeProvider([{"entries": [{
            "organization": {"value": "Sample Labs", "evidence_span": "Research Intern, Sample Labs"},
            "role": {"value": "Research Intern", "evidence_span": "Research Intern, Sample Labs"},
            "start_date": {"value": "Jun 2024", "evidence_span": "Jun 2024 - Aug 2024"},
            "end_date": {"value": "Aug 2024", "evidence_span": "Jun 2024 - Aug 2024"},
            # Invented: not in the resume at all.
            "description": {"value": "Managed a $2M budget", "evidence_span": "Managed a $2M budget"},
        }]}])])
        got = llm.recover(doc, "experience", exp.start, exp.end, consent=True)
        self.assertEqual({c.field for c in got}, {"organization", "role", "start_date", "end_date"})
        for c in got:
            self.assertEqual(doc.text[c.start : c.end], c.evidence)
            self.assertEqual(c.method, "llm:fake")

    def test_conflict_marks_both(self) -> None:
        det = [deterministic.Candidate("identity", "full_name", "Priya Sharma", "P", "P", 0, 1, confidence=0.75)]
        rec = [deterministic.Candidate("identity", "full_name", "Priya S.", "P", "P", 0, 1, method="llm:groq", confidence=0.7)]
        merged = llm.merge(det, rec)
        self.assertEqual([c.validation for c in merged], ["conflicting", "conflicting"])

    def test_agreement_raises_confidence(self) -> None:
        det = [deterministic.Candidate("identity", "full_name", "Priya Sharma", "P", "P", 0, 1, confidence=0.75)]
        rec = [deterministic.Candidate("identity", "full_name", "priya sharma", "P", "P", 0, 1, method="llm:groq", confidence=0.7)]
        merged = llm.merge(det, rec)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].confidence, 0.9)


class TextQualityTests(unittest.TestCase):
    def test_garbage_text_layer_is_unusable(self) -> None:
        from resume.quality import is_text_usable

        garbage = " ".join(["1"] * 600)  # what rudra beta CV.pdf's text layer extracts as
        self.assertFalse(is_text_usable(garbage))
        self.assertFalse(is_text_usable("1 1 1 1\n" * 80 + "Education Skills"))
        self.assertFalse(is_text_usable("Priya Sharma priya@x.co"))  # too short
        self.assertFalse(is_text_usable("%$# @@! ~~ ;; " * 40 + " experience"))  # symbol soup

    def test_real_resume_text_is_usable(self) -> None:
        from resume.quality import is_text_usable

        self.assertTrue(is_text_usable(RESUME))


    def test_whole_document_triggers(self) -> None:
        from resume.quality import needs_whole_document

        name = deterministic.Candidate("identity", "full_name", "A B", "A B", "A B", 0, 3)
        skill = deterministic.Candidate("skills", "skill", "Python", "Python", "Python", 0, 6)
        self.assertEqual(needs_whole_document(True, 0.0, [name, skill]), "")
        self.assertTrue(needs_whole_document(False, 0.0, [name]))
        self.assertTrue(needs_whole_document(True, 0.0, []))
        self.assertTrue(needs_whole_document(True, 0.3, [name]))  # unmapped-font header
        self.assertIn("no name or email", needs_whole_document(True, 0.0, [skill]))


class VisionTests(unittest.TestCase):
    def test_pdf_pages_render_to_valid_base64_png(self) -> None:
        import base64

        import fitz

        from resume.vision import MAX_PAGES, render_pages

        pdf = fitz.open()
        for i in range(MAX_PAGES + 2):
            pdf.new_page().insert_text((72, 72), f"Page {i}")
        imgs = render_pages(pdf.tobytes(), "pdf")
        self.assertEqual(len(imgs), MAX_PAGES)
        for b64 in imgs:
            self.assertTrue(base64.b64decode(b64, validate=True).startswith(b"\x89PNG\r\n\x1a\n"))

    def test_image_upload_is_normalized_to_png(self) -> None:
        import base64
        import io

        from PIL import Image

        from resume.vision import MAX_SIDE, render_pages

        buf = io.BytesIO()
        Image.new("RGB", (4000, 3000), "white").save(buf, format="JPEG")
        (b64,) = render_pages(buf.getvalue(), "image")
        img = Image.open(io.BytesIO(base64.b64decode(b64)))
        self.assertEqual(img.format, "PNG")
        self.assertLessEqual(max(img.size), MAX_SIDE)
        self.assertEqual(render_pages(b"x", "txt"), [])


class FullExtractionTests(unittest.TestCase):
    def tearDown(self) -> None:
        provider_router.set_chain_for_tests(None)

    def test_schema_covers_all_ten_groups_strictly(self) -> None:
        schema = llm.full_schema()
        self.assertEqual(len(schema["required"]), 10)
        self.assertEqual(set(schema["required"]), set(schema["properties"]))
        edu = schema["properties"]["education"]["items"]
        self.assertEqual(set(edu["required"]), set(edu["properties"]))  # strict: every field present
        self.assertFalse(edu["additionalProperties"])

    def test_vision_facts_are_verified_against_ocr_text_when_possible(self) -> None:
        ocr = doc_of("PRIYA SHARMA\npriya.sharma@example.edu\nIndian Institute of Technology Madras")
        response = {
            "identity": {"full_name": {"value": "Priya Sharma", "evidence_span": "PRIYA SHARMA"},
                         "headline": None, "location": None},
            "contact": {"email": {"value": "priya.sharma@example.edu", "evidence_span": "priya.sharma@example.edu"},
                        # Seen in the image but missing from the (partial) OCR text:
                        "phone": {"value": "+91 98765 43210", "evidence_span": "Phone: +91 98765 43210"},
                        "linkedin_url": None, "github_url": None, "website": None},
            "education": [{"institution": {"value": "IIT Madras", "evidence_span": "Indian Institute of Technology Madras"},
                           "degree": None, "field_of_study": None, "start_date": None, "end_date": None, "grade": None}],
            # Value not in its own quote: invented, must be dropped.
            "experience": [{"organization": {"value": "Google", "evidence_span": "Research Intern, Sample Labs"},
                            "role": None, "start_date": None, "end_date": None, "description": None}],
        }
        gemini = FakeProvider([response], name="gemini", vision=True)
        provider_router.set_chain_for_tests([gemini])
        got = {(c.group, c.field): c for c in llm.extract_full(ocr, True, images=["aGk="])}

        self.assertEqual(gemini.calls[0]["images"], ["aGk="])
        name = got[("identity", "full_name")]
        self.assertEqual((name.validation, name.confidence, name.method), ("validated", llm.CONF_VISION_MATCHED, "llm:gemini-vision"))
        self.assertEqual(ocr.text[name.start:name.end], "PRIYA SHARMA")
        phone = got[("contact", "phone")]
        self.assertEqual((phone.validation, phone.confidence, phone.start), ("unresolved", llm.CONF_VISION_UNMATCHED, -1))
        self.assertNotIn(("experience", "organization"), got)
        # "IIT Madras" isn't literally in its quote → not supported → dropped, not guessed.
        self.assertNotIn(("education", "institution"), got)

    def test_text_mode_rejects_unquoted_fields(self) -> None:
        doc = doc_of(RESUME.strip())
        provider_router.set_chain_for_tests([FakeProvider([{
            "identity": {"full_name": {"value": "Priya Sharma", "evidence_span": "PRIYA SHARMA"}, "headline": None, "location": None},
            "skills": [{"skill": {"value": "Rust", "evidence_span": "Rust"}}],  # not in the resume
        }], name="groq")])
        got = llm.extract_full(doc, True)
        self.assertEqual([(c.group, c.field, c.method) for c in got], [("identity", "full_name", "llm:groq")])


class ConnectorMappingTests(unittest.TestCase):
    """Pure mappers: API response shapes captured live (Oct 2026) → profile_facts rows."""

    def facts(self, origin):
        from connectors.common import Facts

        return Facts("u1", origin, f"api:{origin}")

    @staticmethod
    def rows(facts):
        # (group, field, record_key, normalized value)
        import json as _json

        return [(r[1], r[2], r[3], _json.loads(r[5])) for r in facts.rows]

    def test_linkedin_apify_item(self) -> None:
        from connectors.linkedin import NeedsReview, map_linkedin, quality_gate

        item = {
            "firstName": "Asha", "lastName": "Rao", "headline": "ML Engineer at Acme",
            "location": {"linkedinText": "Pune, Maharashtra, India"},
            "linkedinUrl": "https://www.linkedin.com/in/asha-rao", "websites": ["https://asha.dev"],
            "experience": [{"position": "ML Intern", "companyName": "Acme", "startDate": {"year": 2025, "text": "Jun 2025"},
                            "endDate": {"text": "Present"}, "description": "Built RAG pipelines"}],
            "education": [{"schoolName": "IIT Bombay", "degree": "B.Tech", "fieldOfStudy": "CSE",
                           "startDate": {"text": "2022"}, "endDate": {"text": "2026"}}],
            "skills": [{"name": "PyTorch"}, {"name": "Python"}], "topSkills": ["Python"],
            "certifications": [{"title": "TensorFlow Developer", "issuedBy": "Google", "issuedAt": "Jan 2025"}],
            "honorsAndAwards": [], "projects": [], "publications": [], "languages": [{"name": "Hindi", "proficiency": "Native"}],
        }
        quality_gate(item)
        got = self.rows(map_linkedin(item, self.facts("linkedin_scrape")))
        values = {(g, f): v for g, f, _k, v in got}
        self.assertEqual(values[("identity", "full_name")], "Asha Rao")
        self.assertEqual(values[("identity", "location")], "Pune, Maharashtra, India")
        self.assertEqual(values[("experience", "start_date")], "Jun 2025")
        self.assertEqual(values[("experience", "end_date")], "Present")
        self.assertEqual(values[("education", "institution")], "IIT Bombay")
        self.assertEqual(values[("certifications", "issuer")], "Google")
        self.assertEqual(sorted(v for g, f, _k, v in got if g == "skills"), ["PyTorch", "Python"])  # deduped
        with self.assertRaises(NeedsReview):
            quality_gate({"headline": "Sign in to view"})

    def test_leetcode_stats_and_skills(self) -> None:
        from connectors.coding_profiles import map_leetcode

        data = {"matchedUser": {"username": "asha", "profile": {"realName": "Asha"},
                                "submitStatsGlobal": {"acSubmissionNum": [{"difficulty": "All", "count": 180}, {"difficulty": "Easy", "count": 90},
                                                                          {"difficulty": "Medium", "count": 80}, {"difficulty": "Hard", "count": 10}]},
                                "languageProblemCount": [{"languageName": "Python3", "problemsSolved": 150}, {"languageName": "C++", "problemsSolved": 0}]},
                "userContestRanking": {"rating": 1712.4, "attendedContestsCount": 12, "topPercentage": 18.2}}
        f = map_leetcode(data, self.facts("leetcode"))
        stats_row = next(r for r in f.rows if r[3] == "leetcode:stats" and r[2] == "title")
        import json as _json

        self.assertEqual(_json.loads(stats_row[4])["medium"], 80)  # structured stats kept for ERIS
        self.assertIn("180 problems solved", _json.loads(stats_row[5]))
        skills = [v for g, fld, _k, v in self.rows(f) if g == "skills"]
        self.assertEqual(skills, ["Python3", "Data Structures and Algorithms"])  # C++ (0 solved) skipped

    def test_problem_solving_score(self) -> None:
        self.assertIsNone(eris.problem_solving_score([]))
        lc = {"record_key": "leetcode:stats", "extracted_value": {"easy": 90, "medium": 80, "hard": 10}}
        hr = {"record_key": "hackerrank:stats", "extracted_value": {"badges": {"Problem Solving": 5}}}
        self.assertAlmostEqual(eris.problem_solving_score([lc]), 0.7)  # (90 + 2*80 + 3*10) / 400
        self.assertEqual(eris.problem_solving_score([lc, hr]), 1.0)  # best of the two
        r = eris.score_role("ml_engineer", {"Python": 1.0}, [], problem_solving=0.65)
        self.assertEqual(r["breakdown"]["missing_components"], [])

    def test_stack_exchange_and_kaggle(self) -> None:
        from connectors.kaggle import map_kaggle
        from connectors.stack_exchange import map_stack_exchange

        se = map_stack_exchange("stackoverflow", {
            "user": {"link": "https://stackoverflow.com/users/1/asha", "reputation": 1234, "badge_counts": {"gold": 0, "silver": 2, "bronze": 9}},
            "tags": [{"tag_name": "machine-learning", "answer_count": 12, "answer_score": 30}]}, self.facts("stack_exchange"))
        values = self.rows(se)
        self.assertIn(("achievements", "title", "se:stackoverflow:reputation", "Stackoverflow reputation 1,234"), values)
        self.assertIn(("skills", "skill", "se-tag:machine-learning", "machine learning"), values)  # hyphens → alias-friendly

        kg = map_kaggle("asha", {"kernels": [{"ref": "asha/eda", "title": "EDA", "language": "python"}],
                                 "datasets": [{"ref": "asha/prices", "title": "Prices", "subtitle": "Daily prices"}],
                                 "competitions": [{"ref": "titanic", "title": "Titanic", "deadline": "2030-01-07T00:00:00Z"}]},
                        self.facts("kaggle"))
        values = self.rows(kg)
        self.assertIn(("projects", "url", "kaggle-kernel:asha/eda", "https://www.kaggle.com/code/asha/eda"), values)
        self.assertIn(("achievements", "date", "kaggle-competition:titanic", "2030-01-07"), values)
        self.assertIn(("skills", "skill", "kaggle-lang:Python", "Python"), values)


DENSE_RESUME = """Rohan Verma
rohan.verma@example.com | +91 99887 76655
Employment History
Data Analyst Intern, Finlytics Pvt Ltd
Jun 2024 - Aug 2024
- Automated weekly sales reports in Python, cutting prep time by 60%
- Built Power BI dashboards for 4 regional teams
Teaching Assistant, Department of Statistics
Jan 2024 - May 2024
- Ran weekly lab sessions for 80 students
Projects Undertaken
Loan Default Predictor
- XGBoost model on 50k loans, AUC 0.87
Licenses & Certifications
Google Data Analytics Certificate
Education
Delhi University
B.Sc Statistics, 2021 - 2024
Skills
Python, SQL, Power BI, Excel, XGBoost
"""


class RoutingFake(FakeProvider):
    """Answers by request content (first matching substring) instead of call order."""

    def __init__(self, routes) -> None:
        super().__init__([], name="groq")
        self.routes = routes

    def call(self, key, model, system, user, schema, images, timeout):
        self.calls.append({"user": user, "images": list(images), "schema": schema})
        return next(v for k, v in self.routes.items() if k in user)


class SectionCoverageTests(unittest.TestCase):
    def tearDown(self) -> None:
        provider_router.set_chain_for_tests(None)

    def test_more_headings_recognised(self) -> None:
        _, sections = deterministic.run(DENSE_RESUME)
        self.assertEqual([s.group for s in sections], ["experience", "projects", "certifications", "education", "skills"])

    def test_rules_only_entries_instead_of_nothing(self) -> None:
        _, sections = deterministic.run(DENSE_RESUME)
        got = deterministic.section_entries(DENSE_RESUME, sections)
        exp_roles = [c.value for c in got if c.group == "experience" and c.field == "role"]
        self.assertEqual(exp_roles, ["Data Analyst Intern, Finlytics Pvt Ltd", "Teaching Assistant, Department of Statistics"])
        self.assertIn(("projects", "title", "Loan Default Predictor"), [(c.group, c.field, c.value) for c in got])
        self.assertIn(("certifications", "name", "Google Data Analytics Certificate"), [(c.group, c.field, c.value) for c in got])
        for c in got:
            self.assertEqual(c.validation, "unresolved")
            self.assertEqual(DENSE_RESUME[c.start:c.end], c.evidence)  # still exact evidence
        dates = {(c.field, c.value) for c in got if c.group == "experience" and c.field.endswith("_date")}
        self.assertIn(("start_date", "Jun 2024"), dates)

    def test_normalize_full_reports_omissions(self) -> None:
        data, omitted = llm.normalize_full({"identity": {"full_name": {"value": "A", "evidence_span": "A"}}, "skills": []})
        self.assertEqual(set(data), set(llm.FIELD_GROUPS))
        self.assertIn("experience", omitted)
        self.assertNotIn("skills", omitted)  # [] is an answer, not an omission
        self.assertEqual(data["experience"], [])
        self.assertIsNone(data["contact"]["email"])

    def test_hints(self) -> None:
        self.assertEqual(llm.missing_hinted_groups("Summer internship at Acme Pvt Ltd", []), ["experience"])
        self.assertEqual(llm.missing_hinted_groups("hello world", []), [])

    def test_empty_experience_triggers_targeted_retry(self) -> None:
        from resume.extract import extract_facts

        text = ("Rohan Verma\nrohan.verma@example.com\nSummary\nAnalyst. " + "Worked on analytics problems. " * 8
                + "\nData Analyst Intern, Finlytics Pvt Ltd\nJun 2024 - Aug 2024\nSkills\nPython, SQL, Excel\n")
        retry = {"entries": [{"organization": {"value": "Finlytics Pvt Ltd", "evidence_span": "Data Analyst Intern, Finlytics Pvt Ltd"},
                              "role": {"value": "Data Analyst Intern", "evidence_span": "Data Analyst Intern, Finlytics Pvt Ltd"},
                              "start_date": {"value": "Jun 2024", "evidence_span": "Jun 2024 - Aug 2024"},
                              "end_date": None, "description": None}]}
        fake = RoutingFake({"Extract only the Experience": retry, "": {"entries": []}})
        provider_router.set_chain_for_tests([fake])
        import hashlib

        data = text.encode()
        facts, _doc, diag = extract_facts(data, "text/plain", hashlib.sha256(data).hexdigest(), consent=True)
        orgs = [c.value for c in facts if c.group == "experience" and c.field == "organization"]
        self.assertEqual(orgs, ["Finlytics Pvt Ltd"])
        self.assertTrue(any(r.startswith("experience:") for r in diag["retried"]))
        self.assertTrue(any("Extract only the Experience" in c["user"] for c in fake.calls))

    def test_no_consent_means_no_ai_but_still_entries(self) -> None:
        from resume.extract import extract_facts

        provider_router.set_chain_for_tests([FakeProvider([], name="groq")])
        import hashlib

        data = DENSE_RESUME.encode()
        facts, _doc, diag = extract_facts(data, "text/plain", hashlib.sha256(data).hexdigest(), consent=False)
        self.assertEqual(diag["tier"], "rules")
        self.assertEqual({"experience", "projects", "certifications"} - {f.group for f in facts}, set())
        self.assertTrue(all(not f.method.startswith("llm") for f in facts))


class VisionRetryPolicyTests(unittest.TestCase):
    def test_explicit_empty_is_not_retried_but_omission_is(self) -> None:
        from resume.extract import _retry_missing

        calls = []
        orig = llm.targeted
        llm.targeted = lambda doc, sections, group, consent, images=(): calls.append(group) or []
        try:
            diag = {"omitted": ["certifications"], "retried": []}  # model sent [] for experience & projects
            _retry_missing(doc_of(""), [], [], ["aGk="], diag)
        finally:
            llm.targeted = orig
        self.assertEqual(calls, ["certifications"])


class ProjectMatchingTests(unittest.TestCase):
    def test_cv_link_to_repo_matches(self) -> None:
        cv = projects.ProjectRecord("cv", "PaperQA Lite", "https://github.com/priya/paperqa-lite", {"Python"}, ["f1"])
        repo = projects.ProjectRecord("repo", "paperqa-lite", "https://github.com/priya/paperqa-lite", {"Python"}, ["g1"], repo_name="priya/paperqa-lite")
        other = projects.ProjectRecord("repo", "dotfiles", None, set(), ["g2"], repo_name="priya/dotfiles")
        out = projects.unify([cv, repo, other])
        matched = [u for u in out if u.status == "matched"]
        self.assertEqual(len(matched), 1)
        self.assertEqual(matched[0].canonical_title, "paperqa-lite")
        self.assertEqual(sorted(matched[0].fact_ids), ["f1", "g1"])
        self.assertEqual(len(out), 2)

    def test_compact_name_matches_camel_case(self) -> None:
        cv = projects.ProjectRecord("cv", "PaperQA Lite", None, set(), ["f1"])
        repo = projects.ProjectRecord("repo", "paperqa-lite", None, set(), ["g1"], repo_name="a/paperqa-lite")
        self.assertEqual(projects.signals(cv, repo), ["name"])

    def test_one_signal_is_not_enough(self) -> None:
        cv = projects.ProjectRecord("cv", "Chess Engine", None, {"C++"}, ["f1"])
        repo = projects.ProjectRecord("repo", "chess-engine", None, {"Rust"}, ["g1"], repo_name="a/chess-engine")
        self.assertTrue(all(u.status == "standalone" for u in projects.unify([cv, repo])))

    def test_name_plus_technologies(self) -> None:
        cv = projects.ProjectRecord("cv", "Chess Engine", None, {"C++", "CUDA"}, ["f1"])
        repo = projects.ProjectRecord("repo", "chess-engine", None, {"C++", "CUDA"}, ["g1"], repo_name="a/chess-engine")
        self.assertEqual(projects.unify([cv, repo])[0].status, "matched")


class ScoringTests(unittest.TestCase):
    def test_eris_renormalizes_missing_problem_solving(self) -> None:
        r = eris.score_role("ml_engineer", {"Python": 1.0, "Machine Learning": 1.0}, [["Python"]])
        self.assertEqual(r["breakdown"]["missing_components"], ["problem_solving"])
        tech = r["breakdown"]["components"]["technical"]
        proj = r["breakdown"]["components"]["projects"]
        self.assertAlmostEqual(r["score"], round((0.5 * tech + 0.25 * proj) / 0.75, 3), places=3)
        self.assertEqual(len(r["breakdown"]["gaps"]), 3)
        self.assertIsNone(eris.score_role("still_exploring", {}, []))

    def test_widget_order_follows_primary_priority(self) -> None:
        now = datetime.now(timezone.utc)
        data = {w: {"x": 1} for w in ("job_matches", "research_feed")}
        common = dict(role="ml_engineer", groups_with_data={"skills", "experience", "education"},
                      last_sync={"github": now - timedelta(hours=1)}, eligible={}, data=data, now=now)
        jobs_first = widgets.score_widgets(priorities=["avasar_jobs"], **common)
        research_first = widgets.score_widgets(priorities=["research_events"], **common)
        self.assertEqual(jobs_first[0]["id"], "job_matches")
        self.assertEqual(research_first[0]["id"], "research_feed")

    def test_empty_widgets_sort_last_even_with_top_score(self) -> None:
        now = datetime.now(timezone.utc)
        out = widgets.score_widgets(priorities=["avasar_jobs"], role="ml_engineer",
                                    groups_with_data={"skills", "experience", "education"}, last_sync={},
                                    eligible={}, data={"eris_readiness": {"score": 0.4}, "skill_gaps": {"gaps": []}}, now=now)
        states = [w["state"] for w in out]
        self.assertEqual(states, sorted(states, key=lambda s: s == "empty"))  # no ready widget after an empty one
        job = next(w for w in out if w["id"] == "job_matches")
        self.assertEqual(job["state"], "empty")
        self.assertGreater(job["score"], out[0]["score"])  # highest P(w), still placed below the ready ones

    def test_ineligible_and_stale(self) -> None:
        now = datetime.now(timezone.utc)
        out = widgets.score_widgets(priorities=["build_projects"], role=None, groups_with_data=set(),
                                    last_sync={"github": now - timedelta(days=30)},
                                    eligible={"eris_readiness": False}, data={"github_activity": {"repos": []}}, now=now)
        ids = {w["id"]: w for w in out}
        self.assertNotIn("eris_readiness", ids)
        self.assertEqual(ids["github_activity"]["state"], "stale")
        self.assertEqual(ids["github_activity"]["components"]["F"], 0.0)


class PersonaWidgetTests(unittest.TestCase):
    def _score(self, persona: str, intents):
        now = datetime.now(timezone.utc)
        # As in compute: GitHub activity only once GitHub is connected.
        return widgets.score_widgets(priorities=intents, role=None, persona=persona, groups_with_data=set(),
                                     last_sync={}, eligible={"github_activity": False}, data={}, now=now)

    def test_each_persona_gets_only_its_widgets(self) -> None:
        from intelligence.config import persona_intents
        faculty = self._score("faculty", persona_intents("faculty", {"mentorship": {"capacity": 3}}))
        alumni = self._score("alumni", persona_intents("alumni", {"give_back": {"refer": True}}))
        student = self._score("student", ["avasar_jobs"])
        self.assertEqual([w["id"] for w in faculty[:3]], ["student_matches", "mentee_requests", "research_feed"])
        self.assertEqual([w["id"] for w in alumni[:3]], ["top_talent", "referral_requests", "alumni_network"])
        self.assertTrue({"student_matches", "top_talent", "referral_requests"}.isdisjoint(w["id"] for w in student))
        self.assertNotIn("eris_readiness", {w["id"] for w in faculty + alumni})
        self.assertEqual({w["state"] for w in faculty[:2]}, {"preview"})  # not "empty", so not sorted last

    def test_persona_intents_follow_answers(self) -> None:
        from intelligence.config import persona_intents
        self.assertEqual(persona_intents("faculty", {"mentorship": {"capacity": 0}}), ["research"])
        self.assertEqual(persona_intents("faculty", {"mentorship": {"capacity": 2, "canReviewResumes": True}}),
                         ["mentoring", "reviewing", "research"])
        self.assertEqual(persona_intents("alumni", {"give_back": {"mentor": True}}), ["mentoring", "network"])
        self.assertEqual(persona_intents("student", {"priorities": ["learn_ai_ml"]}), ["learn_ai_ml"])
        # Alumni who only mentor: the network ranks above talent and referrals.
        top = self._score("alumni", persona_intents("alumni", {"give_back": {"mentor": True}}))[0]
        self.assertEqual(top["id"], "alumni_network")


class RegistrySyncTests(unittest.TestCase):
    def test_every_web_widget_is_scored_by_the_worker(self) -> None:
        """src/lib/dashboard/widgets.ts ids must exist in intelligence/config.py WIDGETS."""
        import re
        from intelligence.config import WIDGETS

        ts = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "..", "src", "lib", "dashboard", "widgets.ts")
        with open(ts) as f:
            web_ids = set(re.findall(r'^\s{4}id: "([a-z_]+)"', f.read(), re.M))
        self.assertTrue(web_ids, "no widget ids parsed from widgets.ts")
        self.assertEqual(web_ids - {w.id for w in WIDGETS}, set())


if __name__ == "__main__":
    unittest.main()
