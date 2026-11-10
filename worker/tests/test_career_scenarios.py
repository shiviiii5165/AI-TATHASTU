"""Representative students through the whole engine (career_engine.compute): evidence classification, proficiency,
alignment state, gaps, prerequisite order and roadmap, with nothing invented. Consent scenarios (M-P) and deleted
accounts (Q) are in test_consent*.py and test_reliability.py; failed recomputation (R) is in test_compute_integration.py."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from intelligence import career_engine as engine  # noqa: E402
from intelligence.frameworks import framework_for  # noqa: E402
from test_career_engine import NOW, OLD, RECENT, RESOURCES, canonical, fact, lexicon, repo  # noqa: E402
from skills_catalog import CATALOG  # noqa: E402

CATEGORIES = {name: cat for name, cat, _a, _amb in CATALOG}


def run(facts=(), repos=(), roles=("ml_engineer",), learning=None, user=None):
    out = engine.compute(user=user or {}, roles=list(roles), facts=list(facts), repos=list(repos), resources=RESOURCES,
                         canonical=canonical, lexicon_scan=lexicon, categories=CATEGORIES, now=NOW, learning=learning)
    out.pop("_ledger")
    return out


def row(out, name, role=None):
    analysis = next(r for r in out["roles"] if role is None or r["role"] == role)
    return next(r for r in analysis["skills"] if r["skill"] == name)


def skill(out, name):
    return next((s for s in out["skills"] if s["name"] == name), None)


def milestones(out):
    return [m for s in out["roadmap"]["stages"] for m in s["milestones"]]


def project(record, title, techs, description=None):
    rows = [fact("projects", "title", title, record=record), fact("projects", "technologies", techs, record=record)]
    if description:
        rows.append(fact("projects", "description", description, record=record))
    return rows


ML_REPOS = [repo(f"me/ml{i}", {"Python": 400_000}, ["machine-learning", "pytorch", "scikit-learn"]) for i in range(5)]


class A_ResumeOnlyLimited(unittest.TestCase):
    def setUp(self):
        self.out = run([fact("skills", "skill", "Python"), fact("education", "degree", "B.Sc Computer Science")])

    def test_provisional_assessment_with_honest_state(self):
        a = self.out["roles"][0]["alignment"]
        self.assertEqual(a["state"], "early")
        self.assertEqual(a["requiredMet"], 0)
        self.assertTrue(a["criticalGaps"])

    def test_a_listed_skill_is_claimed_not_foundational(self):
        s = skill(self.out, "Python")
        self.assertEqual((s["evidenceState"], s["proficiency"], s["level"]), ("claimed", None, "Not assessed"))
        self.assertEqual(row(self.out, "Python")["gapType"], "claimed_unverified")

    def test_unknown_is_not_zero_and_roadmap_is_conservative(self):
        r = row(self.out, "Machine Learning")
        self.assertEqual((r["state"], r["proficiency"]), ("missing", None))
        self.assertEqual(self.out["roadmap"]["requirementsMet"], False)
        self.assertTrue(milestones(self.out))


class B_StrongClaimsNoProjects(unittest.TestCase):
    def test_many_claims_never_raise_alignment(self):
        names = [n for n, _ in [(r.competency, 0) for r in framework_for("ml_engineer").requirements]]
        out = run([fact("skills", "skill", n) for n in names] * 3)  # duplicates on purpose
        self.assertEqual(out["roles"][0]["alignment"]["state"], "early")
        self.assertEqual(out["roles"][0]["counts"]["met"], 0)
        self.assertEqual(len([s for s in out["skills"] if s["name"] == "Python"]), 1, "duplicate mentions are one skill")
        self.assertTrue(all(s["proficiency"] is None for s in out["skills"]))


class C_ResumeWithProjects(unittest.TestCase):
    def setUp(self):
        facts = (project("p1", "Churn model", ["Python", "scikit-learn"], "Trained a machine learning model with scikit-learn and Python")
                 + project("p2", "Sales forecasting", ["Python", "Pandas"]) + project("p3", "Image tagger", ["Python", "PyTorch"]))
        self.out = run(facts)

    def test_described_work_is_unverified_and_capped(self):
        s = skill(self.out, "Python")
        self.assertEqual(s["evidenceState"], "unverified")
        self.assertLessEqual(s["proficiency"], engine.UNVERIFIED_CAP)
        self.assertGreater(s["proficiency"], 0)

    def test_required_competencies_need_independent_evidence(self):
        self.assertNotEqual(row(self.out, "Python")["state"], "met")
        self.assertNotEqual(self.out["roles"][0]["alignment"]["state"], "requirements_demonstrated")

    def test_supporting_competencies_accept_described_work(self):
        out = run(project("p1", "A", ["Git"]) + project("p2", "B", ["Git"]))
        self.assertEqual(row(out, "Git")["state"], "met")  # supporting, Foundational, described accepted
        self.assertEqual(row(out, "Git")["tier"], "supporting")


class D_VerifiedProjectsAndGithub(unittest.TestCase):
    def test_github_metadata_demonstrates_but_never_claims_code_was_read(self):
        self.assertEqual(skill(run(repos=ML_REPOS), "Python")["level"], "Proficient")  # metadata alone stops below Advanced
        out = run(project("p1", "Churn model", ["Python"]), ML_REPOS)
        s = skill(out, "Python")
        self.assertEqual(s["evidenceState"], "demonstrated")
        self.assertTrue(all(e["kind"] in ("repository", "project") for e in s["evidence"]))
        self.assertEqual(row(out, "Python")["state"], "met")
        self.assertIn(out["roles"][0]["alignment"]["state"], ("developing", "strong", "requirements_demonstrated"))


class E_CourseWithoutPractice(unittest.TestCase):
    def test_completed_course_is_learning_not_proficiency(self):
        learning = [{"id": "l1", "kind": "course", "title": "Machine Learning Specialization", "status": "completed", "verification": "unverified", "skills": ["Machine Learning"], "source": "user_entered"}]
        out = run([fact("skills", "skill", "Python")], learning=learning)
        s = skill(out, "Machine Learning")
        self.assertIsNone(s["proficiency"])
        self.assertEqual(s["coursesCompleted"], 1)
        self.assertEqual(row(out, "Machine Learning")["gapType"], "claimed_unverified")
        rec = next((r for r in out["recommendations"] if r["skill"] == "Machine Learning"), None)
        self.assertIsNone(rec, "a claimed-but-unshown skill needs proof, not another course")

    def test_a_started_course_is_tracked_and_changes_no_assessment(self):
        learning = [{"id": "l1", "kind": "course", "title": "Deep Learning Specialization", "status": "started", "verification": "unverified", "skills": [], "source": "roadmap"}]
        out = run(repos=[repo("a/x", {"Python": 100_000})], roles=("deep_learning_engineer",), learning=learning)
        rec = next(r for r in out["recommendations"] if r["skill"] == "Deep Learning")
        self.assertEqual(rec["courseStatus"], "started")
        self.assertIsNone(skill(out, "Deep Learning"))


class F_ClaimedCertifications(unittest.TestCase):
    def test_resume_certification_is_a_claimed_credential_with_no_points(self):
        base = run(project("p1", "A", ["PyTorch"]))
        out = run(project("p1", "A", ["PyTorch"]) + [fact("certifications", "name", "PyTorch Certified Developer", record="c1")])
        self.assertEqual(skill(out, "PyTorch")["credential"], "claimed")
        self.assertEqual(skill(out, "PyTorch")["proficiency"], skill(base, "PyTorch")["proficiency"])

    def test_verified_certification_supports_but_never_proves_alone(self):
        verified = [{"id": "c1", "kind": "certification", "title": "PyTorch Certified", "status": "completed", "verification": "verified", "skills": ["PyTorch"], "source": "issuer"}]
        alone = run(learning=verified)
        self.assertIsNone(skill(alone, "PyTorch")["proficiency"])
        with_work = run(project("p1", "A", ["PyTorch"]), learning=verified)
        self.assertEqual(skill(with_work, "PyTorch")["scoreParts"]["certification"], 5.0)
        self.assertEqual(skill(with_work, "PyTorch")["credential"], "verified")


class G_StrongAcrossMandatory(unittest.TestCase):
    def setUp(self):
        topics = ["machine-learning", "pytorch", "scikit-learn", "python"]
        self.out = run(repos=[repo(f"me/r{i}", {"Python": 900_000}, topics) for i in range(6)])

    def test_requirements_demonstrated_and_no_mandatory_gaps(self):
        a = self.out["roles"][0]["alignment"]
        self.assertEqual(a["state"], "requirements_demonstrated")
        road = self.out["roadmap"]
        self.assertTrue(road["requirementsMet"])
        self.assertTrue(all(m["optional"] for m in milestones(self.out)))
        self.assertTrue(all(r["tier"] == "supporting" for r in self.out["roles"][0]["open"]))

    def test_no_beginner_recommendation_for_demonstrated_skills(self):
        recommended = {r["skill"] for r in self.out["recommendations"]}
        self.assertFalse(recommended & {"Python", "Machine Learning", "PyTorch", "scikit-learn"})


class H_MissingCriticalPrerequisite(unittest.TestCase):
    def setUp(self):
        self.out = run(repos=[repo(f"me/r{i}", {"Python": 300_000}, ["pytorch"]) for i in range(5)], roles=("deep_learning_engineer",))

    def test_prerequisite_comes_first_and_blocks(self):
        order = [m["skill"] for m in milestones(self.out)]
        dl = next(m for m in milestones(self.out) if m["skill"] == "Deep Learning")
        self.assertIn("Linear Algebra", dl["requires"])
        self.assertIn("Linear Algebra", dl["blockedBy"])
        self.assertLess(order.index("Linear Algebra"), order.index("Deep Learning"))

    def test_volume_elsewhere_cannot_reach_strong_with_a_foundation_unmet(self):
        self.assertNotIn(self.out["roles"][0]["alignment"]["state"], ("strong", "requirements_demonstrated"))
        self.assertIn("Deep Learning", self.out["roles"][0]["alignment"]["criticalGaps"])

    def test_gap_priority_puts_required_before_supporting_and_explains_why(self):
        open_rows = self.out["roles"][0]["open"]
        tiers = [r["tier"] for r in open_rows]
        self.assertEqual(tiers, sorted(tiers, key=lambda t: t != "required"))
        self.assertTrue(all(r["priorityReason"] and r["whyItMatters"] for r in open_rows))
        self.assertEqual([r["priorityRank"] for r in open_rows], list(range(1, len(open_rows) + 1)))


class I_NewEvidenceResolvesAGap(unittest.TestCase):
    def test_a_gap_closes_and_its_milestone_completes(self):
        before = run(repos=ML_REPOS[:1])
        self.assertNotEqual(row(before, "Machine Learning")["state"], "met")
        after = run(repos=ML_REPOS)
        self.assertEqual(row(after, "Machine Learning")["state"], "met")
        self.assertIn("Machine Learning", after["roadmap"]["completed"])
        self.assertNotIn("Machine Learning", [m["skill"] for m in milestones(after)])
        self.assertIn("ml_engineer:machine-learning", [m["id"] for m in after["roadmap"]["completedMilestones"]])


class J_GoalChanges(unittest.TestCase):
    def test_same_evidence_reassessed_against_the_new_framework(self):
        ml = run(repos=ML_REPOS, roles=("ml_engineer",))
        ops = run(repos=ML_REPOS, roles=("mlops_engineer",))
        self.assertEqual(skill(ml, "Python"), skill(ops, "Python"), "evidence is reused unchanged")
        self.assertEqual(ops["roadmap"]["role"], "mlops_engineer")
        self.assertTrue(all(m["id"].startswith("mlops_engineer:") for m in milestones(ops)))
        self.assertIn("Kubernetes", [m["skill"] for m in milestones(ops)])
        self.assertNotEqual(ml["roles"][0]["alignment"]["state"], "not_enough_evidence")


class K_PartialSourceFailure(unittest.TestCase):
    def test_missing_repositories_leave_resume_evidence_intact(self):
        facts = project("p1", "A", ["Python"])
        with_repos = run(facts, ML_REPOS)
        without = run(facts, [])  # e.g. a GitHub sync failed and returned nothing
        self.assertEqual(skill(without, "Python")["evidenceState"], "unverified")
        self.assertTrue(any(e["kind"] == "project" for e in skill(with_repos, "Python")["evidence"]))


class L_NoAiNeeded(unittest.TestCase):
    def test_assessment_is_deterministic_and_has_no_provider_dependency(self):
        a = json.dumps(run(project("p1", "A", ["Python"]), ML_REPOS), sort_keys=True, default=str)
        b = json.dumps(run(project("p1", "A", ["Python"]), ML_REPOS), sort_keys=True, default=str)
        self.assertEqual(a, b)


class Freshness(unittest.TestCase):
    def test_stale_code_scores_lower(self):
        new = skill(run(repos=[repo("a/x", {"Python": 10_000}, pushed=RECENT)]), "Python")["proficiency"]
        old = skill(run(repos=[repo("a/x", {"Python": 10_000}, pushed=OLD)]), "Python")["proficiency"]
        self.assertLess(old, new)


class EmptyProfile(unittest.TestCase):
    def test_nothing_to_read_gives_not_enough_evidence_and_no_invented_gaps(self):
        out = run([fact("identity", "full_name", "Asha", origin="user_entered")])
        self.assertEqual(out["roles"][0]["alignment"]["state"], "not_enough_evidence")
        self.assertTrue(out["roadmap"]["provisional"])
        self.assertEqual(out["recommendations"], [])
        self.assertEqual(out["roles"][0]["counts"]["missing"], 0)


class AlignmentRules(unittest.TestCase):
    """Removing a rule must fail a test: each state is pinned by a case on the boundary."""

    def test_rules_are_documented_in_the_output(self):
        self.assertIn("requirements_demonstrated", run()["framework"]["alignmentRules"])

    def test_described_only_evidence_can_never_demonstrate_requirements(self):
        names = [r.competency for r in framework_for("ml_engineer").requirements if r.required]
        facts = [f for i, n in enumerate(names) for f in project(f"p{i}", f"P{i}", [n]) + project(f"q{i}", f"Q{i}", [n]) + project(f"r{i}", f"R{i}", [n])]
        out = run(facts)
        self.assertNotEqual(out["roles"][0]["alignment"]["state"], "requirements_demonstrated")
        self.assertEqual(out["roles"][0]["alignment"]["requiredMet"], 0)

    def test_no_percentage_is_offered_as_alignment(self):
        a = run(repos=ML_REPOS)["roles"][0]["alignment"]
        self.assertIn(a["state"], engine.ALIGNMENT_LABELS)
        self.assertFalse(any(isinstance(v, float) for v in a.values()))


class Ledger(unittest.TestCase):
    def test_every_fact_reference_is_real_and_unique(self):
        facts = project("p1", "A", ["Python"]) + [fact("skills", "skill", "Python")]
        out = engine.compute(user={}, roles=["ml_engineer"], facts=facts, repos=ML_REPOS, resources=RESOURCES, canonical=canonical, lexicon_scan=lexicon, categories=CATEGORIES, now=NOW)
        ids = {f["id"] for f in facts}
        pairs = [(e["skill"], e["factId"]) for e in out["_ledger"]]
        self.assertTrue(pairs)
        self.assertEqual(len(pairs), len(set(pairs)))
        self.assertTrue(all(fid in ids for _, fid in pairs), "never a manufactured evidence id")
        self.assertNotIn("_factRefs", json.dumps({k: v for k, v in out.items() if k != "_ledger"}, default=str))


if __name__ == "__main__":
    unittest.main()
