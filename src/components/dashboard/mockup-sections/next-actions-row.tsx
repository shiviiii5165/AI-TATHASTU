"use client";

import Image from "next/image";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";

interface NextActionItem {
  num: number;
  title: string;
  desc: string;
  btnText: string;
  btnHref: string;
  category?: string;
}

interface NextActionsRowProps {
  actions?: NextActionItem[];
  onOpenYora?: () => void;
}

const FALLBACK_ACTIONS = [
  {
    num: 1,
    title: "Complete your profile",
    desc: "Confirm extracted milestones and degrees to increase verification score.",
    btnText: "Review Profile →",
    btnHref: "/profile",
  },
  {
    num: 2,
    title: "Connect GitHub",
    desc: "Sync repositories to calculate your verified AI Impact Score.",
    btnText: "Sync Code →",
    btnHref: "/projects",
  },
  {
    num: 3,
    title: "Explore Learning Paths",
    desc: "Target high-demand skill gaps with curated AI curricula.",
    btnText: "Browse Paths →",
    btnHref: "/learning",
  },
  {
    num: 4,
    title: "Expand Peer Network",
    desc: "Connect with verified researchers and students with matching interests.",
    btnText: "Find Peers →",
    btnHref: "/people",
  },
  {
    num: 5,
    title: "Benchmark Your Skills",
    desc: "Take domain quizzes and problem-solving benchmarks.",
    btnText: "Start Assessment →",
    btnHref: "/skills",
  },
];

export function NextActionsRow({ actions: dynamicActions, onOpenYora }: NextActionsRowProps) {
  const sourceActions =
    dynamicActions && dynamicActions.length > 0 ? dynamicActions : FALLBACK_ACTIONS;

  const actions = sourceActions.slice(0, 5).map((a, idx) => {
    const numBg =
      idx === 0 || idx === 1
        ? "bg-[#2878F0] text-white"
        : idx === 2
        ? "bg-[#8554FF] text-white"
        : idx === 3
        ? "bg-[#19C58A] text-white"
        : "bg-[#FF496D] text-white";
    const btnColor =
      idx === 0 || idx === 1
        ? "text-[#2878F0] hover:text-[#1A5DC2]"
        : idx === 2
        ? "text-[#8554FF] hover:text-[#6533ED]"
        : idx === 3
        ? "text-[#19C58A] hover:text-[#0E9D6D]"
        : "text-[#FF496D] hover:text-[#E0264E]";
    return {
      num: a.num || idx + 1,
      title: a.title,
      desc: a.desc,
      btnText: a.btnText || "Start →",
      btnHref: a.btnHref || "/dashboard",
      numBg,
      btnColor,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Your Next 5 Actions (8 columns on lg) */}
      <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-5 shadow-2xs lg:col-span-8">
        <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[#EDF5FF] text-[#2878F0]">
              <CheckCircle2 className="size-4" />
            </div>
            <h2 className="font-sans text-sm font-bold text-[#11182B]">Your Next 5 Actions</h2>
          </div>
          <span className="text-[11px] font-semibold text-[#8554FF]">Recommended Flow</span>
        </div>

        {/* 5 action cards horizontally distributed */}
        <div className="my-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          {actions.map((act) => (
            <div
              key={act.num}
              className="flex flex-col justify-between rounded-xl border border-[#F0F2F7] bg-[#FAFBFC] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#8554FF]/40 hover:bg-white hover:shadow-2xs"
            >
              <div>
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${act.numBg}`}
                >
                  {act.num}
                </div>
                <p className="mt-2 text-xs font-bold text-[#11182B] leading-snug line-clamp-2" title={act.title}>
                  {act.title}
                </p>
                <p className="mt-1 line-clamp-2 text-[10px] text-[#617493]">{act.desc}</p>
              </div>
              <div className="mt-3 pt-1">
                <Link
                  href={act.btnHref}
                  className={`inline-flex items-center text-[11px] font-bold transition-transform hover:translate-x-0.5 ${act.btnColor}`}
                >
                  {act.btnText}
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
          <span>Priority queue based on career readiness</span>
          <span className="font-medium text-[#19C58A]">{actions.length} Actions Ready</span>
        </div>
      </div>

      {/* Ask Yora Assistant Card (4 columns on lg) */}
      <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#7A4BFF] via-[#6533ED] to-[#4F1CD9] p-5 text-white shadow-sm lg:col-span-4">
        {/* Subtle decorative glow & stars */}
        <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-xl" />
        <div className="pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-[#FF496D]/20 blur-xl" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur-xs">
              <Sparkles className="size-4 text-white" />
            </div>
            <h2 className="font-sans text-sm font-bold text-white">Ask Yora Assistant</h2>
          </div>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-xs">
            Always Active
          </span>
        </div>

        {/* Center avatar & speech prompt */}
        <div className="relative z-10 my-3 flex items-center gap-3.5">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 border-white/40 shadow-xs">
            <Image
              src="/brand/yora-avatar.jpg"
              alt="Yora Assistant"
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
          <div className="min-w-0">
            <p className="font-sans text-xs font-bold text-white">Need career guidance?</p>
            <p className="mt-0.5 text-[11px] font-medium text-white/80 line-clamp-2 leading-relaxed">
              Ask about your roadmap, skill gaps, or matched opportunities.
            </p>
          </div>
        </div>

        {/* Action input trigger button */}
        <div className="relative z-10 pt-1">
          <button
            type="button"
            onClick={onOpenYora}
            className="flex w-full items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-xs font-bold text-[#6533ED] shadow-xs transition-all hover:bg-white/95 hover:shadow-md cursor-pointer"
          >
            <span>Ask Yora a question…</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
