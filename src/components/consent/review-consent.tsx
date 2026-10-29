"use client";

import { ArrowRight, Check, LoaderCircle, Minus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { generateProfile } from "@/app/onboarding/review-consent/actions";
import { StepFooter } from "@/components/onboarding/continue-form";
import { Button } from "@/components/ui/button";
import type { ConsentChoices } from "@/lib/consent/catalog";
import { cn } from "@/lib/utils";

/** One row per persona-specific step (Steps 1–3); built server-side for the user's flow. */
export type AnswerRow = { term: string; href: string; value: string | null; detail?: string | null; ordered?: string[]; empty: string };

export type ProgressSummary = {
  answers: AnswerRow[];
  // Profile-completeness checks for the persona's own steps; resume and sources are added here.
  checks: { label: string; done: boolean }[];
  resume:
    | { state: "none" | "processing" | "failed" }
    | { state: "extracted"; confirmedFacts: number };
  sources: { name: string; status: string }[];
};

/**
 * `initialChoices` are the user's saved answers, false where never answered.
 * Mentor discovery and analytics are no longer asked here (they live in
 * Settings), so finishing records those as they stand: opt-out unless granted.
 */
export function ReviewConsent({ summary, initialChoices }: { summary: ProgressSummary; initialChoices: ConsentChoices }) {
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();

  const checks = [
    ...summary.checks,
    {
      label: "Resume reviewed",
      done: summary.resume.state === "extracted" && summary.resume.confirmedFacts > 0,
    },
    { label: "A source connected", done: summary.sources.length > 0 },
  ];
  const completeness = checks.filter((c) => c.done).length / checks.length;
  // Odd card count: the last card spans both columns so the grid ends flush.
  const cardCount = summary.answers.length + 2;

  function generate() {
    setGenerateError(null);
    startGenerating(async () => {
      const result = await generateProfile(initialChoices);
      if (result && !result.ok) setGenerateError(result.error);
    });
  }

  return (
    <>
      <div className="onb-frame mt-8 headline-reveal">
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Your Information
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Profile Completeness - Modernized high-contrast widget with glowing progress */}
            <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-xs md:col-span-2 transition-all before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-[#FF6B4A] before:via-[#FF2A85] before:to-[#9333EA]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6B4A]/15 via-[#FF2A85]/15 to-[#9333EA]/15 text-[#FF2A85] shadow-2xs">
                      <Sparkles className="size-4 animate-pulse" />
                    </div>
                    <h3 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                      Profile completeness
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                    Everything filled helps us generate accurate matches, recommendations, and intelligence.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <div className="flex items-center gap-2 rounded-full border border-[#FF2A85]/20 bg-[#FF2A85]/10 px-3.5 py-1.5 font-mono text-sm font-extrabold text-[#FF2A85] shadow-xs">
                    <span>{Math.round(completeness * 100)}%</span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      ({checks.filter((c) => c.done).length}/{checks.length} complete)
                    </span>
                  </div>
                </div>
              </div>

              {/* Progress bar with animated glowing wave */}
              <div
                role="progressbar"
                aria-label="Profile completeness"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(completeness * 100)}
                className="mt-4 h-3 w-full overflow-hidden rounded-full bg-muted/80 p-0.5 border border-border/40"
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#FF6B4A] via-[#FF2A85] to-[#9333EA] progress-animated-glow transition-all duration-1000 ease-out"
                  style={{ width: `${Math.max(5, Math.round(completeness * 100))}%` }}
                />
              </div>

              {/* Checklist items with clear 14px text and distinct badges */}
              <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {checks.map((c) => (
                  <li
                    key={c.label}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs",
                      c.done
                        ? "border-emerald-500/25 bg-emerald-500/[0.05] text-foreground font-semibold"
                        : "border-border/60 bg-muted/30 text-muted-foreground font-medium",
                    )}
                  >
                    {c.done ? (
                      <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs">
                        <Check aria-hidden className="size-3.5 stroke-[2.8]" />
                      </span>
                    ) : (
                      <span className="flex size-5.5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/60 border border-border/70">
                        <Minus aria-hidden className="size-3.5 stroke-[2]" />
                      </span>
                    )}
                    <span className="truncate">{c.label}</span>
                    <span className="ml-auto text-xs font-semibold">
                      {c.done ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Done</span>
                      ) : (
                        <span className="text-muted-foreground/70">Optional</span>
                      )}
                    </span>
                    <span className="sr-only">{c.done ? " (done)" : " (not yet)"}</span>
                  </li>
                ))}
              </ul>
            </div>

            {summary.answers.map((a) => (
              <SummaryCard key={a.term} term={a.term} href={a.href}>
                {a.ordered ? (
                  a.ordered.length ? (
                    <ol className="space-y-1">
                      {a.ordered.map((p, i) => (
                        <li key={p} className="text-foreground text-sm font-medium">
                          <span className="mr-2 font-mono text-xs font-semibold text-[#FF5A5F]">{i + 1}</span>
                          {p}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Empty>{a.empty}</Empty>
                  )
                ) : (
                  (a.value ? <span className="text-foreground font-medium text-sm">{a.value}</span> : <Empty>{a.empty}</Empty>)
                )}
                {a.detail && <span className="block mt-0.5 text-xs text-muted-foreground">{a.detail}</span>}
              </SummaryCard>
            ))}
            <SummaryCard
              term="Resume"
              href={summary.resume.state === "extracted" ? "/onboarding/resume/review" : "/onboarding/resume"}
            >
              <ResumeLine resume={summary.resume} />
            </SummaryCard>
            <SummaryCard
              term="Connected sources"
              href="/onboarding/connect-sources"
              className={cardCount % 2 ? "md:col-span-2" : undefined}
            >
              {summary.sources.length ? (
                <span className="text-foreground font-medium text-sm">
                  {summary.sources.map((s) => s.name).join(", ")}
                </span>
              ) : (
                <Empty>None yet</Empty>
              )}
            </SummaryCard>
          </div>
        </section>

        <div className="mt-4 rounded-2xl border border-border/80 bg-muted/40 p-4 text-sm text-muted-foreground flex items-start gap-3">
          <div className="size-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
          <p className="leading-relaxed">
            <span className="font-semibold text-foreground">Your data is private & encrypted.</span> We never sell your personal information or share it with unauthorized third parties. You can update your permissions anytime in Settings.
          </p>
        </div>
      </div>

      <StepFooter backStep="connectors" error={generateError ?? undefined}>
        <form action={generate}>
          <Button
            type="submit"
            disabled={generating}
            className="h-11 px-7 rounded-full font-semibold bg-gradient-to-r from-[#FF5A5F] via-[#F43F5E] to-[#EA580C] text-white shadow-md shadow-rose-500/20 hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2 cursor-pointer"
          >
            {generating ? <LoaderCircle data-icon="inline-start" aria-hidden className="size-4 animate-spin" /> : null}
            {generating ? "Creating your profile…" : "Create my profile"}
            {!generating && <ArrowRight data-icon="inline-end" aria-hidden className="size-4" />}
          </Button>
        </form>
      </StepFooter>
    </>
  );
}

function SummaryCard({
  term,
  href,
  className,
  children,
}: {
  term: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <dl className={cn("flex min-w-0 flex-col rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all hover:border-border hover:shadow-2xs", className)}>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{term}</dt>
        <dd className="-my-2 -mr-2">
          <Link
            href={href}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-xs font-semibold text-[#FF2A85] hover:bg-[#FF2A85]/10 transition-colors focus-visible:ring-2 focus-visible:ring-[#FF5A5F] focus-visible:outline-none cursor-pointer"
          >
            Edit<span className="sr-only"> {term.toLowerCase()}</span>
          </Link>
        </dd>
      </div>
      <dd className="mt-2 min-w-0">{children}</dd>
    </dl>
  );
}

function ResumeLine({ resume }: { resume: ProgressSummary["resume"] }) {
  switch (resume.state) {
    case "none":
      return <Empty>Not uploaded</Empty>;
    case "processing":
      return (
        <span className="flex items-center gap-2 text-xs font-medium text-amber-600 dark:text-amber-400">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
          Reading file. Added to profile once reviewed.
        </span>
      );
    case "failed":
      return <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Couldn&apos;t read file. Try another.</span>;
    case "extracted":
      return (
        <span className="text-xs font-medium text-foreground">
          {resume.confirmedFacts > 0 ? (
            <>Uploaded · {resume.confirmedFacts} fields confirmed</>
          ) : (
            <>Uploaded · pending review</>
          )}
        </span>
      );
  }
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-muted-foreground italic">{children}</span>;
}
