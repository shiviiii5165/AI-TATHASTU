import { ArrowRight, CalendarClock, Compass, Info } from "lucide-react";
import Link from "next/link";

import { roleLabel } from "@/components/dashboard/widgets/labels";
import { standingView, type IntelligenceScore } from "@/lib/dashboard/eris-intelligence";
import type { AlignmentState, IntelligenceDoc } from "@/lib/dashboard/types";
import { ALIGNMENT_TEXT, roadmapView } from "@/lib/roadmap/view";
import type { MilestoneSubmission } from "@/lib/roadmap/progress";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const assessedOn = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : DATE.format(d);
};

const ALIGNMENT_TONE: Record<AlignmentState, string> = {
  not_enough_evidence: "bg-muted text-muted-foreground ring-border",
  early: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/30",
  developing: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/30",
  strong: "bg-violet-100 text-violet-800 ring-violet-300 dark:bg-violet-500/25 dark:text-violet-200 dark:ring-violet-400/40",
  requirements_demonstrated: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30",
};

/**
 * Where you stand: the ERIS — Intelligence Score (lib/dashboard/eris-intelligence, from the engine's role analysis),
 * the rule-based alignment state beside it as a separate thing, the required gaps holding it back and the roadmap's
 * next step. Owner-only: the dashboard is rendered for the signed-in user from their own profile view.
 */
