import type { Metadata } from "next";
import { Suspense } from "react";

import { submitGiveBack } from "@/app/onboarding/persona-actions";
import { PersonaStepForm } from "@/components/onboarding/persona-step-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { requireOnboardingStep } from "@/lib/dal";
import { previousStep } from "@/lib/onboarding/steps";

export const metadata: Metadata = { title: "How you'd like to give back" };

export default function Page() {
  return (
    <>
      <StepHeader step="give_back" frame="form" title="How you'd like to give back">
        Choose any that suit you, or none for now. You can change these any time, and students only see what you turn on.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <Step />
      </Suspense>
    </>
  );
}

async function Step() {
  const { user, state } = await requireOnboardingStep("give_back");
  const on = (v: unknown) => (v === true ? "on" : "");
  return (
    <PersonaStepForm
      step="give_back"
      action={submitGiveBack}
      backStep={previousStep("give_back", user.role)}
      initialValues={{
        mentor: on(state.giveBack.mentor),
        refer: on(state.giveBack.refer),
        speak: on(state.giveBack.speak),
      }}
    />
  );
}
