"use client";

import { ArrowRight, Check, LoaderCircle, Minus } from "lucide-react";
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
      <div className="mx-auto mt-8 w-full max-w-[880px]">
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
            Your Information
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs md:col-span-2">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold text-slate-900">Profile completeness</p>
              <p className="font-mono text-sm font-semibold text-[#FF2A85]">{Math.round(completeness * 100)}%</p>
            </div>
            <div
              role="progressbar"
              aria-label="Profile completeness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(completeness * 100)}
              className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className="h-full origin-left bg-gradient-to-r from-[#FF5A5F] via-[#F43F5E] to-[#EA580C] transition-transform duration-500"
                style={{ transform: `scaleX(${completeness})` }}
              />
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className={cn(
                    "flex items-center gap-2 text-xs font-medium",
                    c.done ? "text-slate-800" : "text-slate-500",
                  )}
                >
                  {c.done ? (
                    <span className="flex size-4 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check aria-hidden className="size-3 stroke-[2.5]" />
                    </span>
                  ) : (
                    <span className="flex size-4 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                      <Minus aria-hidden className="size-3" />
                    </span>
                  )}
                  {c.label}
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
                        <li key={p} className="text-slate-800 text-sm font-medium">
                          <span className="mr-2 font-mono text-xs font-semibold text-[#FF5A5F]">{i + 1}</span>
                          {p}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Empty>{a.empty}</Empty>
                  )
                ) : (
                  (a.value ? <span className="text-slate-900 font-medium text-sm">{a.value}</span> : <Empty>{a.empty}</Empty>)
                )}
                {a.detail && <span className="block mt-0.5 text-xs text-slate-600">{a.detail}</span>}
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
                <span className="text-slate-900 font-medium text-sm">
                  {summary.sources.map((s) => s.name).join(", ")}
                </span>
              ) : (
                <Empty>None yet</Empty>
              )}
            </SummaryCard>
          </div>
        </section>

        <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-sm text-slate-700 flex items-start gap-3">
          <div className="size-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
          <p className="leading-relaxed">
            <span className="font-semibold text-slate-900">Your data is private & encrypted.</span> We never sell your personal information or share it with unauthorized third parties. You can update your permissions anytime in Settings.
          </p>
        </div>
      </div>

      <StepFooter backStep="connectors" error={generateError ?? undefined}>
        <form action={generate}>
          <Button
            type="submit"
            disabled={generating}
            className="h-11 px-7 rounded-full font-semibold bg-gradient-to-r from-[#FF5A5F] via-[#F43F5E] to-[#EA580C] text-white shadow-md shadow-rose-500/20 hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2"
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
    <dl className={cn("flex min-w-0 flex-col rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs", className)}>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{term}</dt>
        <dd className="-my-2 -mr-2">
          <Link
            href={href}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-xs font-semibold text-[#FF2A85] hover:bg-[#FFF5F7] transition-colors focus-visible:ring-2 focus-visible:ring-[#FF5A5F] focus-visible:outline-none"
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
        <span className="flex items-center gap-2 text-xs font-medium text-amber-600">
          <LoaderCircle aria-hidden className="size-3.5 animate-spin" />
          Reading file. Added to profile once reviewed.
        </span>
      );
    case "failed":
      return <span className="text-xs font-medium text-rose-600">Couldn&apos;t read file. Try another.</span>;
    case "extracted":
      return (
        <span className="text-xs font-medium text-slate-800">
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
  return <span className="text-xs text-slate-500 italic">{children}</span>;
}
