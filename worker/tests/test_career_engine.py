"""The career engine against realistic profiles: nothing invented, everything traceable."""

from __future__ import annotations

import json
import re
import sys
import time
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import provider_router  # noqa: E402
from intelligence import career_engine as engine  # noqa: E402
from intelligence.config import ROLE_SKILLS  # noqa: E402
from intelligence.roadmap import generate_next_best_actions  # noqa: E402
from intelligence.skill_graph import SKILL_ONTOLOGY  # noqa: E402
from resume.deterministic import _PATTERNS  # noqa: E402
from skills_catalog import CATALOG, alias_key  # noqa: E402

NOW = datetime(2026, 11, 2, tzinfo=timezone.utc)
RECENT = NOW - timedelta(days=30)
OLD = NOW - timedelta(days=900)

ALIASES = {alias_key(a): name for name, _c, aliases, _amb in CATALOG for a in [name, *aliases]}
CATEGORIES = {name: cat for name, cat, _a, _amb in CATALOG}
MIGRATION = Path(__file__).resolve().parents[2] / "src/db/migrations/0015_pgvector_and_rag.sql"
RESOURCES = [
    {"title": t.replace("''", "'"), "provider": p, "url": u, "description": d}
    for t, p, u, d in re.findall(r"^\('((?:[^']|'')+)', '((?:[^']|'')+)', '([^']*)', '((?:[^']|'')*)'\)", MIGRATION.read_text(encoding="utf-8"), re.M)
]


def canonical(mention):
    name = mention.strip()
    return ALIASES.get(alias_key(name), name) if name else None


def lexicon(text):
    return sorted({c for c, pattern, section_only in _PATTERNS if not section_only and pattern.search(text)})


def fact(group, field, value, origin="resume", record=None, **extra):
    return {"id": f"{group}-{field}-{value}"[:40], "field_group": group, "field_name": field, "record_key": record, "normalized_value": value,
            "extracted_value": extra.pop("extracted", value), "origin": origin, "confirmation": "confirmed", "source_evidence": extra.pop("evidence", None), "created_at": RECENT}


def repo(name, languages=None, topics=None, description=None, pushed=RECENT):
    return {"id": name, "repo_name": name, "url": f"https://github.com/{name}", "description": description, "languages": languages or {}, "topics": topics or [], "stars": 0, "last_commit_at": pushed}


def run(facts=(), repos=(), roles=("ml_engineer",), user=None):
    return engine.compute(user=user or {}, roles=list(roles), facts=list(facts), repos=list(repos), resources=RESOURCES,
                          canonical=canonical, lexicon_scan=lexicon, categories=CATEGORIES, now=NOW)


def skill(out, name):
    return next((s for s in out["skills"] if s["name"] == name), None)


def role_row(out, role, name):
    analysis = next(r for r in out["roles"] if r["role"] == role)
    return next(r for r in analysis["skills"] if r["skill"] == name)


RESUME_ONLY = [
    fact("skills", "skill", "Python"), fact("skills", "skill", "PyTorch"),
    fact("projects", "title", "Resume Parser", record="p1"), fact("projects", "technologies", ["Python"], record="p1"),
]
GITHUB_ONLY = [repo(f"a/r{i}", {"Python": 200_000}, ["pytorch"]) for i in range(5)]


