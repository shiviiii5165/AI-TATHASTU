"""Engine v4: code signals, evidence gates, project intent, the complete gap inventory, curated learning and the layered
roadmap, through the ten student situations the product has to handle. Pure: no database, no network."""

from __future__ import annotations

import base64
import io
import json
import sys
import unittest
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from intelligence import career_engine as engine, code_signals, learning, project_intent  # noqa: E402
from intelligence.frameworks import COMPETENCIES, CURRENT_ROLES, FRAMEWORKS  # noqa: E402
from skills_catalog import KIND, alias_map, kind_of  # noqa: E402
from test_career_engine import NOW, OLD, canonical, code_repo, fact, lexicon, repo, with_login  # noqa: E402
from test_career_scenarios import CATEGORIES, project  # noqa: E402


def run(facts=(), repos=(), roles=("ml_engineer",), learning_records=None, user=None, intent=None, context=None):
    out = engine.compute(user=user or {}, roles=list(roles), facts=with_login(facts, repos), repos=list(repos), canonical=canonical, lexicon_scan=lexicon,
                         categories=CATEGORIES, now=NOW, learning=learning_records, intent_text=intent, context=context)
    out.pop("_ledger")
    return out


def skill(out, name):
    return next((s for s in out["skills"] if s["name"] == name), None)


def inv(out, name):
    return next((r for r in out["gapInventory"] if r["skill"] == name), None)


def goal(text):
    return fact("goals", "project_intent", text, origin="user_entered")


def milestones(out):
    return [m for s in out["roadmap"]["stages"] for m in s["milestones"]]


# ─── Ontology and code signals ──────────────────────────────────────────────


class Ontology(unittest.TestCase):
    def test_linguist_names_resolve_to_real_skills(self):
        aliases = alias_map()
        self.assertEqual(aliases["dockerfile"], "Docker")
        self.assertEqual(aliases["plpgsql"], "SQL")
        self.assertEqual(aliases["hcl"], "Terraform")
        self.assertEqual(aliases["scss"], "CSS")

    def test_a_language_a_framework_a_concept_and_a_capability_are_different_things(self):
        self.assertEqual(KIND["Python"], "language")
        self.assertEqual(KIND["PyTorch"], "framework")
        self.assertEqual(KIND["Large Language Models"], "concept")
        self.assertEqual(KIND["Model Evaluation"], "capability")
        self.assertEqual(KIND["Kubernetes"], "platform")
        self.assertEqual(kind_of("ML Engineer"), "unknown", "a career role is not a skill")

    def test_every_framework_competency_is_a_catalogue_skill(self):
        names = set(alias_map().values())
        for c in COMPETENCIES:
            self.assertIn(c, names, c)

    def test_a_canonical_name_beats_another_skills_alias(self):
        self.assertEqual(alias_map()["github actions"], "CI/CD")


