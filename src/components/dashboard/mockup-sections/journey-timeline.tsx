"use client";

import { ArrowRight, BookOpen, Briefcase, CalendarOff, Compass, FolderGit2, GraduationCap, MapPin, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { journeyView, type JourneyMilestone } from "@/lib/dashboard/journey";

/**
 * Your Journey: the user's own confirmed records as a chronological path, oldest first, ending on where
 * they are now. Each kind of record has its own colour and icon. The path draws itself segment by segment
 * in that real order, lighting each milestone as it arrives; reduced motion shows the finished state.
 * Nothing is filled in: undated records sit apart instead of at a guessed point in time.
 */
export const KIND_STYLE: Record<JourneyMilestone["kind"], { label: string; icon: LucideIcon; hex: string; node: string; chip: string; tint: string }> = {
  education: {
    label: "Education",
    icon: GraduationCap,
    hex: "#3b82f6",
    node: "from-blue-500 to-indigo-500 shadow-blue-500/40",
    chip: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    tint: "from-blue-50/80 dark:from-blue-500/10",
  },
  experience: {
    label: "Experience",
    icon: Briefcase,
    hex: "#8b5cf6",
    node: "from-violet-500 to-fuchsia-500 shadow-violet-500/40",
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    tint: "from-violet-50/80 dark:from-violet-500/10",
  },
  project: {
    label: "Project",
    icon: FolderGit2,
    hex: "#14b8a6",
    node: "from-teal-500 to-emerald-500 shadow-teal-500/40",
    chip: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    tint: "from-teal-50/80 dark:from-teal-500/10",
  },
  achievement: {
    label: "Achievement",
    icon: Trophy,
    hex: "#f59e0b",
    node: "from-amber-400 to-orange-500 shadow-amber-500/40",
    chip: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    tint: "from-amber-50/80 dark:from-amber-500/10",
  },
  publication: {
    label: "Publication",
    icon: BookOpen,
    hex: "#ec4899",
    node: "from-pink-500 to-rose-500 shadow-pink-500/40",
    chip: "bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300",
    tint: "from-pink-50/80 dark:from-pink-500/10",
  },
};

/** Timing of the sequential reveal, exported so tests can check the order is the chronological one. */
export const SEGMENT_MS = 260;
export const STEP_MS = 480;
export function journeyDelays(index: number) {
  // Node lights, then its segment draws, finishing before the next node lights.
  return { node: index * STEP_MS, text: index * STEP_MS + 80, segment: index * STEP_MS + 200 };
}

export function JourneyTimeline({ milestones = [] }: { milestones?: JourneyMilestone[] }) {
  const view = useMemo(() => journeyView(milestones), [milestones]);
  const kinds = useMemo(() => [...new Set([...view.timeline, ...view.undated].map((m) => m.kind))], [view]);
  const empty = view.timeline.length === 0 && view.undated.length === 0;

  return (
    <section className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5" data-testid="journey-timeline">
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-gradient-to-br from-blue-400/15 via-violet-400/10 to-pink-400/10 blur-2xl" />
      <div className="relative flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 via-violet-500 to-pink-500 text-white shadow-sm shadow-violet-500/30">
            <Compass aria-hidden className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-foreground">Your Journey</h2>
        </div>
        <Link href="/profile" className="group inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <span>View profile</span>
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>

      {empty ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div aria-hidden className="mb-3 flex items-center gap-1.5">
            {(Object.keys(KIND_STYLE) as JourneyMilestone["kind"][]).map((k, i) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full opacity-40" style={{ background: KIND_STYLE[k].hex }} />
                {i < 4 && <span className="h-px w-4 bg-border" />}
              </span>
            ))}
          </div>
          <p className="text-xs font-semibold text-foreground">Nothing on your timeline yet</p>
          <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">Your journey is drawn from your confirmed education, work, projects and achievements. Confirm your resume to start it.</p>
          <Link href="/onboarding/resume" className="mt-3 text-xs font-semibold text-primary hover:underline">
            Add your resume
          </Link>
        </div>
      ) : (
        <>
          {view.earlier > 0 && (
            <p className="relative mt-3 pl-11 text-[11px] text-muted-foreground">
              {view.earlier} earlier {view.earlier === 1 ? "milestone" : "milestones"} on your{" "}
              <Link href="/profile" className="font-semibold text-primary hover:underline">
                profile
              </Link>
            </p>
          )}
          {view.timeline.length > 0 && (
            <ol className="relative mt-3" aria-label="Your journey, from earliest to most recent">
              {view.timeline.map((item, index) => (
                <Milestone key={`${item.kind}-${item.title}-${index}`} item={item} index={index} next={view.timeline[index + 1]} />
              ))}
            </ol>
          )}

          {view.undated.length > 0 && (
            <div className="relative mt-3 border-t border-dashed border-border pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <CalendarOff aria-hidden className="size-3" />
                No date on the record, so not placed on the path
              </p>
              <ul className="space-y-1.5">
                {view.undated.map((item, i) => {
                  const k = KIND_STYLE[item.kind];
                  const Icon = k.icon;
                  return (
                    <li key={`${item.title}-${i}`} className="flex min-w-0 items-center gap-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed bg-card" style={{ borderColor: k.hex, color: k.hex }}>
                        <Icon aria-hidden className="size-3" />
                      </span>
                      <span className="min-w-0 truncate text-xs font-medium text-foreground" title={item.title}>
                        {item.title}
                      </span>
                      <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${k.chip}`}>{k.label}</span>
                    </li>
                  );
                })}
              </ul>
              {view.hiddenUndated > 0 && <p className="mt-1.5 text-[11px] text-muted-foreground">And {view.hiddenUndated} more on your profile</p>}
            </div>
          )}

          <div className="relative mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground" aria-label="Legend">
            {kinds.map((k) => (
              <span key={k} className="flex items-center gap-1">
                <span aria-hidden className="size-2 rounded-full" style={{ background: KIND_STYLE[k].hex }} />
                {KIND_STYLE[k].label}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Milestone({ item, index, next }: { item: JourneyMilestone; index: number; next?: JourneyMilestone }) {
  const k = KIND_STYLE[item.kind];
  const Icon = k.icon;
  const d = journeyDelays(index);
  const nodeSize = item.current ? "size-9" : "size-7";

  return (
    <li className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 pb-4 last:pb-0" data-kind={item.kind} data-current={item.current || undefined}>
      {/* Rail: the segment from this milestone to the next, coloured from one to the other. */}
      {next && (
        <span
          aria-hidden
          data-testid="journey-segment"
          className="absolute left-[1.125rem] top-8 bottom-0 w-[3px] origin-top -translate-x-1/2 rounded-full motion-safe:animate-[journeySegment_var(--seg-ms)_ease-in_both] motion-reduce:animate-none"
          style={{ background: `linear-gradient(to bottom, ${k.hex}, ${KIND_STYLE[next.kind].hex})`, animationDelay: `${d.segment}ms`, ["--seg-ms" as string]: `${SEGMENT_MS}ms` }}
        />
      )}
      <div className="relative flex justify-center pt-0.5">
        {item.current && <span aria-hidden className="motion-pulse-ring absolute top-0.5 size-9 rounded-full motion-reduce:hidden" style={{ boxShadow: `0 0 0 4px ${k.hex}33` }} />}
        <span
          data-testid="journey-node"
          style={{ animationDelay: `${d.node}ms` }}
          className={`relative z-10 flex ${nodeSize} items-center justify-center rounded-full bg-gradient-to-br text-white shadow-md ring-[3px] ring-card ${k.node} motion-safe:animate-[journeyNode_360ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none`}
        >
          <Icon aria-hidden className={item.current ? "size-4" : "size-3.5"} />
        </span>
      </div>

      <div
        style={{ animationDelay: `${d.text}ms` }}
        className={`min-w-0 rounded-xl motion-safe:animate-[journeyText_320ms_ease-out_both] motion-reduce:animate-none ${item.current ? `border border-border bg-gradient-to-r to-transparent px-2.5 py-2 ${k.tint}` : "pt-1"}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${k.chip}`}>{k.label}</span>
          {item.current && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-foreground px-1.5 py-px text-[10px] font-semibold text-background">
              <MapPin aria-hidden className="size-2.5" />
              Where you are now
            </span>
          )}
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{item.when ?? (item.current ? "Ongoing" : "")}</span>
        </div>
        <p className={`mt-0.5 truncate font-semibold text-foreground ${item.current ? "text-sm" : "text-xs"}`} title={item.title}>
          {item.title}
        </p>
        {item.detail && (
          <p className="truncate text-[11px] text-muted-foreground" title={item.detail}>
            {item.detail}
          </p>
        )}
        <span className="sr-only">{item.current ? "Current." : ""}</span>
      </div>
    </li>
  );
}
