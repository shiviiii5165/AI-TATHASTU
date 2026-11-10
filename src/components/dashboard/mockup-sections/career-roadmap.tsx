"use client";

import { ArrowRight, BookOpen, Briefcase, CalendarDays, Check, CheckCircle2, ChevronRight, CircleDashed, ExternalLink, FileText, Flag, Hourglass, Info, ListChecks, Lock, Send, Sparkles, Target, TrendingUp, TriangleAlert, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";

import { submitRoadmapEvidence } from "@/app/(dashboard)/dashboard/roadmap-actions";
import type { LearningRecommendation, IntelligenceDoc, RoleSkillRow } from "@/lib/dashboard/types";
import { milestoneReason } from "@/lib/roadmap/explain";
import type { MilestoneStatus, MilestoneSubmission, RoadmapStep } from "@/lib/roadmap/progress";
import { roadmapView, type RoadmapStageView, type SkillBucket } from "@/lib/roadmap/view";

/**
 * Career Roadmap, as in the approved mockup: goal, evidence coverage and next milestone; the journey from where
 * you are through the engine's stages to your goal; how the goal's skills stand; and the one next action.
 * Every value comes from lib/roadmap/view.ts, which reads only the engine's intelligence document. Where the
 * engine has nothing (no goal, no framework, too little evidence), this says so instead of showing a plan.
 */
export const HORIZONS = [
  { label: "Short term", hex: "#3b82f6" },
  { label: "Mid term", hex: "#8b5cf6" },
  { label: "Long term", hex: "#a855f7" },
] as const;

export const STATUS_STYLE: Record<MilestoneStatus, { label: string; icon: typeof CheckCircle2; className: string; hex: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, hex: "#10b981", className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30" },
  active: { label: "Do next", icon: Sparkles, hex: "#7c3aed", className: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/30" },
  submitted: { label: "In review", icon: Send, hex: "#0ea5e9", className: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30" },
  needs_more_evidence: { label: "Needs more evidence", icon: TriangleAlert, hex: "#f59e0b", className: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30" },
  blocked: { label: "Blocked", icon: Lock, hex: "#f43f5e", className: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30" },
  upcoming: { label: "Upcoming", icon: CircleDashed, hex: "#94a3b8", className: "bg-muted text-muted-foreground ring-border" },
};

const BUCKET_COLOUR: Record<SkillBucket["key"], string> = { demonstrated: "#10b981", inProgress: "#3b82f6", notYet: "#e2e8f0" };
const weeks = (n: number) => `about ${n} ${n === 1 ? "week" : "weeks"}`;

export function CareerRoadmap({ intelligence, submissions }: { intelligence?: IntelligenceDoc; submissions?: MilestoneSubmission[] }) {
  const view = useMemo(() => roadmapView(intelligence, submissions), [intelligence, submissions]);
  const [stageKey, setStageKey] = useState<string | null>(null);
  const [stepId, setStepId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
          <Target aria-hidden className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-sans text-lg font-bold leading-tight text-foreground">Career Roadmap</h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {view.state === "ready" ? `A personalised path towards ${view.goal.label}, built from your skills, evidence and chosen goal.` : "A personalised path built from your skills, evidence and chosen goal."}
          </p>
        </div>
      </div>
      {view.state === "ready" && (
        <Link href="/learning#roadmap" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 dark:border-violet-400/30 dark:bg-violet-500/10 dark:text-violet-300">
          View full plan
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      )}
    </div>
  );

  if (view.state !== "ready") {
    const content =
      view.state === "pending"
        ? { title: "Your roadmap is being calculated", body: "It's built from your evidence and career goal the next time your profile is processed." }
        : view.state === "unsupported"
          ? { title: "No roadmap for your goal yet", body: `We don't have a competency framework for ${view.goals.join(", ")}, so we can't say what it needs without guessing.` }
          : { title: "No career goal to plan towards", body: "A roadmap needs a career goal you've chosen; we don't assume one for you. Goals are chosen during onboarding, and changing them afterwards isn't available yet." };
    return (
      <section id="career-roadmap" className="scroll-mt-20 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-6" data-testid="career-roadmap">
        {header}
        <div className="mt-6 flex flex-col items-center py-6 text-center">
          <p className="text-sm font-semibold text-foreground">{content.title}</p>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">{content.body}</p>
        </div>
      </section>
    );
  }

  const selectedStage = view.stages.find((s) => s.key === (stageKey ?? view.nextStage?.key ?? view.stages[0]?.key)) ?? null;
  const selectedStep = view.steps.find((s) => s.id === (stepId ?? view.nextAction?.step.id)) ?? null;
  const rowOf = (skill: string) => view.skills.flatMap((b) => b.rows).find((r) => r.skill === skill);
  const recOf = (skill: string) => intelligence?.recommendations.find((r) => r.skill === skill);
  const openStep = (step: RoadmapStep) => {
    setStageKey(step.stageKey);
    setStepId(step.id);
    requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const asOf = new Date(view.computedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <section id="career-roadmap" className="scroll-mt-20 rounded-2xl border border-border bg-gradient-to-b from-violet-50/40 to-card p-4 text-card-foreground shadow-2xs dark:from-violet-500/5 sm:p-6" data-testid="career-roadmap">
      {header}

      {/* Goal · coverage · next milestone */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <Briefcase aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Your goal</p>
            <p className="truncate text-base font-bold text-foreground" data-testid="roadmap-goal">{view.goal.label}</p>
            {view.goal.blurb && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{view.goal.blurb}.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
            Evidence coverage
            <span title="Skills your evidence shows at the level this goal expects. The percentage weights each skill by its importance to the goal." className="text-muted-foreground">
              <Info aria-hidden className="size-3.5" />
              <span className="sr-only">About evidence coverage: skills your evidence shows at the expected level, weighted by importance.</span>
            </span>
          </p>
          {view.coverage.percent === null ? (
            <p className="mt-2 text-xs text-muted-foreground" data-testid="roadmap-coverage-unavailable">
              Not measured yet: there isn&apos;t enough evidence to assess this goal.{" "}
              <Link href="/connections" className="font-semibold text-primary hover:underline">
                Add evidence
              </Link>
            </p>
          ) : (
            <>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <p className="text-base font-bold text-foreground">
                  {view.coverage.met} of {view.coverage.total} skills
                </p>
                <p className="text-base font-bold tabular-nums text-foreground">{view.coverage.percent}%</p>
              </div>
              <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${view.coverage.percent}% evidence coverage for ${view.goal.label}`}>
                <div data-testid="roadmap-progress-bar" className="h-full origin-left rounded-full bg-gradient-to-r from-violet-500 to-pink-500 motion-safe:animate-[skillBarGrow_1100ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none" style={{ width: `${view.coverage.percent}%` }} />
              </div>
            </>
          )}
        </div>

        <NextMilestoneCard stage={view.nextStage} onOpen={() => view.nextStage && setStageKey(view.nextStage.key)} />
      </div>

      {view.coverage.total > 0 && !view.coverage.assessed && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            There isn&apos;t enough evidence yet to measure where you stand, so the milestones below are what {view.goal.label} requires, not measured gaps.{" "}
            <Link href="/connections" className="font-semibold underline">
              Connect GitHub or confirm your resume
            </Link>
            .
          </span>
        </p>
      )}

      {/* The journey: where you are → the engine's stages → your goal */}
      <Journey view={view} selectedKey={selectedStage?.key ?? null} onSelect={setStageKey} />

      {/* The selected stage's milestones and the chosen milestone's details */}
      {selectedStage && (
        <div className="mt-4 rounded-2xl border border-border bg-card p-3 sm:p-4" data-testid="roadmap-stage-detail">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: HORIZONS[Math.min(view.stages.indexOf(selectedStage), 2)].hex }}>
              {selectedStage.horizon}
            </p>
            <p className="text-sm font-semibold text-foreground">{selectedStage.title}</p>
            {selectedStage.estimateWeeks !== null && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={view.assumption}>
                <Hourglass aria-hidden className="size-3" />
                {weeks(selectedStage.estimateWeeks)} (estimate)
              </span>
            )}
          </div>
          <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {selectedStage.steps.map((step) => {
              const st = STATUS_STYLE[step.status];
              const Icon = st.icon;
              const active = selectedStep?.id === step.id;
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    aria-controls="roadmap-milestone-detail"
                    data-status={step.status}
                    onClick={() => openStep(step)}
                    className={`flex w-full items-center gap-2 rounded-lg border-l-[3px] px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-muted" : "bg-muted/30 hover:bg-muted/60"}`}
                    style={{ borderLeftColor: st.hex }}
                  >
                    <Icon aria-hidden className="size-3.5 shrink-0" style={{ color: st.hex }} />
                    <span className={`min-w-0 flex-1 truncate text-xs font-medium ${step.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"}`}>{step.skill}</span>
                    <span className="sr-only">{st.label}</span>
                    {step.status !== "upcoming" && step.status !== "completed" && <span className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold ring-1 ${st.className}`}>{st.label}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {selectedStep && selectedStep.stageKey === selectedStage.key && (
            <div ref={detailRef}>
              <MilestoneDetail key={selectedStep.id} step={selectedStep} goal={view.goal.label} row={rowOf(selectedStep.skill)} rec={recOf(selectedStep.skill)} assumption={view.assumption} onPick={(skill) => { const s = view.steps.find((x) => x.skill === skill); if (s) openStep(s); }} />
            </div>
          )}
        </div>
      )}

      {/* Goal skill progress · next action */}
      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <SkillProgress buckets={view.skills} goal={view.goal.label} />
        <NextAction action={view.nextAction} onOpen={openStep} />
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Based on your evidence as of {asOf}. {view.assumption}
      </p>
    </section>
  );
}

function NextMilestoneCard({ stage, onOpen }: { stage: RoadmapStageView | null; onOpen: () => void }) {
  if (!stage) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-400/30 dark:bg-emerald-500/10">
        <p className="text-xs text-muted-foreground">Next milestone</p>
        <p className="mt-1 text-sm font-semibold text-foreground">Nothing open right now</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Every milestone is complete or waiting on evidence you&apos;ve submitted.</p>
      </div>
    );
  }
  const open = stage.steps.filter((s) => s.status !== "completed");
  return (
    <button type="button" onClick={onOpen} data-testid="roadmap-next-milestone" className="group flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-left shadow-2xs transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-emerald-400/30 dark:bg-emerald-500/10">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-emerald-600 dark:text-emerald-300">
        <Target aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">Next milestone · {stage.horizon}</span>
        <span className="block truncate text-base font-bold text-foreground">{stage.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
          {open.length} {open.length === 1 ? "skill" : "skills"} to bring to the expected level: {open.map((s) => s.skill).join(", ")}
        </span>
      </span>
      <ChevronRight aria-hidden className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function Journey({ view, selectedKey, onSelect }: { view: Extract<ReturnType<typeof roadmapView>, { state: "ready" }>; selectedKey: string | null; onSelect: (key: string) => void }) {
  const cols = view.stages.length + 2;
  return (
    <div className="relative mt-6" data-testid="roadmap-journey">
      {/* The path: horizontal on wide screens, vertical on phones. */}
      <span aria-hidden className="absolute left-[21px] top-6 bottom-6 w-[3px] rounded-full bg-gradient-to-b from-emerald-400 via-blue-500 to-purple-500 md:hidden" />
      <span aria-hidden className="absolute top-[21px] hidden h-[3px] rounded-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-500 md:block" style={{ left: `${50 / cols}%`, right: `${50 / cols}%` }} />
      <ol className="relative flex flex-col gap-5 md:grid md:gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} aria-label={`Your path to ${view.goal.label}`}>
        <JourneyNode
          testId="journey-current"
          dot={<span className="flex size-[45px] items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-emerald-100 dark:ring-emerald-500/20"><Check aria-hidden className="size-5" strokeWidth={3} /></span>}
          title="Where you are"
          body={view.position ?? "Not on your profile"}
          extra={!view.position ? <Link href="/profile" className="text-[11px] font-semibold text-primary hover:underline">Add your current role</Link> : null}
        />
        {view.stages.map((stage, i) => {
          const colour = HORIZONS[Math.min(i, 2)].hex;
          const selected = stage.key === selectedKey;
          const dot =
            stage.status === "completed" ? (
              <span className="flex size-[45px] items-center justify-center rounded-full bg-emerald-500 text-white"><Check aria-hidden className="size-5" strokeWidth={3} /></span>
            ) : stage.status === "blocked" ? (
              <span className="flex size-[45px] items-center justify-center rounded-full border-[3px] border-rose-300 bg-card text-rose-500"><Lock aria-hidden className="size-4" /></span>
            ) : (
              <span className="flex size-[45px] items-center justify-center rounded-full bg-card" style={{ border: `${stage.status === "active" ? 5 : 3}px solid ${colour}`, boxShadow: stage.status === "active" ? `0 0 0 6px ${colour}22` : undefined }}>
                {stage.status === "active" && <span className="size-3 rounded-full" style={{ background: colour }} />}
              </span>
            );
          return (
            <JourneyNode
              key={stage.key}
              testId={`journey-stage-${stage.key}`}
              status={stage.status}
              dot={dot}
              selected={selected}
              onClick={() => onSelect(stage.key)}
              title={stage.horizon}
              body={stage.title}
              extra={
                <>
                  <span className="text-[11px] text-muted-foreground">
                    {stage.steps.filter((s) => s.status === "completed").length} of {stage.steps.length} done
                    {stage.status === "active" ? " · in progress" : ""}
                  </span>
                  {stage.status === "blocked" && <span className="text-[11px] font-medium text-rose-600 dark:text-rose-300">Waiting on {stage.blockedBy.join(" and ")}</span>}
                  {stage.estimateWeeks !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" title={view.assumption}>
                      <CalendarDays aria-hidden className="size-3" />
                      {weeks(stage.estimateWeeks)} (estimate)
                    </span>
                  )}
                </>
              }
            />
          );
        })}
        <JourneyNode
          testId="journey-goal"
          dot={<span className="flex size-[45px] items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-purple-600 text-white ring-4 ring-violet-100 dark:ring-violet-500/20"><Flag aria-hidden className="size-5" /></span>}
          title="Your goal"
          body={view.goal.label}
          extra={<span className="text-[11px] text-muted-foreground">{view.coverage.percent === null ? "Coverage not measured yet" : `${view.coverage.percent}% evidence coverage`}</span>}
        />
      </ol>
    </div>
  );
}

function JourneyNode({ dot, title, body, extra, onClick, selected, status, testId }: { dot: React.ReactNode; title: string; body: string; extra?: React.ReactNode; onClick?: () => void; selected?: boolean; status?: string; testId: string }) {
  const inner = (
    <>
      <span className="relative z-10 shrink-0 rounded-full bg-card">{dot}</span>
      <span className="flex min-w-0 flex-col gap-0.5 md:items-center md:text-center">
        <span className={`text-sm font-bold text-foreground ${selected ? "rounded-md bg-violet-100 px-2 dark:bg-violet-500/20" : ""}`}>{title}</span>
        <span className="text-xs text-muted-foreground">{body}</span>
        {extra}
      </span>
    </>
  );
  const cls = "flex items-start gap-3 md:flex-col md:items-center md:gap-2";
  return (
    <li data-testid={testId} data-status={status}>
      {onClick ? (
        <button type="button" onClick={onClick} aria-pressed={selected} aria-controls="roadmap-stage-detail" className={`${cls} w-full rounded-xl p-1 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-center`}>
          {inner}
        </button>
      ) : (
        <div className={`${cls} p-1`}>{inner}</div>
      )}
    </li>
  );
}

function SkillProgress({ buckets, goal }: { buckets: SkillBucket[]; goal: string }) {
  const [open, setOpen] = useState<SkillBucket["key"] | null>(null);
  const total = buckets.reduce((s, b) => s + b.rows.length, 0);
  const demonstrated = buckets.find((b) => b.key === "demonstrated")!.rows.length;
  // Donut arcs from the engine's own classification counts.
  const R = 44, C = 2 * Math.PI * R;
  const lens = buckets.map((b) => (total ? (b.rows.length / total) * C : 0));
  const arcs = buckets.map((b, i) => ({ key: b.key, len: lens[i], offset: lens.slice(0, i).reduce((s, l) => s + l, 0) }));
  const shown = buckets.find((b) => b.key === open);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs" data-testid="roadmap-skill-progress">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ListChecks aria-hidden className="size-4 text-violet-600 dark:text-violet-300" />
        Goal skill progress
      </p>
      {total === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">The engine hasn&apos;t assessed {goal}&apos;s skills against your evidence yet.</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
          <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`${demonstrated} of ${total} skills demonstrated`} className="shrink-0">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#f1f5f9" strokeWidth="14" />
            {arcs.map((a) =>
              a.len > 0 ? <circle key={a.key} cx="60" cy="60" r={R} fill="none" stroke={BUCKET_COLOUR[a.key]} strokeWidth="14" strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.offset} transform="rotate(-90 60 60)" /> : null,
            )}
            <text x="60" y="58" textAnchor="middle" className="fill-foreground" fontSize="17" fontWeight="700">{demonstrated} / {total}</text>
            <text x="60" y="75" textAnchor="middle" className="fill-muted-foreground" fontSize="10">skills</text>
          </svg>
          <ul className="w-full divide-y divide-border rounded-xl border border-border">
            {buckets.map((b) => (
              <li key={b.key}>
                <button type="button" aria-expanded={open === b.key} onClick={() => setOpen(open === b.key ? null : b.key)} data-bucket={b.key} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full ring-1 ring-black/5" style={{ background: BUCKET_COLOUR[b.key] }} />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground">{b.label}</span> <span className="text-muted-foreground">({b.note})</span>
                  </span>
                  <span className="font-bold tabular-nums text-foreground">{b.rows.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {shown && (
        <div className="mt-3 rounded-xl bg-muted/40 p-3" data-testid="roadmap-skill-bucket">
          {shown.rows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-1.5 text-[11px]">
              {shown.rows.map((r) => (
                <li key={r.skill}>
                  <span className="font-semibold text-foreground">{r.skill}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.proficiency === null ? "not assessed" : r.level}, needs {r.expectedLevel}
                    {r.evidence.length ? ` · ${r.evidence.slice(0, 2).join("; ")}` : " · no evidence yet"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/skills" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
            All skills and their evidence
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        </div>
      )}
    </div>
  );
}

function NextAction({ action, onOpen }: { action: Extract<ReturnType<typeof roadmapView>, { state: "ready" }>["nextAction"]; onOpen: (step: RoadmapStep) => void }) {
  if (!action) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Zap aria-hidden className="size-4 text-violet-600" />
          Next action
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Nothing to do right now: every skill is at its expected level or waiting on evidence you&apos;ve submitted.</p>
      </div>
    );
  }
  const { step, reason, row, rec, horizon } = action;
  const evidence = row?.evidence[0] ?? (step.blockedBy.length ? `Needs ${step.blockedBy.join(" and ")} first` : "No evidence yet");
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs" data-testid="roadmap-next-action">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Zap aria-hidden className="size-4 text-violet-600 dark:text-violet-300" />
        Next action
      </p>
      <div className="mt-3 flex flex-col gap-3 rounded-xl bg-violet-50/70 p-3 sm:flex-row sm:items-center dark:bg-violet-500/10">
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-card text-violet-600 sm:flex dark:text-violet-300">
          <Sparkles aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{step.deliverable}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{reason}</p>
        </div>
        {rec?.resource ? (
          <a href={rec.resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 sm:self-center">
            Start the course
            <ExternalLink aria-hidden className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <button type="button" onClick={() => onOpen(step)} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 sm:self-center">
            Open milestone
            <ArrowRight aria-hidden className="size-3.5" />
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5">
          <BookOpen aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0"><span className="text-muted-foreground">Skill:</span> <span className="font-semibold text-foreground">{step.skill}</span></span>
        </span>
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5" title={evidence}>
          <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0"><span className="text-muted-foreground">Evidence:</span> <span className="font-semibold text-foreground">{evidence}</span></span>
        </span>
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5">
          <TrendingUp aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0"><span className="text-muted-foreground">Moves you toward:</span> <span className="font-semibold text-foreground">{horizon}</span></span>
        </span>
      </div>
    </div>
  );
}

function MilestoneDetail({ step, goal, row, rec, assumption, onPick }: { step: RoadmapStep; goal: string; row?: RoleSkillRow; rec?: LearningRecommendation; assumption: string; onPick: (skill: string) => void }) {
  const st = STATUS_STYLE[step.status];
  const [formOpen, setFormOpen] = useState(false);
  const [sent, setSent] = useState(false);
  return (
    <div id="roadmap-milestone-detail" aria-live="polite" className="mt-3 rounded-xl border border-border bg-gradient-to-br from-muted/60 to-transparent p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-bold text-foreground">{step.skill}</h3>
        <span className={`rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ${st.className}`}>{st.label}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground" title={assumption}>
          <Hourglass aria-hidden className="size-3" />
          About {step.estimateWeeks} weeks (estimate)
        </span>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2 text-[11px]">
          <div>
            <p className="font-semibold text-foreground">Why this is on your roadmap</p>
            <p className="mt-0.5 text-muted-foreground">{milestoneReason(goal, row, step)}</p>
          </div>
          {row && row.evidence.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">What your evidence shows so far</p>
              <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
                {row.evidence.slice(0, 3).map((e, i) => (
                  <li key={i} className="truncate" title={e}>
                    • {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {step.requires.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">Builds on</p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {step.requires.map((r) => {
                  const blocked = step.blockedBy.includes(r);
                  return (
                    <li key={r}>
                      <button
                        type="button"
                        onClick={() => onPick(r)}
                        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${blocked ? STATUS_STYLE.blocked.className : STATUS_STYLE.completed.className}`}
                      >
                        {blocked ? <Lock aria-hidden className="size-2.5" /> : <CheckCircle2 aria-hidden className="size-2.5" />}
                        {r}
                        <span className="sr-only">{blocked ? " (not at level yet)" : " (at level)"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {step.blockedBy.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">Start with {step.blockedBy.join(" and ")} first.</p>}
            </div>
          )}
        </div>

        <div className="space-y-2 text-[11px]">
          <div>
            <p className="font-semibold text-foreground">Next step</p>
            <p className="mt-0.5 text-muted-foreground">{step.status === "completed" ? "Nothing to do: keep the evidence public and current." : (row?.action ?? step.deliverable)}</p>
            {step.status !== "completed" && <p className="mt-0.5 text-[10px] text-muted-foreground">Done when: {step.criterion}.</p>}
          </div>
          {step.status !== "completed" &&
            (rec?.resource ? (
              <a href={rec.resource.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 rounded-lg bg-blue-50/80 p-2 transition-colors hover:bg-blue-100/80 dark:bg-blue-500/10 dark:hover:bg-blue-500/15">
                <BookOpen aria-hidden className="mt-px size-3.5 shrink-0 text-blue-600 dark:text-blue-300" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <span className="truncate">{rec.resource.title}</span>
                    <ExternalLink aria-hidden className="size-2.5 shrink-0" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </span>
                  {(rec.resource.provider || rec.resource.duration) && <span className="block text-[10px] text-muted-foreground">{[rec.resource.provider, rec.resource.duration].filter(Boolean).join(" · ")}</span>}
                </span>
              </a>
            ) : rec ? (
              <p className="text-[10px] text-muted-foreground">No catalogued course for this skill: learn by building the project above.</p>
            ) : null)}
          {step.status !== "completed" &&
            (sent || step.status === "submitted" ? (
              <p className="text-[10px] text-muted-foreground">Evidence submitted. It counts once the next evaluation shows {step.skill} at level; a submission alone doesn&apos;t complete a milestone.</p>
            ) : formOpen ? (
              <EvidenceForm step={step} onDone={() => (setSent(true), setFormOpen(false))} />
            ) : (
              <button type="button" onClick={() => setFormOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                <Send aria-hidden className="size-3" />
                Submit evidence of your work
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

function EvidenceForm({ step, onDone }: { step: RoadmapStep; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-wrap gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitRoadmapEvidence({ milestoneId: step.id, evidenceUrl: url });
          if (res.ok) {
            setUrl("");
            onDone();
          } else setMessage(res.error);
        });
      }}
    >
      <label className="sr-only" htmlFor={`evidence-${step.id}`}>
        Link to your work for {step.skill}
      </label>
      <input
        id={`evidence-${step.id}`}
        type="url"
        required
        inputMode="url"
        placeholder="https://github.com/you/project"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setMessage(null);
        }}
        className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button type="submit" disabled={pending} className="shrink-0 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
        {pending ? "Sending…" : "Submit"}
      </button>
      {message && (
        <p role="alert" className="basis-full text-[10px] text-destructive">
          {message}
        </p>
      )}
    </form>
  );
}
