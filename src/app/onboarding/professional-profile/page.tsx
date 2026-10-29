import type { Metadata } from "next";
import { Suspense } from "react";

import { submitProfessionalProfile } from "@/app/onboarding/persona-actions";
import { PersonaStepForm } from "@/components/onboarding/persona-step-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { requireOnboardingStep } from "@/lib/dal";
import { previousStep } from "@/lib/onboarding/steps";

export const metadata: Metadata = { title: "Where you work now" };

export default function Page() {
  return (
    <>
      <StepHeader step="professional_profile" frame="form" title="Where you work now">
        Your current role helps students see what paths lead where, and lets us show you talent that fits your team.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <Step />
      </Suspense>
    </>
  );
}

async function Step() {
  const { user, state } = await requireOnboardingStep("professional_profile");
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return (
    <PersonaStepForm
      step="professional_profile"
      action={submitProfessionalProfile}
      backStep={previousStep("professional_profile", user.role)}
      initialValues={{
        company: s(user.company),
        jobTitle: s(user.jobTitle),
        careerArea: s(state.careerRole),
      }}
    />
  );
}