class ResumeOnly(unittest.TestCase):
    def test_a_listed_skill_is_claimed_and_not_assessed(self):
        s = skill(run([fact("skills", "skill", "PyTorch")]), "PyTorch")
        self.assertEqual((s["status"], s["proficiency"], s["level"]), ("claimed", None, "Not assessed"))

    def test_a_described_project_scores_but_stays_claimed_and_capped(self):
        facts = [fact("projects", "technologies", ["Python"], record=f"p{i}") for i in range(6)]
        s = skill(run(facts), "Python")
        self.assertEqual(s["status"], "claimed")
        self.assertLessEqual(s["proficiency"], engine.UNVERIFIED_CAP)
        self.assertGreater(s["proficiency"], 0)

    def test_a_claim_is_not_a_gap_but_lacks_evidence(self):
        row = role_row(run(RESUME_ONLY), "ml_engineer", "PyTorch")
        self.assertEqual(row["state"], "unverified")
        self.assertTrue(row["insufficientEvidence"])
        self.assertIn("need proof of practical use", row["action"])
        self.assertEqual(row["gapType"], "claimed_unverified")

    def test_a_certification_alone_earns_no_proficiency(self):
        out = run([fact("certifications", "name", "PyTorch Certified", record="c1"), fact("skills", "skill", "PyTorch")])
        self.assertIsNone(skill(out, "PyTorch")["proficiency"])


class GithubOnly(unittest.TestCase):
    def test_repositories_verify_a_skill_with_traceable_evidence(self):
        s = skill(run(repos=GITHUB_ONLY), "Python")
        self.assertEqual(s["status"], "verified")
        self.assertGreater(s["proficiency"], 50)
        self.assertEqual(s["scoreParts"]["repositories"], 40)
        self.assertTrue(all(e["ref"].startswith("https://github.com/") for e in s["evidence"]))
        self.assertEqual(s["evidence"][0]["at"], RECENT.isoformat())

    def test_old_code_scores_lower_than_recent_code(self):
        new = skill(run(repos=[repo("a/x", {"Rust": 10_000})]), "Rust")["proficiency"]
        old = skill(run(repos=[repo("a/x", {"Rust": 10_000}, pushed=OLD)]), "Rust")["proficiency"]
        self.assertLess(old, new)

    def test_one_small_repository_is_not_expertise(self):
        self.assertEqual(skill(run(repos=[repo("a/x", {"Rust": 500})]), "Rust")["level"], "Foundational")

    def test_scoring_is_deterministic(self):
        strip = lambda o: json.dumps(o, sort_keys=True, default=str)  # noqa: E731
        self.assertEqual(strip(run(RESUME_ONLY, GITHUB_ONLY)), strip(run(RESUME_ONLY, GITHUB_ONLY)))


class Combined(unittest.TestCase):
    def test_resume_plus_github_raises_confidence_and_keeps_every_source(self):
        s = skill(run(RESUME_ONLY, GITHUB_ONLY), "Python")
        self.assertGreater(s["confidence"], skill(run(repos=GITHUB_ONLY), "Python")["confidence"])
        self.assertEqual({e["kind"] for e in s["evidence"]} >= {"repository"}, True)
        self.assertGreaterEqual(s["evidenceCount"], 7)

    def test_conflicting_evidence_is_not_averaged_into_a_claim(self):
        out = run([fact("skills", "skill", "Rust"), fact("skills", "skill", "Python")], [repo("a/x", {"Python": 100_000})])
        self.assertEqual(skill(out, "Python")["status"], "verified")
        self.assertEqual(skill(out, "Rust")["status"], "claimed")
        self.assertIsNone(skill(out, "Rust")["proficiency"])

    def test_aliases_merge_into_one_skill(self):
        out = run([fact("skills", "skill", "py"), fact("skills", "skill", "python3"), fact("skills", "skill", "Python")], [repo("a/x", {"Python": 1000})])
        self.assertEqual(len([s for s in out["skills"] if s["name"].lower().startswith("py") and "torch" not in s["name"].lower()]), 1)