class Manifests(unittest.TestCase):
    def test_requirements_pyproject_poetry_conda_setup_pipfile_and_package_json(self):
        self.assertEqual(code_signals.parse_manifest("requirements.txt", "torch>=2.1\n# c\nscikit_learn==1.4 ; python_version>'3'\n-r base.txt\n"), ["scikit-learn", "torch"])
        self.assertEqual(code_signals.parse_manifest("pyproject.toml", '[project]\ndependencies = ["transformers>=4", "peft"]\n'), ["peft", "transformers"])
        self.assertEqual(code_signals.parse_manifest("pyproject.toml", '[tool.poetry.dependencies]\npython = "^3.11"\nfastapi = "^0.110"\n'), ["fastapi"])
        self.assertEqual(code_signals.parse_manifest("environment.yml", "dependencies:\n  - python=3.11\n  - numpy\n  - pip:\n    - wandb\n"), ["numpy", "wandb"])
        self.assertEqual(code_signals.parse_manifest("setup.py", "setup(install_requires=['opencv-python', 'ultralytics'])"), ["opencv-python", "ultralytics"])
        self.assertEqual(code_signals.parse_manifest("Pipfile", "[packages]\nlangchain = '*'\n"), ["langchain"])
        self.assertEqual(code_signals.parse_manifest("package.json", '{"dependencies": {"next": "15", "@anthropic-ai/sdk": "1"}, "devDependencies": {"vitest": "2"}}'), ["@anthropic-ai/sdk", "next", "vitest"])
        self.assertEqual(code_signals.parse_manifest("package.json", "not json"), [])
        # Markers in quoted strings (seen on openai/whisper) never become packages.
        marked = '[project]\ndependencies = [\n "triton>=2; platform_machine==\'x86_64\' and sys_platform==\'linux\'",\n "numpy",\n]\n'
        self.assertEqual(code_signals.parse_manifest("pyproject.toml", marked), ["numpy", "triton"])

    def test_packages_map_to_what_they_are_for_and_general_packages_to_nothing_more(self):
        self.assertEqual(code_signals.skills_for_package("scikit-learn"), ("scikit-learn", "Machine Learning"))
        self.assertEqual(code_signals.skills_for_package("google-cloud-storage"), ("Google Cloud",))
        self.assertEqual(code_signals.skills_for_package("requests"), ())
        self.assertEqual(code_signals.skills_for_package("pillow"), ())

    def test_every_mapped_skill_is_in_the_catalogue(self):
        names = set(alias_map().values())
        for package, skills in code_signals.PACKAGE_SKILLS.items():
            for s in skills:
                self.assertIn(s, names, package)

    def test_structure_flags(self):
        flags = code_signals.structure_from_listing(["src", "tests", "Dockerfile", "main.tf", "train.ipynb", ".github"], workflow_files=2)
        self.assertEqual((flags["tests"], flags["ci"], flags["dockerfile"], flags["terraform"], flags["notebooks"]), (True, True, True, True, 1))
        self.assertEqual(code_signals.structure_from_listing(["README.md"])["tests"], False)


class ConnectorSignals(unittest.TestCase):
    """fetch_code_signals and collect_signals against a fake GitHub: what's read, what's reused, what's stored."""

    def client(self, files, calls):
        def b64(text):
            return {"encoding": "base64", "content": base64.b64encode(text.encode()).decode(), "size": len(text)}

        class Client:
            def get(self, path):
                calls.append(path)
                if path.endswith("/contents/"):
                    return [{"name": n, "type": "dir" if n in (".github", "tests") else "file", "size": len(files.get(n, ""))} for n in files], {}
                if path.endswith("/contents/.github/workflows"):
                    return [{"name": "ci.yml"}], {}
                if path.endswith("/readme"):
                    if "README.md" not in files:
                        raise urllib.error.HTTPError(path, 404, "Not Found", {}, io.BytesIO(b""))
                    return b64(files["README.md"]), {}
                name = path.rsplit("/contents/", 1)[1]
                return b64(files[name]), {}
        return Client()

    def test_reads_manifests_structure_and_readme_skills_but_stores_no_readme_text(self):
        from connectors import github
        calls = []
        files = {"requirements.txt": "torch\nscikit-learn\n", "tests": "", ".github": "", "Dockerfile": "FROM python", "README.md": "We report cross-validation scores and use PyTorch."}
        out = github.fetch_code_signals(self.client(files, calls), {"full_name": "a/x", "pushed_at": "2026-10-01T00:00:00Z", "private": True}, lexicon)
        self.assertEqual(out["manifests"], {"requirements.txt": ["scikit-learn", "torch"]})
        self.assertTrue(out["structure"]["tests"] and out["structure"]["ci"] and out["structure"]["dockerfile"])
        self.assertIn("Model Evaluation", out["readme"]["skills"])
        self.assertNotIn("cross-validation scores", json.dumps(out), "README text is never stored")
        self.assertTrue(out["private"])
        self.assertTrue(code_signals.was_read(out))

    def test_an_unchanged_repository_reuses_its_signals_without_a_request(self):
        from connectors import github
        calls = []
        old = {"version": 2, "pushedAt": "2026-10-01T00:00:00Z", "manifests": {"requirements.txt": ["torch"]}, "structure": {}, "readme": {}}
        out = github.collect_signals(self.client({}, calls), [{"full_name": "a/x", "pushed_at": "2026-10-01T00:00:00Z"}], {"a/x": old})
        self.assertEqual(out["a/x"], old)
        self.assertEqual(calls, [])

    def test_a_failure_stops_fetching_but_never_fails_the_sync(self):
        from connectors import github

        class Broken:
            def get(self, path):
                raise urllib.error.HTTPError(path, 502, "Bad Gateway", {}, io.BytesIO(b""))
        out = github.collect_signals(Broken(), [{"full_name": "a/x", "pushed_at": "t"}, {"full_name": "a/y", "pushed_at": "t"}], {})
        self.assertEqual(out, {})


