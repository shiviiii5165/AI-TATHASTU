import type { ReactNode } from "react";
import { FLOW_LENGTH, stepLabel, stepPosition, type WizardStep } from "@/lib/onboarding/steps";
import { cn } from "@/lib/utils";

export function StepHeader({
  step,
  title,
  children,
  frame,
  className,
}: {
  step: WizardStep;
  title: ReactNode;
  children?: ReactNode;
  /** Single-column steps: centre the header in the same frame as their content ("form" = onb-frame, "wide" = onb-frame-wide). */
  frame?: "form" | "wide";
  className?: string;
}) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const position = stepPosition(step) + 1;

  return (
    <header
      className={cn(
        "relative headline-reveal",
        frame === "form" ? "onb-frame" : frame === "wide" ? "onb-frame-wide" : "max-w-3xl",
        className,
      )}
    >
      {/* Luminous ambient accent glow backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-12 -left-8 -z-10 size-48 rounded-full bg-gradient-to-br from-[#FF2A85]/15 via-[#9333EA]/10 to-transparent blur-3xl opacity-80"
      />

      {/* Modern step tracker pill with live pulsing beacon */}
      <div className="inline-flex items-center gap-2.5 rounded-full border border-[#FF2A85]/20 bg-muted/80 dark:bg-muted/40 px-3.5 py-1.5 text-xs font-semibold backdrop-blur-md shadow-xs">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full bg-[#FF2A85] beacon-pulse opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-gradient-to-r from-[#FF6B4A] to-[#FF2A85]" />
        </span>
        <p className="font-mono text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          <span className="font-bold text-[#FF2A85]">{pad(position)}</span> / {pad(FLOW_LENGTH)} · {stepLabel(step)}
        </p>
      </div>

      {/* Headline with animated iridescent shimmer text and dynamic expanding bar */}
      <div className="relative mt-3.5">
        <h1 className="font-sans text-3xl font-black tracking-[-0.03em] sm:text-4xl lg:text-[2.65rem] leading-[1.12] headline-shimmer drop-shadow-xs">
          {title}
        </h1>
        <div
          aria-hidden="true"
          className="mt-3.5 h-1.5 rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF2A85] to-[#9333EA] shadow-[0_0_12px_rgba(255,42,133,0.5)] bar-expand"
        />
      </div>

      {children && (
        <p className="mt-3.5 max-w-[65ch] text-sm leading-relaxed text-muted-foreground sm:text-base font-normal">
          {children}
        </p>
      )}
    </header>
  );
}