class Roles(unittest.TestCase):
    def test_multiple_roles_are_independent(self):
        out = run(RESUME_ONLY, GITHUB_ONLY, roles=("ml_engineer", "mlops_engineer"))
        self.assertEqual([r["role"] for r in out["roles"]], ["ml_engineer", "mlops_engineer"])
        self.assertNotEqual(out["roles"][0]["coverage"], out["roles"][1]["coverage"])
        self.assertTrue(any(r["skill"] == "Kubernetes" for r in out["roles"][1]["skills"]))
        self.assertFalse(any(r["skill"] == "Kubernetes" for r in out["roles"][0]["skills"]))

    def test_every_required_skill_comes_from_the_framework_and_nothing_else(self):
        out = run(RESUME_ONLY, GITHUB_ONLY)
        required = {canonical(n) for n, _w in ROLE_SKILLS["ml_engineer"]}
        self.assertEqual({r["skill"] for r in out["roles"][0]["skills"]}, required)

    def test_a_role_without_a_framework_says_so_and_gets_no_invented_gaps(self):
        out = run(RESUME_ONLY, roles=("still_exploring",))
        self.assertEqual(out["roles"], [])
        self.assertEqual(out["unsupportedRoles"], ["still_exploring"])
        self.assertEqual(out["recommendations"], [])
        self.assertIsNone(out["roadmap"])

    def test_inferred_is_a_pointer_not_a_score_and_never_from_a_claim(self):
        demonstrated = run(repos=[repo("a/x", topics=["pytorch"])])
        inferred = next(s for s in demonstrated["inferred"] if s["name"] == canonical("Deep Learning"))
        self.assertIsNone(inferred["proficiency"])
        self.assertEqual(inferred["inferredFrom"], ["PyTorch"])
        self.assertEqual(run([fact("skills", "skill", "PyTorch")])["inferred"], [])

    def test_inferred_skill_is_insufficient_evidence_not_met(self):
        row = role_row(run(repos=[repo("a/x", topics=["pytorch"])]), "ml_engineer", "Machine Learning")
        self.assertEqual(row["state"], "inferred")
        self.assertTrue(row["insufficientEvidence"])

    def test_priority_and_expectation_come_from_the_framework(self):
        rows = {r["skill"]: r for r in run(RESUME_ONLY)["roles"][0]["skills"]}
        self.assertEqual((rows["Python"]["priority"], rows["Python"]["expectedLevel"], rows["Python"]["tier"]), ("High", "Proficient", "required"))
        self.assertEqual((rows["SQL"]["priority"], rows["SQL"]["expectedLevel"], rows["SQL"]["tier"]), ("Medium", "Working", "supporting"))
        self.assertEqual((rows["Git"]["priority"], rows["Git"]["expectedLevel"]), ("Low", "Foundational"))


class StrongProfile(unittest.TestCase):
    def setUp(self):
        repos = [repo(f"a/r{i}", {"Python": 900_000, "SQL": 90_000}, ["pytorch", "scikit-learn", "docker", "machine-learning", "mlflow", "aws", "statistics", "git"]) for i in range(8)]
        self.repos = repos
        self.out = run(repos=repos)

    def test_hyphenated_github_topics_match_the_catalogue(self):
        self.assertEqual(skill(self.out, "Machine Learning")["status"], "verified")

    def test_a_free_form_topic_is_not_a_skill(self):
        out = run(repos=[repo("a/r", {"Python": 1000}, ["awesome-list", "hacktoberfest"])])
        self.assertEqual([s["name"] for s in out["skills"]], ["Python"])

    def test_reaches_high_coverage(self):
        self.assertGreater(self.out["roles"][0]["coverage"], 0.9)

    def test_repository_metadata_alone_stops_at_proficient(self):
        # We read metadata, not code, so it can't by itself show the top level.
        self.assertEqual(skill(self.out, "Python")["level"], "Proficient")

    def test_advanced_takes_repositories_and_described_work_together(self):
        facts = [fact("projects", "technologies", ["Python"], record=f"p{i}") for i in range(3)]
        self.assertEqual(skill(run(facts, self.repos), "Python")["level"], "Advanced")

    def test_a_platform_assessment_can_raise_the_score(self):
        facts = [fact("achievements", "title", "badges", origin="hackerrank", record="hackerrank:stats", extracted={"badges": {"Python": 5}})]
        s = skill(run(facts), "Python")
        self.assertEqual((s["status"], s["proficiency"]), ("verified", 100.0))

    def test_met_skills_get_no_recommendations(self):
        recommended = {r["skill"] for r in self.out["recommendations"]}
        for row in self.out["roles"][0]["skills"]:
            if row["state"] == "met":
                self.assertNotIn(row["skill"], recommended)