# ─── The ten student situations ─────────────────────────────────────────────

RESUME_STRONG = (
    [fact("skills", "skill", s) for s in ("Python", "PyTorch", "Machine Learning", "Docker", "SQL")]
    + project("p1", "Fraud detector", ["Python", "scikit-learn"], "Trained a machine learning model with scikit-learn and reported precision and recall")
    + project("p2", "Image classifier", ["Python", "PyTorch"], "Fine-tuned a convolutional neural network with PyTorch")
    + [fact("experience", "role", "ML Intern", record="e1"), fact("experience", "description", "Built a machine learning pipeline in Python with pandas", record="e1")]
)
GITHUB_STRONG = [code_repo(f"me/r{i}", {"Python": 300_000}, ["torch", "scikit-learn", "pandas", "statsmodels", "fastapi"], tests=True, ci=True,
                           dockerfile=True, readme=["Model Evaluation", "Data Preparation", "Model Deployment"]) for i in range(5)]


class P1_StrongResumeLittleProjectEvidence(unittest.TestCase):
    def setUp(self):
        self.out = run(RESUME_STRONG)

    def test_described_skills_are_capped_and_honestly_labelled(self):
        s = skill(self.out, "PyTorch")
        self.assertEqual(s["evidenceBasis"], "described")
        self.assertLessEqual(s["proficiency"], engine.UNVERIFIED_CAP)
        self.assertTrue(any("Described in" in b for b in s["levelBasis"]))
        self.assertTrue(any("Listed in your skills" in b for b in s["levelBasis"]))
        # Many descriptions reach the cap, and then the cap says why.
        many = run([fact("projects", "technologies", ["PyTorch"], record=f"p{i}") for i in range(6)] + [fact("experience", "description", "Trained models with PyTorch", record="e1")])
        self.assertIn("Only your own descriptions", skill(many, "PyTorch")["levelCap"])
        self.assertIn("public repository", skill(many, "PyTorch")["nextLevel"])

    def test_required_skills_need_proof_not_courses(self):
        row = inv(self.out, "PyTorch")
        self.assertEqual(row["category"], "proof_needed")
        self.assertNotIn("PyTorch", {r["skill"] for r in self.out["recommendations"]})
        self.assertEqual(self.out["roles"][0]["alignment"]["requiredMet"], 0)


class P2_StrongGithubIncompleteResume(unittest.TestCase):
    def setUp(self):
        self.out = run(repos=GITHUB_STRONG)

    def test_code_evidence_meets_requirements_without_a_resume(self):
        a = self.out["roles"][0]["alignment"]
        self.assertEqual(a["state"], "requirements_demonstrated")
        self.assertEqual(skill(self.out, "Machine Learning")["evidenceBasis"], "demonstrated")
        self.assertTrue(any("uses scikit-learn" in e["label"] for e in skill(self.out, "Machine Learning")["evidence"]))

    def test_coverage_reports_the_missing_resume(self):
        resume = next(s for s in self.out["dataCoverage"]["sources"] if s["id"] == "resume")
        self.assertEqual(resume["status"], "missing")
        gh = next(s for s in self.out["dataCoverage"]["sources"] if s["id"] == "github")
        self.assertIn("read for 5 of them", gh["detail"])

    def test_achievements_are_only_verified_accomplishments(self):
        achievements = self.out["roadmap"]["achievements"]
        self.assertTrue(achievements)
        met = {r["skill"] for r in self.out["roles"][0]["skills"] if r["state"] == "met"}
        self.assertTrue({a["skill"] for a in achievements} <= met)
        self.assertTrue(all(a["evidence"] for a in achievements))


