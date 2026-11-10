"""All 20 career pathways: one canonical registry, structured draft frameworks, distinct requirements, role-specific roadmaps."""

import json
import unittest
from pathlib import Path

from intelligence import frameworks as fw
from intelligence.career_engine import PREREQUISITES, analyze_role, build_roadmap, milestone_id
from intelligence.config import ROLE_PROJECT_CONTEXT, ROLE_SKILLS
from intelligence.matching import ROLE_LABELS as MATCHING_LABELS
from skills_catalog import CATALOG, alias_map

SELECTABLE = [
    "ml_engineer", "data_scientist", "deep_learning_engineer", "generative_ai_engineer", "llm_application_engineer",
    "llm_model_engineer", "mlops_engineer", "llmops_engineer", "ai_agent_engineer", "nlp_engineer",
    "computer_vision_engineer", "multimodal_ai_engineer", "speech_ai_engineer", "rl_engineer", "robotics_ai_engineer",
    "graph_ai_engineer", "ai_infrastructure_engineer", "ai_evaluation_safety_engineer", "edge_federated_ai_engineer",
    "ai_researcher",
]
LABELS = {
    "ml_engineer": "ML Engineer", "data_scientist": "Data Scientist", "deep_learning_engineer": "Deep Learning Engineer",
    "generative_ai_engineer": "Generative AI Engineer", "llm_application_engineer": "LLM Application Engineer",
    "llm_model_engineer": "LLM Model Engineer", "mlops_engineer": "MLOps Engineer", "llmops_engineer": "LLMOps Engineer",
    "ai_agent_engineer": "AI Agent Engineer", "nlp_engineer": "Natural Language Processing (NLP) Engineer",
    "computer_vision_engineer": "Computer Vision Engineer", "multimodal_ai_engineer": "Multimodal AI Engineer",
    "speech_ai_engineer": "Speech AI Engineer", "rl_engineer": "Reinforcement Learning Engineer",
    "robotics_ai_engineer": "Robotics Engineer", "graph_ai_engineer": "Graph AI Engineer",
    "ai_infrastructure_engineer": "AI Infrastructure Engineer", "ai_evaluation_safety_engineer": "AI Evaluation & Safety Engineer",
    "edge_federated_ai_engineer": "Edge & Federated AI Engineer", "ai_researcher": "AI Research Engineer / Applied AI Scientist",
}
CANONICAL = {name for name, *_ in CATALOG}
REGISTRY_FILE = Path(fw.__file__).with_name("frameworks") / "career_roles.json"


def ident(name):
    return name


def skills_at(met, score=60.0, state="demonstrated"):
    """Synthetic engine skills: every name in `met` at `score` with the given evidence state."""
    return {n: {"name": n, "proficiency": score, "level": "Proficient", "confidence": 0.8, "evidenceState": state,
                "status": "verified" if state == "demonstrated" else "claimed", "evidence": [{"label": f"repo-{n}"}]} for n in met}


class Registry(unittest.TestCase):
    def test_exactly_the_20_current_pathways_with_their_labels(self):
        self.assertEqual(list(fw.CURRENT_ROLES), SELECTABLE)
        for role, label in LABELS.items():
            self.assertEqual(fw.ROLE_LABELS[role], label)

    def test_retired_roles_stay_resolvable_but_not_current(self):
        for role in ("ai_engineer", "ai_product_founder", "still_exploring"):
            self.assertIn(role, fw.RETIRED_ROLES)
            self.assertNotIn(role, fw.CURRENT_ROLES)
            self.assertIn(role, fw.ROLE_LABELS)

    def test_matching_uses_the_registry_not_a_copy(self):
        self.assertIs(MATCHING_LABELS, fw.ROLE_LABELS)

    def test_registry_file_has_no_duplicate_ids(self):
        ids = [r["id"] for r in json.loads(REGISTRY_FILE.read_text(encoding="utf-8"))["roles"]]
        self.assertEqual(len(ids), len(set(ids)))


