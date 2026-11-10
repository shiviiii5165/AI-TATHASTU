"""Runs the real career engine (worker/intelligence/career_engine.py) on a realistic mixed profile and
writes the intelligence document plus the facts it was computed from. Used to feed browser tests with
engine output instead of hand-written fixtures."""
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

WORKER = Path(sys.argv[1])
OUT = Path(sys.argv[2])
sys.path.insert(0, str(WORKER))

from intelligence import career_engine as engine  # noqa: E402
from intelligence.evaluation import _canonical, _lexicon, _CATEGORIES  # noqa: E402

NOW = datetime.now(timezone.utc)
RECENT = NOW - timedelta(days=20)

FACTS_SPEC = [
    # group, record, field, value
    ("education", "edu1", "degree", "B.Tech Computer Science"),
    ("education", "edu1", "institution", "IIT Delhi"),
    ("education", "edu1", "end_date", "2022"),
    ("education", "edu2", "degree", "Online Diploma in Data Science"),  # undated on purpose
    ("experience", "exp1", "role", "Data Analyst Intern"),
    ("experience", "exp1", "organization", "Acme Analytics"),
    ("experience", "exp1", "start_date", "2021"),
    ("experience", "exp1", "end_date", "2021"),
    ("experience", "exp1", "technologies", ["Python", "SQL"]),
    ("experience", "exp2", "role", "ML Engineer"),
    ("experience", "exp2", "organization", "Nimbus AI"),
    ("experience", "exp2", "start_date", "2023"),
    ("experience", "exp2", "end_date", "Present"),
    ("experience", "exp2", "technologies", ["Python", "PyTorch"]),
    ("projects", "p1", "title", "Resume Parser"),
    ("projects", "p1", "date", "2022"),
    ("projects", "p1", "technologies", ["Python", "scikit-learn"]),
    ("projects", "p2", "title", "Undated Side Project"),
    ("projects", "p2", "technologies", ["Python"]),
    ("achievements", "a1", "title", "Smart India Hackathon winner"),
    ("achievements", "a1", "date", "2021"),
    ("skills", None, "skill", "Kubernetes"),
]


def fact(i, group, record, field, value):
    return {"id": f"f{i}", "field_group": group, "field_name": field, "record_key": record, "normalized_value": value,
            "extracted_value": value, "origin": "resume", "confirmation": "confirmed", "source_evidence": None, "created_at": RECENT}


facts = [fact(i, *f) for i, f in enumerate(FACTS_SPEC)]
repos = [
    {"id": "r1", "repo_name": "asha/resume-parser", "url": "https://github.com/asha/resume-parser", "description": None,
     "languages": {"Python": 120_000}, "topics": ["scikit-learn", "pytorch"], "stars": 3, "last_commit_at": RECENT},
    {"id": "r2", "repo_name": "asha/sql-dashboards", "url": "https://github.com/asha/sql-dashboards", "description": None,
     "languages": {"Python": 30_000, "SQL": 20_000}, "topics": [], "stars": 0, "last_commit_at": RECENT},
]
# Rows as seeded in src/db/migrations (learning_resources); titles are what the engine's COURSES map matches on.
resources = [
    {"title": "Practical Deep Learning for Coders", "provider": "Fast.ai", "url": "https://course.fast.ai/", "description": None},
    {"title": "Advanced SQL for Data Scientists & Analysts", "provider": "Mode Analytics", "url": "https://mode.com/sql-tutorial/", "description": None},
    {"title": "Statistical Inference and Hypothesis Testing", "provider": "Johns Hopkins University", "url": "https://www.coursera.org/learn/statistical-inference", "description": None},
]
# The users row as onboarding stores it (no job title set): position comes from the degree.
user = {"degree": "B.Tech Computer Science", "university": "IIT Delhi"}

intel = engine.compute(user=user, roles=["ml_engineer"], facts=facts, repos=repos, resources=resources, canonical=_canonical,
                       lexicon_scan=_lexicon, categories=_CATEGORIES, now=NOW)
intel.pop("_ledger", None)  # written to skill_evidence by the worker, never part of the dashboard document

journey_facts = [{"group": g, "record": r, "field": f, "value": v if isinstance(v, str) else json.dumps(v)} for g, r, f, v in FACTS_SPEC if r]
OUT.write_text(json.dumps({"intelligence": intel, "facts": journey_facts}, default=str, indent=1), encoding="utf-8")
r = intel["roadmap"] or {}
print("skills", [(s["name"], s["status"], s["proficiency"]) for s in intel["skills"]])
print("edges", [(e["source"], e["target"], e["basis"]) for e in intel["graph"]["edges"]])
print("roadmap", r.get("role"), r.get("currentPosition"), r.get("progress"), [(st["key"], [(m["skill"], m["requires"]) for m in st["milestones"]]) for st in r.get("stages", [])])
print("recs", [(x["skill"], bool(x["resource"])) for x in intel["recommendations"]])