class LimitedProfile(unittest.TestCase):
    def test_nothing_to_read_is_not_assessed_rather_than_all_missing(self):
        out = run([fact("identity", "full_name", "Asha", origin="user_entered")])
        self.assertFalse(out["hasEvidenceBase"])
        self.assertEqual(out["roles"][0]["counts"]["not_assessed"], len(ROLE_SKILLS["ml_engineer"]))
        self.assertEqual(out["roles"][0]["coverage"], 0)
        self.assertEqual(out["recommendations"], [])
        self.assertEqual(out["skills"], [])

    def test_no_connected_accounts_still_works_from_a_resume(self):
        out = run(RESUME_ONLY)
        self.assertTrue(out["hasEvidenceBase"])
        self.assertEqual(out["counts"]["verified"], 0)
        self.assertGreater(out["counts"]["claimed"], 0)

    def test_no_roles_at_all(self):
        out = run(RESUME_ONLY, roles=())
        self.assertEqual((out["roles"], out["roadmap"], out["recommendations"]), ([], None, []))


class Recommendations(unittest.TestCase):
    def setUp(self):
        self.out = run(RESUME_ONLY, GITHUB_ONLY, roles=("ml_engineer", "data_scientist"))

    def test_only_real_catalogue_courses_with_their_stored_url(self):
        catalogue = {r["title"]: r["url"] for r in RESOURCES}
        with_course = [r for r in self.out["recommendations"] if r["resource"]]
        self.assertTrue(with_course)
        self.assertTrue(all(engine.RESOURCE_CHECKS[r["resource"]["title"]]["status"] == "ok" for r in with_course))
        for r in with_course:
            self.assertEqual(catalogue[r["resource"]["title"]], r["resource"]["url"])
            self.assertIsNone(r["resource"]["duration"])  # never invented

    def test_every_curated_course_exists_and_has_a_specific_page(self):
        catalogue = {r["title"]: r["url"] for r in RESOURCES}
        homepages = {"https://www.coursera.org/", "https://www.datacamp.com/", "https://www.turing.ac.uk/", "https://realpython.com/"}
        for skill_name, courses in engine.COURSES.items():
            for title, _difficulty in courses:
                self.assertIn(title, catalogue, skill_name)
                self.assertNotIn(catalogue[title], homepages)

    def test_a_course_that_stopped_checking_out_is_not_offered(self):
        title = "Machine Learning Specialization"
        for broken in ({"status": "dead"}, {"url": "https://example.com/moved"}):
            record = {**engine.RESOURCE_CHECKS[title], **broken}
            with mock.patch.dict(engine.RESOURCE_CHECKS, {title: record}):
                out = run(RESUME_ONLY, roles=("ml_engineer",))
            self.assertNotIn(title, {(r["resource"] or {}).get("title") for r in out["recommendations"]})

    def test_an_old_check_is_flagged_rather_than_trusted_silently(self):
        title = "Machine Learning Specialization"
        record = {**engine.RESOURCE_CHECKS[title], "checkedAt": "2026-01-01"}
        with mock.patch.dict(engine.RESOURCE_CHECKS, {title: record}):
            out = run(RESUME_ONLY, roles=("ml_engineer",))
        flagged = [r["resource"] for r in out["recommendations"] if r["resource"] and r["resource"]["title"] == title]
        self.assertTrue(flagged and flagged[0]["linkStale"])

    def test_a_skill_with_no_course_says_none_rather_than_inventing_one(self):
        out = run(repos=[repo("a/x", {"Python": 10})], roles=("mlops_engineer",))
        docker = next(r for r in out["recommendations"] if r["skill"] == "Docker")
        self.assertIsNone(docker["resource"])
        self.assertIn("Docker", docker["demonstration"])

    def test_missing_catalogue_row_means_no_resource(self):
        out = engine.compute(user={}, roles=["ml_engineer"], facts=RESUME_ONLY, repos=[], resources=[], canonical=canonical, lexicon_scan=lexicon, categories=CATEGORIES, now=NOW)
        self.assertTrue(out["recommendations"])
        self.assertTrue(all(r["resource"] is None for r in out["recommendations"]))

    def test_no_duplicates_and_a_shared_skill_names_both_roles(self):
        names = [r["skill"] for r in self.out["recommendations"]]
        self.assertEqual(len(names), len(set(names)))
        shared = [r for r in self.out["recommendations"] if len(r["roles"]) == 2]
        self.assertTrue(shared)

    def test_claimed_skills_need_proof_not_a_course(self):
        self.assertNotIn("PyTorch", {r["skill"] for r in run(RESUME_ONLY)["recommendations"]})

    def test_prerequisites_are_reported_with_their_real_state(self):
        out = run(repos=[repo("a/x", {"Python": 100_000})], roles=("deep_learning_engineer",))
        deep = next(r for r in out["recommendations"] if r["skill"] == "Deep Learning")
        self.assertEqual(deep["prerequisites"], [{"skill": "Linear Algebra", "met": False}])

    def test_ranking_prefers_important_gaps(self):
        priorities = [r["priority"] for r in self.out["recommendations"]]
        self.assertEqual(priorities[0], "High")

    def test_status_comes_only_from_evidence(self):
        self.assertTrue(all(r["status"] in ("not_started", "in_progress") for r in self.out["recommendations"]))


