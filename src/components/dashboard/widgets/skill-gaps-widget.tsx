import { ArrowUpRight, Lock } from "lucide-react";
import Link from "next/link";

import { roleLabel } from "@/components/dashboard/widgets/labels";
import { gapNote } from "@/lib/dashboard/eris-intelligence";
import { expectsText, needsShort } from "@/lib/dashboard/plain-language";
import type { IntelligenceDoc, RoleSkillRow } from "@/lib/dashboard/types";
import type { MilestoneSubmission } from "@/lib/roadmap/progress";
import { roadmapView } from "@/lib/roadmap/view";

const MAX_ROWS = 7;

const PRIORITY_DOT: Record<RoleSkillRow["priority"], string> = {
  High: "bg-orange-500",
  Medium: "bg-violet-400",
  Low: "bg-slate-300 dark:bg-slate-500",
};

/**
 * Skills to develop for the selected direction: the engine's open competencies (career_engine.analyze_role
 * `open`) in its priority order, the same rows the Skill Gaps card shows. Required before supporting is the
 * engine's own ordering; nothing is re-ranked here.
 */
export function SkillGapsWidget({ intelligence, primaryRole, submissions = [] }: { intelligence?: IntelligenceDoc; primaryRole: string | null; submissions?: MilestoneSubmission[] }) {
  const analysis = primaryRole ? intelligence?.roles.find((r) => r.role === primaryRole) : undefined;
  if (!intelligence) return <p className="text-xs text-muted-foreground">Being prepared from your evidence.</p>;
  if (!primaryRole) return <p className="text-xs text-muted-foreground">Choose a career direction to see which skills it needs. None is assumed for you.</p>;
  if (!analysis) return <p className="text-xs text-muted-foreground">Your selected direction doesn&apos;t have a competency framework yet, so there&apos;s no list of skills to compare with.</p>;
  if (!analysis.assessed)
    return (
      <p className="text-xs text-muted-foreground">
        Not enough evidence to compare your skills with {roleLabel(analysis.role)} yet. That isn&apos;t the same as having gaps.{" "}
        <Link href="/connections" className="font-semibold text-orange-600 hover:underline dark:text-orange-300">
          Add evidence
        </Link>
      </p>
    );

  const open = analysis.open.filter((r) => r.state !== "met");
  if (open.length === 0) return <p className="text-xs text-muted-foreground">Every competency for {roleLabel(analysis.role)} is at its expected level, based on your current evidence.</p>;

  const required = open.filter((r) => (r.tier ?? "required") === "required").length;
  const shown = open.slice(0, MAX_ROWS);
  // Where to start: the roadmap's next step (the same one Where you stand names), else the first skill not
  // waiting on a prerequisite.
  const roadmap = roadmapView(intelligence, submissions);
  const next = roadmap.state === "ready" ? roadmap.nextAction?.step.skill : undefined;
  const start = (next && open.some((r) => r.skill === next) ? next : undefined) ?? open.find((r) => !(r.blockedBy ?? []).filter(Boolean).length)?.skill;
  return (
    <div>
      <p className="text-xs text-muted-foreground">
        For {roleLabel(analysis.role)}: <span className="font-semibold text-foreground">{required}</span> required
        {open.length - required > 0 && (
          <>
            {" "}
            and <span className="font-semibold text-foreground">{open.length - required}</span> supporting
          </>
        )}{" "}
        to develop, in the order to work on them.
      </p>
      <ol className="mt-2.5 space-y-1.5" aria-label="Skills to develop">
        {shown.map((row) => (
          <Row key={row.skill} row={row} first={row.skill === start} />
        ))}
      </ol>
      {open.length > shown.length && (
        <Link href="/skills" className="mt-2 inline-flex text-[11px] font-semibold text-orange-600 hover:underline dark:text-orange-300">
          See all {open.length} on Skills
        </Link>
      )}
    </div>
  );
}

function Row({ row, first }: { row: RoleSkillRow; first: boolean }) {
  const supporting = row.tier === "supporting";
  const blocked = row.blockedBy?.filter(Boolean) ?? [];
  return (
    <li className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 ${first ? "border border-orange-200 bg-orange-50/60 dark:border-orange-400/30 dark:bg-orange-500/10" : "border border-transparent hover:bg-muted/50"}`} data-skill={row.skill}>
      <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${PRIORITY_DOT[row.priority]}`} title={`${row.priority} priority`} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
          <span className="font-semibold text-foreground">{row.skill}</span>
          <span className="text-[10px] font-medium text-muted-foreground">
            {supporting ? "Supporting" : "Required"} · {row.priority} priority
          </span>
          {first && <span className="text-[10px] font-semibold text-orange-700 dark:text-orange-300">Start here</span>}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          <span className="font-medium text-violet-700 dark:text-violet-300">{gapNote(row)}</span>
          {row.proficiency !== null && row.proficiency !== undefined ? ` · now ${row.level}` : ""}
        </p>
        <p className="text-[11px] text-muted-foreground" title={expectsText("Your target role", row.expectedLevel)}>
          {needsShort(row.expectedLevel)}
        </p>
        {blocked.length > 0 && (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Lock aria-hidden className="size-3" /> Builds on {blocked.join(", ")}, so start that first
          </p>
        )}
        {first && row.whyItMatters && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{row.whyItMatters}</p>}
      </div>
      <Link
        href={`/learn?skill=${encodeURIComponent(row.skill)}`}
        aria-label={`Learn ${row.skill}`}
        className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-orange-100 hover:text-orange-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:bg-orange-500/15"
      >
        <ArrowUpRight aria-hidden className="size-4" />
      </Link>
    </li>
  );
}
