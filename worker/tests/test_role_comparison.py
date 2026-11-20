"""Multi-role intelligence (workstream B): comparisons must agree with each role's own assessment and never invent transfer."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import golden_profiles as g  # noqa: E402
from intelligence.frameworks import CURRENT_ROLES, FRAMEWORKS  # noqa: E402
from test_career_engine import fact  # noqa: E402


def comp(out, role):
    return next(c for c in out["roleComparison"]["comparisons"] if c["role"] == role)


class SingleGoal(unittest.TestCase):
    def test_one_goal_has_no_comparison(self):
        f, r = g.advanced_practical("ml_engineer")
        self.assertIsNone(g.run(f, r, ["ml_engineer"])["roleComparison"])


class Consistency(unittest.TestCase):
    def test_every_pair_agrees_with_the_roles_own_rows(self):
        for primary in CURRENT_ROLES:
            others = [r for r in CURRENT_ROLES if r != primary][:3]
            f, r = g.advanced_practical(primary)
            out = g.run(f, r, [primary, *others])
            for other in others:
                c = comp(out, other)
                rows = {x["skill"]: x for x in g.analysis(out, other)["skills"]}
                pf = {q.competency for q in FRAMEWORKS[primary].requirements}
                with self.subTest(primary=primary, other=other):
                    self.assertTrue(set(c["transfers"]) <= {s["skill"] for s in c["shared"]})
                    self.assertTrue(all(rows[s]["state"] == "met" for s in c["transfers"] + c["alreadyCovered"]))
                    self.assertTrue(all(rows[s]["state"] != "met" for s in c["newToLearn"]))
                    self.assertFalse(set(c["newToLearn"]) & pf, "a competency the primary goal also needs is shared, not new")
                    self.assertEqual(c["counts"]["otherRequiredMet"], g.analysis(out, other)["alignment"]["requiredMet"])

    def test_required_new_competencies_come_first(self):
        f, r = g.advanced_practical("ml_engineer")
        c = comp(g.run(f, r, ["ml_engineer", "mlops_engineer"]), "mlops_engineer")
        tiers = [next(x for x in FRAMEWORKS["mlops_engineer"].requirements if x.competency == s).tier for s in c["newToLearn"]]
        self.assertEqual(tiers, sorted(tiers, key=lambda t: 0 if t == "required" else 1))


class Transfer(unittest.TestCase):
    def test_a_shared_skill_at_a_lower_level_is_a_level_to_raise_not_a_new_skill(self):
        # Statistics: ML Engineer expects Working, Data Scientist Proficient. One repository without tests reaches Working only.
        repos = [g.code_evidence_repo("analysis", ["Python", "Statistics"], quality=False)]
        out = g.run([], repos, ["ml_engineer", "data_scientist"])
        ml = {x["skill"]: x for x in g.analysis(out, "ml_engineer")["skills"]}
        c = comp(out, "data_scientist")
        self.assertEqual(ml["Statistics"]["state"], "met")
        self.assertIn("Statistics", c["raiseLevel"])
        self.assertNotIn("Statistics", c["newToLearn"])

    def test_shared_open_foundations_are_learned_once(self):
        facts = [fact("skills", "skill", s) for s in ("Python", "SQL", "Statistics")]
        out = g.run(facts, [], ["ml_engineer", "data_scientist", "ai_evaluation_safety_engineer"])
        common = out["roleComparison"]["commonFoundations"]
        top = common[0]
        self.assertGreaterEqual(len(top["requiredBy"]), 2)
        self.assertTrue(all(len(x["roles"]) >= 2 for x in common))
        python = next(x for x in common if x["skill"] == "Python")
        self.assertEqual(sorted(python["requiredBy"]), sorted(["ml_engineer", "data_scientist", "ai_evaluation_safety_engineer"]))

    def test_no_time_or_probability_is_invented(self):
        f, r = g.advanced_practical("ml_engineer")
        text = json.dumps(g.run(f, r, ["ml_engineer", "data_scientist"])["roleComparison"]).lower()
        for word in ("hour", "week", "probability of", "chance", "%"):
            self.assertNotIn(word, text)


if __name__ == "__main__":
    unittest.main()
