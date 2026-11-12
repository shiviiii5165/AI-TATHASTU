"""Pins the synthetic evaluation's result, so a scoring change has to be looked at. See intelligence/evaluation.py:
these expectations are one engineer's judgement, not hiring or assessment outcomes."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from intelligence.evaluation import CASES, ROLE_PROFILES, evaluate, run  # noqa: E402


class Evaluation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.report = evaluate()

    def test_known_disagreements_are_exactly_these(self):
        # Engine v4 no longer credits a topic tag as use (the old topic_tagging/Kubernetes false positive is gone: a tag
        # alone stops at Working). Private code we can't read remains a real limit, documented in SCORING_MODEL.md.
        self.assertEqual(self.report["false_positives"], [])
        self.assertEqual(self.report["false_negatives"], ["private_code_senior/Java"])

    def test_every_group_is_represented(self):
        self.assertEqual({c.group for c in CASES}, {"beginner", "intermediate", "experienced", "conflicting"})

    def test_role_coverage_never_falls_as_evidence_grows(self):
        self.assertTrue(self.report["ranking_consistent"], self.report["coverage"])
        self.assertLess(self.report["coverage"]["beginner"], self.report["coverage"]["experienced"])

    def test_same_evidence_gives_the_same_answer(self):
        facts, repos = ROLE_PROFILES["experienced"]
        self.assertEqual(run(facts, repos)["skills"], run(facts, repos)["skills"])

    def test_more_of_the_same_evidence_never_lowers_a_score(self):
        for count in range(1, 8):
            fewer = run([], [{**ROLE_PROFILES["experienced"][1][0], "id": f"r{i}"} for i in range(count)])
            more = run([], [{**ROLE_PROFILES["experienced"][1][0], "id": f"r{i}"} for i in range(count + 1)])
            scores = {s["name"]: s["proficiency"] for s in more["skills"]}
            for skill in fewer["skills"]:
                self.assertGreaterEqual(scores[skill["name"]], skill["proficiency"])

    def test_known_limit_confidence_counts_kinds_of_source_not_amount(self):
        # Pinned so it stays visible: a bare claim and eight large repositories both read 0.35.
        by_case = {(r["case"], r["skill"]): r for r in self.report["rows"]}
        self.assertEqual(by_case[("resume_list_only", "Python")]["confidence"], 0.35)
        self.assertEqual(by_case[("metadata_only_senior", "Python")]["confidence"], 0.35)


if __name__ == "__main__":
    unittest.main()
