import { describe, expect, it } from "vitest";
import { CONSENT_ITEMS, CONSENT_POLICY_VERSION, CONSENT_PURPOSES, EXTERNAL_AI_FULL_SCOPE_SINCE, RESUME_AI_CONSENT, coversVersion, needsExternalAiScopeUpdate } from "@/lib/consent/catalog";

describe("one-time external_ai consent", () => {
  it("asks again only for a grant given before the full scope was disclosed", () => {
    expect(needsExternalAiScopeUpdate({ granted: true, policyVersion: "2026-10-29" })).toBe(true);
    expect(needsExternalAiScopeUpdate({ granted: true, policyVersion: null })).toBe(true);
  });

  it("never asks again once answered under the current scope, either way, or when there's no answer", () => {
    expect(needsExternalAiScopeUpdate({ granted: true, policyVersion: EXTERNAL_AI_FULL_SCOPE_SINCE })).toBe(false);
    expect(needsExternalAiScopeUpdate({ granted: true, policyVersion: "2027-01-15" })).toBe(false);
    expect(needsExternalAiScopeUpdate({ granted: false, policyVersion: "2026-10-29" })).toBe(false);
    expect(needsExternalAiScopeUpdate(null)).toBe(false);
    expect(needsExternalAiScopeUpdate(undefined)).toBe(false);
  });

  it("a later wording-only policy version doesn't re-ask: the scope date is what counts", () => {
    expect(CONSENT_POLICY_VERSION >= EXTERNAL_AI_FULL_SCOPE_SINCE).toBe(true);
    expect(coversVersion(CONSENT_POLICY_VERSION, EXTERNAL_AI_FULL_SCOPE_SINCE)).toBe(true);
    expect(coversVersion("test", EXTERNAL_AI_FULL_SCOPE_SINCE)).toBe(false);
  });
});

describe("consent/catalog - Policy and Items Verification", () => {
  it("defines a valid ISO date for CONSENT_POLICY_VERSION", () => {
    expect(CONSENT_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("includes all 4 defined consent purposes", () => {
    expect(CONSENT_PURPOSES).toEqual(["external_ai", "linkedin_scrape", "mentor_discovery", "analytics"]);
  });

  it("every consent item has clear title, body, and without-consequence copy", () => {
    for (const item of CONSENT_ITEMS) {
      expect(item.title.length).toBeGreaterThan(5);
      expect(item.body.length).toBeGreaterThan(20);
      expect(item.without.length).toBeGreaterThan(10);
    }
  });

  it("mentions required privacy safeguards in copy without misleading claims", () => {
    const aiItem = CONSENT_ITEMS.find((c) => c.purpose === "external_ai");
    expect(aiItem?.body).toContain("Nothing is added to your profile until you review and confirm it");
    // The outside services that really receive resume content are always named, here and at the resume step.
    expect(aiItem?.body).toContain("Groq, Google Gemini or OpenRouter");
    const resumeText = RESUME_AI_CONSENT.details.map((d) => d.text).join(" ");
    expect(resumeText).toContain("Groq, Google Gemini or OpenRouter");
    expect(resumeText).not.toMatch(/stays (entirely )?(with|within) AI Tathastu|never leaves/i);
    expect(RESUME_AI_CONSENT.details.map((d) => d.term)).toEqual(["What we extract", "Why we need it", "Who processes your resume", "What else this covers", "What is saved", "If you don't allow it", "Changing your mind"]);
    // Everything the worker sends to outside AI under external_ai is disclosed (portfolio, repositories, matching),
    // in the settings copy and at the resume step alike.
    for (const text of [aiItem!.body, resumeText]) {
      expect(text).toMatch(/portfolio/i);
      expect(text).toMatch(/GitHub repositories/);
      expect(text).toMatch(/match you with people/);
    }
    // Withdrawal must not promise more than the worker does (consent is read when a job starts).
    expect(resumeText).toContain("Processing that has already started may finish with them");

    const linkedinItem = CONSENT_ITEMS.find((c) => c.purpose === "linkedin_scrape");
    expect(linkedinItem?.body).toContain("We never log in as you or use your cookies");
  });
});
