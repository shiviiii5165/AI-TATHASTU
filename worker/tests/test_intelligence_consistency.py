"""One profile, one answer: every dashboard module reads the same engine result."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from intelligence import career_engine as engine, eris  # noqa: E402
from intelligence.compute import with_engine_assessment  # noqa: E402
from intelligence.config import ROLE_SKILLS  # noqa: E402
from test_career_engine import OLD, RECENT, canonical, fact, repo, run  # noqa: E402

GH = [repo("a/api", {"Python": 300_000}, ["docker", "machine-learning"]), repo("a/ml", {"Python": 200_000}, ["pytorch"])]
CV = [fact("skills", "skill", "Python"), fact("skills", "skill", "Kubernetes"), fact("projects", "title", "Vision", record="p1"), fact("projects", "technologies", ["PyTorch"], record="p1")]
STRONG = [repo(f"a/r{i}", {"Python": 900_000, "SQL": 90_000}, ["pytorch", "scikit-learn", "docker", "machine-learning", "mlflow", "aws", "statistics", "git"]) for i in range(8)]

PROFILES = {
    "resume only": dict(facts=CV),
    "github only": dict(repos=GH),
    "resume and github": dict(facts=CV, repos=GH),
    "conflicting": dict(facts=[fact("skills", "skill", "Kubernetes"), fact("skills", "skill", "Rust")], repos=[repo("a/old", {"Python": 800}, pushed=OLD)]),
    "multiple roles": dict(facts=CV, repos=GH, roles=("ml_engineer", "data_scientist")),
    "limited": dict(facts=[fact("skills", "skill", "Python")]),
    "strong": dict(repos=STRONG),
    "no evidence": dict(),
}


def eris_for(out, analysis):
    return eris.score_role(analysis, [], None)


class AcrossModules(unittest.TestCase):
    def each_role(self):
        for label, kwargs in PROFILES.items():
            out = run(**kwargs)
            for analysis in out["roles"]:
                with self.subTest(profile=label, role=analysis["role"]):
                    yield out, analysis, eris_for(out, analysis)

    def test_eris_gaps_are_the_engines_top_gaps_in_its_order(self):
        for _out, analysis, result in self.each_role():
            if result:
                self.assertEqual([g["skill"] for g in result["breakdown"]["gaps"]], [r["skill"] for r in eris.open_rows_of(analysis)[:3]])

    def test_a_skill_at_its_level_is_never_called_a_gap_anywhere(self):
        for out, analysis, result in self.each_role():
            met = {r["skill"] for r in analysis["skills"] if r["state"] == "met"}
            if result:
                self.assertFalse(met & {g["skill"] for g in result["breakdown"]["gaps"]})
            self.assertFalse(met & {r["skill"] for r in out["recommendations"] if analysis["role"] in r["roles"]})

    def test_every_module_agrees_on_a_skills_score_and_state(self):
        for out, analysis, result in self.each_role():
            scores = {s["name"]: s["proficiency"] for s in out["skills"]}
            for row in analysis["skills"]:
                self.assertEqual(row["proficiency"], scores.get(row["skill"]))
            if result:
                by_skill = {s["skill"]: s for s in result["breakdown"]["skills"]}
                for row in analysis["skills"]:
                    self.assertEqual(by_skill[row["skill"]]["state"], row["state"])
                    expected = None if row["proficiency"] is None else round(row["proficiency"] / 100, 3)
                    self.assertEqual(by_skill[row["skill"]]["readiness"], expected)
            for node in out["graph"]["nodes"]:
                if node["status"] != "inferred":
                    self.assertEqual(node["proficiency"], scores[node["name"]])

    def test_roadmap_progress_is_coverage_and_technical_never_falls_below_it(self):
        for out, analysis, result in self.each_role():
            if out["roadmap"] and out["roadmap"]["role"] == analysis["role"]:
                self.assertEqual(out["roadmap"]["progress"], analysis["coverage"])
            if result:
                self.assertGreaterEqual(result["breakdown"]["components"]["technical"], analysis["coverage"] - 0.001)

    def test_recommended_skills_are_open_gaps_for_the_roles_they_name(self):
        for out, analysis, _result in self.each_role():
            open_skills = {r["skill"] for r in eris.open_rows_of(analysis)}
            for rec in out["recommendations"]:
                if analysis["role"] in rec["roles"]:
                    self.assertIn(rec["skill"], open_skills)

    def test_legacy_gaps_for_yora_are_a_subset_of_the_engines_with_real_gaps_only(self):
        for label, kwargs in PROFILES.items():
            out = run(**kwargs)
            legacy = {g["skill"] for g in engine.legacy_gaps_and_paths(out)["gaps"]}
            if out["roles"]:
                by_skill = {r["skill"]: r for r in out["roles"][0]["open"]}
                for skill in legacy:
                    self.assertFalse(by_skill[skill]["insufficientEvidence"], label)

    def test_a_skill_shown_only_by_repositories_reaches_the_summary(self):
        out = run(**PROFILES["github only"])
        rows = with_engine_assessment([], out)
        self.assertEqual({r["name"] for r in rows}, {s["name"] for s in out["skills"]})
        self.assertEqual(next(r for r in rows if r["name"] == "Python")["sources"], ["github"])

    def test_the_old_skill_summary_takes_its_status_from_the_engine(self):
        out = run(**PROFILES["resume and github"])
        names = [s["name"] for s in out["skills"]]
        summary = [{"name": n, "evidenceStrength": 0.5, "verificationStatus": "stale", "sources": []} for n in names]
        for row, skill in zip(with_engine_assessment(summary, out), out["skills"]):
            self.assertEqual(row["verificationStatus"], skill["status"])
            self.assertEqual(row["proficiency"], skill["proficiency"])


class ErisOwnDimensions(unittest.TestCase):
    def analysis(self, **kwargs):
        return run(**kwargs)["roles"][0]

    def test_no_evidence_means_no_score_rather_than_zero(self):
        self.assertIsNone(eris.score_role(self.analysis(), []))

    def test_claims_alone_mean_no_score_rather_than_zero(self):
        self.assertIsNone(eris.score_role(self.analysis(facts=[fact("skills", "skill", "Python")]), []))

    def test_problem_solving_stays_its_own_dimension(self):
        analysis = self.analysis(repos=GH)
        without = eris.score_role(analysis, [])
        withit = eris.score_role(analysis, [], 0.9)
        self.assertEqual(without["breakdown"]["components"]["technical"], withit["breakdown"]["components"]["technical"])
        self.assertIsNone(without["breakdown"]["components"]["problem_solving"])
        self.assertEqual(withit["breakdown"]["components"]["problem_solving"], 0.9)
        self.assertGreater(withit["score"], without["score"])

    def test_projects_match_on_canonical_names(self):
        analysis = self.analysis(repos=GH)
        name = canonical("pytorch")
        self.assertEqual(eris.score_role(analysis, [[name]])["breakdown"]["relevant_projects"], 1)

    def test_a_role_without_a_framework_has_no_score(self):
        self.assertNotIn("still_exploring", ROLE_SKILLS)
        self.assertEqual(run(repos=GH, roles=("still_exploring",))["roles"], [])

    def test_recent_constant_is_used(self):
        self.assertLess(OLD, RECENT)


if __name__ == "__main__":
    unittest.main()
