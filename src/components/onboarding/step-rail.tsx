"use client";

import { Check, GraduationCap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Persona } from "@/db/schema";
import { PERSONA_COPY } from "@/lib/onboarding/personas";
import { flowSteps, stepIndex, type OnboardingStep } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

const NEUTRAL_STEPS = flowSteps("student");

export function StepRail({
  currentStep,
  persona,
}: {
  currentStep: OnboardingStep | null;
  persona: Persona | null;
}) {
  const pathname = usePathname();
  const chosen = currentStep !== null && currentStep !== "role";
  const ONBOARDING_STEPS = chosen && persona ? flowSteps(persona) : NEUTRAL_STEPS;
  const reached = currentStep && persona ? stepIndex(currentStep, persona) : -1;
  const viewing = ONBOARDING_STEPS.findIndex((s) => pathname.startsWith(`/onboarding/${s.slug}`));
  const onRole = pathname.startsWith("/onboarding/role");

  return (
    <nav aria-label="Onboarding progress" className="w-full">
      {/* Mobile progress bar (below lg) */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono font-semibold tracking-wider text-slate-500 uppercase">
            {onRole || !chosen
              ? "Getting started"
              : `Step ${Math.max(viewing, 0) + 1} of ${ONBOARDING_STEPS.length}`}
          </span>
          {chosen && persona && (
            <span className="font-medium text-slate-700">
              {onRole ? (
                PERSONA_COPY[persona].label
              ) : (
                <Link
                  href="/onboarding/role"
                  className="underline underline-offset-2 hover:text-[#FF2A85]"
                >
                  {PERSONA_COPY[persona].label}
                  <span className="sr-only"> (change)</span>
                </Link>
              )}
            </span>
          )}
        </div>
        <ol
          className="mt-2.5 grid gap-1.5"
          style={{ gridTemplateColumns: `repeat(${ONBOARDING_STEPS.length}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {ONBOARDING_STEPS.map((s, i) => (
            <li
              key={s.id}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === viewing
                  ? "bg-gradient-to-r from-[#FF6B4A] to-[#FF2A85] shadow-xs"
                  : i < Math.max(reached, viewing)
                    ? "bg-slate-900"
                    : "bg-slate-200"
              )}
            />
          ))}
        </ol>
      </div>

      {/* Persona card / badge on desktop */}
      <div className="mb-6 hidden lg:block">
        <div className="flex items-center gap-2.5 rounded-xl border border-rose-100 bg-rose-50/60 px-3.5 py-2.5">
          <div className="grid size-7 place-items-center rounded-lg bg-[#FF2A85] text-white shadow-xs">
            <GraduationCap className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-semibold text-rose-700 uppercase tracking-wider">
              Persona
            </p>
            <p className="truncate text-xs font-bold text-slate-900">
              Joining as{" "}
              {chosen && persona ? (
                onRole ? (
                  PERSONA_COPY[persona].label
                ) : (
                  <Link
                    href="/onboarding/role"
                    className="underline underline-offset-2 hover:text-[#FF2A85]"
                  >
                    {PERSONA_COPY[persona].label}
                    <span className="sr-only"> (change)</span>
                  </Link>
                )
              ) : (
                "Student"
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Desktop vertical connected step rail */}
      <div className="relative hidden lg:block">
        {/* Continuous vertical connecting line */}
        <div
          className="absolute top-4 bottom-6 left-4 w-0.5 -translate-x-1/2 bg-slate-200"
          aria-hidden="true"
        />

        <ol className="space-y-4">
          {ONBOARDING_STEPS.map((s, i) => {
            const isDone = i < reached;
            const isCurrent = i === viewing;
            const isReachable = i <= reached;

            const circle = (
              <span
                className={cn(
                  "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all duration-200",
                  isCurrent &&
                    "border-[#FF2A85] bg-gradient-to-br from-[#FF6B4A] to-[#FF2A85] text-white shadow-md shadow-rose-500/30 scale-105 ring-4 ring-rose-500/15",
                  !isCurrent && isDone &&
                    "border-slate-900 bg-slate-900 text-white",
                  !isCurrent && !isDone &&
                    "border-slate-200 bg-white text-slate-400"
                )}
              >
                {isDone && !isCurrent ? (
                  <Check aria-hidden="true" className="size-3.5 stroke-[2.5] motion-scale-in" />
                ) : (
                  i + 1
                )}
              </span>
            );


            const label = (
              <span
                className={cn(
                  "text-sm transition-colors duration-150",
                  isCurrent
                    ? "font-bold text-[#0F172A]"
                    : isDone
                      ? "font-medium text-slate-700"
                      : "text-slate-400"
                )}
              >
                {s.label}
                {isDone && <span className="sr-only"> (completed)</span>}
              </span>
            );

            return (
              <li key={s.id}>
                {isReachable && !isCurrent ? (
                  <Link
                    href={`/onboarding/${s.slug}`}
                    className="group flex items-center gap-3.5 rounded-xl px-1.5 py-1 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {circle}
                    {label}
                  </Link>
                ) : (
                  <div
                    className="flex items-center gap-3.5 px-1.5 py-1"
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    {circle}
                    {label}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
