"""Field groups and names. Mirrors src/lib/profile/field-groups.ts: the review
screen only renders names it knows, so keep the two in sync."""

from __future__ import annotations

from typing import Dict, List

FIELD_GROUPS: Dict[str, List[str]] = {
    "identity": ["full_name", "headline", "location"],
    "contact": ["email", "phone", "linkedin_url", "github_url", "website",
                "leetcode_url", "hackerrank_url", "kaggle_url", "orcid_url", "stackexchange_url"],
    "education": ["institution", "degree", "field_of_study", "start_date", "end_date", "grade"],
    "experience": ["organization", "role", "start_date", "end_date", "description"],
    "projects": ["title", "description", "technologies", "url"],
    "skills": ["skill"],
    "certifications": ["name", "issuer", "date"],
    "achievements": ["title", "description", "date"],
    "publications": ["title", "venue", "date", "url"],
    "languages": ["language", "proficiency"],
}

REPEATABLE = {"education", "experience", "projects", "skills", "certifications", "achievements", "publications", "languages"}
