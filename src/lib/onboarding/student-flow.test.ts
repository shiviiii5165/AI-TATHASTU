import { describe, expect, it } from "vitest";
import {
  CAREER_ROLES,
  CAREER_ROLE_IDS,
  PRIORITIES,
  PRIORITY_IDS,
  MAX_PRIORITIES,
} from "@/lib/onboarding/catalog";
import {
  FLOWS,
  FLOW_LENGTH,
  firstStep,
  nextStep,
  previousStep,
  stepHref,
  stepIndex,
} from "@/lib/onboarding/steps";

describe("onboarding/student-flow - Student Journey Verification", () => {
  describe("Step catalog integrity", () => {
    it("has unique role IDs and valid labels", () => {
      expect(new Set(CAREER_ROLE_IDS).size).toBe(CAREER_ROLE_IDS.length);
      // Every selectable role is a valid id; retired ids stay valid so saved preferences keep loading.
      for (const role of CAREER_ROLES) expect(CAREER_ROLE_IDS).toContain(role.id);

      for (const role of CAREER_ROLES) {
        expect(role.id).toBeDefined();
        expect(role.label.length).toBeGreaterThan(2);
        expect(role.blurb.length).toBeGreaterThan(10);
      }
    });

    it("has unique priority IDs and respect max priorities boundary", () => {
      expect(new Set(PRIORITY_IDS).size).toBe(PRIORITY_IDS.length);
      expect(PRIORITIES.length).toBe(PRIORITY_IDS.length);
      expect(MAX_PRIORITIES).toBeGreaterThanOrEqual(3);

      for (const priority of PRIORITIES) {
        expect(priority.id).toBeDefined();
        expect(priority.label.length).toBeGreaterThan(2);
        expect(priority.blurb.length).toBeGreaterThan(10);
      }
    });

    it("finds role and priority by ID", () => {
      const mlRole = CAREER_ROLES.find((r) => r.id === "ml_engineer");
      expect(mlRole?.label).toBe("ML Engineer");

      const learnPriority = PRIORITIES.find((p) => p.id === "learn_ai_ml");
      expect(learnPriority?.label).toBe("Learn AI & ML");
    });
  });

  describe("Student 6-step flow order and transitions", () => {
    const studentFlow = FLOWS.student;

    it("has exactly 6 steps in the expected order", () => {
      expect(studentFlow).toHaveLength(FLOW_LENGTH);
      expect(studentFlow).toEqual([
        "career_direction",
        "priorities",
        "basic_profile",
        "resume",
        "connectors",
        "review",
      ]);
    });

    it("maps sequential transitions correctly from start to finish", () => {
      expect(firstStep("student")).toBe("career_direction");

      expect(nextStep("career_direction", "student")).toBe("priorities");
      expect(nextStep("priorities", "student")).toBe("basic_profile");
      expect(nextStep("basic_profile", "student")).toBe("resume");
      expect(nextStep("resume", "student")).toBe("connectors");
      expect(nextStep("connectors", "student")).toBe("review");
      expect(nextStep("review", "student")).toBe("done");
    });

    it("maps backward transitions correctly", () => {
      expect(previousStep("review", "student")).toBe("connectors");
      expect(previousStep("connectors", "student")).toBe("resume");
      expect(previousStep("resume", "student")).toBe("basic_profile");
      expect(previousStep("basic_profile", "student")).toBe("priorities");
      expect(previousStep("priorities", "student")).toBe("career_direction");
      expect(previousStep("career_direction", "student")).toBe("role");
    });

    it("returns correct URL paths for every student step", () => {
      expect(stepHref("career_direction")).toBe("/onboarding/career-direction");
      expect(stepHref("priorities")).toBe("/onboarding/priorities");
      expect(stepHref("basic_profile")).toBe("/onboarding/basic-profile");
      expect(stepHref("resume")).toBe("/onboarding/resume");
      expect(stepHref("connectors")).toBe("/onboarding/connect-sources");
      expect(stepHref("review")).toBe("/onboarding/review-consent");
      expect(stepHref("done")).toBe("/dashboard");
    });

    it("returns correct 0-indexed positions within the flow", () => {
      expect(stepIndex("career_direction", "student")).toBe(0);
      expect(stepIndex("priorities", "student")).toBe(1);
      expect(stepIndex("basic_profile", "student")).toBe(2);
      expect(stepIndex("resume", "student")).toBe(3);
      expect(stepIndex("connectors", "student")).toBe(4);
      expect(stepIndex("review", "student")).toBe(5);
    });
  });
});
