import { redirect } from "next/navigation";
import { Suspense } from "react";

import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { FINISHED_REDIRECT, getCurrentUser, getOnboardingState } from "@/lib/dal";
import { stepHref } from "@/lib/onboarding/steps";

// Entry point: resume wherever the user left off.
export default function OnboardingIndex() {
  return (
    <Suspense fallback={<StepSkeleton label="Finding where you left off…" />}>
      <ResumeRedirect />
    </Suspense>
  );
}

async function ResumeRedirect(): Promise<never> {
  const user = await getCurrentUser();
  const state = await getOnboardingState(user.id);
  redirect(state.currentStep === "done" ? `${FINISHED_REDIRECT}?redirect=/dashboard` : stepHref(state.currentStep));
}
