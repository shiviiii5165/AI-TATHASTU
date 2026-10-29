import type { Metadata } from "next";
import { Suspense } from "react";

import { submitAlumniProfile } from "@/app/onboarding/persona-actions";
import { AcademicStepForm } from "@/components/onboarding/academic-step-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { academicPrefill } from "@/lib/academic/prefill";
import { requireOnboardingStep } from "@/lib/dal";
import { PERSONA_FORMS } from "@/lib/onboarding/personas";
import { previousStep } from "@/lib/onboarding/steps";

export const metadata: Metadata = { title: "Your alumni profile" };

export default function Page() {
  return (
    <>
      <StepHeader step="alumni_profile" frame="form" title="Your alumni profile">
        Where and what you studied. Students from your university and field will be able to find you.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <Step />
      </Suspense>
    </>
  );
}

// Same academic block and server validation as students (src/lib/academic/validate.ts).
async function Step() {
  const { user } = await requireOnboardingStep("alumni_profile");
  const { catalog, institution, values } = await academicPrefill(user, "completed");
  return (
    <AcademicStepForm
      action={submitAlumniProfile}
      mode={{ year: false, graduation: "completed" }}
      degreeLabel="Degree"
      extraFields={PERSONA_FORMS.alumni_profile}
      catalog={catalog}
      initialInstitution={institution}
      initialValues={{ ...values }}
      backStep={previousStep("alumni_profile", user.role)}
    />
  );
}
