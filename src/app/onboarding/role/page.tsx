import type { Metadata } from "next";
import { Suspense } from "react";

import { choosePersona } from "@/app/onboarding/persona-actions";
import { RoleSelector } from "@/components/onboarding/role-selector";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { requireRoleChoice } from "@/lib/dal";

export const metadata: Metadata = { title: "Who are you? · AI Tathastu" };

/** Step 0: the persona decides the rest of onboarding and the dashboard. */
export default function RolePage() {
  return (
    <>
      <header className="max-w-3xl">
        <p className="font-mono text-sm font-semibold tracking-wider text-slate-400">
          <span className="font-bold text-[#FF2A85]">01</span> / 06
        </p>
        <h1 className="mt-3 font-sans text-3xl font-extrabold tracking-tight text-[#0F172A] sm:text-4xl lg:text-5xl">
          Who are you?
        </h1>
        <p className="mt-2.5 text-sm font-normal leading-relaxed text-slate-500 sm:mt-3 sm:text-base">
          Choose how you&apos;ll use AI Tathastu. We&apos;ll customize your experience.
        </p>
      </header>
      <Suspense fallback={<StepSkeleton />}>
        <RoleChoice />
      </Suspense>
    </>
  );
}

async function RoleChoice() {
  const { user, state } = await requireRoleChoice();
  const current = state.currentStep === "role" ? null : user.role;

  return <RoleSelector initialPersona={current} action={choosePersona} />;
}