class Roadmap(unittest.TestCase):
    def test_prerequisites_come_first(self):
        road = run(repos=[repo("a/x", {"Python": 10})], roles=("mlops_engineer",))["roadmap"]
        order = [m["skill"] for s in road["stages"] for m in s["milestones"]]
        self.assertLess(order.index("Docker"), order.index("Kubernetes"))
        for stage in road["stages"]:
            for m in stage["milestones"]:
                self.assertTrue(m["criterion"])
                self.assertTrue(m["deliverable"])

    def test_no_milestone_depends_on_a_later_one(self):
        for role in ROLE_SKILLS:
            road = run(RESUME_ONLY, roles=(role,))["roadmap"]
            seen = set(road["completed"])
            for stage in road["stages"]:
                for m in stage["milestones"]:
                    self.assertTrue(set(m["requires"]) - {x["skill"] for x in stage["milestones"]} <= seen | set(_earlier(road, stage)), (role, m))
                seen |= {m["skill"] for m in stage["milestones"]}

    def test_progress_is_coverage_never_decoration(self):
        out = run(RESUME_ONLY, GITHUB_ONLY)
        self.assertEqual(out["roadmap"]["progress"], out["roles"][0]["coverage"])
        self.assertEqual(run(RESUME_ONLY)["roadmap"]["progress"], 0)

    def test_position_is_only_what_the_record_says(self):
        self.assertIsNone(run(RESUME_ONLY)["roadmap"]["currentPosition"])
        self.assertEqual(run(RESUME_ONLY, user={"degree": "B.Sc", "university": "IIT"})["roadmap"]["currentPosition"], "B.Sc at IIT")

    def test_no_invented_time_estimates(self):
        road = run(RESUME_ONLY)["roadmap"]
        self.assertIn("No time estimates", road["assumption"])
        for stage in road["stages"]:
            self.assertIsNone(stage["estimateWeeks"])
            self.assertTrue(all(m["estimateWeeks"] is None for m in stage["milestones"]))

    def test_none_of_the_old_invented_content_survives(self):
        text = json.dumps(run(RESUME_ONLY, GITHUB_ONLY), default=str)
        for invented in ("Publish 2 papers", "Center of Excellence", "Advanced LLM Evaluation", "Final Year", "Research Grant", "B.Tech"):
            self.assertNotIn(invented, text)

    def test_legacy_columns_are_filled_from_the_same_source(self):
        legacy = engine.legacy_roadmap(run(RESUME_ONLY, user={"degree": "B.Sc"})["roadmap"])
        self.assertEqual(legacy["current_stage"], "B.Sc")
        self.assertTrue(legacy["short_term"]["milestones"])
        self.assertEqual(engine.legacy_roadmap(None), None)


