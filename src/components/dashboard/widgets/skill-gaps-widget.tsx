import { ArrowUpRight, Lock } from "lucide-react";
import Link from "next/link";

import { roleLabel } from "@/components/dashboard/widgets/labels";
import { categoryOf, primaryAnalysis, skillsToDevelop, type DevelopRow } from "@/lib/dashboard/intelligence";
import { currentLevelText, expectsText, stateText, TONE_CLASS } from "@/lib/dashboard/plain-language";
import type { IntelligenceDoc } from "@/lib/dashboard/types";
import type { MilestoneSubmission } from "@/lib/roadmap/progress";
import { roadmapView } from "@/lib/roadmap/view";

const MAX_ROWS = 6;

/** Where a row sits in the engine's priority rule (career_engine.PRIORITY_GROUPS); v3 rows fall back to their tier. */
const GROUP_DOT = ["bg-orange-500", "bg-rose-500", "bg-violet-500", "bg-sky-500", "bg-slate-300 dark:bg-slate-500"];

function groupOf(row: DevelopRow): { index: number; label: string } {
  if ("priorityGroup" in row && typeof row.priorityGroup === "number") return { index: row.priorityGroup, label: row.priorityGroupLabel };
  return (row.tier ?? "required") === "required" ? { index: 2, label: "Required for your career" } : { index: 4, label: "Supporting and optional" };
}

/**
 * Skills to develop: the engine's complete gap inventory (career framework, the student's project and the prerequisites
 * they build on), in its explained priority order. Nothing is re-ranked here. The first row is the roadmap's next step,
 * so this card, Where you stand and the roadmap always name the same place to start.
 */
export function SkillGapsWidget({ intelligence, primaryRole, submissions = [] }: { intelligence?: IntelligenceDoc; primaryRole: string | null; submissions?: MilestoneSubmission[] }) {
  const analysis = primaryAnalysis(intelligence, primaryRole);
  if (!intelligence) return <p className="text-xs text-muted-foreground">Being prepared from your evidence.</p>;
  if (!primaryRole && !intelligence.project?.rows?.length) return <p className="text-xs text-muted-foreground">Choose a career direction to see which skills it needs. None is assumed for you.</p>;
  if (primaryRole && !analysis) return <p className="text-xs text-muted-foreground">Your selected direction doesn&apos;t have a competency framework yet, so there&apos;s no list of skills to compare with.</p>;
  if (analysis && !analysis.assessed)
    return (
      <p className="text-xs text-muted-foreground">
        Not enough evidence to compare your skills with {roleLabel(analysis.role)} yet. That isn&apos;t the same as having gaps.{" "}
        <Link href="/connections" className="font-semibold text-orange-600 hover:underline dark:text-orange-300">
          Add evidence
        </Link>
      </p>
    );

  const open = skillsToDevelop(intelligence, primaryRole);
  if (open.length === 0) return <p className="text-xs text-muted-foreground">Every skill {analysis ? roleLabel(analysis.role) : "your goal"} needs is at its expected level, based on your current evidence.</p>;

  const required = open.filter((r) => ("roleTier" in r ? r.roleTier : r.tier ?? "required") === "required").length;
  const project = open.filter((r) => r.sources?.includes("project")).length;
  const shown = open.slice(0, MAX_ROWS);
  const roadmap = roadmapView(intelligence, submissions);
  const next = roadmap.state === "ready" ? roadmap.nextAction?.step.skill : undefined;
  const start = (next && open.some((r) => r.skill === next) ? next : undefined) ?? open.find((r) => !(r.blockedBy ?? []).length)?.skill;
  const hasProject = intelligence.project?.status === "analysed";
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        {analysis ? <>For {roleLabel(analysis.role)}{hasProject ? " and your project" : ""}: </> : "For your project: "}
        <span className="font-semibold text-foreground">{open.length}</span> to develop
        {required > 0 && <> · {required} required</>}
        {project > 0 && <> · {project} for your project</>}. Ordered by what builds on what, then by importance.
      </p>
      <ol className="mt-2.5 space-y-1.5" aria-label="Skills to develop">
        {shown.map((row) => (
          <Row key={row.skill} row={row} first={row.skill === start} goal={analysis ? roleLabel(analysis.role) : "Your project"} />
        ))}
      </ol>
      <Link href="/skills#gap-inventory" className="mt-2 inline-flex text-[11px] font-semibold text-orange-600 hover:underline dark:text-orange-300">
        {open.length > shown.length ? `See all ${open.length}, with the evidence behind each` : "See the evidence behind each"}
      </Link>
    </div>
  );
}

function Row({ row, first, goal }: { row: DevelopRow; first: boolean; goal: string }) {
  const text = stateText(row);
  const group = groupOf(row);
  const blocked = row.blockedBy?.filter(Boolean) ?? [];
  const why = row.whyItMatters ?? ("inventoryReason" in row ? row.inventoryReason : null);
  const forProject = row.sources?.includes("project");
  return (
    <li data-skill={row.skill} data-category={categoryOf(row)}>
      <details open={first} className={`group rounded-xl px-2.5 py-2 ${first ? "border border-orange-200 bg-orange-50/60 dark:border-orange-400/30 dark:bg-orange-500/10" : "border border-transparent hover:bg-muted/50 open:border-border open:bg-muted/30"}`}>
        <summary className="flex cursor-pointer list-none items-start gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${GROUP_DOT[group.index] ?? GROUP_DOT[4]}`} title={group.label} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
              <span className="font-semibold text-foreground">{row.skill}</span>
              <span className={`rounded px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${TONE_CLASS[text.tone]}`} title={text.sentence}>
                {text.label}
              </span>
              {first && <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300">Start here</span>}
            </span>
            <span className="mt-0.5 block text-[10.5px] font-medium text-muted-foreground">
              {group.label}
              {forProject && group.index !== 1 && group.index !== 3 ? " · also needed by your project" : ""}
            </span>
            {why && <span className="mt-0.5 line-clamp-1 block text-[11px] text-muted-foreground group-open:line-clamp-none">{why}</span>}
          </span>
        </summary>
        <dl className="mt-2 grid gap-1.5 pl-4.5 text-[11px] sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-foreground">Where you are</dt>
            <dd className="text-muted-foreground" title={expectsText(goal, row.expectedLevel)}>
              {currentLevelText(row)} · expected {row.expectedLevel}
              {row.levelBasis?.[0] ? `. ${row.levelBasis[0]}.` : row.evidence.length ? `. From ${row.evidence[0]}.` : `. ${text.sentence}`}
            </dd>
          </div>
          {row.action && (
            <div>
              <dt className="font-semibold text-foreground">What to do next</dt>
              <dd className="text-muted-foreground">{row.action}</dd>
            </div>
          )}
          {row.demonstration && (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-foreground">What would show it</dt>
              <dd className="text-muted-foreground">{row.demonstration}</dd>
            </div>
          )}
          {blocked.length > 0 && (
            <div className="sm:col-span-2 flex items-center gap-1 text-muted-foreground">
              <Lock aria-hidden className="size-3" /> Builds on {blocked.join(", ")}, so start there first.
            </div>
          )}
          <div className="sm:col-span-2">
            <Link href={`/learn?skill=${encodeURIComponent(row.skill)}`} className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline dark:text-orange-300">
              Learning options for {row.skill}
              <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </div>
        </dl>
      </details>
    </li>
  );
}
