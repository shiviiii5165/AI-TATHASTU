"use client";

import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { continueFromStep, type ContinuableStep } from "@/app/onboarding/actions";
import type { Persona } from "@/db/schema";
import { stepHref, previousStep, type WizardStep } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

/**
 * Sticky step footer matching reference layout:
 * - Left: Back button
 * - Center: Realtime save feedback
 * - Right: Tactile brand Continue CTA
 */
export function ContinueForm({
  step,
  persona,
  canContinue,
  hint,
  status,
  label,
  variant,
}: {
  step: ContinuableStep;
  persona: Persona;
  canContinue: boolean;
  hint: string;
  status?: React.ReactNode;
  label?: string;
  variant?: "default" | "outline" | "pink";
}) {
  const [state, formAction, pending] = useActionState(continueFromStep, null);

  return (
    <StepFooter backStep={previousStep(step, persona)} status={status} error={state?.error}>
      <form action={formAction}>
        <input type="hidden" name="step" value={step} />
        <ContinueButton
          pending={pending}
          disabled={!canContinue}
          hint={canContinue ? undefined : hint}
          label={label}
          variant={variant}
        />
      </form>
    </StepFooter>
  );
}

export function StepFooter({
  backStep,
  status,
  error,
  children,
}: {
  backStep: WizardStep | "role" | null;
  status?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-30 mt-12 -ml-(--onb-gutter-l) -mr-(--onb-gutter-r) border-t border-slate-200/80 bg-white/95 pl-(--onb-gutter-l) pr-(--onb-gutter-r) pt-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:pt-4.5 sm:pb-[max(1.125rem,env(safe-area-inset-bottom))]">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        {/* Mobile buttons row */}
        {/* Wraps below ~360px so three actions (Back, Skip, Continue) never overflow. */}
        <div className="flex flex-wrap items-center justify-between gap-3 order-2 sm:order-1 sm:w-auto">
          {backStep ? (
            <Link
              href={stepHref(backStep)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              <span>Back</span>
            </Link>
          ) : (
            <div className="hidden sm:block" />
          )}

          <div className="sm:hidden flex flex-1 justify-end">
            {children}
          </div>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left order-1 sm:order-2">
          {error ? (
            <p role="alert" className="text-xs sm:text-sm font-medium text-red-600">
              {error}
            </p>
          ) : (
            status
          )}
        </div>

        <div className="hidden sm:block order-3">{children}</div>
      </div>
    </div>
  );
}

export function ContinueButton({
  pending,
  disabled,
  hint,
  label = "Continue",
  variant = "default",
}: {
  pending: boolean;
  disabled?: boolean;
  hint?: string;
  label?: string;
  variant?: "default" | "outline" | "pink";
}) {
  return (
    <div className="flex items-center gap-3">
      {hint && (
        <span id="continue-hint" className="hidden text-xs font-medium text-slate-400 sm:inline">
          {hint}
        </span>
      )}
      <button
        type="submit"
        disabled={disabled || pending}
        aria-describedby={hint ? "continue-hint" : undefined}
        className={cn(
          "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 sm:px-7 text-xs sm:text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none touch-manipulation cursor-pointer",
          variant === "default" && [
            "bg-gradient-to-r from-[#FF6B4A] via-[#FF2A85] to-[#9333EA] text-white shadow-md shadow-rose-500/25",
            "hover:opacity-95 hover:shadow-lg hover:shadow-rose-500/35 hover:scale-[1.01] active:scale-[0.99]",
            "disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:scale-100",
          ],
          variant === "outline" && [
            "border border-slate-200 bg-white text-slate-700 shadow-xs",
            "hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99]",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          ],
          variant === "pink" && [
            "rounded-2xl bg-pink-50 text-[#FF2A85] hover:bg-pink-100/80 px-6 font-semibold shadow-2xs",
            "active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed",
          ]
        )}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : null}
        <span>{pending ? "Saving…" : label}</span>
        {!pending && <ArrowRight aria-hidden="true" className="size-4" />}
      </button>
    </div>
  );
}