class P3_ManyClaimsLittleWork(unittest.TestCase):
    def test_claims_never_raise_levels_or_alignment(self):
        claims = [fact("skills", "skill", c) for c in COMPETENCIES]
        out = run(claims)
        self.assertTrue(all(s["proficiency"] is None for s in out["skills"]))
        self.assertEqual(out["roles"][0]["alignment"]["state"], "early")
        self.assertTrue(all(r["category"] in ("proof_needed",) for r in out["roles"][0]["skills"]))
        self.assertEqual(out["recommendations"], [], "claimed skills need proof, not courses")


class P4_StrongProgrammingWeakML(unittest.TestCase):
    def setUp(self):
        self.out = run(repos=[code_repo(f"me/web{i}", {"Python": 400_000, "TypeScript": 300_000}, ["fastapi", "pytest"], tests=True, ci=True) for i in range(5)])

    def test_python_meets_but_ml_foundations_lead_the_inventory(self):
        self.assertEqual(inv(self.out, "Python")["category"], "meets")
        first = next(r for r in self.out["gapInventory"] if r["category"] != "meets")
        self.assertEqual(first["skill"], "Statistics")
        self.assertEqual(first["priorityGroupLabel"], "Foundation for required skills")
        self.assertIn("Machine Learning", first["unblocks"])

    def test_missing_evidence_is_never_called_missing_ability(self):
        text = json.dumps(self.out)
        for phrase in ("lack of knowledge", "doesn't know", "missing ability", "you lack"):
            self.assertNotIn(phrase, text.lower())
        self.assertEqual(inv(self.out, "Machine Learning")["categoryLabel"], "Not shown yet")


class P5_DataScientistToMLEngineer(unittest.TestCase):
    def test_same_evidence_reassessed_and_the_change_is_visible(self):
        repos = [code_repo(f"me/ds{i}", {"Python": 200_000, "Jupyter Notebook": 900_000}, ["pandas", "scikit-learn", "statsmodels", "matplotlib"],
                           readme=["Data Preparation", "Model Evaluation", "Data Visualization"]) for i in range(4)]
        ds = run(repos=repos, roles=("data_scientist",))
        ml = run(repos=repos, roles=("ml_engineer",))
        self.assertEqual(skill(ds, "Pandas"), skill(ml, "Pandas"), "evidence is reused unchanged")
        self.assertEqual(inv(ml, "Model Deployment")["category"], "not_shown")
        self.assertIsNone(inv(ds, "Model Deployment"), "deployment isn't part of the data scientist framework")
        self.assertNotEqual(ds["roadmap"]["stages"][0]["skills"], ml["roadmap"]["stages"][0]["skills"])


class P6_LLMApplicationEngineer(unittest.TestCase):
    def setUp(self):
        repos = [code_repo("me/bot", {"Python": 80_000}, ["openai", "langchain", "chromadb", "fastapi"], readme=["Retrieval-Augmented Generation"]),
                 code_repo("me/ui", {"TypeScript": 120_000}, ["next", "@anthropic-ai/sdk", "vitest"], tests=True, manifest="package.json")]
        self.out = run(repos=repos, roles=("llm_application_engineer",))

    def test_llm_stack_comes_from_dependency_files(self):
        llm = skill(self.out, "Large Language Models")
        self.assertEqual(llm["codeRepositories"], 2)
        self.assertEqual(skill(self.out, "Vector Databases")["evidenceBasis"], "demonstrated")
        self.assertEqual(skill(self.out, "LangChain")["evidenceBasis"], "demonstrated")

    def test_framework_tools_are_supporting_not_required(self):
        row = next(r for r in self.out["roles"][0]["skills"] if r["skill"] == "LangChain")
        self.assertEqual(row["tier"], "supporting")

    def test_recommendations_are_level_aware_and_explained(self):
        for r in self.out["recommendations"]:
            if r["resource"]:
                self.assertTrue(r["resource"]["fitReason"].endswith("."))
                self.assertIn(r["skill"], learning.CATALOGUE_SKILLS if hasattr(learning, "CATALOGUE_SKILLS") else {s for x in learning.RESOURCES for s in x["skills"]})
                self.assertTrue(r["demonstration"])


