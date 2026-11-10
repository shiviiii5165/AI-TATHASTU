"use client";

import { ArrowRight, BookOpen, Briefcase, Compass, FolderGit2, GraduationCap, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { journeyView, type JourneyMilestone } from "@/lib/dashboard/journey";

/**
 * Your Journey: the user's own confirmed records as a chronological path, oldest first, ending on where they
 * are now. Each kind of record has its own light colour and icon. Exactly one record, the most relevant ongoing
 * one (lib/dashboard/journey.ts primaryCurrentIndex), is marked "Where you are now"; other ongoing records say
 * "Ongoing". Dated achievements sit on the path; undated ones are grouped compactly below it, never placed at a
 * guessed point in time. The path draws in order once; reduced motion shows the finished state.
 */
export const KIND_STYLE: Record<JourneyMilestone["kind"], { label: string; icon: LucideIcon; hex: string; soft: string; chip: string }> = {
  education: { label: "Education", icon: GraduationCap, hex: "#38bdf8", soft: "#e0f2fe", chip: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  experience: { label: "Experience", icon: Briefcase, hex: "#a78bfa", soft: "#ede9fe", chip: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  project: { label: "Project", icon: FolderGit2, hex: "#2dd4bf", soft: "#ccfbf1", chip: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  achievement: { label: "Achievement", icon: Trophy, hex: "#fbbf24", soft: "#fef3c7", chip: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  publication: { label: "Publication", icon: BookOpen, hex: "#f472b6", soft: "#fce7f3", chip: "bg-pink-50 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300" },
};

/** Timing of the sequential reveal, exported so tests can check the order is the chronological one. */
export const SEGMENT_MS = 260;
export const STEP_MS = 480;
export function journeyDelays(index: number) {
  // Node appears, then its segment draws, finishing before the next node appears.
  return { node: index * STEP_MS, text: index * STEP_MS + 80, segment: index * STEP_MS + 200 };
}

export function JourneyTimeline({ milestones = [] }: { milestones?: JourneyMilestone[] }) {
  const view = useMemo(() => journeyView(milestones), [milestones]);
  const undated = [...view.undatedAchievements, ...view.undatedOther];
  const empty = view.timeline.length === 0 && undated.length === 0;

  return (
    <section className="relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5" data-testid="journey-timeline">
      <div className="relative flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
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
                <Milestone key={`${item.kind}-${item.title}-${index}`} item={item} index={index} next={view.timeline[index + 1]} primary={index === view.primaryIndex} />
              ))}
            </ol>
          )}

          {view.undatedOther.length > 0 && <UndatedGroup title="Other records without a date" items={view.undatedOther} testId="undated-other" />}
          {view.hiddenUndated > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              And {view.hiddenUndated} more on your{" "}
              <Link href="/profile" className="font-semibold text-primary hover:underline">
                profile
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}

function UndatedGroup({ title, items, testId }: { title: string; items: JourneyMilestone[]; testId: string }) {
  return (
    <div className="relative mt-4 border-t border-border pt-3" data-testid={testId}>
      <p className="mb-2 text-[11px] font-semibold text-muted-foreground">{title}</p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label={title}>
        {items.map((item, i) => {
          const k = KIND_STYLE[item.kind];
          const Icon = k.icon;
          return (
            <li key={`${item.title}-${i}`} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 px-2.5 py-2" style={{ background: `${k.soft}80` }}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card" style={{ color: k.hex, boxShadow: `inset 0 0 0 1.5px ${k.hex}66` }}>
                <Icon aria-hidden className="size-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-foreground" title={item.title}>
                  {item.title}
                </span>
                <span className="block truncate text-[10px] text-muted-foreground" title={item.detail || k.label}>
                  {item.detail || k.label}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Milestone({ item, index, next, primary }: { item: JourneyMilestone; index: number; next?: JourneyMilestone; primary: boolean }) {
  const k = KIND_STYLE[item.kind];
  const Icon = k.icon;
  const d = journeyDelays(index);

  return (
    <li className="relative grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2 pb-4 last:pb-0" data-kind={item.kind} data-current={item.current || undefined} data-primary={primary || undefined}>
      {next && (
        <span
          aria-hidden
          data-testid="journey-segment"
          className="absolute left-[1.125rem] top-8 bottom-0 w-[2px] origin-top -translate-x-1/2 rounded-full opacity-60 motion-safe:animate-[journeySegment_var(--seg-ms)_ease-in_both] motion-reduce:animate-none"
          style={{ background: `linear-gradient(to bottom, ${k.hex}, ${KIND_STYLE[next.kind].hex})`, animationDelay: `${d.segment}ms`, ["--seg-ms" as string]: `${SEGMENT_MS}ms` }}
        />
      )}
      <div className="relative flex justify-center pt-0.5">
        <span
          data-testid="journey-node"
          style={{ animationDelay: `${d.node}ms`, background: primary ? k.hex : k.soft, color: primary ? "#fff" : k.hex, boxShadow: primary ? `0 0 0 4px ${k.soft}` : `inset 0 0 0 1.5px ${k.hex}55` }}
          className={`relative z-10 flex items-center justify-center rounded-full ring-2 ring-card ${primary ? "size-8" : "size-7"} motion-safe:animate-[journeyNode_360ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none`}
        >
          <Icon aria-hidden className={primary ? "size-4" : "size-3.5"} />
        </span>
      </div>

      <div
        style={{ animationDelay: `${d.text}ms`, ...(primary ? { background: `${k.soft}66`, borderColor: `${k.hex}55` } : {}) }}
        className={`min-w-0 motion-safe:animate-[journeyText_320ms_ease-out_both] motion-reduce:animate-none ${primary ? "rounded-xl border px-2.5 py-2" : "pt-1"}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={`rounded px-1.5 py-px text-[10px] font-semibold ${k.chip}`}>{k.label}</span>
          {!primary && item.current && <span className="text-[10px] font-medium text-muted-foreground">Ongoing</span>}
          <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">{item.when ?? (item.current ? "Ongoing" : "")}</span>
        </div>
        <p className={`mt-0.5 truncate font-semibold text-foreground ${primary ? "text-sm" : "text-xs"}`} title={item.title}>
          {item.title}
        </p>
        {item.detail && (
          <p className="truncate text-[11px] text-muted-foreground" title={item.detail}>
            {item.detail}
          </p>
        )}
      </div>
    </li>
  );
}
