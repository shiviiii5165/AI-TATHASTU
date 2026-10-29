import type { Metadata } from "next";
import { Suspense } from "react";

import { submitMentorship } from "@/app/onboarding/persona-actions";
import { PersonaStepForm } from "@/components/onboarding/persona-step-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { requireOnboardingStep } from "@/lib/dal";
import { previousStep } from "@/lib/onboarding/steps";

export const metadata: Metadata = { title: "How you'd like to mentor" };

export default function Page() {
  return (
    <>
      <StepHeader
        step="mentorship" frame="form"
        title="How you'd like to mentor"
      >
        Set how many students you can take on and what you can help with. Students only see you as available while you have room.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <Step />
      </Suspense>
    </>
  );
}

async function Step() {
  const { user, state } = await requireOnboardingStep("mentorship");
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  const on = (v: unknown) => (v === true ? "on" : "");
  return (
    <PersonaStepForm
      step="mentorship"
      action={submitMentorship}
      backStep={previousStep("mentorship", user.role)}
      initialValues={{
        capacity: s(state.mentorship.capacity),
        canVerifyEris: on(state.mentorship.canVerifyEris),
        canReviewResumes: on(state.mentorship.canReviewResumes),
      }}
    />
  );
}