class P7_AIResearchEngineer(unittest.TestCase):
    def test_research_framework_asks_for_experimental_rigour(self):
        out = run(repos=[code_repo(f"me/paper{i}", {"Python": 200_000}, ["torch", "wandb"], readme=["Experimental Design"]) for i in range(3)], roles=("ai_researcher",))
        row = next(r for r in out["roles"][0]["skills"] if r["skill"] == "Experimental Design")
        self.assertEqual((row["tier"], row["expectedLevel"]), ("required", "Proficient"))
        self.assertEqual(skill(out, "Experimental Design")["evidenceBasis"], "demonstrated")
        self.assertTrue(out["roles"][0]["framework"]["references"])


class P8_ClearIdeaNoImplementation(unittest.TestCase):
    def setUp(self):
        self.out = run([fact("skills", "skill", "Python"), goal(
            "A voice assistant for farmers that answers crop questions from government PDFs in Hindi, running on a cheap Android phone offline.")])

    def test_project_requirements_come_from_the_description_with_their_triggers(self):
        p = self.out["project"]
        self.assertEqual(p["status"], "analysed")
        rows = {r["skill"]: r for r in p["rows"]}
        for needed in ("Speech Recognition", "Retrieval-Augmented Generation", "On-device ML", "Model Quantization"):
            self.assertIn(needed, rows, needed)
        self.assertIn("pdfs", rows["Retrieval-Augmented Generation"]["triggers"])
        self.assertTrue(all(r["why"] for r in p["rows"]))

    def test_project_and_career_requirements_are_kept_apart(self):
        p = self.out["project"]
        self.assertIn("Speech Recognition", p["projectOnly"])
        self.assertIn("Machine Learning", p["careerOnly"])
        self.assertTrue(p["closestRoles"])
        self.assertTrue(any("project" in r["sources"] for r in self.out["gapInventory"]))

    def test_roadmap_includes_project_skills_in_dependency_order(self):
        order = [m["skill"] for m in milestones(self.out)]
        self.assertIn("Retrieval-Augmented Generation", order)
        self.assertLess(order.index("Large Language Models"), order.index("Retrieval-Augmented Generation"))
        self.assertTrue(any(m["sources"] == ["project"] for m in milestones(self.out)))

    def test_a_vague_goal_is_not_guessed_at(self):
        out = run([fact("skills", "skill", "Python"), goal("Something cool with AI that helps people")])
        self.assertEqual(out["project"]["status"], "too_vague")
        self.assertEqual(out["project"]["rows"], [])
        self.assertTrue(out["project"]["prompts"])

    def test_the_onboarding_other_text_is_the_fallback(self):
        out = run([fact("skills", "skill", "Python")], intent="A chatbot over my lecture notes")
        self.assertEqual((out["project"]["status"], out["project"]["source"]), ("analysed", "onboarding_other"))
        self.assertEqual(run([fact("skills", "skill", "Python"), goal("A forecasting dashboard for shop sales")], intent="A chatbot")["project"]["source"], "profile")


class P9_PrivateOrInaccessibleRepositories(unittest.TestCase):
    def test_unread_repositories_are_reported_not_assumed(self):
        out = run(repos=[repo("me/private-thing", {"Python": 200_000}, ["pytorch"])])
        gh = next(s for s in out["dataCoverage"]["sources"] if s["id"] == "github")
        self.assertIn("read for 0 of them", gh["detail"])
        self.assertTrue(any("haven't had their files read" in l for l in gh["limits"]))
        self.assertEqual(skill(out, "PyTorch")["evidenceBasis"], "repository_mention")

    def test_an_empty_or_unreadable_repository_says_so(self):
        out = run(repos=[repo("me/empty", {}, signals={"version": 1, "unavailable": "empty repository"})])
        gh = next(s for s in out["dataCoverage"]["sources"] if s["id"] == "github")
        self.assertIn("read for 0 of them", gh["detail"])

    def test_private_repositories_are_counted_when_access_was_granted(self):
        r = code_repo("me/p", packages=["torch"])
        r["code_signals"]["private"] = True
        gh = next(s for s in run(repos=[r])["dataCoverage"]["sources"] if s["id"] == "github")
        self.assertTrue(any("private repository" in l for l in gh["limits"]))