class Frameworks(unittest.TestCase):
    def test_data_is_valid(self):
        self.assertEqual(fw.validate(), [])

    def test_versioned_and_marked_draft_with_provenance(self):
        self.assertTrue(fw.FRAMEWORK_VERSION)
        self.assertEqual(fw.FRAMEWORK_STATUS, "draft_unreviewed")
        self.assertIsNone(fw.FRAMEWORK_PROVENANCE["reviewedBy"])
        self.assertEqual(fw.FRAMEWORK_PROVENANCE["references"], [])  # no invented sources
        self.assertIn("Not an industry standard", fw.FRAMEWORK_PROVENANCE["basis"])

    def test_every_pathway_has_its_own_structured_framework(self):
        for role in SELECTABLE:
            with self.subTest(role=role):
                f = fw.framework_for(role)
                self.assertIsNotNone(f, "no generic fallback: each role has its own")
                self.assertEqual(f.status, "current")
                self.assertGreaterEqual(len(f.responsibilities), 3)
                self.assertGreaterEqual(len(f.requirements), 6)
                self.assertGreaterEqual(sum(r.required for r in f.requirements), 2)
                self.assertTrue(f.completion_criteria)
                self.assertTrue(f.project_context)
                for r in f.requirements:
                    self.assertIn(r.competency, CANONICAL, f"{role}: {r.competency} is not canonical")
                    self.assertIn(r.expected_level, fw.LEVEL_FLOOR)
                    self.assertEqual(r.evidence_requirement, "independent" if r.required else "described")
                    c = fw.COMPETENCIES[r.competency]
                    self.assertTrue(c["description"] and c["demonstration"])

    def test_frameworks_are_distinct(self):
        sets = {role: frozenset(r.competency for r in fw.framework_for(role).requirements) for role in SELECTABLE}
        self.assertEqual(len(set(sets.values())), len(SELECTABLE))
        required = {role: frozenset(r.competency for r in fw.framework_for(role).requirements if r.required) for role in SELECTABLE}
        self.assertEqual(len(set(required.values())), len(SELECTABLE))

    def test_shared_competencies_are_one_definition_with_role_specific_expectations(self):
        def req(role, name):
            return next(r for r in fw.framework_for(role).requirements if r.competency == name)
        self.assertEqual(req("data_scientist", "Statistics").tier, "required")
        self.assertEqual(req("ml_engineer", "Statistics").tier, "supporting")
        self.assertEqual(req("mlops_engineer", "Docker").expected_level, "Proficient")
        self.assertEqual(req("llm_application_engineer", "Docker").expected_level, "Foundational")

    def test_role_specific_requirements_do_not_leak(self):
        def names(role):
            return {r.competency for r in fw.framework_for(role).requirements}
        self.assertNotIn("Retrieval-Augmented Generation", names("computer_vision_engineer"))
        self.assertNotIn("ROS", names("data_scientist"))
        self.assertNotIn("Kubernetes", names("ml_engineer"))
        self.assertIn("Speech Recognition", names("speech_ai_engineer"))
        self.assertIn("Graph Neural Networks", names("graph_ai_engineer"))
        self.assertIn("Federated Learning", names("edge_federated_ai_engineer"))
        self.assertIn("LLM Evaluation", names("ai_evaluation_safety_engineer"))
        self.assertIn("AI Agents", names("ai_agent_engineer"))

    def test_compat_views_are_derived_from_the_framework(self):
        for role in SELECTABLE:
            self.assertEqual([s for s, _ in ROLE_SKILLS[role]], [r.competency for r in fw.framework_for(role).requirements])
            self.assertIn(role, ROLE_PROJECT_CONTEXT)

    def test_specialist_aliases_normalise(self):
        aliases = alias_map()
        self.assertEqual(aliases["asr"], "Speech Recognition")
        self.assertEqual(aliases["gnn"], "Graph Neural Networks")
        self.assertEqual(aliases["ragas"], "LLM Evaluation")
        self.assertEqual(aliases["tflite"], "TensorFlow Lite")

    def test_prerequisites_point_at_defined_competencies(self):
        for skill, prereqs in PREREQUISITES.items():
            for p in prereqs:
                self.assertIn(p, fw.COMPETENCIES, f"{skill} -> {p}")
                self.assertIn(p, CANONICAL)


