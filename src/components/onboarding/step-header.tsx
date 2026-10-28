import type { ReactNode } from "react";
import { FLOW_LENGTH, stepLabel, stepPosition, type WizardStep } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

export function StepHeader({
  step,
  title,
  children,
  className,
}: {
  step: WizardStep;
  title: ReactNode;
  children?: ReactNode;
  /** Single-column steps pass their content width (e.g. "mx-auto max-w-2xl") so the header lines up with it. */
  className?: string;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const position = stepPosition(step) + 1;

  return (
    <header className={cn("max-w-3xl", className)}>
      <p className="font-mono text-xs font-semibold tracking-wider text-slate-500 uppercase">
        <span className="font-bold text-[#FF2A85]">{pad(position)}</span> / {pad(FLOW_LENGTH)} · {stepLabel(step)}
      </p>

      <h1 className="mt-2.5 font-sans text-2xl font-extrabold leading-[1.15] tracking-tight text-[#0F172A] sm:text-3xl lg:text-4xl">
        {title}
      </h1>

      {children && (
        <p className="mt-2.5 max-w-[65ch] text-sm leading-relaxed text-slate-600 sm:text-base">
          {children}
        </p>
      )}
    </header>
  );
}