class P10_IncompleteOrConflictingProfile(unittest.TestCase):
    def test_nothing_to_read_is_not_assessed_everywhere(self):
        out = run([fact("identity", "full_name", "Asha", origin="user_entered")])
        self.assertFalse(out["hasEvidenceBase"])
        self.assertTrue(all(r["category"] == "not_assessed" for r in out["roles"][0]["skills"]))
        self.assertEqual(out["recommendations"], [])

    def test_a_claim_contradicted_by_nothing_stays_a_claim_and_old_code_counts_less(self):
        out = run([fact("skills", "skill", "Rust")], [repo("me/old", {"Python": 300_000}, pushed=OLD)])
        self.assertIsNone(skill(out, "Rust")["proficiency"])
        recent = run(repos=[repo("me/new", {"Python": 300_000})])
        self.assertLess(skill(out, "Python")["proficiency"], skill(recent, "Python")["proficiency"])
        self.assertTrue(any("months ago" in b for b in skill(out, "Python")["levelBasis"]))

    def test_a_goal_without_a_framework_says_so(self):
        out = run(repos=GITHUB_STRONG, roles=("still_exploring",))
        self.assertEqual(out["unsupportedRoles"], ["still_exploring"])
        self.assertIsNone(out["roadmap"])


# ─── Cross-component consistency ────────────────────────────────────────────

PROFILES = {
    "resume": dict(facts=RESUME_STRONG),
    "github": dict(repos=GITHUB_STRONG),
    "both+project": dict(facts=RESUME_STRONG + [goal("A RAG chatbot over course PDFs deployed as a web app")], repos=GITHUB_STRONG[:2]),
    "claims": dict(facts=[fact("skills", "skill", c) for c in ("Python", "Kubernetes", "PyTorch")]),
    "two goals": dict(facts=RESUME_STRONG, repos=GITHUB_STRONG[:1], roles=("ml_engineer", "mlops_engineer")),
}


class OneAnswerEverywhere(unittest.TestCase):
    def each(self):
        for label, kwargs in PROFILES.items():
            with self.subTest(profile=label):
                yield run(**kwargs)

    def test_role_rows_inventory_and_skills_agree_on_level_and_state(self):
        for out in self.each():
            scores = {s["name"]: s["proficiency"] for s in out["skills"]}
            primary = out["roles"][0]
            for row in primary["skills"]:
                self.assertEqual(row["proficiency"], scores.get(row["skill"]))
                i = inv(out, row["skill"])
                self.assertEqual((i["proficiency"], i["level"]), (row["proficiency"], row["level"]))
                if "project" not in i["sources"]:
                    self.assertEqual(i["state"], row["state"])

    def test_the_inventory_is_complete(self):
        for out in self.each():
            names = {r["skill"] for r in out["gapInventory"]}
            self.assertTrue({r["skill"] for r in out["roles"][0]["skills"]} <= names, "every framework skill is in the inventory")
            self.assertTrue({r["skill"] for r in out["project"].get("rows", [])} <= names, "every project skill is in the inventory")
            ranks = [r["inventoryRank"] for r in out["gapInventory"] if r["category"] != "meets"]
            self.assertEqual(ranks, list(range(1, len(ranks) + 1)))
            for r in out["gapInventory"]:
                self.assertTrue(r["inventoryReason"] and r["categoryLabel"])
                if r["category"] != "meets":
                    self.assertTrue(r["action"])

    def test_recommendations_and_roadmap_only_address_open_inventory_gaps(self):
        for out in self.each():
            open_ = {r["skill"] for r in out["gapInventory"] if r["category"] != "meets"}
            self.assertTrue({r["skill"] for r in out["recommendations"]} <= open_)
            if out["roadmap"]:
                self.assertEqual({m["skill"] for m in milestones(out)}, open_, "every open gap has exactly one place on the roadmap")
                self.assertTrue(set(out["roadmap"]["completed"]).isdisjoint(open_))

    def test_roadmap_stages_respect_dependencies_and_say_how_they_complete(self):
        for out in self.each():
            if not out["roadmap"]:
                continue
            seen = set(out["roadmap"]["completed"]) | {r["skill"] for r in out["gapInventory"] if r["category"] == "meets"}
            for stage in out["roadmap"]["stages"]:
                self.assertTrue(stage["purpose"] and stage["completionCriteria"])
                names = {m["skill"] for m in stage["milestones"]}
                for m in stage["milestones"]:
                    self.assertTrue(set(m["requires"]) - names <= seen, (stage["title"], m["skill"], m["requires"]))
                seen |= names

    def test_no_component_invents_a_skill(self):
        for out in self.each():
            known = set(COMPETENCIES) | {s["name"] for s in out["skills"]}
            for r in out["gapInventory"] + out["recommendations"]:
                self.assertIn(r["skill"], known)