export function ErisWidget({ intelligence, primaryRole, submissions = [] }: { intelligence?: IntelligenceDoc; primaryRole: string | null; submissions?: MilestoneSubmission[] }) {
  const view = standingView(intelligence, primaryRole);
  const when = "computedAt" in view ? assessedOn(view.computedAt) : null;

  if (view.state === "pending") return <Note>Your assessment is being prepared from your evidence.</Note>;
  if (view.state === "legacy")
    return <Note when={when}>This assessment was made by an earlier version of the engine, so no score is shown. It is recalculated the next time your profile is processed.</Note>;
  if (view.state === "no_direction")
    return (
      <Note when={when}>No career direction is selected, so there&apos;s nothing to score against. We don&apos;t assume one for you. Your skills and evidence are still shown elsewhere on the dashboard.</Note>
    );
  if (view.state === "unsupported")
    return <Note when={when}>Your selected direction doesn&apos;t have a competency framework yet, so it can&apos;t be scored. Your skills and evidence are still shown elsewhere on the dashboard.</Note>;

  const next = roadmapView(intelligence, submissions);
  const nextAction = next.state === "ready" ? next.nextAction : null;

  return (
    <div className="space-y-4" data-testid="where-you-stand">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <ScoreBlock score={view.score} />

        <dl className="grid content-start gap-2.5 text-xs">
          <div>
            <dt className="text-[11px] font-semibold text-muted-foreground">Career direction</dt>
            <dd className="mt-0.5 flex flex-wrap items-center gap-1.5 font-semibold text-foreground">
              <Compass aria-hidden className="size-3.5 text-violet-500" />
              {roleLabel(view.role)}
              {view.draft && (
                <span className="rounded-md bg-muted px-1.5 py-px text-[10px] font-medium text-muted-foreground" title="Our team wrote this framework. It hasn't been reviewed and isn't an industry standard.">
                  Draft framework
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold text-muted-foreground">Alignment</dt>
            <dd className="mt-0.5">
              {view.alignment && view.assessed ? (
                <>
                  <span data-testid="alignment-state" data-state={view.alignment.state} className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${ALIGNMENT_TONE[view.alignment.state]}`}>
                    {view.alignment.label}
                  </span>
                  <p className="mt-1 text-muted-foreground">
                    {view.alignment.requiredMet} of {view.alignment.required} required skills shown at the expected level. {ALIGNMENT_TEXT[view.alignment.state]}
                  </p>
                </>
              ) : (
                <span className="text-muted-foreground">Not enough evidence to assess yet.</span>
              )}
            </dd>
          </div>
          {when && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarClock aria-hidden className="size-3.5" />
              <span>
                Last assessed <time dateTime={view.computedAt}>{when}</time>
              </span>
            </div>
          )}
        </dl>
      </div>

      {view.gaps.length > 0 && (
        <div className="border-t border-border pt-3">
          <h3 className="text-xs font-semibold text-foreground">Holding your alignment back</h3>
          <ol className="mt-2 grid gap-2 md:grid-cols-3" aria-label="Priority gaps">
            {view.gaps.map((g, i) => (
              <li key={g.skill} className="min-w-0 rounded-xl border border-border bg-muted/30 px-2.5 py-2">
                <p className="flex items-baseline gap-1.5 text-xs font-semibold text-foreground">
                  <span aria-hidden className="tabular-nums text-violet-500">{i + 1}</span>
                  <span className="min-w-0 break-words">{g.skill}</span>
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">{g.note}</p>
                {g.why && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground" title={g.why}>{g.why}</p>}
              </li>
            ))}
          </ol>
        </div>
      )}

      {nextAction && (
        <Link
          href={`/learn?skill=${encodeURIComponent(nextAction.step.skill)}`}
          className="group flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50/70 px-3 py-2.5 transition-colors duration-150 hover:border-orange-300 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:border-orange-400/30 dark:bg-orange-500/10"
          data-testid="next-action"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-orange-700 dark:text-orange-300">Next action · {nextAction.step.skill}</span>
            <span className="block text-xs text-foreground">{nextAction.step.objective ?? nextAction.step.deliverable}</span>
          </span>
          <ArrowRight aria-hidden className="size-4 shrink-0 text-orange-600 transition-transform duration-150 group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

function ScoreBlock({ score }: { score: IntelligenceScore | null }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-3 dark:border-violet-400/20 dark:bg-violet-500/10" data-testid="eris-score">
      <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">ERIS — Intelligence Score</p>
      {score ? (
        <>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-bold tabular-nums tracking-tight text-foreground" data-testid="eris-value">
              {score.score}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-500/20" role="meter" aria-label="ERIS — Intelligence Score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score.score}>
            <div className="h-full origin-left rounded-full bg-violet-500" style={{ transform: `scaleX(${score.score / 100})` }} />
          </div>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">How much of this direction&apos;s competency framework your evidence currently backs. Not a job-readiness or hiring estimate.</p>
          <ul className="mt-2 space-y-0.5 text-[11px]" aria-label="Score breakdown">
            {[score.required, score.supporting].filter((f) => f.competencies > 0).map((f) => (
              <li key={f.label} className="flex justify-between gap-2">
                <span className="text-muted-foreground">
                  {f.label} ({f.competencies})
                </span>
                <span className="font-semibold tabular-nums text-foreground">{f.score ?? "—"}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
            {[
              `${score.counts.evidenced} backed by evidence`,
              score.counts.described > 0 ? `${score.counts.described} by your own descriptions only (half credit)` : null,
              `${score.counts.none} not yet shown (no credit)`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm font-semibold text-foreground" data-testid="eris-value">
            Not enough evidence
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">No score until at least one competency for this direction is backed by evidence. A GitHub repository, an assessment or a confirmed project on your resume would help.</p>
          <Link href="/connections" className="mt-2 inline-flex text-[11px] font-semibold text-orange-600 hover:underline dark:text-orange-300">
            Add evidence
          </Link>
        </>
      )}
    </div>
  );
}

function Note({ children, when, action }: { children: React.ReactNode; when?: string | null; action?: { label: string; href: string } }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground" data-testid="where-you-stand">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-violet-500" />
      <div className="min-w-0">
        <p>{children}</p>
        {when && <p className="mt-1 text-[11px]">Last assessed {when}</p>}
        {action && (
          <Link href={action.href} className="mt-2 inline-flex text-[11px] font-semibold text-orange-600 hover:underline dark:text-orange-300">
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
