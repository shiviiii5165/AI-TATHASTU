import Link from "next/link";

import type { ErisData } from "@/lib/dashboard/types";
import { roleLabel } from "@/components/dashboard/widgets/labels";
import { cn } from "@/lib/utils";

type Breakdown = {
  components: { technical: number | null; projects: number | null; problem_solving: number | null };
  missing_components: string[];
};

const COMPONENTS = [
  ["technical", "Technical skills"],
  ["projects", "Projects"],
  ["problem_solving", "Problem solving"],
] as const;

/** Renders the precomputed eris_scores breakdown (loaded by the dashboard page); computes nothing. */
export function ErisWidget({
  data,
  byRole,
  breakdown: raw,
}: {
  data: ErisData;
  byRole: Record<string, number>;
  breakdown: Record<string, unknown> | undefined;
}) {
  const breakdown = raw as Breakdown | undefined;
  const score = Math.round(data.score * 100);
  const otherRoles = Object.entries(byRole).filter(([r]) => r !== data.role);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
      <div>
        <p className="font-heading text-7xl leading-none tracking-tight">
          {score}
          <span className="ml-1 font-sans text-base text-muted-foreground">/100</span>
        </p>
        <p className="mt-2 text-sm text-muted-foreground">for {roleLabel(data.role)}</p>
        <div
          role="meter"
          aria-label="Interview readiness"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={score}
          className="mt-4 h-1.5 w-full min-w-40 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full origin-left bg-brand" style={{ transform: `scaleX(${data.score})` }} />
        </div>
      </div>

      <div className="min-w-0 space-y-5">
        {breakdown && (
          <dl className="grid grid-cols-3 gap-3">
            {COMPONENTS.map(([key, label]) => {
              const value = breakdown.components[key];
              return (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className={cn("mt-0.5 font-mono text-sm", value === null && "text-muted-foreground")}>
                    {value === null ? "Not scored" : Math.round(value * 100)}
                  </dd>
                </div>
              );
            })}
          </dl>
        )}
        {data.gaps.length > 0 && (
          <div>
            <p className="text-sm font-medium">Close these gaps first</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {data.gaps.map((g) => (
                <li key={g.skill}>
                  <Link
                    href={`/learn?skill=${encodeURIComponent(g.skill)}`}
                    className="inline-flex h-8 items-center gap-2 rounded-full border border-border-strong px-3 text-sm transition-colors duration-150 hover:border-foreground hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {g.skill}
                    <span className="font-mono text-xs text-muted-foreground">{Math.round(g.readiness * 100)}%</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {breakdown?.missing_components.includes("problem_solving") && (
          <p className="text-xs text-muted-foreground">
            Problem-solving practice (LeetCode, HackerRank) isn&apos;t connected yet, so the score uses skills and projects only.
          </p>
        )}
        {otherRoles.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Also tracking:{" "}
            {otherRoles.map(([r, s], i) => (
              <span key={r}>
                {i > 0 && ", "}
                {roleLabel(r)} <span className="font-mono">{Math.round(s * 100)}</span>
              </span>
            ))}
          </p>
        )}
      </div>
    </div>
  );
}
