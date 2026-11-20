"""Golden evaluation for every current role (workstream E): graded synthetic students through the real engine.

The most important failure mode is false expertise: a competency marked met, or a skill at Proficient or above, on evidence
the method doesn't accept. It is checked for every role x profile, including cross-role (transfer) runs. The matrix these
tests assert is rendered by scripts/golden_report.py into docs/engineering/CAREER_INTELLIGENCE_EVALUATION.md.
"""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import golden_profiles as g  # noqa: E402
from intelligence.frameworks import CURRENT_ROLES, FRAMEWORKS, career_levels  # noqa: E402
from intelligence.reachability import routes  # noqa: E402

RUNS = {}


def run(role, profile):
    key = (role, profile)
    if key not in RUNS:
        facts, repos = g.PROFILES[profile](role)
        RUNS[key] = g.run(facts, repos, [role])
    return RUNS[key]


def align(role, profile):
    return g.analysis(run(role, profile), role)["alignment"]


class FalseExpertise(unittest.TestCase):
    def test_no_role_and_no_profile_produces_false_expertise(self):
        for role in CURRENT_ROLES:
            for profile in g.PROFILES:
                with self.subTest(role=role, profile=profile):
                    self.assertEqual(g.false_expertise(run(role, profile)), [])

    def test_claims_alone_never_earn_a_level(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                out = run(role, "beginner_claims")
                self.assertTrue(all(s["proficiency"] is None for s in out["skills"]))
                self.assertEqual((align(role, "beginner_claims")["state"], align(role, "beginner_claims")["requiredMet"]), ("early", 0))

    def test_an_inflated_resume_stays_early_and_below_proficient(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                out = run(role, "resume_inflated")
                self.assertEqual(align(role, "resume_inflated")["state"], "early")
                self.assertTrue(all((s["proficiency"] or 0) < 50 for s in out["skills"]), "own descriptions are capped at Working")
                met = [r for r in g.analysis(out, role)["skills"] if r["required"] and r["state"] == "met"]
                self.assertTrue(all(r["codeVerifiable"] is False for r in met), "only requirements no repository can show may be met on descriptions")

    def test_activity_without_depth_shows_only_the_language(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                a = g.analysis(run(role, "high_activity_low_depth"), role)
                met = {r["skill"] for r in a["skills"] if r["state"] == "met"}
                self.assertTrue(met <= {"Python"}, met)
                self.assertLessEqual(g.LEVEL_RANK[a["alignment"]["state"]], g.LEVEL_RANK["developing"])

    def test_tagged_but_unused_skills_need_proof(self):
        """Tags are a repository mention: by the published rule they can reach Foundational on a supporting skill, never a
        required competency and never anything above Foundational."""
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                a = g.analysis(run(role, "contradicted"), role)
                for r in a["skills"]:
                    if r["skill"] != "Python" and r["state"] == "met":
                        self.assertFalse(r["required"], r["skill"])
                        self.assertEqual(r["expectedLevel"], "Foundational", r["skill"])
                        self.assertNotEqual(r["evidenceState"], "demonstrated", r["skill"])

    def test_code_in_repositories_that_arent_the_students_doesnt_count(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                self.assertEqual(align(role, "not_own_code")["requiredMet"], 0)
                self.assertEqual(align(role, "not_own_code")["state"], "early")


class Grading(unittest.TestCase):
    def test_alignment_rises_with_evidence_and_never_falls(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                ranks = [g.LEVEL_RANK[align(role, p)["state"]] for p in ("beginner_claims", "intermediate", "advanced_practical")]
                self.assertEqual(ranks, sorted(ranks))
                self.assertLess(ranks[0], ranks[2])

    def test_strong_practical_work_without_certificates_demonstrates_the_role(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                a = align(role, "advanced_practical")
                if a["requiredNeedsAssessment"]:
                    # Honest limit, reported rather than hidden: only an assessment we don't run could meet it.
                    self.assertNotEqual(a["state"], "requirements_demonstrated")
                else:
                    self.assertEqual(a["state"], "requirements_demonstrated", a)

    def test_outdated_evidence_is_flagged_and_never_demonstrates_the_role(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                old, fresh = run(role, "outdated"), run(role, "advanced_practical")
                a = g.analysis(old, role)["alignment"]
                self.assertNotEqual(a["state"], "requirements_demonstrated")
                if not a["requiredNeedsAssessment"]:
                    self.assertTrue(a["requiredStale"])
                fresh_levels = {s["name"]: s["proficiency"] or 0 for s in fresh["skills"]}
                for s in old["skills"]:
                    self.assertLessEqual(s["proficiency"] or 0, fresh_levels.get(s["name"], 100), s["name"])

    def test_a_missing_foundation_is_named_first_and_blocks_demonstration(self):
        checked = 0
        for role in CURRENT_ROLES:
            built = g.missing_prerequisite(role)
            if built is None:
                continue
            facts, repos, foundation, dependents = built
            a = g.analysis(g.run(facts, repos, [role]), role)
            rows = {r["skill"]: r for r in a["skills"]}
            if all(rows[d]["state"] == "met" for d in dependents):
                continue  # other competencies' code legitimately evidences the dependents (gymnasium -> RL), so nothing is blocked
            with self.subTest(role=role, foundation=foundation):
                row = rows[foundation]
                self.assertNotEqual(row["state"], "met")
                self.assertIn(row["category"], ("foundation", "possibly"))
                self.assertTrue(row["unblocks"], "the open competencies that build on it are named")
                self.assertNotEqual(a["alignment"]["state"], "requirements_demonstrated")
                self.assertEqual(a["open"][0]["skill"], foundation, "a blocking required foundation is the first priority")
                checked += 1
        self.assertGreaterEqual(checked, 5)


class Transfer(unittest.TestCase):
    def test_evidence_transfers_to_other_roles_only_where_it_applies(self):
        """A strong student of role A, assessed for every other role B: shared competencies count, B's own don't appear."""
        for a_role in CURRENT_ROLES:
            facts, repos = g.advanced_practical(a_role)
            out = g.run(facts, repos, list(CURRENT_ROLES))
            with self.subTest(source=a_role):
                self.assertEqual(g.false_expertise(out), [])
            evidenced = {s["name"] for s in out["skills"] if s["proficiency"] is not None}
            for b in out["roles"]:
                for r in b["skills"]:
                    if r["state"] == "met":
                        with self.subTest(source=a_role, target=b["role"], skill=r["skill"]):
                            self.assertIn(r["skill"], evidenced)

    def test_ml_engineer_to_data_scientist_keeps_distinct_gaps(self):
        facts, repos = g.advanced_practical("ml_engineer")
        out = g.run(facts, repos, ["data_scientist"])
        rows = {r["skill"]: r for r in g.analysis(out, "data_scientist")["skills"]}
        ml = {r.competency for r in FRAMEWORKS["ml_engineer"].requirements}
        self.assertEqual(rows["Python"]["state"], "met")
        for name, r in rows.items():
            if name not in ml:
                self.assertNotEqual(r["state"], "met", f"{name} is Data-Scientist-specific; ML evidence must not fill it")


class OntologyAndMethod(unittest.TestCase):
    def test_required_competencies_without_a_code_route_are_reported_exactly(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                expected = sorted(r.competency for r in FRAMEWORKS[role].requirements if r.required and not routes(r.competency))
                self.assertEqual(align(role, "advanced_practical")["requiredNotCodeVerifiable"], expected)

    def test_motion_planning_is_no_longer_counted_as_control_systems(self):
        from test_career_engine import canonical
        self.assertEqual(canonical("motion planning"), "Motion Planning")
        self.assertEqual(canonical("path planning"), "Motion Planning")
        self.assertEqual(canonical("pid control"), "Control Systems")
        self.assertEqual(canonical("amcl"), "Robot Localization")

    def test_every_role_spans_several_domains_and_rows_carry_them(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                a = g.analysis(run(role, "advanced_practical"), role)
                self.assertGreaterEqual(len(a["domains"]), 3)
                self.assertTrue(all(r["domain"] for r in a["skills"]))
                self.assertEqual(sum(d["total"] for d in a["domains"]), len(a["skills"]))

    def test_career_stages_are_ordered_and_junior_is_the_assessed_target(self):
        order = ("Foundational", "Working", "Proficient", "Advanced")
        for role in CURRENT_ROLES:
            for req in FRAMEWORKS[role].requirements:
                levels = career_levels(req)
                with self.subTest(role=role, competency=req.competency):
                    self.assertEqual(levels["junior"], req.expected_level)
                    self.assertLessEqual(order.index(levels["junior"]), order.index(levels["intermediate"]))
                    self.assertLessEqual(order.index(levels["intermediate"]), order.index(levels["senior"]))
            stages = g.analysis(run(role, "advanced_practical"), role)["careerStages"]
            counts = g.analysis(run(role, "advanced_practical"), role)["counts"]
            with self.subTest(role=role):
                self.assertEqual(stages["junior"]["met"], counts["met"])
                self.assertGreaterEqual(stages["junior"]["met"], stages["intermediate"]["met"])
                self.assertGreaterEqual(stages["intermediate"]["met"], stages["senior"]["met"])

    def test_identical_evidence_gives_identical_output(self):
        for role in ("ml_engineer", "robotics_ai_engineer", "llm_application_engineer"):
            facts, repos = g.advanced_practical(role)
            a = json.dumps(g.run(facts, repos, [role]), sort_keys=True, default=str)
            b = json.dumps(g.run(facts, repos, [role]), sort_keys=True, default=str)
            self.assertEqual(a, b)


if __name__ == "__main__":
    unittest.main()
