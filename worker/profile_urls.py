"""Personal website vs platform profile URLs. Mirrors platformUrlField() in
src/lib/profile/field-groups.ts; keep the host lists in sync.

Every contact URL (resume rules, resume AI, connectors) is routed through
route_contact_url(), so a LeetCode or Kaggle link can never land in `website`
and push out the user's portfolio.
"""

from __future__ import annotations

import re
from typing import Optional, Tuple
from urllib.parse import urlsplit

# field → (host pattern, path pattern a *profile* URL must match)
PLATFORMS = (
    ("linkedin_url", r"linkedin\.com", r"/in/[^/]+/?"),
    ("github_url", r"github\.com", r"/[A-Za-z0-9-]+/?"),
    ("leetcode_url", r"leetcode\.com", r"/(?:u/)?[\w-]+/?"),
    ("hackerrank_url", r"hackerrank\.com", r"/(?:profile/)?[\w-]+/?"),
    ("kaggle_url", r"kaggle\.com", r"/[\w-]+/?"),
    ("orcid_url", r"orcid\.org", r"/\d{4}-\d{4}-\d{4}-\d{3}[\dX]/?"),
    ("stackexchange_url", r"(?:[\w-]+\.)?(?:stackoverflow|stackexchange|superuser|serverfault|askubuntu|mathoverflow)\.(?:com|net)",
     r"/users/\d+(?:/[^/]+)?/?"),
)
# Platform-ish hosts that are never someone's personal website (repo links,
# coding sites without a connector).
OTHER_PLATFORM_HOSTS = r"(?:codechef\.com|codeforces\.com|geeksforgeeks\.org|gist\.github\.com)"

URL_FIELDS = {"website", *(f for f, _h, _p in PLATFORMS)}

# GitHub/Kaggle top-level paths that look like a username but aren't one.
RESERVED_PATHS = {"orgs", "topics", "features", "settings", "code", "datasets", "competitions", "learn", "discussions",
                  "problems", "contest", "explore"}


def normalize(url: str) -> Optional[str]:
    """https, lower-case host without www., no query/fragment/trailing slash."""
    raw = url.strip().rstrip(".,;)")
    if not raw:
        return None
    if not re.match(r"https?://", raw, re.I):
        raw = "https://" + raw
    parts = urlsplit(raw)
    host = (parts.hostname or "").lower()
    if not host or "." not in host:
        return None
    host = host[4:] if host.startswith("www.") else host
    path = re.sub(r"/{2,}", "/", parts.path).rstrip("/")
    return f"https://{host}{path}"


def classify(url: str) -> Tuple[Optional[str], Optional[str]]:
    """(field, normalized url). field is a platform field, 'website' for a personal
    site, or None for a platform URL that isn't a profile (a repo, a problem page)."""
    norm = normalize(url)
    if not norm:
        return None, None
    parts = urlsplit(norm)
    host, path = parts.hostname or "", parts.path
    for field, host_re, path_re in PLATFORMS:
        if re.fullmatch(host_re, host):
            first = path.strip("/").split("/")[0].lower()
            ok = re.fullmatch(path_re, path or "/") and first not in RESERVED_PATHS
            return (field, norm) if ok else (None, norm)
    if re.fullmatch(rf"(?:[\w-]+\.)?{OTHER_PLATFORM_HOSTS}", host):
        return None, norm
    return "website", norm


def route_contact_url(field: str, value: str) -> Tuple[Optional[str], Optional[str]]:
    """Where a contact URL fact belongs: (field, normalized value), or (None, None) to drop it."""
    if field not in URL_FIELDS:
        return field, value
    target, norm = classify(value)
    return (target, norm) if target else (None, None)
