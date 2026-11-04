"""The link checker's rules, with no network, and the recorded results the engine relies on."""

from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "worker"))

spec = importlib.util.spec_from_file_location("check_learning_links", ROOT / "scripts/check_learning_links.py")
checker = importlib.util.module_from_spec(spec)
sys.modules["check_learning_links"] = checker
spec.loader.exec_module(checker)

from intelligence import career_engine as engine  # noqa: E402

URL = "https://example.org/courses/deep-learning"
PAGE = "<html><head><title>Deep Learning Specialization</title></head><body>Deep Learning Specialization by Example</body></html>"


class Classify(unittest.TestCase):
    def status(self, http, final=URL, body=PAGE, url=URL, title="Deep Learning Specialization"):
        return checker.classify(title, url, http, final, body)

    def test_a_page_that_names_the_course_is_ok(self):
        self.assertEqual(self.status(200), "ok")

    def test_missing_pages(self):
        self.assertEqual(self.status(404), "dead")
        self.assertEqual(self.status(410), "dead")

    def test_a_200_page_saying_its_gone_is_dead(self):
        self.assertEqual(self.status(200, body="<title>Page not found</title>"), "dead")
        self.assertEqual(self.status(200, body="<title>Deep Learning</title><body>This course is no longer available</body>"), "dead")

    def test_a_bot_refusal_says_nothing_either_way(self):
        for code in (403, 429):
            self.assertEqual(self.status(code), "blocked")

    def test_no_response_is_unreachable(self):
        self.assertEqual(self.status(None, final=None, body=""), "unreachable")
        self.assertEqual(self.status(503), "unreachable")

    def test_a_redirect_to_another_page_is_not_trusted(self):
        self.assertEqual(self.status(200, final="https://example.org/courses/something-else"), "redirected")

    def test_a_redirect_to_the_homepage_is_generic(self):
        self.assertEqual(self.status(200, final="https://example.org/"), "generic")

    def test_a_trailing_slash_or_www_is_not_a_redirect(self):
        self.assertEqual(self.status(200, final=URL + "/"), "ok")
        self.assertEqual(self.status(200, final="https://www.example.org/courses/deep-learning"), "ok")

    def test_a_page_that_doesnt_name_the_course_is_unconfirmed(self):
        self.assertEqual(self.status(200, body="<title>Cooking</title><body>Recipes</body>"), "identity_unconfirmed")

    def test_a_front_page_counts_only_if_its_title_names_the_course(self):
        root = "https://example.org/"
        vague = "<title>Example University</title><body>Deep Learning Specialization and more</body>"
        self.assertEqual(self.status(200, url=root, final=root, body=vague), "generic")
        self.assertEqual(self.status(200, url=root, final=root, body=PAGE), "ok")

    def test_invalid_urls_never_get_fetched(self):
        for bad in ("http://example.org/x", "ftp://example.org/x", "https://user:pw@example.org/x", "https://127.0.0.1/x", "not a url"):
            self.assertEqual(checker.structure_problem(bad), "invalid", bad)


class Duplicates(unittest.TestCase):
    def test_the_second_entry_with_a_url_is_a_duplicate_and_costs_no_request(self):
        entries = [{"title": "A", "provider": "P", "url": URL}, {"title": "B", "provider": "P", "url": URL + "/"}]
        calls = []
        original, checker.fetch = checker.fetch, lambda url: calls.append(url) or (200, url, "<title>A</title>")
        pause, checker.PAUSE_S = checker.PAUSE_S, 0
        try:
            report = checker.check_all(entries, "2026-11-02")
        finally:
            checker.fetch, checker.PAUSE_S = original, pause
        self.assertEqual(len(calls), 1)
        self.assertEqual(report["resources"]["B"]["status"], "duplicate")
        self.assertEqual(report["resources"]["B"]["duplicateOf"], "A")

    def test_the_request_cap_holds(self):
        entries = [{"title": f"T{i}", "provider": "P", "url": f"https://example.org/{i}"} for i in range(checker.MAX_URLS + 5)]
        calls = []
        original, checker.fetch = checker.fetch, lambda url: calls.append(url) or (404, url, "")
        pause, checker.PAUSE_S = checker.PAUSE_S, 0
        try:
            report = checker.check_all(entries, "2026-11-02")
        finally:
            checker.fetch, checker.PAUSE_S = original, pause
        self.assertEqual(len(calls), checker.MAX_URLS)
        self.assertEqual(report["resources"][f"T{checker.MAX_URLS}"]["status"], "not_checked")


class RecordedResults(unittest.TestCase):
    def setUp(self):
        self.report = json.loads((ROOT / "worker/intelligence/resource_checks.json").read_text(encoding="utf-8"))

    def test_every_catalogue_entry_has_a_check_with_a_date_and_status(self):
        entries = checker.catalogue(checker.MIGRATION.read_text(encoding="utf-8"))
        self.assertEqual({e["title"] for e in entries}, set(self.report["resources"]))
        for record in self.report["resources"].values():
            self.assertTrue(record["checkedAt"])
            self.assertTrue(record["status"])

    def test_every_curated_course_is_a_real_catalogue_title(self):
        for courses in engine.COURSES.values():
            for title, _difficulty in courses:
                self.assertIn(title, self.report["resources"])


if __name__ == "__main__":
    unittest.main()
