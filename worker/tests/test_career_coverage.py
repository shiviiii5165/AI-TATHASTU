"""All 20 career directions have a real, role-specific competency framework, and roadmaps differ by goal."""

import unittest

from intelligence.career_engine import PREREQUISITES, build_roadmap, expected_for, level_for, milestone_id, priority_for
from intelligence.config import ROLE_PROJECT_CONTEXT, ROLE_SKILLS
from skills_catalog import CATALOG, alias_map

SELECTABLE = [
    "ml_engineer", "data_scientist", "deep_learning_engineer", "generative_ai_engineer", "llm_application_engineer",
    "llm_model_engineer", "mlops_engineer", "llmops_engineer", "ai_agent_engineer", "nlp_engineer",
    "computer_vision_engineer", "multimodal_ai_engineer", "speech_ai_engineer", "rl_engineer", "robotics_ai_engineer",
    "graph_ai_engineer", "ai_infrastructure_engineer", "ai_evaluation_safety_engineer", "edge_federated_ai_engineer",
    "ai_researcher",
]
CANONICAL = {name for name, *_ in CATALOG}


def analysis(role, met=()):
    rows = []
    for skill, weight in ROLE_SKILLS[role]:
        expected = expected_for(weight)
        state = "met" if skill in met else "missing"
        rows.append({"skill": skill, "weight": weight, "priority": priority_for(weight), "expected": expected,
                     "expectedLevel": level_for(expected), "state": state})
    coverage = sum(r["weight"] for r in rows if r["state"] == "met") / sum(r["weight"] for r in rows)
    return {"role": role, "skills": rows, "coverage": coverage}


class CareerCoverage(unittest.TestCase):
    def test_every_direction_has_a_framework_of_canonical_skills(self):
        for role in SELECTABLE:
            with self.subTest(role=role):
                self.assertIn(role, ROLE_SKILLS)
                self.assertGreaterEqual(len(ROLE_SKILLS[role]), 6)
                for skill, weight in ROLE_SKILLS[role]:
                    self.assertIn(skill, CANONICAL, f"{role}: {skill} is not canonical")
                    self.assertTrue(0 < weight <= 1)
                self.assertIn(role, ROLE_PROJECT_CONTEXT)

    def test_specialist_gaps_are_covered(self):
        self.assertIn("Speech Recognition", dict(ROLE_SKILLS["speech_ai_engineer"]))
        self.assertIn("Graph Neural Networks", dict(ROLE_SKILLS["graph_ai_engineer"]))
        self.assertIn("Federated Learning", dict(ROLE_SKILLS["edge_federated_ai_engineer"]))
        self.assertIn("LLM Evaluation", dict(ROLE_SKILLS["ai_evaluation_safety_engineer"]))
        self.assertIn("AI Agents", dict(ROLE_SKILLS["ai_agent_engineer"]))

    def test_frameworks_are_distinct(self):
        frameworks = {role: frozenset(dict(ROLE_SKILLS[role])) for role in SELECTABLE}
        self.assertEqual(len(set(frameworks.values())), len(SELECTABLE))

    def test_specialist_aliases_normalise(self):
        aliases = alias_map()
        self.assertEqual(aliases["asr"], "Speech Recognition")
        self.assertEqual(aliases["gnn"], "Graph Neural Networks")
        self.assertEqual(aliases["ragas"], "LLM Evaluation")
        self.assertEqual(aliases["tflite"], "TensorFlow Lite")

    def test_prerequisites_point_at_canonical_skills(self):
        for skill, prereqs in PREREQUISITES.items():
            for p in prereqs:
                self.assertIn(p, CANONICAL, f"{skill} -> {p}")


class Roadmaps(unittest.TestCase):
    def test_different_goals_get_different_milestones(self):
        def skills(role):
            return {m["skill"] for s in build_roadmap(analysis(role), None)["stages"] for m in s["milestones"]}
        self.assertNotEqual(skills("ml_engineer"), skills("robotics_ai_engineer"))
        self.assertNotEqual(skills("ml_engineer"), skills("llm_application_engineer"))
        self.assertIn("ROS", skills("robotics_ai_engineer"))
        self.assertIn("Retrieval-Augmented Generation", skills("llm_application_engineer"))

    def test_milestone_ids_are_stable_and_role_scoped(self):
        a = build_roadmap(analysis("speech_ai_engineer"), None)
        b = build_roadmap(analysis("speech_ai_engineer"), None)
        ids = lambda r: [m["id"] for s in r["stages"] for m in s["milestones"]]
        self.assertEqual(ids(a), ids(b))
        self.assertEqual(len(set(ids(a))), len(ids(a)))
        self.assertEqual(milestone_id("speech_ai_engineer", "Text-to-Speech"), "speech_ai_engineer:text-to-speech")
        self.assertTrue(all(i.startswith("speech_ai_engineer:") for i in ids(a)))

    def test_progress_is_only_evidence_coverage(self):
        empty = build_roadmap(analysis("ml_engineer"), None)
        self.assertEqual(empty["progress"], 0)
        some = build_roadmap(analysis("ml_engineer", met={"Python", "Machine Learning"}), None)
        self.assertGreater(some["progress"], 0)
        self.assertLess(some["progress"], 1)
        self.assertEqual(set(some["completed"]), {"Python", "Machine Learning"})
        open_skills = {m["skill"] for s in some["stages"] for m in s["milestones"]}
        self.assertNotIn("Python", open_skills)


if __name__ == "__main__":
    unittest.main()
