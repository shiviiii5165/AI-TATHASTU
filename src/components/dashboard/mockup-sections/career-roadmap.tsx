"use client";

import { ArrowRight, BarChart3, BookOpen, Briefcase, Check, CheckCircle2, ChevronRight, CircleDashed, ExternalLink, FileText, Flag, Info, ListChecks, ListOrdered, Lock, Send, Sparkles, Target, TrendingUp, TriangleAlert, Zap } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";

import { submitRoadmapEvidence } from "@/app/(dashboard)/dashboard/roadmap-actions";
import type { IntelligenceDoc, LearningRecommendation, RoleSkillRow } from "@/lib/dashboard/types";
import { currentLevelText, expectsText, prerequisiteText, stateText, TONE_CLASS } from "@/lib/dashboard/plain-language";
import { milestoneReason } from "@/lib/roadmap/explain";
import { nextStepsFromRoadmap } from "@/lib/roadmap/next-steps";
import type { MilestoneStatus, MilestoneSubmission, RoadmapStep } from "@/lib/roadmap/progress";
import { roadmapView, type RoadmapStageView, type SkillBucket } from "@/lib/roadmap/view";

/**
 * Career Roadmap (approved curved-roadmap mockup). The engine decides; this explains:
 *  - goal, evidence coverage and the next milestone;
 *  - a curved journey from where you are, through the engine's stages, to your goal, with a runner that stands
 *    only where the engine says you've got to;
 *  - the selected stage: the next skill to focus on, why it matters, the stage's other skills, details on demand;
 *  - how the goal's skills stand; one next action; the next few steps after it.
 * Every value comes from lib/roadmap/view.ts and lib/roadmap/next-steps.ts, which read only the engine's
 * intelligence document. When the engine has nothing to say, this says so.
 */
type ReadyView = Extract<ReturnType<typeof roadmapView>, { state: "ready" }>;

