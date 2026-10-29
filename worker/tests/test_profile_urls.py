"""Personal website vs platform profile URLs: classifier, resume routing,
connector mapping, and (against the disposable e2e Postgres, when running)
repeated syncs and preservation of existing data."""

from __future__ import annotations

import json
import os
import sys
import unittest
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from connectors.common import Facts  # noqa: E402
from profile_urls import classify, normalize, route_contact_url  # noqa: E402
from resume import deterministic  # noqa: E402
from resume.deterministic import Candidate  # noqa: E402
from resume.persist import route_contacts  # noqa: E402

RESUME = """Shivam Kumar Singh
shivam@example.com | +91 98765 43210
www.linkedin.com/in/shivam-kumar-singh-lpu | https://github.com/shiviiii5165/
https://leetcode.com/u/shiviiii5165/ | https://www.kaggle.com/shivam | https://orcid.org/0000-0002-1825-0097
Portfolio: https://shivamkumarsingh-ashy.vercel.app/
https://stackoverflow.com/users/42/shivam | https://www.hackerrank.com/profile/shivam

Projects
Resume Parser - https://github.com/shiviiii5165/resume-parser
"""


class ClassifierTests(unittest.TestCase):
    def test_normalize(self) -> None:
        self.assertEqual(normalize("WWW.LeetCode.com/u/Asha/?tab=1#x"), "https://leetcode.com/u/Asha")
        self.assertEqual(normalize("http://asha.dev/"), "https://asha.dev")
        self.assertIsNone(normalize("   "))
        self.assertIsNone(normalize("localhost"))

    def test_classify(self) -> None:
        cases = {
            "https://leetcode.com/u/shiviiii5165/": "leetcode_url",
            "leetcode.com/shiviiii5165": "leetcode_url",
            "https://www.hackerrank.com/profile/asha": "hackerrank_url",
            "https://www.kaggle.com/asha": "kaggle_url",
            "https://orcid.org/0000-0002-1825-0097": "orcid_url",
            "https://math.stackexchange.com/users/7/asha": "stackexchange_url",
            "www.linkedin.com/in/shivam-kumar-singh-lpu": "linkedin_url",
            "https://github.com/shiviiii5165/": "github_url",
            "https://shivamkumarsingh-ashy.vercel.app/": "website",
            "https://asha.dev": "website",
            # platform URLs that aren't profiles: never a website, never a profile
            "https://github.com/asha/repo": None,
            "https://leetcode.com/problems/two-sum": None,
            "https://www.kaggle.com/code/asha/eda": None,
            "https://codeforces.com/profile/asha": None,
            "https://github.com/orgs/acme": None,
        }
        for url, field in cases.items():
            with self.subTest(url=url):
                self.assertEqual(classify(url)[0], field)

    def test_route_leaves_non_url_fields_alone(self) -> None:
        self.assertEqual(route_contact_url("email", "a@b.co"), ("email", "a@b.co"))
        self.assertEqual(route_contact_url("website", "https://leetcode.com/u/a"), ("leetcode_url", "https://leetcode.com/u/a"))
        self.assertEqual(route_contact_url("website", "https://github.com/a/b"), (None, None))


class ResumeRoutingTests(unittest.TestCase):
    def test_portfolio_and_platform_links_each_land_in_their_field(self) -> None:
        cands, _ = deterministic.run(RESUME)
        got = {c.field: c.value for c in cands if c.group == "contact"}
        self.assertEqual(got["website"], "https://shivamkumarsingh-ashy.vercel.app")
        self.assertEqual(got["linkedin_url"], "https://linkedin.com/in/shivam-kumar-singh-lpu")
        self.assertEqual(got["github_url"], "https://github.com/shiviiii5165")
        self.assertEqual(got["leetcode_url"], "https://leetcode.com/u/shiviiii5165")
        self.assertEqual(got["kaggle_url"], "https://kaggle.com/shivam")
        self.assertEqual(got["orcid_url"], "https://orcid.org/0000-0002-1825-0097")
        self.assertEqual(got["stackexchange_url"], "https://stackoverflow.com/users/42/shivam")
        self.assertEqual(got["hackerrank_url"], "https://hackerrank.com/profile/shivam")
        # every candidate keeps verbatim evidence from the resume (reviewable)
        for c in cands:
            if c.group == "contact":
                self.assertIn(c.evidence, RESUME)
        # the repo link is not a contact field
        self.assertNotIn("https://github.com/shiviiii5165/resume-parser", got.values())

    def test_ai_tier_misfiled_links_are_rerouted_at_persist(self) -> None:
        def c(field: str, value: str, method: str = "llm:groq") -> Candidate:
            return Candidate("contact", field, value, value, value, 0, len(value), method=method)

        routed = route_contacts([
            c("website", "https://leetcode.com/u/asha/"),  # AI put LeetCode in website
            c("website", "https://asha.dev"),
            c("github_url", "https://github.com/asha/repo"),  # a repo, not a profile: dropped
            c("website", "https://www.leetcode.com/u/asha"),  # duplicate after normalization
            c("email", "asha@example.com"),
            c("email", "asha2@example.com"),  # non-URL fields untouched (not deduped here)
        ])
        self.assertEqual(
            [(r.field, r.value) for r in routed],
            [("leetcode_url", "https://leetcode.com/u/asha"), ("website", "https://asha.dev"),
             ("email", "asha@example.com"), ("email", "asha2@example.com")],
        )


