"use client";

import { ArrowRight, Check, LoaderCircle, Minus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import type { SaveResult } from "@/app/onboarding/actions";
import { generateProfile } from "@/app/onboarding/review-consent/actions";
import { StepFooter } from "@/components/onboarding/continue-form";
import { SaveStatusText } from "@/components/onboarding/save-status";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAutosave } from "@/hooks/use-autosave";
import { CONSENT_ITEMS, CONSENT_POLICY_VERSION, type ConsentChoices } from "@/lib/consent/catalog";
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

async function saveConsents(choices: ConsentChoices): Promise<SaveResult> {
  const res = await fetch("/api/consents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(choices),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: data.error ?? "Your choice wasn't saved." };
}

export function ReviewConsent({ summary, initialChoices }: { summary: ProgressSummary; initialChoices: ConsentChoices }) {
  const [choices, setChoices] = useState(initialChoices);
  const { status, error, save, retry } = useAutosave(saveConsents);
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

  function toggle(purpose: keyof ConsentChoices, value: boolean) {
    const next = { ...choices, [purpose]: value };
    setChoices(next);
    void save(next);
  }

  function generate() {
    setGenerateError(null);
    startGenerating(async () => {
      const result = await generateProfile(choices);
      if (result && !result.ok) setGenerateError(result.error);
    });
  }

  return (
    <>
      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section aria-labelledby="summary-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="summary-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Your Information
            </h2>
          </div>

          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
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
                    c.done ? "text-slate-800" : "text-slate-400",
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

          <dl className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-xs">
            {summary.answers.map((a) => (
              <SummaryRow key={a.term} term={a.term} href={a.href}>
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
                {a.detail && <span className="block mt-0.5 text-xs text-slate-500">{a.detail}</span>}
              </SummaryRow>
            ))}
            <SummaryRow
              term="Resume"
              href={summary.resume.state === "extracted" ? "/onboarding/resume/review" : "/onboarding/resume"}
            >
              <ResumeLine resume={summary.resume} />
            </SummaryRow>
            <SummaryRow term="Connected sources" href="/onboarding/connect-sources">
              {summary.sources.length ? (
                <span className="text-slate-900 font-medium text-sm">
                  {summary.sources.map((s) => s.name).join(", ")}
                </span>
              ) : (
                <Empty>None yet</Empty>
              )}
            </SummaryRow>
          </dl>
        </section>

        <section aria-labelledby="consent-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="consent-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Your permissions
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Policy v{CONSENT_POLICY_VERSION}</span>
          </div>

          <fieldset className="space-y-3">
            <legend className="sr-only">Choose what AI Tathastu may do with your data</legend>
            {CONSENT_ITEMS.filter((item) => item.purpose !== "external_ai").map((item) => {
              const id = `consent-${item.purpose}`;
              const checked = choices[item.purpose];
              return (
                <div
                  key={item.purpose}
                  className={cn(
                    "flex items-start gap-4 rounded-2xl border bg-white p-5 transition-all duration-200 shadow-xs",
                    checked
                      ? "border-[#FF5A5F]/40 bg-[#FFF5F7]/20 ring-1 ring-[#FF5A5F]/20"
                      : "border-slate-200/90 hover:border-slate-300",
                  )}
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(v) => toggle(item.purpose, v === true)}
                    aria-describedby={`${id}-body ${id}-without`}
                    className="mt-0.5 size-5 rounded-md border-slate-300 data-[state=checked]:bg-[#FF5A5F] data-[state=checked]:border-[#FF5A5F]"
                  />
                  <div className="min-w-0">
                    <label htmlFor={id} className="cursor-pointer font-semibold text-slate-900 text-sm">
                      {item.title}
                    </label>
                    <p id={`${id}-body`} className="mt-1 text-xs leading-relaxed text-slate-500">
                      {item.body}
                    </p>
                    <p id={`${id}-without`} className="mt-2 text-xs font-medium text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {item.without}
                    </p>
                  </div>
                </div>
              );
            })}
          </fieldset>

          <div className="mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-600 flex items-start gap-3">
            <div className="size-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
            <p className="leading-relaxed">
              <span className="font-semibold text-slate-800">Your data is private & encrypted.</span> We never sell your personal information or share it with unauthorized third parties. You can update your permissions anytime in Settings.
            </p>
          </div>
        </section>
      </div>

      <StepFooter
        backStep="connectors"
        error={generateError ?? undefined}
        status={<SaveStatusText status={status} error={error} onRetry={retry} />}
      >
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

function SummaryRow({ term, href, children }: { term: string; href: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 p-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] items-start">
      <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{term}</dt>
      <dd className="col-span-2 row-start-2 min-w-0 sm:col-span-1 sm:row-start-1">{children}</dd>
      <dd className="col-start-2 row-start-1 sm:col-start-3">
        <Link
          href={href}
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-[#FF2A85] hover:bg-[#FFF5F7] transition-colors focus-visible:ring-2 focus-visible:ring-[#FF5A5F] focus-visible:outline-none"
        >
          Edit<span className="sr-only"> {term.toLowerCase()}</span>
        </Link>
      </dd>
    </div>
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
  return <span className="text-xs text-slate-400 italic">{children}</span>;
}
