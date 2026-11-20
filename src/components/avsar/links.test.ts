import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EcosystemOpportunitiesRow } from "@/components/dashboard/mockup-sections/ecosystem-opportunities-row";
import { explainFit } from "@/lib/opportunities/fit";
import { buildStudentSignals, type ResearchCard } from "@/lib/opportunities/recommend";

import { officialPageHref } from "./links";

const card = (id: string, url: string): ResearchCard => ({
  id: `00000000-0000-4000-8000-00000000000${id}`,
  title: `Project Assistant ${id}`,
  organization: "Indian Institute of Technology Hyderabad",
  kind: "research_assistant",
  researchGroup: null,
  location: null,
  workMode: null,
  deadline: null,
  deadlineAt: null,
  url,
  sourceName: "IIT Hyderabad Careers",
  lastVerifiedAt: "2026-11-19T00:00:00.000Z",
  fit: explainFit({ requiredSkills: [], eligibleLevels: [], eligibility: null }, buildStudentSignals({ skills: [], intelligenceSkills: [], degree: null })),
});

describe("AVSAR dashboard Official page link", () => {
  it("renders the link only for an absolute http(s) URL", () => {
    const html = renderToStaticMarkup(
      createElement(EcosystemOpportunitiesRow, {
        research: { status: "ok", personalised: true, items: [card("1", "https://iith.ac.in/careers/advert-1.pdf"), card("2", "javascript:alert(1)")] },
        internships: { status: "not_configured", handoffUrl: "/integrations/launch/avasar" },
      }),
    );
    expect(html).toContain('href="https://iith.ac.in/careers/advert-1.pdf"');
    expect(html).not.toContain("javascript:");
    expect(html.match(/Official page/g)).toHaveLength(1);
    // The card itself still opens its verified detail page.
    expect(html).toContain('href="/opportunities/00000000-0000-4000-8000-000000000002"');
  });
});

describe("officialPageHref", () => {
  it("keeps absolute HTTPS and HTTP URLs exactly as stored", () => {
    const https = "https://erp.iitkgp.ac.in/SRICStaffRecruitment/AdvertiseView.jsp?serial_no=123";
    const http = "http://iitr.ac.in/Careers/Project%20Jobs.html";
    expect(officialPageHref(https)).toBe(https);
    expect(officialPageHref(http)).toBe(http);
  });

  it("rejects script, data and file URLs", () => {
    expect(officialPageHref("javascript:alert(1)")).toBeNull();
    expect(officialPageHref("JavaScript:alert(1)")).toBeNull();
    expect(officialPageHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(officialPageHref("file:///etc/passwd")).toBeNull();
  });

  it("rejects protocol-relative, relative and malformed URLs", () => {
    expect(officialPageHref("//evil.example/path")).toBeNull();
    expect(officialPageHref("/opportunities/123")).toBeNull();
    expect(officialPageHref("https://")).toBeNull();
    expect(officialPageHref("not a url")).toBeNull();
    expect(officialPageHref("")).toBeNull();
    expect(officialPageHref(null)).toBeNull();
    expect(officialPageHref(undefined)).toBeNull();
  });

  it("rejects URLs carrying credentials", () => {
    expect(officialPageHref("https://user:pass@example.org/")).toBeNull();
  });
});
