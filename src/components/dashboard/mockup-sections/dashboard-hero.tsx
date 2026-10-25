"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

interface DashboardHeroProps {
  name: string;
  line?: string;
  updated?: string;
  onOpenYora?: () => void;
}

export function DashboardHero({ name, line, updated, onOpenYora }: DashboardHeroProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E7EAF3] bg-gradient-to-r from-white via-[#FFF7F9] to-[#F8F5FF] p-4.5 sm:p-6 lg:p-7 shadow-xs">
      {/* Subtle ambient light effects without visual clutter */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full bg-gradient-to-br from-[#FF496D]/10 to-[#8554FF]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-8 left-1/4 h-36 w-36 rounded-full bg-[#19C58A]/10 blur-2xl" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 sm:gap-6">
        {/* Left greeting, direction, and primary action */}
        <div className="max-w-xl">
          <h1 className="editorial-title text-2xl sm:text-3xl lg:text-[2.25rem] text-[#11182B] tracking-tight leading-[1.2] break-words">
            Good to see you,{" "}
            <span className="bg-gradient-to-r from-[#FF496D] to-[#FF713D] bg-clip-text text-transparent font-normal italic">
              {name}.
            </span>
          </h1>
          <p className="mt-2 text-sm sm:text-[15px] font-medium text-[#64748B] leading-relaxed">
            Your intelligence workspace connects verified skills, projects, and career opportunities.{" "}
            <span className="text-[#FF496D] font-semibold">Tathastu.</span>
          </p>

          {line && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-purple-200/60 bg-purple-50/70 px-3 py-1 text-xs font-semibold text-[#8554FF]">
              <span className="size-2 rounded-full bg-[#19C58A] animate-pulse" />
              <span className="truncate max-w-[calc(100vw-5rem)] sm:max-w-none">{line}</span>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-3 pt-1">
            <Link
              href="/opportunities"
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF496D] to-[#FF713D] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95 active:scale-95 transition-all touch-manipulation"
            >
              <span>Explore Opportunities</span>
              <ArrowRight className="size-3.5" />
            </Link>
            {updated && (
              <span className="text-[11px] font-medium text-[#64748B]">
                {updated}
              </span>
            )}
          </div>
        </div>

        {/* Center/Right Yora visual & speech card */}
        <div className="flex flex-row items-center gap-3.5 sm:gap-4 lg:gap-5 w-full lg:w-auto self-start lg:self-center shrink-0 pt-2 lg:pt-0 border-t border-slate-100/80 lg:border-t-0">
          {/* Yora character avatar */}
          <div className="relative size-14 sm:size-20 lg:size-24 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-white/90 shadow-xs">
            <Image
              src="/brand/yora-hero-waving.jpg"
              alt="Yora AI Assistant"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 56px, 96px"
              priority
            />
          </div>

          {/* Message card from Yora */}
          <button
            type="button"
            onClick={onOpenYora}
            className="group relative flex-1 lg:w-72 lg:flex-initial rounded-2xl border border-white/95 bg-white/90 p-3 sm:p-4 text-left shadow-xs backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#8554FF]/40 touch-manipulation"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex size-5 sm:size-5.5 items-center justify-center rounded-full bg-gradient-to-tr from-[#8554FF] to-[#FF496D] text-white">
                  <Sparkles className="size-2.5 sm:size-3" />
                </div>
                <span className="font-sans text-xs font-bold text-[#11182B]">Yora Insight</span>
              </div>
              <span className="rounded-full bg-[#8554FF]/10 px-2 py-0.5 text-[10px] font-bold text-[#8554FF] transition-colors group-hover:bg-[#8554FF] group-hover:text-white">
                Chat
              </span>
            </div>
            <p className="mt-1.5 sm:mt-2 text-xs font-medium text-[#4A5568] leading-relaxed line-clamp-2 sm:line-clamp-none">
              Your profile signals are strong! Click here to ask about roadmap milestones, skill gaps, or interview readiness.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
