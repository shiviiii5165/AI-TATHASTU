"""ERIS — Intelligence Score (career_engine.alignment_score): formula, duplicates, weak evidence, missing data, and
real students through the whole engine. The dashboard shows this value; it never computes one itself."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from intelligence import career_engine as engine  # noqa: E402
from test_career_scenarios import ML_REPOS, project, run  # noqa: E402
from test_career_engine import fact  # noqa: E402


def row(skill, **kw):
    base = {"skill": skill, "tier": "required", "evidenceRequirement": "independent", "evidenceState": "demonstrated",
            "weight": 1.0, "expected": 50, "proficiency": 50, "state": "met"}
    base.update(kw)
    return base


def none(skill, **kw):
    return row(skill, **{"proficiency": None, "state": "missing", "evidenceState": "missing", **kw})


def score(rows, assessed=True, state="developing"):
    return engine.alignment_score(rows, assessed, state)


class Formula(unittest.TestCase):
    def test_weighted_share_of_the_framework_backed_by_evidence(self):
        self.assertEqual(score([row("Python"), row("SQL", proficiency=25, state="underdeveloped")])["value"], 75)
        self.assertEqual(score([row("A", weight=3), none("B", weight=1)])["value"], 75)

    def test_exceeding_the_expected_level_cannot_inflate_it(self):
        self.assertEqual(score([row("A", proficiency=100), none("B")])["value"], 50)

    def test_described_only_evidence_counts_half_where_independent_proof_is_required(self):
        self.assertEqual(score([row("A", evidenceState="unverified", state="unverified")])["value"], 50)
        self.assertEqual(score([row("A", evidenceRequirement="described", evidenceState="unverified")])["value"], 100)

    def test_claimed_suggested_and_missing_get_no_credit(self):
        rows = [row("A"), none("B", state="unverified", evidenceState="claimed"), none("C", state="inferred", evidenceState="inferred")]
        out = score(rows)
        self.assertEqual(out["value"], 33)
        self.assertEqual(out["counts"], {"evidenced": 1, "described": 0, "none": 2})

    def test_a_duplicated_competency_counts_once(self):
        self.assertEqual(score([row("Python"), row("python"), none("SQL")])["value"], 50)

    def test_no_score_instead_of_zero(self):
        self.assertIsNone(score([none("A"), none("B")]))
        self.assertIsNone(score([row("A")], assessed=False))
        self.assertIsNone(score([row("A")], state="not_enough_evidence"))
        self.assertIsNone(score([row("A", weight=0)]))
        self.assertIsNone(score([]))

    def test_required_and_supporting_breakdown(self):
        out = score([row("A"), none("B"), row("C", tier="supporting", evidenceState="unverified", state="unverified")])
        self.assertEqual(out["required"], {"score": 50, "competencies": 2})
        self.assertEqual(out["supporting"], {"score": 50, "competencies": 1})
        self.assertEqual(out["version"], engine.SCORE_VERSION)


class ThroughTheEngine(unittest.TestCase):
    def analysis(self, out):
        return out["roles"][0]

    def test_listed_skills_alone_give_no_score(self):
        out = run([fact("skills", "skill", "Python"), fact("skills", "skill", "PyTorch")] * 3)
        self.assertIsNone(self.analysis(out)["alignmentScore"])

    def test_nothing_at_all_gives_no_score(self):
        self.assertIsNone(self.analysis(run([]))["alignmentScore"])

    def test_resume_projects_score_lower_than_the_same_skills_in_repositories(self):
        described = run(project("p1", "Churn model", ["Python", "scikit-learn"], "Trained a model with scikit-learn"))
        shown = run([], ML_REPOS)
        d, s = self.analysis(described)["alignmentScore"], self.analysis(shown)["alignmentScore"]
        self.assertIsNotNone(s)
        if d is not None:
            self.assertLess(d["value"], s["value"])

    def test_score_is_stored_beside_alignment_and_never_replaces_it(self):
        a = self.analysis(run([], ML_REPOS))
        self.assertIn("alignment", a)
        self.assertIsInstance(a["alignmentScore"]["value"], int)
        self.assertTrue(0 <= a["alignmentScore"]["value"] <= 100)


if __name__ == "__main__":
    unittest.main()