class AllTwentyRoles(unittest.TestCase):
    def test_every_role_analyses_with_its_own_framework(self):
        out = run(RESUME_STRONG, GITHUB_STRONG[:2], roles=CURRENT_ROLES)
        self.assertEqual([r["role"] for r in out["roles"]], list(CURRENT_ROLES))
        self.assertEqual(len(CURRENT_ROLES), 20)
        for analysis in out["roles"]:
            fw = FRAMEWORKS[analysis["role"]]
            self.assertEqual({r["skill"] for r in analysis["skills"]}, {q.competency for q in fw.requirements})

    def test_each_role_alone_produces_a_coherent_plan(self):
        for role in CURRENT_ROLES:
            with self.subTest(role=role):
                out = run(RESUME_STRONG, GITHUB_STRONG[:1], roles=(role,))
                a = out["roles"][0]
                self.assertTrue(a["framework"]["references"])
                self.assertTrue(all(r["whyItMatters"] for r in a["skills"]))
                self.assertTrue(a["specialisations"])
                self.assertTrue(out["roadmap"]["stages"])
                for r in out["recommendations"]:
                    self.assertTrue(r["resource"] or r["noResourceReason"])


class LearningCatalogue(unittest.TestCase):
    def test_most_framework_competencies_have_a_checked_resource(self):
        cover = learning.coverage()
        missing = sorted(c for c in COMPETENCIES if not cover.get(c, {}).get("verified"))
        # Known, reported honestly in the UI ("no checked resource yet"). Keep the list short and reviewed.
        self.assertLessEqual(len(missing), 8, missing)

    def test_level_awareness(self):
        beginner = learning.choose("PyTorch", None, "Proficient", False, {"Python"}, {"PyTorch"}, NOW)["resource"]
        practising = learning.choose("PyTorch", "Working", "Proficient", True, {"Python", "PyTorch", "Deep Learning"}, {"PyTorch"}, NOW)["resource"]
        self.assertEqual(beginner["levelWindow"]["start"], "none")
        self.assertNotEqual(practising["levelWindow"]["start"], "none")