def _earlier(road, stage):
    names = []
    for s in road["stages"]:
        if s is stage:
            break
        names += [m["skill"] for m in s["milestones"]]
    return names


class Graph(unittest.TestCase):
    def test_every_edge_is_real_evidence_or_a_documented_relation(self):
        graph = run(RESUME_ONLY, GITHUB_ONLY)["graph"]
        names = {n["name"] for n in graph["nodes"]}
        ontology = {(s, canonical(t) or t) for s, targets in SKILL_ONTOLOGY.items() for t, _w in targets}
        for e in graph["edges"]:
            self.assertIn(e["source"], names)
            self.assertIn(e["target"], names)
            if e["basis"] == "evidence":
                self.assertTrue(e["evidence"])
            else:
                self.assertIn((e["source"], e["target"]), ontology)

    def test_used_together_comes_from_a_shared_repository(self):
        graph = run(repos=GITHUB_ONLY)["graph"]
        edge = next(e for e in graph["edges"] if e["relationship"] == "used_together")
        self.assertEqual({edge["source"], edge["target"]}, {"PyTorch", "Python"})

    def test_no_invented_hub_and_it_stays_a_readable_size(self):
        graph = run(repos=[repo(f"a/r{i}", {f"Lang{j}": 10 for j in range(30)}) for i in range(3)])["graph"]
        self.assertLessEqual(len(graph["nodes"]), engine.MAX_GRAPH_NODES)
        self.assertNotIn("AI/ML", {n["name"] for n in graph["nodes"]})
        self.assertGreater(graph["totalSkills"], engine.MAX_GRAPH_NODES)

    def test_empty_profile_has_an_empty_graph(self):
        self.assertEqual(run()["graph"]["nodes"], [])


class NoAiInTheEngine(unittest.TestCase):
    def test_the_engine_never_calls_a_provider(self):
        with mock.patch.object(provider_router, "route_llm", side_effect=AssertionError("LLM called")), \
                mock.patch("urllib.request.urlopen", side_effect=AssertionError("network used")):
            run(RESUME_ONLY, GITHUB_ONLY, roles=tuple(ROLE_SKILLS))


class NextActions(unittest.TestCase):
    def test_offers_no_feature_that_does_not_exist_and_no_invented_skill(self):
        actions = generate_next_best_actions({"career_role": "ml_engineer", "github_connected": True}, [], 1.0)
        text = json.dumps(actions)
        self.assertNotIn("assessment", text.lower())
        self.assertNotIn("Advanced AI", text)

    def test_only_suggests_github_when_not_connected(self):
        self.assertFalse(any("GitHub" in a["title"] for a in generate_next_best_actions({"github_connected": True}, [], 1.0)))
        self.assertTrue(any("GitHub" in a["title"] for a in generate_next_best_actions({"github_connected": False}, [], 1.0)))


class Performance(unittest.TestCase):
    def test_a_heavy_profile_computes_quickly_and_stays_a_reasonable_size(self):
        repos = [repo(f"a/r{i}", {"Python": 5000, "C++": 100, "SQL": 300}, ["pytorch", "docker", "aws"], "pytorch and kubernetes") for i in range(100)]
        facts = RESUME_ONLY + [fact("skills", "skill", f"Skill{i}") for i in range(200)]
        started = time.perf_counter()
        out = run(facts, repos, roles=tuple(ROLE_SKILLS))
        self.assertLess(time.perf_counter() - started, 1.0)
        out.pop("_ledger")  # never stored in the view
        # Every role at once is the worst case; engine v3 adds per-competency explanations (why, priority reason).
        self.assertLess(len(json.dumps(out, default=str)), 500_000)


if __name__ == "__main__":
    unittest.main()
