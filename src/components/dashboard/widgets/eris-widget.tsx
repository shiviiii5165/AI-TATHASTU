import Link from "next/link";

import type { ErisData, RoleAnalysis } from "@/lib/dashboard/types";
import { roleLabel } from "@/components/dashboard/widgets/labels";
import { ALIGNMENT_TEXT } from "@/lib/roadmap/view";

/**
 * Where you stand for your goal: the engine's rule-based alignment state (career_engine.alignment), never a
 * readiness score or percentage, which would read as a hiring probability. Renders precomputed data; computes nothing.
 */
export function ErisWidget({ data, roles }: { data: ErisData; roles: RoleAnalysis[] }) {
  const primary = roles.find((r) => r.role === data.role) ?? roles[0];
  const alignment = primary?.alignment;
  const others = roles.filter((r) => r !== primary && r.alignment);

  return (
    <div className="space-y-5">
      <div>
        {alignment && primary?.assessed ? (
          <>
            <p className="text-xl font-bold tracking-tight text-foreground" data-testid="alignment-state" data-state={alignment.state}>
              {alignment.label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              for {roleLabel(primary.role)}: {ALIGNMENT_TEXT[alignment.state]}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {alignment.requiredMet} of {alignment.required} required skills shown at the expected level.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Not enough evidence to assess yet. Add your resume or connect GitHub.</p>
        )}
      </div>

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
                  <span className="text-xs text-muted-foreground">{g.level && g.level !== "Not assessed" ? `${g.level}, needs ${g.expectedLevel ?? "more"}` : "No proof yet"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {others.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Also tracking:{" "}
          {others.map((r, i) => (
            <span key={r.role}>
              {i > 0 && ", "}
              {roleLabel(r.role)} ({r.alignment!.label.toLowerCase()})
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
