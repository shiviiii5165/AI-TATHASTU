"use client";

import { ArrowRight, Compass } from "lucide-react";
import Link from "next/link";

import type { JourneyMilestone } from "@/lib/dashboard/journey";

const VISIBLE = 6;

/** Newest first, from the user's own confirmed records. Nothing here is filled in or estimated. */
export function JourneyTimeline({ milestones = [] }: { milestones?: JourneyMilestone[] }) {
  const items = [...milestones].reverse();
  const undated = items.filter((m) => !m.when && !m.current);
  const dated = items.filter((m) => m.when || m.current);
  const visible = [...dated, ...undated].slice(0, VISIBLE);
  const hidden = items.length - visible.length;

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground">
            <Compass aria-hidden className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-foreground">Your Journey</h2>
        </div>
        <Link href="/profile" className="group inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <span>View profile</span>
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>

      {visible.length > 0 ? (
        <ol className="mt-3 flex-1 space-y-3 border-l border-border pl-4" aria-label="Your education, work and achievements, newest first">
          {visible.map((item, index) => (
            <li key={`${item.title}-${index}`} className="relative">
              <span
                aria-hidden
                className={`absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card ${item.current ? "bg-primary" : "bg-muted-foreground"}`}
              />
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 truncate text-xs font-semibold text-foreground" title={item.title}>
                  {item.title}
                </p>
                <span className="shrink-0 text-[11px] text-muted-foreground">{item.current ? "Current" : item.when ?? "No date"}</span>
              </div>
              {item.detail && (
                <p className="truncate text-[11px] text-muted-foreground" title={item.detail}>
                  {item.detail}
                </p>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
          <p className="text-xs font-semibold text-foreground">Nothing on your timeline yet</p>
          <p className="mt-1 max-w-xs text-[11px] text-muted-foreground">Confirm your resume to add your education and work here.</p>
          <Link href="/onboarding/resume" className="mt-3 text-xs font-semibold text-primary hover:underline">
            Add your resume
          </Link>
        </div>
      )}

      {hidden > 0 && (
        <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">
          And {hidden} more on your{" "}
          <Link href="/profile" className="font-semibold text-primary hover:underline">
            profile
          </Link>
        </p>
      )}
    </div>
  );
}