export const STATUS_STYLE: Record<MilestoneStatus, { label: string; icon: typeof CheckCircle2; className: string; hex: string }> = {
  completed: { label: "Done", icon: CheckCircle2, hex: "#10b981", className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30" },
  active: { label: "Work on now", icon: Sparkles, hex: "#3b82f6", className: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30" },
  submitted: { label: "Waiting for next check", icon: Send, hex: "#0ea5e9", className: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30" },
  needs_more_evidence: { label: "Needs a clearer work example", icon: TriangleAlert, hex: "#f97316", className: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/30" },
  blocked: { label: "Needs an earlier skill", icon: Lock, hex: "#94a3b8", className: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-400/30" },
  upcoming: { label: "Later", icon: CircleDashed, hex: "#94a3b8", className: "bg-muted text-muted-foreground ring-border" },
};

const STAGE_STATUS_LABEL: Record<RoadmapStageView["status"], string> = { completed: "Complete", active: "Current stage", upcoming: "Later", blocked: "Waiting on an earlier stage" };
const BUCKET_COLOUR: Record<SkillBucket["key"], string> = { demonstrated: "#10b981", inProgress: "#3b82f6", notYet: "#e2e8f0" };
/** "PyTorch: a public project using PyTorch…" → "A public project using PyTorch…" (the engine's deliverable, as written). */
const deliverableOf = (title: string) => { const d = title.slice(title.indexOf(": ") + 2); return d.charAt(0).toUpperCase() + d.slice(1); };
/** What each engine stage is (career_engine.build_roadmap): foundation, build and the optional deepen stage. */
const STAGE_PURPOSE: Record<string, string> = {
  foundation: "These required skills don't depend on any other skill you still need for this role, so they're the place to start.",
  build: "Each of these required skills builds on another skill earlier in your roadmap, so it comes after it.",
  deepen: "Supporting skills: useful for the role but not required. They never hold back the required stages.",
};

/** The real prerequisite, never a bare "unlock" (plain-language.prerequisiteText, without its final full stop). */
const unlockText = (skills: string[]) => prerequisiteText(skills).replace(/\.$/, "");

export function CareerRoadmap({ intelligence, submissions }: { intelligence?: IntelligenceDoc; submissions?: MilestoneSubmission[] }) {
  const view = useMemo(() => roadmapView(intelligence, submissions), [intelligence, submissions]);
  const nextSteps = useMemo(() => nextStepsFromRoadmap(intelligence, submissions, 3, { excludeNext: true }), [intelligence, submissions]);
  const [stageKey, setStageKey] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <Target aria-hidden className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-sans text-lg font-bold leading-tight text-foreground">Career Roadmap</h2>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {view.state === "ready" ? (
              <>
                Your personalised path toward <span className="font-semibold text-foreground">{view.goal.label}</span>, based on your skills, evidence and chosen goal.
              </>
            ) : (
              "Your personalised path, based on your skills, evidence and chosen goal."
            )}
          </p>
        </div>
      </div>
      {view.state === "ready" && (
        <Link href="/learning#roadmap" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-indigo-200 bg-card px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 dark:border-indigo-400/30 dark:text-indigo-300">
          View full plan
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      )}
    </div>
  );

  if (view.state !== "ready") {
    const content =
      view.state === "pending"
        ? { title: "Your roadmap is being prepared", body: "It's built from your evidence and career goal once your profile has been processed." }
        : view.state === "unsupported"
          ? { title: "No roadmap for your goal yet", body: `We don't yet know which skills ${view.goals.join(", ")} needs, so we can't plan a route without guessing.` }
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

  const stage = view.stages.find((s) => s.key === (stageKey ?? view.nextStage?.key ?? view.stages[0]?.key)) ?? null;
  const rowOf = (skill: string) => view.skills.flatMap((b) => b.rows).find((r) => r.skill === skill);
  const recOf = (skill: string) => intelligence?.recommendations.find((r) => r.skill === skill);
  const openStep = (id: string) => {
    const step = view.steps.find((s) => s.id === id);
    if (!step) return;
    setStageKey(step.stageKey);
    setDetailId(step.id);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const asOf = new Date(view.computedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  // The role framework's own description of the job (career_engine analyze_role → framework.responsibilities).
  const responsibilities = intelligence?.roles.find((r) => r.role === view.goal.id)?.framework?.responsibilities ?? [];

  return (
    <section id="career-roadmap" className="scroll-mt-20 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-6" data-testid="career-roadmap">
      {header}

      {/* Goal · coverage · next milestone */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <Briefcase aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Career you&apos;re working towards</p>
            <p className="truncate text-base font-bold text-foreground" data-testid="roadmap-goal">{view.goal.label}</p>
            {view.goal.blurb && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{view.goal.blurb}.</p>}
            {responsibilities.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-muted-foreground" aria-label={`What a ${view.goal.label} does`} data-testid="roadmap-goal-duties">
                {responsibilities.slice(0, 2).map((r) => (
                  <li key={r} className="line-clamp-2">• {r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
            <BarChart3 aria-hidden className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
              Current assessment
              <span title="Based on this goal's required skills: which ones your work shows at the expected level, starting with the foundations. Not a probability of getting hired." className="text-muted-foreground">
                <Info aria-hidden className="size-3.5" />
                <span className="sr-only">How it&apos;s worked out: from this goal&apos;s required skills and the proof your work gives for each. Not a probability of getting hired.</span>
              </span>
            </p>
            {!view.coverage.assessed || !view.alignment || view.alignment.state === "not_enough_evidence" ? (
              <p className="mt-1.5 text-xs text-muted-foreground" data-testid="roadmap-coverage-unavailable">
                <span className="font-semibold text-foreground">Not assessed yet.</span> We need more examples of your work before we can assess your progress.{" "}
                <Link href="/connections" className="font-semibold text-primary hover:underline">Add evidence</Link>
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm font-bold text-foreground" data-testid="roadmap-alignment" data-state={view.alignment.state}>{view.alignment.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{view.alignment.explanation}</p>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Your work shows {view.alignment.requiredMet} of {view.alignment.required} required skills at the expected level.
                </p>
              </>
            )}
          </div>
        </div>

        <NextMilestoneCard view={view} onOpen={() => view.nextStage && setStageKey(view.nextStage.key)} />
      </div>

      {view.requirementsMet && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200" data-testid="roadmap-requirements-met">
          <CheckCircle2 aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>Your available evidence now covers the required skills for {view.goal.label}. Anything left below is optional. This isn&apos;t a certification or a job guarantee.</span>
        </p>
      )}

      {view.coverage.total > 0 && !view.coverage.assessed && (
        <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Info aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            We can&apos;t see where you stand yet, so these steps show what {view.goal.label} needs rather than your personal gaps.{" "}
            <Link href="/connections" className="font-semibold underline">Connect GitHub or confirm your resume</Link>.
          </span>
        </p>
      )}

      <CurvedJourney view={view} selectedKey={stage?.key ?? null} onSelect={setStageKey} />

      <Achievements view={view} />

      {/* Selected stage · goal skill progress */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div ref={panelRef} className="min-w-0 lg:col-span-7">
          {stage && <StagePanel key={stage.key} view={view} stage={stage} detailId={detailId} onDetail={setDetailId} onOpenStep={openStep} rowOf={rowOf} recOf={recOf} />}
        </div>
        <div className="min-w-0 lg:col-span-5">
          <SkillProgress buckets={view.skills} goal={view.goal.label} />
        </div>
      </div>

      {/* One next action · the steps after it */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <NextAction action={view.nextAction} onOpen={openStep} />
        </div>
        <div className="min-w-0 lg:col-span-5">
          <NextStepsList steps={nextSteps} onOpen={openStep} />
        </div>
      </div>

      <p className="mt-4 text-[11px] text-muted-foreground" data-testid="roadmap-basis">
        Based on your evidence as of {asOf}. {view.assumption}
        {view.frameworkDraft && ` The skills for ${view.goal.label} are a draft written by our team, not an official industry standard.`}
      </p>
    </section>
  );
}

function NextMilestoneCard({ view, onOpen }: { view: ReadyView; onOpen: () => void }) {
  const stage = view.nextStage;
  if (!stage) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-400/30 dark:bg-emerald-500/10">
        <p className="text-xs text-muted-foreground">Next milestone</p>
        <p className="mt-1 text-sm font-semibold text-foreground">Nothing to start right now</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Everything open is either done or waiting for your submitted work to be checked.</p>
      </div>
    );
  }
  const open = stage.steps.filter((s) => s.status !== "completed");
  const focus = view.nextAction?.step.stageKey === stage.key ? view.nextAction.step.skill : null;
  return (
    <button type="button" onClick={onOpen} data-testid="roadmap-next-milestone" className="group flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-left shadow-2xs transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-emerald-400/30 dark:bg-emerald-500/10">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-emerald-600 dark:text-emerald-300">
        <Target aria-hidden className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">Next milestone · {stage.horizon}</span>
        <span className="block truncate text-base font-bold text-foreground">{stage.title}</span>
        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
          {focus ? `Start with ${focus}` : `Work on ${open[0]?.skill ?? "this stage"}`}
          {open.length > 1 ? `, then ${open.length - 1} more ${open.length - 1 === 1 ? "skill" : "skills"} in this stage.` : "."}
        </span>
      </span>
      <ChevronRight aria-hidden className="mt-2 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

// ─── Achievements ───────────────────────────────────────────────────────────

/**
 * Milestones already reached: each is a competency the engine found at its expected level, with the evidence that showed
 * it. No points, streaks or badges: the only way onto this strip is work we can check.
 */
function Achievements({ view }: { view: ReadyView }) {
  if (view.achievements.length === 0) return null;
  return (
    <div className="mt-4 rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-3 dark:border-emerald-400/20 dark:bg-emerald-500/5" data-testid="roadmap-achievements">
      <p className="flex flex-wrap items-baseline gap-x-2 text-xs font-semibold text-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 aria-hidden className="size-4 text-emerald-600 dark:text-emerald-300" />
          Already shown in your work
        </span>
        <span className="text-[11px] font-normal text-muted-foreground">Each one is a skill this goal needs, at the level it expects, in work we could check.</span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {view.achievements.map((a, i) => (
          <li
            key={a.id}
            title={a.evidence ? `Shown by: ${a.evidence}` : undefined}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-card px-2.5 py-1 text-[11px] font-medium text-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-300 dark:border-emerald-400/30"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <Check aria-hidden className="size-3 text-emerald-600 dark:text-emerald-300" strokeWidth={3} />
            {a.title}
            {a.tier === "required" && <span className="text-[10px] text-muted-foreground">required</span>}
            {a.forProject && <span className="text-[10px] text-sky-700 dark:text-sky-300">project</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Curved journey ─────────────────────────────────────────────────────────

type JNode = { kind: "start" | "stage" | "goal"; key: string; title: string; body: string; stage?: RoadmapStageView };

function journeyNodes(view: ReadyView): JNode[] {
  return [
    { kind: "start", key: "start", title: "Where you are", body: view.position ?? "Not on your profile yet" },
    ...view.stages.map((s): JNode => ({ kind: "stage", key: s.key, title: s.horizon, body: s.title, stage: s })),
    { kind: "goal", key: "goal", title: "Your goal", body: view.goal.label },
  ];
}

/** Segment i joins node i to node i+1: done before the runner, the active stretch right after it, the rest still ahead. */
function segmentState(i: number, view: ReadyView, nodes: JNode[]): "done" | "active" | "ahead" {
  if (i < view.reachedIndex) return "done";
  if (i === view.reachedIndex && nodes[i + 1]?.stage?.status === "active") return "active";
  return "ahead";
}

const VB_W = 1000;
const VB_H = 150;

function CurvedJourney({ view, selectedKey, onSelect }: { view: ReadyView; selectedKey: string | null; onSelect: (key: string) => void }) {
  const nodes = journeyNodes(view);
  const n = nodes.length;
  // A gentle rise from where you are to your goal, with a soft wave so the path reads as a journey.
  const pts = nodes.map((_, i) => ({ x: ((i + 0.5) / n) * VB_W, y: 98 - (n > 1 ? (58 * i) / (n - 1) : 0) + (i % 2 === 1 ? 16 : 0) }));
  const seg = (i: number) => {
    const a = pts[i], b = pts[i + 1], dx = (b.x - a.x) / 2;
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };
  const reached = nodes[view.reachedIndex];
  const runnerLabel = `You are here: ${reached.kind === "start" ? "where you are now" : reached.kind === "goal" ? "your goal" : `${reached.title}, ${reached.body}`}`;

  return (
    <div className="mt-6">
      {/* Wide screens: one curved path, left to right. */}
      <div className="relative hidden h-[268px] md:block" data-testid="roadmap-journey" aria-label={`Your path to ${view.goal.label}`} role="group">
        <svg aria-hidden className="absolute inset-x-0 top-[24px] h-[150px] w-full overflow-visible" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="roadmap-active" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="45%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          {pts.slice(0, -1).map((_, i) => {
            const st = segmentState(i, view, nodes);
            return (
              <path
                key={i}
                d={seg(i)}
                data-segment={st}
                fill="none"
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                stroke={st === "done" ? "#10b981" : st === "active" ? "url(#roadmap-active)" : "#c7d2fe"}
                strokeWidth={st === "ahead" ? 3 : 4}
                strokeDasharray={st === "ahead" ? "1 8" : undefined}
                strokeOpacity={st === "ahead" ? 0.9 : 1}
              />
            );
          })}
        </svg>
        <ol className="absolute inset-0">
          {nodes.map((node, i) => (
            <JourneyNodeDesktop key={node.key} node={node} index={i} x={(pts[i].x / VB_W) * 100} y={pts[i].y + 24} width={100 / n} view={view} selected={node.key === selectedKey} onSelect={onSelect} />
          ))}
        </ol>
        <Runner style={{ left: `calc(${(pts[view.reachedIndex].x / VB_W) * 100}% - 46px)`, top: pts[view.reachedIndex].y + 24 - 66 }} label={runnerLabel} index={view.reachedIndex} testId="journey-runner" />
      </div>

      {/* Phones: the same path, top to bottom. */}
      <ol className="relative md:hidden" data-testid="roadmap-journey-mobile" aria-label={`Your path to ${view.goal.label}`}>
        {nodes.map((node, i) => {
          const st = i < n - 1 ? segmentState(i, view, nodes) : null;
          return (
            <li key={node.key} className="relative flex gap-3 pb-6 last:pb-0" data-journey-node={node.key} data-status={node.stage?.status}>
              {st && (
                <span
                  aria-hidden
                  data-segment={st}
                  className="absolute left-[21px] top-11 bottom-0 w-[3px] -translate-x-1/2 rounded-full"
                  style={st === "done" ? { background: "#10b981" } : st === "active" ? { background: "linear-gradient(#10b981, #3b82f6, #8b5cf6)" } : { backgroundImage: "linear-gradient(#c7d2fe 50%, transparent 50%)", backgroundSize: "3px 9px" }}
                />
              )}
              <NodeDot node={node} />
              <div className="min-w-0 flex-1 pt-1">
                {node.stage ? (
                  <button type="button" onClick={() => onSelect(node.key)} aria-pressed={node.key === selectedKey} aria-label={`${node.title}: ${node.body}, ${STAGE_STATUS_LABEL[node.stage.status]}. Show details`} className="w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <NodeText node={node} view={view} selected={node.key === selectedKey} />
                  </button>
                ) : (
                  <NodeText node={node} view={view} selected={false} />
                )}
              </div>
              {i === view.reachedIndex && <Runner small label={runnerLabel} index={i} testId="journey-runner-mobile" />}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function NodeDot({ node }: { node: JNode }) {
  if (node.kind === "start") return <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white ring-4 ring-emerald-100 dark:ring-emerald-500/20"><Check aria-hidden className="size-5" strokeWidth={3} /></span>;
  if (node.kind === "goal") return <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white ring-4 ring-violet-100 dark:ring-violet-500/20"><Flag aria-hidden className="size-5" /></span>;
  const s = node.stage!;
  if (s.status === "completed") return <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"><Check aria-hidden className="size-5" strokeWidth={3} /></span>;
  if (s.status === "active") return <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-[5px] border-blue-500 bg-card shadow-[0_0_0_6px_rgba(59,130,246,0.15)]"><span className="size-3 rounded-full bg-blue-500" /></span>;
  if (s.status === "blocked") return <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-slate-300 bg-card text-slate-500 dark:border-slate-500"><Lock aria-hidden className="size-4" /></span>;
  return <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border-[3px] border-indigo-200 bg-card" />;
}

function NodeText({ node, view, selected }: { node: JNode; view: ReadyView; selected: boolean }) {
  const s = node.stage;
  return (
    <span className="flex min-w-0 flex-col gap-1 md:items-center md:text-center">
      <span className={`text-sm font-bold text-foreground ${selected ? "rounded-md bg-indigo-50 px-2 py-0.5 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200" : ""}`}>{node.title}</span>
      <span className="text-xs text-muted-foreground">{node.body}</span>
      {node.kind === "start" && view.coverage.met > 0 && <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">{view.coverage.met} goal {view.coverage.met === 1 ? "skill" : "skills"} already at level</span>}
      {node.kind === "start" && !view.position && <Link href="/profile" className="text-[11px] font-semibold text-primary hover:underline">Add your current role</Link>}
      {s && s.status !== "completed" && (
        <span className="text-[11px] text-muted-foreground">
          {s.steps.filter((x) => x.status !== "completed").length} {s.steps.length === 1 ? "skill" : "skills"}
          {s.projectSkills > 0 ? ` · ${s.projectSkills} for your project` : ""}
        </span>
      )}
      {s?.status === "blocked" && <span className="text-[11px] text-muted-foreground">{unlockText(s.blockedBy)}</span>}
      {s?.optional && <span className="text-[11px] text-muted-foreground">Optional</span>}
      {node.kind === "goal" && (
        <span className="inline-flex w-fit items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
          {view.alignment && view.coverage.assessed ? view.alignment.label : "Not assessed yet"}
        </span>
      )}
    </span>
  );
}

function JourneyNodeDesktop({ node, index, x, y, width, view, selected, onSelect }: { node: JNode; index: number; x: number; y: number; width: number; view: ReadyView; selected: boolean; onSelect: (key: string) => void }) {
  const style = { left: `${x}%`, top: y, width: `${width}%` } as const;
  const body = (
    <>
      <span className="flex justify-center"><NodeDot node={node} /></span>
      <span className="mt-2 block px-2"><NodeText node={node} view={view} selected={selected} /></span>
    </>
  );
  return (
    <li className="absolute -translate-x-1/2 -translate-y-[22px]" style={style} data-testid={`journey-${node.kind === "stage" ? `stage-${node.key}` : node.kind === "start" ? "current" : "goal"}`} data-journey-node={node.key} data-index={index} data-status={node.stage?.status}>
      {node.stage ? (
        <button type="button" onClick={() => onSelect(node.key)} aria-pressed={selected} aria-label={`${node.title}: ${node.body}, ${STAGE_STATUS_LABEL[node.stage.status]}. Show details`} className="block w-full rounded-xl pb-1 transition-colors hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-indigo-500/5">
          {body}
        </button>
      ) : (
        <div>{body}</div>
      )}
    </li>
  );
}

/** The runner stands at the furthest point the engine says you've reached. It never moves on its own. */
function Runner({ style, label, index, small, testId }: { style?: React.CSSProperties; label: string; index: number; small?: boolean; testId: string }) {
  const size = small ? 30 : 46;
  return (
    <span role="img" aria-label={label} title={label} data-testid={testId} data-at={index} className={`${small ? "relative shrink-0 self-start" : "absolute"} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-2 motion-safe:duration-700`} style={style}>
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <path d="M4 25h7M2 31h8M6 19h5" stroke="#c7d2fe" strokeWidth="2" strokeLinecap="round" />
        <circle cx="31" cy="8" r="5" fill="#4338ca" />
        <path d="M29 14 L23 28" stroke="#4f46e5" strokeWidth="5" strokeLinecap="round" />
        <path d="M28 17 L35 22 L40 18" fill="none" stroke="#6366f1" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M27 17 L19 20 L15 16" fill="none" stroke="#818cf8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 28 L31 34 L30 44" fill="none" stroke="#4f46e5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 28 L15 34 L8 32" fill="none" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// ─── Selected stage ─────────────────────────────────────────────────────────

function StagePanel({ view, stage, detailId, onDetail, onOpenStep, rowOf, recOf }: { view: ReadyView; stage: RoadmapStageView; detailId: string | null; onDetail: (id: string | null) => void; onOpenStep: (id: string) => void; rowOf: (skill: string) => RoleSkillRow | undefined; recOf: (skill: string) => LearningRecommendation | undefined }) {
  const open = stage.steps.filter((s) => s.status !== "completed");
  // The engine's next milestone when it's in this stage; otherwise the first one that can be worked on now.
  const focus = stage.steps.find((s) => s.id === view.nextAction?.step.id) ?? open.find((s) => s.status !== "blocked") ?? open[0] ?? null;
  const others = stage.steps.filter((s) => s.id !== focus?.id);
  const detail = stage.steps.find((s) => s.id === detailId) ?? null;
  const statusTone = stage.status === "active" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : stage.status === "completed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300";

  return (
    <div className="h-full rounded-2xl border border-border bg-card p-4 shadow-2xs" data-testid="roadmap-stage-detail" id="roadmap-stage-detail">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{stage.horizon}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}>{STAGE_STATUS_LABEL[stage.status]}</span>
          </div>
          <h3 className="mt-1.5 text-base font-bold text-foreground">{stage.title}</h3>
          {stage.focus && <p className="text-[11px] font-medium text-indigo-700 dark:text-indigo-300">{stage.focus}</p>}
          <p className="text-xs text-muted-foreground" data-testid="roadmap-stage-skills">
            Covers {stage.steps.map((s) => s.skill).join(", ")}.{" "}
            {open.length === 0 ? `Your work shows all of them at the level ${view.goal.label} expects.` : `${open.length} of ${stage.steps.length} still need to reach the level ${view.goal.label} expects.`}
          </p>
        </div>
        {stage.optional && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground" title="Supporting skills: useful for the role, but not required to meet it.">Optional</span>}
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-violet-50/50 p-3 text-[11px] sm:grid-cols-2 dark:bg-violet-500/10" data-testid="roadmap-stage-meaning">
        <div>
          <dt className="font-semibold text-foreground">Why this stage is here</dt>
          <dd className="mt-0.5 text-muted-foreground">{stage.purpose ?? STAGE_PURPOSE[stage.key] ?? "The engine grouped these skills by what they build on."}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">When it&apos;s complete</dt>
          <dd className="mt-0.5 text-muted-foreground">
            {stage.completionCriteria ??
              (stage.optional
                ? `When your work shows these skills at the level ${view.goal.label} expects. Optional: it doesn't affect whether you meet the role's requirements.`
                : `When your work shows each skill here at the level ${view.goal.label} expects, in work we can check, such as a public repository or an assessment. The roadmap then moves on to the next stage.`)}
            {stage.unlocksTitle && <span className="mt-1 block font-medium text-foreground">Then: {stage.unlocksTitle}</span>}
          </dd>
        </div>
      </dl>

      {stage.status === "blocked" && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-500/10 dark:text-slate-300">{unlockText(stage.blockedBy)}.</p>}

      <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2 sm:divide-x sm:divide-border">
        <div className="min-w-0 sm:pr-4">
          <p className="text-xs font-semibold text-foreground">Next skill to focus on</p>
          {focus ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
                  <TrendingUp aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-base font-bold text-foreground" data-testid="roadmap-focus-skill">{focus.skill}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${STATUS_STYLE[focus.status].className}`}>{STATUS_STYLE[focus.status].label}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Why it matters: </span>
                {milestoneReason(view.goal.label, rowOf(focus.skill), focus)}
              </p>
              {focus.blockedBy.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{unlockText(focus.blockedBy)}.</p>}
              <button type="button" aria-expanded={detail?.id === focus.id} aria-controls="roadmap-milestone-detail" onClick={() => onDetail(detail?.id === focus.id ? null : focus.id)} className="mt-3 inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300">
                {detail?.id === focus.id ? "Hide skill details" : "View skill details"}
                <ArrowRight aria-hidden className="size-3" />
              </button>
            </>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Nothing left to work on in this stage.</p>
          )}
        </div>
        <div className="min-w-0 sm:pl-4">
          <p className="text-xs font-semibold text-foreground">Other skills in this stage ({others.length})</p>
          {others.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">None.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {others.map((s) => {
                const st = STATUS_STYLE[s.status];
                const Icon = st.icon;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      data-status={s.status}
                      aria-pressed={detail?.id === s.id}
                      aria-controls="roadmap-milestone-detail"
                      onClick={() => onDetail(detail?.id === s.id ? null : s.id)}
                      title={st.label}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${detail?.id === s.id ? "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-400/40 dark:bg-indigo-500/15 dark:text-indigo-200" : "border-border bg-card text-foreground hover:bg-muted/60"} ${s.status === "completed" ? "line-through decoration-emerald-500/60" : ""}`}
                    >
                      <Icon aria-hidden className="size-3" style={{ color: st.hex }} />
                      {s.skill}
                      <span className="sr-only">: {st.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {detail && (
        <MilestoneDetail key={detail.id} step={detail} goal={view.goal.label} row={rowOf(detail.skill)} rec={recOf(detail.skill)} assumption={view.assumption} onPick={(skill) => { const s = view.steps.find((x) => x.skill === skill); if (s) onOpenStep(s.id); }} />
      )}
    </div>
  );
}

// ─── Goal skill progress ────────────────────────────────────────────────────

function SkillProgress({ buckets: all, goal }: { buckets: SkillBucket[]; goal: string }) {
  const [open, setOpen] = useState<SkillBucket["key"] | null>(null);
  // Required skills decide the goal; optional (supporting) ones are counted apart so they never read as gaps.
  const isRequired = (r: RoleSkillRow) => (r.tier ?? "required") === "required";
  const buckets = all.map((b) => ({ ...b, rows: b.rows.filter(isRequired) }));
  const optional = all.flatMap((b) => b.rows.filter((r) => !isRequired(r)));
  const optionalMet = all.find((b) => b.key === "demonstrated")!.rows.filter((r) => !isRequired(r)).length;
  const total = buckets.reduce((s, b) => s + b.rows.length, 0);
  const demonstrated = buckets.find((b) => b.key === "demonstrated")!.rows.length;
  const R = 44, C = 2 * Math.PI * R;
  const lens = buckets.map((b) => (total ? (b.rows.length / total) * C : 0));
  const arcs = buckets.map((b, i) => ({ key: b.key, len: lens[i], offset: lens.slice(0, i).reduce((s, l) => s + l, 0) }));
  const shown = buckets.find((b) => b.key === open);
  const plain: Record<SkillBucket["key"], { label: string; note: string }> = {
    demonstrated: { label: "Meets the expected level", note: "your work shows it" },
    inProgress: { label: "More practice needed", note: "shown, but below the expected level" },
    notYet: { label: "Waiting for work examples", note: "listed, possibly relevant, or not found in your work yet" },
  };
  return (
    <div className="h-full rounded-2xl border border-border bg-card p-4 shadow-2xs" data-testid="roadmap-skill-progress">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ListChecks aria-hidden className="size-4 text-indigo-600 dark:text-indigo-300" />
        Required skills: your progress
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">Three separate groups: a skill waiting for work examples isn&apos;t the same as one that needs more practice.</p>
      {total === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">We haven&apos;t compared your work with what {goal} needs yet.</p>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-4 sm:flex-row">
          <svg width="116" height="116" viewBox="0 0 120 120" role="img" aria-label={`${demonstrated} of ${total} required skills meet the expected level`} className="shrink-0">
            <circle cx="60" cy="60" r={R} fill="none" stroke="#f1f5f9" strokeWidth="13" />
            {arcs.map((a) => (a.len > 0 ? <circle key={a.key} cx="60" cy="60" r={R} fill="none" stroke={BUCKET_COLOUR[a.key]} strokeWidth="13" strokeDasharray={`${a.len} ${C - a.len}`} strokeDashoffset={-a.offset} transform="rotate(-90 60 60)" /> : null))}
            <text x="60" y="58" textAnchor="middle" className="fill-foreground" fontSize="18" fontWeight="700">{demonstrated} / {total}</text>
            <text x="60" y="75" textAnchor="middle" className="fill-muted-foreground" fontSize="10">required met</text>
          </svg>
          <ul className="w-full divide-y divide-border rounded-xl border border-border">
            {buckets.map((b) => (
              <li key={b.key}>
                <button type="button" aria-expanded={open === b.key} onClick={() => setOpen(open === b.key ? null : b.key)} data-bucket={b.key} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                  <span aria-hidden className="size-2.5 shrink-0 rounded-full ring-1 ring-black/5" style={{ background: BUCKET_COLOUR[b.key] }} />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-foreground">{plain[b.key].label}</span> <span className="text-muted-foreground">({plain[b.key].note})</span>
                  </span>
                  <span className="font-bold tabular-nums text-foreground">{b.rows.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {optional.length > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground" data-testid="roadmap-optional-count">
          Optional skills: {optionalMet} of {optional.length} meet the expected level. They don&apos;t count towards the role&apos;s requirements.
        </p>
      )}
      {shown && (
        <div className="mt-3 rounded-xl bg-muted/40 p-3" data-testid="roadmap-skill-bucket">
          {shown.rows.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-2 text-[11px]">
              {shown.rows.map((r) => {
                const t = stateText(r);
                return (
                  <li key={r.skill} data-skill={r.skill}>
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-foreground">{r.skill}</span>
                      <span className={`rounded px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${TONE_CLASS[t.tone]}`}>{t.label}</span>
                    </p>
                    <p className="text-muted-foreground" title={expectsText(goal, r.expectedLevel)}>
                      {currentLevelText(r)} · expected: {r.expectedLevel} · {r.state === "met" ? "expectation met" : "not met yet"}
                    </p>
                    <p className="text-muted-foreground">
                      {r.evidence.length ? <>From: {r.evidence.slice(0, 2).join("; ")}</> : t.sentence}
                    </p>
                  </li>
                );
              })}
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

// ─── Next action and next steps ─────────────────────────────────────────────

function NextAction({ action, onOpen }: { action: ReadyView["nextAction"]; onOpen: (id: string) => void }) {
  if (!action) {
    return (
      <div className="h-full rounded-2xl border border-border bg-card p-4 shadow-2xs" data-testid="roadmap-next-action">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Zap aria-hidden className="size-4 text-indigo-600" />
          Next action
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Nothing to do right now: every skill is at its expected level, or your submitted work is waiting to be checked.</p>
      </div>
    );
  }
  const { step, reason, row, rec, horizon } = action;
  const evidence = row?.evidence[0] ?? (step.blockedBy.length ? `Builds on ${step.blockedBy.join(" and ")}` : "No work examples found yet");
  // Shown only when it adds to the headline (the engine's deliverable); never the same sentence twice.
  const same = (a?: string | null) => (a ?? "").trim().toLowerCase().replace(/\.$/, "") === step.deliverable.trim().toLowerCase().replace(/\.$/, "");
  const produce = [step.practicalTask, step.evidenceRequired].find((t) => t && !same(t)) ?? null;
  return (
    <div className="h-full rounded-2xl border border-border bg-card p-4 shadow-2xs" data-testid="roadmap-next-action">
      <p className="flex items-center gap-2 text-sm font-bold text-foreground">
        <Zap aria-hidden className="size-4 text-indigo-600 dark:text-indigo-300" />
        Next action
      </p>
      <div className="mt-3 flex flex-col gap-3 rounded-xl bg-indigo-50/60 p-3 sm:flex-row sm:items-center dark:bg-indigo-500/10">
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-card text-indigo-600 sm:flex dark:text-indigo-300">
          <Sparkles aria-hidden className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">{step.deliverable}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{reason}</p>
        </div>
        {rec?.resource ? (
          <a href={rec.resource.url} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 sm:self-center">
            Start the course
            <ExternalLink aria-hidden className="size-3.5" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : (
          <button type="button" onClick={() => onOpen(step.id)} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 sm:self-center">
            See what to do
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
          <span className="min-w-0"><span className="text-muted-foreground">Moves forward:</span> <span className="font-semibold text-foreground">{horizon}</span></span>
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2" data-testid="roadmap-next-action-detail">
        {produce && (
          <div className="rounded-lg bg-muted/40 p-2.5">
            <dt className="font-semibold text-foreground">What to build or show</dt>
            <dd className="mt-0.5 text-muted-foreground">{produce}</dd>
          </div>
        )}
        <div className="rounded-lg bg-muted/40 p-2.5">
          <dt className="font-semibold text-foreground">How we&apos;ll recognise your progress</dt>
          <dd className="mt-0.5 text-muted-foreground">
            {step.criterion ? `${step.criterion.charAt(0).toUpperCase()}${step.criterion.slice(1)}.` : `When your work shows ${step.skill} at the expected level.`} It counts after your profile is next processed, for example after a GitHub sync.
          </dd>
        </div>
      </dl>
    </div>
  );
}

function NextStepsList({ steps, onOpen }: { steps: ReturnType<typeof nextStepsFromRoadmap>; onOpen: (id: string) => void }) {
  return (
    <div className="h-full rounded-2xl border border-border bg-card p-4 shadow-2xs" data-testid="roadmap-next-steps">
      <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <ListOrdered aria-hidden className="size-4 text-indigo-600 dark:text-indigo-300" />
        Your next steps
      </h3>
      {steps.steps.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{steps.empty?.message ?? "Nothing else is open after the next action."}</p>
      ) : (
        <ol className="mt-2 divide-y divide-border">
          {steps.steps.map((s, i) => (
            <li key={s.stepId ?? i}>
              <button type="button" onClick={() => s.stepId && onOpen(s.stepId)} className="group flex w-full items-center gap-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-foreground" title={s.desc}>{s.skill ?? s.title}</span>
                  <span className="block truncate text-[11px] text-muted-foreground" title={s.title}>{s.skill ? deliverableOf(s.title) : s.desc}</span>
                </span>
                <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ol>
      )}
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
        {step.sources?.includes("project") && <span className="rounded-full bg-sky-50 px-1.5 py-px text-[10px] font-semibold text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30">Your project needs it</span>}
        {step.sources?.length === 1 && step.sources[0] === "prerequisite" && <span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold text-muted-foreground">Builds a foundation</span>}
        {step.optional && <span className="ml-auto text-[10px] text-muted-foreground" title={assumption}>Optional for this goal</span>}
      </div>
      {step.objective && <p className="mt-1 text-[11px] font-medium text-foreground">{step.objective}</p>}

      <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-2 text-[11px]">
          <div>
            <p className="font-semibold text-foreground">Why this is on your roadmap</p>
            <p className="mt-0.5 text-muted-foreground">{milestoneReason(goal, row, step)}</p>
          </div>
          {step.levelBasis && step.levelBasis.length > 0 ? (
            <div>
              <p className="font-semibold text-foreground">What your evidence shows so far</p>
              <ul className="mt-0.5 space-y-0.5 text-muted-foreground">
                {step.levelBasis.slice(0, 3).map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
              {step.nextLevel && <p className="mt-0.5 text-muted-foreground"><span className="font-semibold text-foreground">To go further: </span>{step.nextLevel}</p>}
            </div>
          ) : row && row.evidence.length > 0 && (
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
              {step.blockedBy.length > 0 && <p className="mt-1 text-[10px] text-muted-foreground">{prerequisiteText(step.blockedBy)}</p>}
            </div>
          )}
        </div>

        <div className="space-y-2 text-[11px]">
          <div>
            <p className="font-semibold text-foreground">Next step</p>
            <p className="mt-0.5 text-muted-foreground">{step.status === "completed" ? "Nothing to do: keep the evidence public and current." : (row?.action ?? step.deliverable)}</p>
            {step.status !== "completed" && step.practicalTask && <p className="mt-0.5 text-muted-foreground"><span className="font-semibold text-foreground">Build: </span>{step.practicalTask}</p>}
            {step.status !== "completed" && step.context && <p className="mt-0.5 text-[10px] text-muted-foreground">Ideally as part of {step.context}.</p>}
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
                  {(rec.resource.typeLabel || rec.resource.provider) && <span className="block text-[10px] text-muted-foreground">{[rec.resource.typeLabel, rec.resource.provider].filter(Boolean).join(" · ")}</span>}
                  {rec.resource.fitReason && <span className="block text-[10px] text-muted-foreground">{rec.resource.fitReason}</span>}
                </span>
              </a>
            ) : rec ? (
              <p className="text-[10px] text-muted-foreground">{rec.noResourceReason ?? "No catalogued course for this skill"}: learn by building the project above.</p>
            ) : null)}
          {step.submissionCheck && (
            <p className={`rounded-md px-2 py-1 text-[10px] ${step.submissionCheck.status === "read" ? "bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200" : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"}`} data-testid="submission-check">
              {step.submissionCheck.message}
            </p>
          )}
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