class EveryRole(unittest.TestCase):
    """The engine end to end on each of the 20 frameworks: nothing evidenced, everything evidenced, required only."""

    def test_each_role_from_nothing_to_requirements_demonstrated(self):
        for role in SELECTABLE:
            with self.subTest(role=role):
                f = fw.framework_for(role)
                none = analyze_role(role, {}, {}, True, ident)
                self.assertEqual(none["alignment"]["state"], "not_enough_evidence")
                self.assertEqual(none["framework"]["status"], "draft_unreviewed")

                required = {r.competency for r in f.requirements if r.required}
                done = analyze_role(role, skills_at(required), {}, True, ident)
                self.assertEqual(done["alignment"]["state"], "requirements_demonstrated")
                road = build_roadmap(done, None)
                self.assertTrue(road["requirementsMet"])
                self.assertTrue(all(s["optional"] for s in road["stages"]), "no mandatory milestone once requirements are met")
                self.assertTrue(all(m["optional"] for s in road["stages"] for m in s["milestones"]))

                every = {r.competency for r in f.requirements}
                full = build_roadmap(analyze_role(role, skills_at(every), {}, True, ident), None)
                self.assertEqual(full["stages"], [])
                self.assertEqual(set(full["completed"]), every)

    def test_each_role_with_claims_only_never_meets_a_requirement(self):
        for role in SELECTABLE:
            with self.subTest(role=role):
                every = {r.competency for r in fw.framework_for(role).requirements}
                claimed = {n: {"name": n, "proficiency": None, "level": "Not assessed", "confidence": 0.35, "evidenceState": "claimed", "status": "claimed", "evidence": []} for n in every}
                a = analyze_role(role, claimed, {}, True, ident)
                self.assertEqual(a["counts"]["met"], 0)
                self.assertEqual(a["alignment"]["state"], "early")
                self.assertTrue(all(r["gapType"] == "claimed_unverified" for r in a["skills"]))


class Roadmaps(unittest.TestCase):
    def test_different_goals_get_different_milestones(self):
        def skills(role):
            return {m["skill"] for s in build_roadmap(analyze_role(role, {}, {}, True, ident), None)["stages"] for m in s["milestones"]}
        self.assertNotEqual(skills("ml_engineer"), skills("robotics_ai_engineer"))
        self.assertNotEqual(skills("ml_engineer"), skills("llm_application_engineer"))
        self.assertIn("ROS", skills("robotics_ai_engineer"))
        self.assertIn("Retrieval-Augmented Generation", skills("llm_application_engineer"))

    def test_milestone_ids_are_stable_unique_and_role_scoped(self):
        a = build_roadmap(analyze_role("speech_ai_engineer", {}, {}, True, ident), None)
        b = build_roadmap(analyze_role("speech_ai_engineer", {}, {}, True, ident), None)
        ids = lambda r: [m["id"] for s in r["stages"] for m in s["milestones"]]  # noqa: E731
        self.assertEqual(ids(a), ids(b))
        self.assertEqual(len(set(ids(a))), len(ids(a)))
        self.assertEqual(milestone_id("speech_ai_engineer", "Text-to-Speech"), "speech_ai_engineer:text-to-speech")
        self.assertTrue(all(i.startswith("speech_ai_engineer:") for i in ids(a)))

    def test_every_milestone_is_actionable(self):
        for role in SELECTABLE:
            road = build_roadmap(analyze_role(role, {}, {}, True, ident), None)
            for s in road["stages"]:
                for m in s["milestones"]:
                    for key in ("objective", "why", "practicalTask", "criterion", "evidenceRequired"):
                        self.assertTrue(m[key], (role, m["skill"], key))
                    self.assertIsNone(m["estimateWeeks"])

    def test_completed_milestones_do_not_reappear_as_open(self):
        some = build_roadmap(analyze_role("ml_engineer", skills_at({"Python", "Machine Learning"}), {}, True, ident), None)
        self.assertEqual(set(some["completed"]), {"Python", "Machine Learning"})
        open_skills = {m["skill"] for s in some["stages"] for m in s["milestones"]}
        self.assertFalse(open_skills & {"Python", "Machine Learning"})


if __name__ == "__main__":
    unittest.main()
