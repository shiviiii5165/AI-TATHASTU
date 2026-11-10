"use client";

import { ArrowRight, BookOpen, CheckCircle2, CircleDashed, Clock, ExternalLink, Flag, Hourglass, Info, Lock, MapPin, Send, Sparkles, Target, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { submitRoadmapEvidence } from "@/app/(dashboard)/dashboard/roadmap-actions";
import { roleLabel } from "@/components/dashboard/widgets/labels";
import type { IntelligenceDoc, LearningRecommendation, RoleSkillRow } from "@/lib/dashboard/types";
import { milestoneReason } from "@/lib/roadmap/explain";
import { roadmapProgress, type MilestoneStatus, type MilestoneSubmission, type RoadmapStep } from "@/lib/roadmap/progress";

/**
 * Career Roadmap: where you are, where you said you want to go, what's missing and what to do next.
 * Everything comes from the engine's roadmap for the user's own selected career goal, its gap analysis
 * for that role and its learning recommendations. Milestone states are from roadmap/progress.ts.
 * When there's no goal, no framework for it or no evidence to assess, this says so instead of drawing a plan.
 */
export const HORIZONS = [
  { label: "Short term", hex: "#8b5cf6", grad: "from-violet-500 to-indigo-500" },
  { label: "Medium term", hex: "#d946ef", grad: "from-fuchsia-500 to-pink-500" },
  { label: "Long term", hex: "#f97316", grad: "from-orange-500 to-amber-400" },
] as const;

export const STATUS_STYLE: Record<MilestoneStatus, { label: string; icon: typeof CheckCircle2; className: string; hex: string }> = {
  completed: { label: "Completed", icon: CheckCircle2, hex: "#10b981", className: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30" },
  active: { label: "Do next", icon: Sparkles, hex: "#8b5cf6", className: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/30" },
  submitted: { label: "In review", icon: Send, hex: "#0ea5e9", className: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30" },
  needs_more_evidence: { label: "Needs more evidence", icon: TriangleAlert, hex: "#f59e0b", className: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30" },
  blocked: { label: "Blocked", icon: Lock, hex: "#ef4444", className: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30" },
  upcoming: { label: "Upcoming", icon: CircleDashed, hex: "#94a3b8", className: "bg-muted text-muted-foreground ring-border" },
};

export function CareerRoadmap({ intelligence, submissions }: { intelligence?: IntelligenceDoc; submissions?: MilestoneSubmission[] }) {
  const roadmap = intelligence?.roadmap ?? null;
  const progress = useMemo(() => (roadmap && intelligence ? roadmapProgress(roadmap, intelligence.computedAt, submissions) : null), [roadmap, intelligence, submissions]);
  const analysis = intelligence?.roles.find((r) => r.role === roadmap?.role);
  const rows = useMemo(() => new Map((analysis?.skills ?? []).map((r) => [r.skill, r])), [analysis]);
  const recs = useMemo(() => new Map((intelligence?.recommendations ?? []).map((r) => [r.skill, r])), [intelligence]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const stages = useMemo(
    () =>
      (roadmap?.stages ?? []).slice(0, 3).map((stage, i) => ({
        ...stage,
        horizon: HORIZONS[i],
        steps: progress?.steps.filter((s) => s.stageKey === stage.key) ?? [],
      })),
    [roadmap, progress],
  );

  const nextStep = progress?.steps.find((s) => s.id === progress.nextId) ?? null;
  const selected = progress?.steps.find((s) => s.id === (selectedId ?? progress.nextId)) ?? null;
  const percent = progress ? Math.round(progress.progress * 100) : 0;
  const goal = roadmap ? roleLabel(roadmap.role) : null;
  const tally = (st: MilestoneStatus) => progress?.steps.filter((s) => s.status === st).length ?? 0;

  return (
    <section id="career-roadmap" className="relative scroll-mt-20 overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5" data-testid="career-roadmap">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-gradient-to-br from-violet-400/15 via-fuchsia-400/10 to-orange-300/10 blur-3xl" />
      <div className="relative flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 text-white shadow-sm shadow-fuchsia-500/30">
            <Target aria-hidden className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-foreground">Career Roadmap</h2>
        </div>
        <Link href="/learning" className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
          <span>View plan</span>
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>

      {!intelligence ? (
        <Missing title="Your roadmap is being calculated" body="It's built from your evidence and career goal the next time your profile is processed." />
      ) : !roadmap || !progress ? (
        intelligence.unsupportedRoles.length ? (
          <Missing
            title="No roadmap for your goal yet"
            body={`We don't have a competency framework for ${intelligence.unsupportedRoles.map(roleLabel).join(", ")}, so we can't say what it needs without guessing. Choose a supported goal, or check back later.`}
            href="/settings"
            action="Review your career goal"
          />
        ) : (
          <Missing title="Choose where you want to go" body="A roadmap needs a career goal you've chosen. We don't assume one for you." href="/settings" action="Set a career goal" />
        )
      ) : (
        <div className="relative">
          {/* Where I am → where I want to go. */}
          <div className="mt-3 grid grid-cols-1 items-stretch gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                <MapPin aria-hidden className="size-3" />
                Where you are
              </p>
              {roadmap.currentPosition ? (
                <p className="mt-1 truncate text-sm font-semibold text-foreground" title={roadmap.currentPosition}>
                  {roadmap.currentPosition}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  No current role on your profile.{" "}
                  <Link href="/profile" className="font-semibold text-primary hover:underline">
                    Add it
                  </Link>
                </p>
              )}
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {progress.completed.length} of {analysis?.skills.length || progress.completed.length + progress.steps.length} goal skills shown at level
              </p>
            </div>

            <div className="flex flex-col justify-center rounded-xl p-3">
              <div className="flex items-baseline justify-between text-[11px]">
                <span className="font-semibold text-foreground">Evidence coverage</span>
                <span className="font-bold tabular-nums text-foreground">{percent}%</span>
              </div>
              <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${percent}% of ${goal} skills shown at their expected level by your evidence`}>
                <div
                  data-testid="roadmap-progress-bar"
                  className="h-full origin-left rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-orange-400 shadow-[0_0_10px] shadow-fuchsia-500/40 motion-safe:animate-[skillBarGrow_1100ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                {(["completed", "active", "submitted", "needs_more_evidence", "blocked", "upcoming"] as MilestoneStatus[]).map((st) =>
                  tally(st) ? (
                    <span key={st} className={`rounded-full px-1.5 py-px font-semibold ring-1 ${STATUS_STYLE[st].className}`}>
                      {tally(st)} {STATUS_STYLE[st].label.toLowerCase()}
                    </span>
                  ) : null,
                )}
              </div>
            </div>

            <div className="rounded-xl border border-fuchsia-200/70 bg-gradient-to-br from-violet-50 to-orange-50 p-3 dark:border-fuchsia-400/20 dark:from-violet-500/10 dark:to-orange-500/10">
              <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-300">
                <Flag aria-hidden className="size-3" />
                Where you want to go
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">{goal}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Your chosen goal ·{" "}
                <Link href="/settings" className="font-semibold text-primary hover:underline">
                  change
                </Link>
              </p>
            </div>
          </div>

          {analysis && !analysis.assessed && (
            <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              <span>
                There isn&apos;t enough evidence yet to measure where you stand, so these milestones are what {goal} requires, not measured gaps.{" "}
                <Link href="/connections" className="font-semibold underline">
                  Connect GitHub or confirm your resume
                </Link>{" "}
                to see real gaps.
              </span>
            </p>
          )}

          {progress.steps.length === 0 ? (
            <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-center dark:bg-emerald-500/10">
              <CheckCircle2 aria-hidden className="mx-auto size-6 text-emerald-600 dark:text-emerald-300" />
              <p className="mt-1 text-xs font-semibold text-foreground">Every skill {goal} needs is at its expected level</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">Based on your current evidence. Keep it current as you build.</p>
            </div>
          ) : (
            <>
              {nextStep && (
                <button
                  type="button"
                  onClick={() => setSelectedId(nextStep.id)}
                  className="mt-3 flex w-full items-start gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-600 p-3 text-left text-white shadow-md shadow-fuchsia-500/20 transition-transform motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-white/80">What to do next</span>
                    <span className="block text-xs font-semibold">{nextStep.deliverable}</span>
                    <span className="block text-[11px] text-white/85">Done when: {nextStep.criterion}.</span>
                  </span>
                </button>
              )}

              {/* The three horizons, joined left to right (top to bottom on small screens). */}
              <ol className="relative mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3" aria-label={`Milestones towards ${goal}`}>
                {stages.map((stage, i) => (
                  <li key={stage.key} className="relative min-w-0">
                    {i < stages.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute left-5 top-full z-0 h-3 w-[3px] lg:left-auto lg:right-[-0.75rem] lg:top-5 lg:h-[3px] lg:w-3"
                        style={{ background: `linear-gradient(90deg, ${stage.horizon.hex}, ${HORIZONS[i + 1].hex})` }}
                      />
                    )}
                    <div className="h-full rounded-xl border border-border bg-card/80 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`flex size-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm ${stage.horizon.grad}`}>{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: stage.horizon.hex }}>
                            {stage.horizon.label}
                          </p>
                          <p className="truncate text-xs font-semibold text-foreground">{stage.title}</p>
                        </div>
                        <span className="ml-auto flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground" title={roadmap.assumption}>
                          <Clock aria-hidden className="size-3" />~{stage.estimateWeeks} wk
                        </span>
                      </div>
                      <ul className="mt-2 space-y-1">
                        {stage.steps.map((step) => {
                          const st = STATUS_STYLE[step.status];
                          const Icon = st.icon;
                          const active = selected?.id === step.id;
                          return (
                            <li key={step.id}>
                              <button
                                type="button"
                                aria-pressed={active}
                                aria-controls="roadmap-milestone-detail"
                                onClick={() => setSelectedId(step.id)}
                                data-status={step.status}
                                className={`flex w-full items-center gap-2 rounded-lg border-l-[3px] px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-muted" : "hover:bg-muted/60"} ${step.status === "upcoming" || step.status === "blocked" ? "opacity-80" : ""}`}
                                style={{ borderLeftColor: st.hex }}
                              >
                                <Icon aria-hidden className="size-3.5 shrink-0" style={{ color: st.hex }} />
                                <span className={`min-w-0 flex-1 truncate text-xs font-medium ${step.status === "completed" ? "text-muted-foreground line-through decoration-emerald-500/60" : "text-foreground"}`}>{step.skill}</span>
                                <span className="sr-only">{st.label}</span>
                                {step.status !== "upcoming" && step.status !== "completed" && <span className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold ring-1 ${st.className}`}>{st.label}</span>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>

              {selected && goal && <MilestoneDetail key={selected.id} step={selected} goal={goal} row={rows.get(selected.skill)} rec={recs.get(selected.skill)} assumption={roadmap.assumption} onPick={(skill) => setSelectedId(progress.steps.find((s) => s.skill === skill)?.id ?? null)} />}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Missing({ title, body, href, action }: { title: string; body: string; href?: string; action?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div aria-hidden className="mb-3 flex items-center gap-1">
        <span className="size-3 rounded-full bg-violet-400/50" />
        <span className="h-0.5 w-8 rounded bg-gradient-to-r from-violet-400/50 to-fuchsia-400/50" />
        <span className="size-3 rounded-full border-2 border-dashed border-fuchsia-400/60" />
        <span className="h-0.5 w-8 rounded bg-gradient-to-r from-fuchsia-400/50 to-orange-400/50" />
        <Flag className="size-4 text-orange-400/70" />
      </div>
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-[11px] text-muted-foreground">{body}</p>
      {href && action && (
        <Link href={href} className="mt-3 text-xs font-semibold text-primary hover:underline">
          {action}
        </Link>
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
