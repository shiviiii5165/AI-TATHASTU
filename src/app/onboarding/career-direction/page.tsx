import type { Metadata } from "next";
import { Suspense } from "react";

import { CareerDirectionForm } from "@/components/onboarding/career-direction-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { requireOnboardingStep } from "@/lib/dal";

export const metadata: Metadata = { title: "What do you want to do? · AI Tathastu" };

export default function CareerDirectionPage() {
  return (
    <>
      <StepHeader
        step="career_direction"
        title="What do you want to do?"
      >
        Choose one or more areas. You can change this later.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <CareerDirectionStep />
      </Suspense>
    </>
  );
}

async function CareerDirectionStep() {
  const { state } = await requireOnboardingStep("career_direction");
  return <CareerDirectionForm initialRoles={state.careerRoles} initialOther={state.careerRoleOther ?? ""} />;
}
