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
    <header className={cn("relative max-w-3xl motion-slide-up", className)}>
      {/* Subtle ambient accent glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -left-6 -z-10 size-40 rounded-full bg-gradient-to-br from-[#FF2A85]/12 via-[#9333EA]/6 to-transparent blur-3xl"
      />

      {/* Modern step tracker pill */}
      <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/60 px-3.5 py-1 text-xs font-semibold backdrop-blur-xs transition-colors shadow-2xs">
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF2A85] opacity-60" />
          <span className="relative inline-flex size-2 rounded-full bg-gradient-to-r from-[#FF6B4A] to-[#FF2A85]" />
        </span>
        <p className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <span className="font-bold text-[#FF2A85]">{pad(position)}</span> / {pad(FLOW_LENGTH)} · {stepLabel(step)}
        </p>
      </div>

      {/* Headline with rich typography and subtle brand accent line */}
      <div className="relative mt-3.5">
        <h1 className="font-sans text-3xl font-black tracking-[-0.03em] sm:text-4xl lg:text-[2.65rem] leading-[1.12] bg-gradient-to-br from-foreground via-foreground to-foreground/80 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
          {title}
        </h1>
        <div
          aria-hidden="true"
          className="mt-3.5 h-1 w-12 rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF2A85] to-[#9333EA] motion-scale-in"
        />
      </div>

      {children && (
        <p className="mt-3 max-w-[65ch] text-sm leading-relaxed text-muted-foreground sm:text-base font-normal">
          {children}
        </p>
      )}
    </header>
  );
}