class ProjectIntentRules(unittest.TestCase):
    def analyse(self, text):
        return project_intent.analyse(text, lexicon, lambda s: s in COMPETENCIES)

    def test_conditional_rules_need_their_context(self):
        fraud = {r["skill"] for r in self.analyse("Detect fraud in bank transactions")["requirements"]}
        self.assertNotIn("Object Detection", fraud, "'detect' only means object detection when images are involved")
        self.assertIn("Machine Learning", fraud)
        cars = {r["skill"] for r in self.analyse("Detect cars in traffic camera video")["requirements"]}
        self.assertIn("Object Detection", cars)

    def test_named_skills_are_always_included(self):
        reqs = {r["skill"]: r for r in self.analyse("A recommendation engine for books built with PyTorch")["requirements"]}
        self.assertEqual(reqs["PyTorch"]["importance"], "core")
        self.assertIn("Recommender Systems", reqs)

    def reqs(self, text):
        return {r["skill"] for r in self.analyse(text)["requirements"]}

    def test_real_world_descriptions(self):
        self.assertTrue({"AI Agents", "Large Language Models"} <= self.reqs("An AI coding agent that reads a GitHub issue, edits the code, runs the tests and opens a pull request."))
        self.assertTrue({"Retrieval-Augmented Generation", "Embeddings", "Vector Databases"} <= self.reqs("RAG app for our company HR policies so employees can ask questions in Slack."))
        self.assertTrue({"Computer Vision", "Object Detection", "On-device ML"} <= self.reqs("A mobile app that detects plant diseases from leaf photos for farmers, working offline."))
        self.assertTrue({"Speech Recognition", "Audio Signal Processing"} <= self.reqs("Transcribe lectures in Hindi and English."))
        self.assertTrue({"Vision-Language Models", "Text-to-Speech"} <= self.reqs("An assistant that looks at screenshots of my screen and explains errors to me by voice."))
        self.assertTrue({"ROS", "Control Systems", "Computer Vision"} <= self.reqs("A small wheeled robot that maps my room and avoids obstacles using a camera."))
        self.assertIn("Audio Signal Processing", self.reqs("Predict which bird songs belong to which species from field recordings."))

    def test_known_false_readings_are_gone(self):
        self.assertNotIn("AI Agents", self.reqs("An AI tool with a website for real estate agents to list houses, recommending houses to buyers."))
        self.assertNotIn("Experimental Design", self.reqs("An AI research assistant that summarises arXiv papers."))
        self.assertEqual(self.analyse("A website for my shop.")["status"], "too_vague", "a website alone isn't an AI project")

    def test_ambiguous_words_become_questions_not_requirements(self):
        a = self.analyse("Transcribe lectures and produce searchable notes.")
        self.assertNotIn("Vector Databases", {r["skill"] for r in a["requirements"]})
        self.assertIn("Vector Databases", {r["skill"] for r in a["possible"]})
        self.assertTrue(all(r["certainty"] == "possible" for r in a["possible"]))
        self.assertTrue(any("documents" in q for q in a["questions"]))
        vague = self.analyse("A bot that trades crypto.")
        self.assertTrue(vague["questions"])

    def test_possible_readings_stay_out_of_the_plan(self):
        out = run([fact("skills", "skill", "Python"), goal("Transcribe lectures and produce searchable notes.")])
        self.assertIn("Vector Databases", {r["skill"] for r in out["project"]["possible"]})
        self.assertNotIn("Vector Databases", {r["skill"] for r in out["gapInventory"] if "project" in r["sources"]})

    def test_deterministic(self):
        text = "An agent that books meetings from my emails"
        self.assertEqual(self.analyse(text), self.analyse(text))


class SubmissionsAreReadOnlyWhenWeCan(unittest.TestCase):
    def test_a_synced_repository_link_is_read_and_another_link_is_explained(self):
        repos = [code_repo("me/stats-work", packages=["statsmodels"])]
        subs = [{"milestoneId": "ml_engineer:statistics", "evidenceUrl": "https://github.com/me/stats-work", "createdAt": "2026-11-01"},
                {"milestoneId": "ml_engineer:model-deployment", "evidenceUrl": "https://example.com/my-blog", "createdAt": "2026-11-01"}]
        out = run(repos=repos, context={"submissions": subs})
        by = {m["skill"]: m for m in milestones(out)}
        self.assertEqual(by["Model Deployment"]["submissionCheck"]["status"], "not_readable")
        stats = by.get("Statistics")
        if stats:  # Statistics may already be met from the same repository
            self.assertEqual(stats["submissionCheck"]["status"], "read")


if __name__ == "__main__":
    unittest.main()
