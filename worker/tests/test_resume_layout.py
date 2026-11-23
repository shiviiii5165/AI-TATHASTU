"""Layout handling in resume text extraction and the rule-based parser.

Each test builds a small synthetic PDF (or text) for one layout pattern: ruled tables,
side-by-side bullet grids, sidebar columns, page footers, hidden profile links, wrapped
bullets and numbered lists. None of it comes from a real resume.
"""

import unittest

import fitz

from profile_urls import classify
from resume import deterministic as det
from resume.text import extract

A4 = (595, 842)


def _pdf(draw) -> bytes:
    doc = fitz.open()
    page = doc.new_page(width=A4[0], height=A4[1])
    draw(page)
    data = doc.tobytes()
    doc.close()
    return data


def _table(page, top: float, cols, rows, size: float = 9) -> float:
    """Ruled table; each cell's text wraps inside its box. Returns the bottom y."""
    x = [72.0]
    for w in cols:
        x.append(x[-1] + w)
    y = top
    for row in rows:
        height = 30
        for i, cell in enumerate(row):
            page.insert_textbox(fitz.Rect(x[i] + 3, y + 3, x[i + 1] - 3, y + height - 2), cell, fontsize=size)
        for i in range(len(x)):
            page.draw_line((x[i], y), (x[i], y + height))
        page.draw_line((x[0], y), (x[-1], y))
        y += height
    page.draw_line((x[0], y), (x[-1], y))
    return y


class TablesInPdf(unittest.TestCase):
    def setUp(self):
        def draw(page):
            page.insert_text((72, 60), "Meera Iyer", fontsize=16)
            page.insert_text((72, 90), "EDUCATION", fontsize=11)
            _table(page, 100, (150, 170, 70, 90), [
                ["Degree", "Institution", "Year", "Result"],
                ["B.Sc (Applied Mathematics)", "Northfield University, Pune", "2019-2022", "CGPA 8.4"],
                ["Class XII (Science- Stream)", "Lakeview School, Nagpur", "2019", "91%"],
            ])
            page.insert_text((72, 230), "CERTIFICATIONS", fontsize=11)
            _table(page, 240, (220, 160, 80), [
                ["Course", "Offered by", "Date"],
                ["Applied Time Series Analysis", "OpenLearn Academy", "Mar 2023"],
                ["Cloud Data Pipelines", "Skyline Institute", "Jan 2024"],
            ])
            page.insert_text((280, 820), "Page 1 of 2", fontsize=8)

        self.doc = extract(_pdf(draw), "pdf")

    def test_each_row_is_one_line_with_spaced_cells(self):
        lines = self.doc.text.split("\n")
        self.assertIn("Degree | Institution | Year | Result", lines)  # labels kept for the parsers and the AI
        self.assertIn("B.Sc (Applied Mathematics) | Northfield University, Pune | 2019-2022 | CGPA 8.4", lines)
        self.assertIn("Applied Time Series Analysis | OpenLearn Academy | Mar 2023", lines)

    def test_page_footer_is_dropped(self):
        self.assertNotIn("Page 1 of 2", self.doc.text)

    def test_education_rows_become_whole_entries(self):
        facts, _ = det.run(self.doc.text)
        edu = [c for c in facts if c.group == "education"]
        by_key = {}
        for c in edu:
            by_key.setdefault(c.record_key, {})[c.field] = c.value
        rows = sorted(by_key.values(), key=lambda r: r.get("degree", ""))
        self.assertEqual(rows[0]["institution"], "Northfield University, Pune")
        self.assertEqual(rows[0]["field_of_study"], "Applied Mathematics")
        self.assertEqual((rows[0]["start_date"], rows[0]["end_date"], rows[0]["grade"]), ("2019", "2022", "CGPA 8.4"))
        self.assertEqual(rows[1]["institution"], "Lakeview School, Nagpur")
        self.assertEqual(len(by_key), 2)  # the label row is not an entry

    def test_certificate_columns_follow_their_labels(self):
        facts, sections = det.run(self.doc.text)
        certs = det.section_entries(self.doc.text, sections, ("certifications",))
        rows = {}
        for c in certs:
            rows.setdefault(c.record_key, {})[c.field] = c.value
        self.assertIn({"name": "Applied Time Series Analysis", "issuer": "OpenLearn Academy", "date": "Mar 2023"}, list(rows.values()))
        self.assertEqual(len(rows), 2)


