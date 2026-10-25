"use client";

import { ArrowRight, Compass, FileUp, Sparkles } from "lucide-react";
import Link from "next/link";

export interface JourneyMilestoneItem {
  title: string;
  year: string;
  field: string;
  active?: boolean;
}

interface JourneyTimelineProps {
  milestones?: JourneyMilestoneItem[];
}

export function JourneyTimeline({ milestones }: JourneyTimelineProps) {
  const hasData = milestones && milestones.length > 0;
  const items = hasData
    ? milestones.slice(0, 4)
    : [];

  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      {/* Soft decorative sphere in bottom left matching mockup */}
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-gradient-to-tr from-[#FF496D]/30 via-[#FF713D]/20 to-transparent blur-xl" />

      {/* Card Header */}
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#EDF5FF] text-[#2878F0]">
            <Compass className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Your Journey</h2>
        </div>
        <Link
          href="/profile"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View Timeline</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Milestones: Mobile Vertical Timeline vs Desktop Horizontal Pipeline */}
      {items.length > 0 ? (
        <div className="my-auto py-3 sm:py-5">
          {/* Mobile Vertical View (sm:hidden) */}
          <div className="relative pl-6 space-y-4 sm:hidden">
            {/* Vertical continuous line */}
            <div className="absolute top-2 bottom-2 left-2.5 w-0.5 bg-[#E2E8F0]" />

            {items.map((item, idx) => (
              <div key={idx} className="relative flex items-start gap-3">
                {/* Node indicator */}
                <div
                  className={`absolute -left-6 top-0.5 z-10 flex size-5.5 items-center justify-center rounded-full border-2 bg-white ${
                    item.active
                      ? "border-[#19C58A] shadow-xs"
                      : "border-[#2878F0] shadow-2xs"
                  }`}
                >
                  <div
                    className={`size-2 rounded-full ${
                      item.active ? "bg-[#19C58A] ring-2 ring-[#19C58A]/30 animate-pulse" : "bg-[#2878F0]"
                    }`}
                  />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-sans text-xs font-bold text-[#11182B] truncate" title={item.title}>
                      {item.title}
                    </p>
                    <span className="font-mono text-[10px] font-bold text-[#64748B] bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                      {item.year}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#8C9AA8] font-medium truncate mt-0.5" title={item.field}>
                    {item.field}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet & Desktop Horizontal Pipeline (hidden sm:block) */}
          <div className="relative hidden sm:block">
            {/* Continuous horizontal connecting line */}
            <div className="absolute top-[26px] left-6 right-6 h-0.5 bg-[#E2E8F0]" />

            <div
              className="relative grid gap-2"
              style={{
                gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
              }}
            >
              {items.map((item, idx) => (
                <div key={idx} className="flex flex-col items-center text-center">
                  {/* Node indicator */}
                  <div
                    className={`relative z-10 flex size-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110 ${
                      item.active
                        ? "border-[#19C58A] bg-white shadow-xs"
                        : "border-[#2878F0] bg-white shadow-2xs"
                    }`}
                  >
                    <div
                      className={`size-2.5 rounded-full ${
                        item.active ? "bg-[#19C58A] ring-2 ring-[#19C58A]/30 animate-pulse" : "bg-[#2878F0]"
                      }`}
                    />
                  </div>

                  {/* Title & metadata */}
                  <div className="mt-2.5 max-w-[110px]">
                    <p className="font-sans text-xs font-bold text-[#11182B] truncate" title={item.title}>
                      {item.title}
                    </p>
                    <p className="text-[11px] font-medium text-[#64748B] truncate">{item.year}</p>
                    <p className="text-[10px] text-[#8C9AA8] font-mono truncate" title={item.field}>
                      {item.field}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="my-auto py-4 px-2 text-center flex flex-col items-center justify-center">
          <div className="size-10 rounded-full bg-[#EDF5FF] text-[#2878F0] flex items-center justify-center mb-2.5">
            <FileUp className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No milestones extracted yet</p>
          <p className="text-[11px] text-[#617493] max-w-xs mt-1">
            Upload your resume to automatically generate your verified academic & career journey timeline.
          </p>
          <Link
            href="/onboarding/resume"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2878F0] text-white text-xs font-semibold hover:bg-[#2063CC] transition-colors"
          >
            <Sparkles className="size-3" />
            <span>Upload Resume</span>
          </Link>
        </div>
      )}

      {/* Footer subtle tip */}
      <div className="pt-2 text-[11px] text-[#617493] flex items-center justify-between">
        <span className="font-medium text-[#11182B]">Academic & Professional Track</span>
        <span className="rounded-md bg-[#EDF5FF] px-2 py-0.5 text-[10px] font-bold text-[#2878F0]">
          {hasData ? "Verified" : "Syncing"}
        </span>
      </div>
    </div>
  );
}
