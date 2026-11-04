import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { importance, roleLabel } from "@/components/dashboard/widgets/labels";
import type { GapState, SkillGap, SkillGapsData } from "@/lib/dashboard/types";

const MAX_ROWS = 6;

const STATE_NOTE: Record<GapState, string> = {
  met: "At expected level",
  underdeveloped: "Below the expected level",
  unverified: "Listed, not shown yet",
  inferred: "Only suggested by related skills",
  missing: "No evidence yet",
  not_assessed: "Not assessed",
};

/**
 * The skills the career engine says are short of this role's expected level, in its order: the
 * same rows the Skill Gaps card shows. The view carries the top 3, the ERIS breakdown all of them.
 */
export function SkillGapsWidget({ data, breakdown }: { data: SkillGapsData; breakdown: Record<string, unknown> | undefined }) {
  const all = ((breakdown as { skills?: SkillGap[] } | undefined)?.skills ?? data.gaps).filter((s) => s.state !== "met");
  const shown = all.slice(0, MAX_ROWS);

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        For {roleLabel(data.role)}: {all.length} {all.length === 1 ? "skill" : "skills"} missing or thin on your profile.
      </p>
      <ul className="mt-4 divide-y">
        {shown.map((s) => (
          <li key={s.skill} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{s.skill}</p>
              <p className="text-xs text-muted-foreground">
                {importance(s.weight)} · {s.state ? STATE_NOTE[s.state] : "Not assessed"}
              </p>
            </div>
            {s.readiness !== null && (
              <div
                role="meter"
                aria-label={`${s.skill} proficiency`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(s.readiness * 100)}
                className="h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full origin-left bg-foreground" style={{ transform: `scaleX(${s.readiness})` }} />
              </div>
            )}
            <Link
              href={`/learn?skill=${encodeURIComponent(s.skill)}`}
              aria-label={`Learn ${s.skill}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ArrowUpRight aria-hidden className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
      {all.length > shown.length && (
        <p className="mt-2 text-xs text-muted-foreground">+{all.length - shown.length} more on the Skills page</p>
      )}
    </div>
  );
}