class ReadingOrder(unittest.TestCase):
    def test_side_by_side_bullets_stay_inside_their_section(self):
        def draw(page):
            page.insert_text((72, 60), "INTERESTS", fontsize=11)
            for i, (a, b) in enumerate([("Graph Theory", "Robotics"), ("Optimisation", "Signal Processing"), ("Statistics", "Control Systems")]):
                page.insert_text((85, 85 + i * 18), f"• {a}", fontsize=10)
                page.insert_text((320, 85 + i * 18), f"• {b}", fontsize=10)
            page.insert_text((72, 160), "PUBLICATIONS", fontsize=11)
            page.insert_text((72, 180), "[1] A. Rao, \"Sparse Solvers for Sensor Networks,\" in Proc. 2024 Conf.", fontsize=10)

        text = extract(_pdf(draw), "pdf").text
        self.assertLess(text.index("INTERESTS"), text.index("Graph Theory"))
        self.assertLess(text.index("Control Systems"), text.index("PUBLICATIONS"))
        self.assertLess(text.index("PUBLICATIONS"), text.index("Sparse Solvers"))

    def test_sidebar_layout_still_reads_column_by_column(self):
        def draw(page):
            for i, word in enumerate(["SKILLS", "Python", "Rust", "Docker"]):
                page.insert_text((40, 120 + i * 60), word, fontsize=10)
            for i, line in enumerate(["EXPERIENCE", "Engineer, Acme", "Built ingestion jobs", "Ran on-call"]):
                page.insert_text((330, 150 + i * 45), line, fontsize=10)

        text = extract(_pdf(draw), "pdf").text
        self.assertLess(text.index("Docker"), text.index("EXPERIENCE"))
        self.assertLess(text.index("EXPERIENCE"), text.index("Ran on-call"))


class HiddenLinks(unittest.TestCase):
    def test_profile_url_behind_link_text_is_extracted(self):
        def draw(page):
            page.insert_text((72, 60), "Kabir Menon", fontsize=16)
            page.insert_text((72, 80), "Profiles: LinkedIn", fontsize=10)
            page.insert_text((72, 110), "Backend engineer working on payments and data pipelines.", fontsize=10)
            page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(122, 70, 160, 82), "uri": "https://www.linkedin.com/in/kabir-menon-dev/"})

        doc = extract(_pdf(draw), "pdf")
        self.assertIn("https://www.linkedin.com/in/kabir-menon-dev/", doc.text)
        facts, _ = det.run(doc.text)
        self.assertIn(("linkedin_url", "https://linkedin.com/in/kabir-menon-dev"), {(c.field, c.value) for c in facts})

    def test_research_indexes_are_not_a_personal_website(self):
        self.assertIsNone(classify("https://scholar.google.com/citations?user=abc")[0])
        self.assertIsNone(classify("https://www.scopus.com/authid/detail.uri?authorId=1")[0])
        self.assertEqual(classify("https://meera.dev")[0], "website")


class EntrySplitting(unittest.TestCase):
    def _entries(self, text, group):
        _, sections = det.run(text)
        rows = {}
        for c in det.section_entries(text, sections, (group,)):
            rows.setdefault(c.record_key, {})[c.field] = c.value
        return list(rows.values())

    def test_wrapped_bullets_stay_in_their_job(self):
        text = (
            "WORK EXPERIENCE\n"
            "Analyst, Riverbank Labs, Chennai\n"
            "Jan 2022 – Present\n"
            "• Owned the pricing dashboards used by the sales team for\n"
            "quarterly planning across three regions:\n"
            "forecasting, churn and upsell.\n"
            "• Led a migration of 40 reports to the new warehouse\n"
            "and retired the legacy ETL jobs.\n"
            "Intern, Hillside Robotics\n"
            "3 Jun 2021 – 9 Aug 2021\n"
            "• Wrote test rigs for motor controllers.\n"
            "REFERENCES\n"
            "Available on request.\n"
        )
        jobs = self._entries(text, "experience")
        self.assertEqual([j["role"] for j in jobs], ["Analyst, Riverbank Labs, Chennai", "Intern, Hillside Robotics"])
        self.assertIn("quarterly planning across three regions: forecasting", jobs[0]["description"])
        self.assertEqual((jobs[1]["start_date"], jobs[1]["end_date"]), ("3 Jun 2021", "9 Aug 2021"))
        self.assertNotIn("Available", " ".join(j.get("description", "") for j in jobs))  # References ended the section

    def test_numbered_publications_under_subheadings(self):
        text = (
            "PUBLICATIONS\n"
            "Peer reviewed\n"
            "[1] N. Das and K. Pillai, \"Low-Power Inference for Edge\n"
            "Cameras,\" in Proc. 2023 Embedded Systems Conf., pp. 1-6.\n"
            "Under review\n"
            "[2] N. Das, \"Calibrating Small Classifiers on Noisy\n"
            "Labels.\"\n"
            "HONOURS AND DISTINCTIONS\n"
            "• Best Paper Runner-up, 2023.\n"
        )
        pubs = self._entries(text, "publications")
        self.assertEqual(len(pubs), 2)
        self.assertTrue(pubs[0]["title"].startswith("N. Das and K. Pillai"))
        self.assertIn("Edge Cameras", pubs[0]["title"])  # the wrapped line was joined back
        self.assertNotIn("Peer reviewed", [p["title"] for p in pubs])
        self.assertEqual([a["title"] for a in self._entries(text, "achievements")], ["Best Paper Runner-up, 2023."])

    def test_and_heading_fallback_needs_a_heading_shape(self):
        self.assertEqual(det.header_group("Achievements and Distinctions"), "achievements")
        self.assertIsNone(det.header_group("Research and development of a parser."))


if __name__ == "__main__":
    unittest.main()
