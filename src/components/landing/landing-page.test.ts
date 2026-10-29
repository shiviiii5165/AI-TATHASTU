import { describe, expect, it } from "vitest";
import { LANDING_HTML } from "./landing-markup";

describe("Landing Page Redesign & Restored Hero — Architecture & Copy Compliance", () => {
  it("renders the 10 requested sections in the exact sequential order", () => {
    const headerIdx = LANDING_HTML.indexOf('class="ref-nav-bar"');
    const heroIdx = LANDING_HTML.indexOf('class="ref-hero"');
    const ecoIdx = LANDING_HTML.indexOf('id="ecosystem"');
    const howIdx = LANDING_HTML.indexOf('id="how"');
    const demoIdx = LANDING_HTML.indexOf('id="demo"');
    const storiesIdx = LANDING_HTML.indexOf('id="campus"');
    const privacyIdx = LANDING_HTML.indexOf('id="privacy"');
    const faqIdx = LANDING_HTML.indexOf('id="faq"');
    const finalCtaIdx = LANDING_HTML.indexOf('class="final-cta-section"');
    const footerIdx = LANDING_HTML.indexOf('id="footer"');

    expect(headerIdx).toBeGreaterThan(-1);
    expect(heroIdx).toBeGreaterThan(headerIdx);
    expect(ecoIdx).toBeGreaterThan(heroIdx);
    expect(howIdx).toBeGreaterThan(ecoIdx);
    expect(demoIdx).toBeGreaterThan(howIdx);
    expect(storiesIdx).toBeGreaterThan(demoIdx);
    expect(privacyIdx).toBeGreaterThan(storiesIdx);
    expect(faqIdx).toBeGreaterThan(privacyIdx);
    expect(finalCtaIdx).toBeGreaterThan(faqIdx);
    expect(footerIdx).toBeGreaterThan(finalCtaIdx);
  });

  it("faithfully restores the original hero composition with all required elements", () => {
    // 1. Heading & Copy
    expect(LANDING_HTML).toContain("Know where you stand.");
    expect(LANDING_HTML).toContain("Know what to do next.");
    expect(LANDING_HTML).toContain(
      "Connect your GitHub, LinkedIn, LeetCode and resume. See what skills you have, what is missing, and what to learn next."
    );

    // 2. CTAs
    expect(LANDING_HTML).toContain('class="ref-primary-cta"');
    expect(LANDING_HTML).toContain("Get started");
    expect(LANDING_HTML).toContain('id="seeHowItWorksBtn"');
    expect(LANDING_HTML).toContain("See how it works");

    // 3. Central Profile Card
    expect(LANDING_HTML).toContain("YOUR PROFILE");
    expect(LANDING_HTML).toContain("Ananya Sharma");
    expect(LANDING_HTML).toContain("Computer Science Student");
    expect(LANDING_HTML).toContain("Skills");
    expect(LANDING_HTML).toContain("24");
    expect(LANDING_HTML).toContain("Projects");
    expect(LANDING_HTML).toContain("8");
    expect(LANDING_HTML).toContain("Publications");
    expect(LANDING_HTML).toContain("5");
    expect(LANDING_HTML).toContain("Opportunities");
    expect(LANDING_HTML).toContain("14");

    // 4. 7 Source Cards
    const sources = ["Resume", "GitHub", "LinkedIn", "LeetCode", "Kaggle", "Research Papers", "Projects"];
    for (const s of sources) {
      expect(LANDING_HTML).toContain(s);
    }

    // 5. 3 Destination Cards
    const outputs = ["Opportunities", "Learning", "Connections"];
    for (const out of outputs) {
      expect(LANDING_HTML).toContain(out);
    }

    // 6. Canvas & Dynamic SVG
    expect(LANDING_HTML).toContain('id="refMeshCanvas"');
    expect(LANDING_HTML).toContain('id="refEcoStage"');
    expect(LANDING_HTML).toContain('id="refSvgConnectionsGroup"');
  });

  it("completely removes the college showcase and university logo banner", () => {
    expect(LANDING_HTML).not.toContain("TRUSTED BY STUDENTS FROM INSTITUTIONS WORLDWIDE");
    expect(LANDING_HTML.toLowerCase()).not.toContain("institutions worldwide");
    expect(LANDING_HTML.toLowerCase()).not.toContain("iit bombay");
    expect(LANDING_HTML.toLowerCase()).not.toContain("bits pilani");
  });

  it("complies with the exact final CTA heading, supporting copy, and reassurance strings", () => {
    // Heading
    expect(LANDING_HTML).toContain("Start your career journey today");
    // Supporting text exact
    expect(LANDING_HTML).toContain("Join thousands of students who are already building a brighter future with AI Tathastu.");
    // Primary CTA
    expect(LANDING_HTML).toContain("Get Started Free");
    // Separate reassurance texts
    expect(LANDING_HTML).toContain("No credit card required");
    expect(LANDING_HTML).toContain("Takes less than 2 minutes");
  });

  it("contains the exact 4 approved privacy card titles", () => {
    expect(LANDING_HTML).toContain("Secure &amp; Encrypted Data Storage");
    expect(LANDING_HTML).toContain("You Own Your Data (Export or Delete Anytime)");
    expect(LANDING_HTML).toContain("No Training on Your Personal Data (Without Consent)");
    expect(LANDING_HTML).toContain("Granular Privacy Controls (Choose What to Share)");
    expect(LANDING_HTML).toContain('href="/privacy"');
  });

  it("renders all 5 room cards with correct secondary badges and accessibility attributes", () => {
    const rooms = [
      { key: "avasar", badge: "Get Hired" },
      { key: "learn", badge: "Grow" },
      { key: "collaborate", badge: "Build" },
      { key: "meet", badge: "Get Guidance" },
      { key: "iris", badge: "ASSESS" },
    ];

    for (const { key, badge } of rooms) {
      expect(LANDING_HTML).toContain(`data-room="${key}"`);
      expect(LANDING_HTML).toContain(badge);
    }

    // Every room card has accessible role and tabindex
    const roomCardCount = (LANDING_HTML.match(/class="room-card [^"]*bento-card/g) || []).length;
    expect(roomCardCount).toBe(5);

    const buttonRoleCount = (LANDING_HTML.match(/data-room="[^"]*" role="button" tabindex="0"/g) || []).length;
    expect(buttonRoleCount).toBe(5);
  });

  it("contains the demo section with 16:9 frame, product preview, and coming-soon triggers", () => {
    expect(LANDING_HTML).toContain('id="demo"');
    expect(LANDING_HTML).toContain("/img/demo-dashboard-preview-960.webp");
    expect(LANDING_HTML).toContain('width="1600" height="900"');
    // No fake playback cues while the real video isn't connected.
    expect(LANDING_HTML).not.toContain("demo-track-progress");
    expect(LANDING_HTML).not.toContain("HD 1080p");
    expect(LANDING_HTML).toContain("Our 2-minute product demo is coming soon.");
    expect(LANDING_HTML).toContain('id="watchDemoBtn"');
    expect(LANDING_HTML).toContain('id="demoPlayTrigger"');
    expect(LANDING_HTML).toContain("Watch Demo (2 min)");
    expect(LANDING_HTML).toContain('id="demoModal"');
  });

  it("contains the FAQ accordion items with triggers and answer panels", () => {
    expect(LANDING_HTML).toContain('id="faq"');
    const faqTriggers = LANDING_HTML.match(/class="faq-trigger"/g) || [];
    expect(faqTriggers.length).toBeGreaterThanOrEqual(5);

    const faqPanels = LANDING_HTML.match(/class="faq-answer-panel"/g) || [];
    expect(faqPanels.length).toBeGreaterThanOrEqual(5);

    // Help center card linking to /contact
    expect(LANDING_HTML).toContain('href="/contact"');
    expect(LANDING_HTML).toContain("Still have questions?");
  });

  it("keeps the primary header CTA consistent as 'Get Started Free'", () => {
    expect(LANDING_HTML).toContain('id="navCreateProfileBtn"');
    const navBtnMatch = LANDING_HTML.match(/id="navCreateProfileBtn"[^>]*>[\s\S]*?<\/a>/);
    expect(navBtnMatch).not.toBeNull();
    expect(navBtnMatch![0]).toContain("Get Started Free");
    expect(navBtnMatch![0]).not.toContain("Open Dashboard");
  });
});