class ConnectorMappingTests(unittest.TestCase):
    @staticmethod
    def contact(facts: Facts):
        return [(r[2], json.loads(r[5])) for r in facts.rows if r[1] == "contact"]

    def test_platform_connectors_never_write_website(self) -> None:
        from connectors.coding_profiles import map_leetcode
        from connectors.kaggle import map_kaggle
        from connectors.stack_exchange import map_stack_exchange

        lc = map_leetcode({"matchedUser": {"username": "asha"}}, Facts("u", "leetcode", "api"))
        kg = map_kaggle("asha", {}, Facts("u", "kaggle", "api"))
        se = map_stack_exchange("stackoverflow", {"user": {"link": "https://stackoverflow.com/users/1/asha"}, "tags": []},
                                Facts("u", "stack_exchange", "api"))
        self.assertEqual(self.contact(lc), [("leetcode_url", "https://leetcode.com/u/asha")])
        self.assertEqual(self.contact(kg), [("kaggle_url", "https://kaggle.com/asha")])
        self.assertEqual(self.contact(se), [("stackexchange_url", "https://stackoverflow.com/users/1/asha")])

    def test_github_blog_pointing_at_a_platform_is_refiled_and_duplicates_dropped(self) -> None:
        f = Facts("u", "github", "api")
        f.add("contact", "website", "https://leetcode.com/u/asha", "blog")
        f.add("contact", "website", "https://asha.dev/", "blog")
        f.add("contact", "website", "asha.dev", "blog again")
        self.assertEqual(self.contact(f), [("leetcode_url", "https://leetcode.com/u/asha"), ("website", "https://asha.dev")])


def _local_db():
    dsn = os.environ.get("DATABASE_URL", "")
    if not dsn or not any(h in dsn for h in ("127.0.0.1", "localhost")):
        return None
    try:
        import psycopg2

        return psycopg2.connect(dsn, connect_timeout=3)
    except Exception:
        return None


class RepeatedSyncIntegrationTests(unittest.TestCase):
    """Real SQL on the disposable e2e Postgres (node e2e/support/stack.mts); skipped when it isn't running."""

    def setUp(self) -> None:
        self.conn = _local_db()
        if not self.conn:
            self.skipTest("disposable local Postgres not running")
        self.user = str(uuid.uuid4())
        with self.conn, self.conn.cursor() as cur:
            cur.execute("INSERT INTO users (id, name, role) VALUES (%s, 'Sync Test', 'student')", (self.user,))
            # Existing data that no connector may touch: the connected portfolio and a user-edited LinkedIn.
            portfolio = Facts(self.user, "portfolio", "api")
            portfolio.add("contact", "website", "https://asha.dev", "Portfolio https://asha.dev")
            portfolio.replace(cur)
            cur.execute(
                """INSERT INTO profile_facts (user_id, field_group, field_name, normalized_value, origin, confirmation)
                   VALUES (%s, 'contact', 'linkedin_url', '"https://linkedin.com/in/asha"', 'user_entered', 'edited')""",
                (self.user,),
            )

    def tearDown(self) -> None:
        if getattr(self, "conn", None):
            with self.conn, self.conn.cursor() as cur:
                cur.execute("DELETE FROM users WHERE id = %s", (self.user,))
            self.conn.close()

    def rows(self):
        with self.conn, self.conn.cursor() as cur:
            cur.execute(
                "SELECT origin, field_name, normalized_value #>> '{}' FROM profile_facts WHERE user_id = %s AND field_group = 'contact' "
                "ORDER BY origin, field_name",
                (self.user,),
            )
            return cur.fetchall()

    def test_repeated_syncs_are_idempotent_and_preserve_other_sources(self) -> None:
        from connectors.coding_profiles import map_leetcode

        def sync() -> None:
            facts = map_leetcode({"matchedUser": {"username": "asha"}}, Facts(self.user, "leetcode", "api"))
            facts.add("contact", "website", "https://leetcode.com/u/asha/", "duplicate from another field")
            with self.conn, self.conn.cursor() as cur:
                facts.replace(cur)

        sync()
        first = self.rows()
        sync()
        sync()
        self.assertEqual(self.rows(), first)
        self.assertEqual(first, [
            ("leetcode", "leetcode_url", "https://leetcode.com/u/asha"),
            ("portfolio", "website", "https://asha.dev"),
            ("user_entered", "linkedin_url", "https://linkedin.com/in/asha"),
        ])


if __name__ == "__main__":
    unittest.main()
