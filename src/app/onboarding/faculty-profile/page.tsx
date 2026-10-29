import type { Metadata } from "next";
import { Suspense } from "react";

import { submitFacultyProfile } from "@/app/onboarding/persona-actions";
import { AcademicStepForm } from "@/components/onboarding/academic-step-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { academicPrefill } from "@/lib/academic/prefill";
import { requireOnboardingStep } from "@/lib/dal";
import { PERSONA_FORMS } from "@/lib/onboarding/personas";
import { previousStep } from "@/lib/onboarding/steps";

export const metadata: Metadata = { title: "Your faculty profile" };

export default function Page() {
  return (
    <>
      <StepHeader step="faculty_profile" frame="form" title="Your faculty profile">
        Students and colleagues see this first. We use your institution, department and field to match you with students in your area.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <Step />
      </Suspense>
    </>
  );
}

// Same academic block and server validation as students (src/lib/academic/validate.ts).
async function Step() {
  const { user } = await requireOnboardingStep("faculty_profile");
  const { catalog, institution, values } = await academicPrefill(user, null);
  return (
    <AcademicStepForm
      action={submitFacultyProfile}
      mode={{ year: false, graduation: null }}
      degreeLabel="Highest degree"
      extraFields={PERSONA_FORMS.faculty_profile}
      catalog={catalog}
      initialInstitution={institution}
      initialValues={{ ...values, department: user.department ?? "", academicTitle: user.academicTitle ?? "" }}
      backStep={previousStep("faculty_profile", user.role)}
    />
  );
}
