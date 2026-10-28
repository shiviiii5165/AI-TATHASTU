"use client";

import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  GitFork,
  GraduationCap,
  GripVertical,
  ListOrdered,
  Rocket,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";

import { savePriorities } from "@/app/onboarding/actions";
import { ContinueForm } from "@/components/onboarding/continue-form";
import { SaveStatusText } from "@/components/onboarding/save-status";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/use-autosave";
import { MAX_PRIORITIES, PRIORITIES } from "@/lib/onboarding/catalog";
import { cn } from "@/lib/utils";

const byId = (id: string) => PRIORITIES.find((p) => p.id === id)!;

const PRIORITY_THEMES: Record<
  string,
  {
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    badgeStyle: string;
  }
> = {
  learn_ai_ml: {
    icon: GraduationCap,
    iconBg: "bg-indigo-50 border-indigo-100",
    iconColor: "text-indigo-600",
    badgeStyle: "bg-indigo-50/80 text-indigo-700 border-indigo-200/60",
  },
  avasar_jobs: {
    icon: Briefcase,
    iconBg: "bg-sky-50 border-sky-100",
    iconColor: "text-sky-600",
    badgeStyle: "bg-sky-50/80 text-sky-700 border-sky-200/60",
  },
  people_mentors: {
    icon: Users,
    iconBg: "bg-emerald-50 border-emerald-100",
    iconColor: "text-emerald-600",
    badgeStyle: "bg-emerald-50/80 text-emerald-700 border-emerald-200/60",
  },
  collaborate: {
    icon: GitFork,
    iconBg: "bg-amber-50 border-amber-100",
    iconColor: "text-amber-600",
    badgeStyle: "bg-amber-50/80 text-amber-700 border-amber-200/60",
  },
  build_projects: {
    icon: Rocket,
    iconBg: "bg-rose-50 border-rose-100",
    iconColor: "text-[#FF2A85]",
    badgeStyle: "bg-rose-50/80 text-[#FF2A85] border-rose-200/60",
  },
  research_events: {
    icon: Trophy,
    iconBg: "bg-purple-50 border-purple-100",
    iconColor: "text-purple-600",
    badgeStyle: "bg-purple-50/80 text-purple-700 border-purple-200/60",
  },
};

export function PrioritiesForm({ initialPriorities }: { initialPriorities: string[] }) {
  const [ranked, setRanked] = useState<string[]>(initialPriorities);
  const [announcement, setAnnouncement] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const { status, error, save, retry } = useAutosave(savePriorities);

  const isFull = ranked.length >= MAX_PRIORITIES;

  function commit(next: string[], message: string) {
    setRanked(next);
    setAnnouncement(message);
    void save(next);
  }

  function toggle(id: string) {
    const { label } = byId(id);
    if (ranked.includes(id)) {
      commit(
        ranked.filter((p) => p !== id),
        `${label} removed.`
      );
    } else if (!isFull) {
      commit([...ranked, id], `${label} added at position ${ranked.length + 1}.`);
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= ranked.length || from === to) return;
    const next = [...ranked];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next, `${byId(item).label} moved to position ${to + 1}.`);
  }

  return (
    <>
      <div className="mt-6 sm:mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem] xl:grid-cols-[minmax(0,1.3fr)_20rem]">
        {/* Left: Priority Options Cards */}
        <section aria-labelledby="priority-options">
          <h2 id="priority-options" className="sr-only">
            Priority Options
          </h2>

          <ul className="grid gap-3.5" aria-label="Priorities options">
            {PRIORITIES.map((p) => {
              const rank = ranked.indexOf(p.id);
              const isSelected = rank !== -1;
              const isBlocked = !isSelected && isFull;
              const theme = PRIORITY_THEMES[p.id] ?? {
                icon: GraduationCap,
                iconBg: "bg-slate-50 border-slate-100",
                iconColor: "text-slate-600",
                badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
              };
              const Icon = theme.icon;

              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={isBlocked}
                    aria-describedby={isBlocked ? "priorities-full" : undefined}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "group relative flex w-full items-center justify-between gap-4 rounded-2xl bg-white p-4.5 sm:p-5 text-left transition-all duration-200 cursor-pointer touch-manipulation",
                      "hover:border-slate-300 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2A85] active:scale-[0.99]",
                      "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-slate-50/50 disabled:opacity-50 disabled:hover:border-slate-200 disabled:active:scale-100",
                      isSelected
                        ? "border-2 border-[#FF2A85] bg-rose-50/15 shadow-xs ring-1 ring-[#FF2A85]/20"
                        : "border border-slate-200/90"
                    )}
                  >
                    {/* Left: Stylish Icon Badge */}
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl border transition-transform duration-150 group-hover:scale-105",
                        theme.iconBg,
                        theme.iconColor
                      )}
                    >
                      <Icon className="size-5.5 stroke-[1.8]" />
                    </div>

                    {/* Middle: Title, Tag, and Subtitle */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-sans text-sm sm:text-base font-bold text-[#0F172A]">
                          {p.label}
                        </span>
                        <span className={cn("rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] font-bold uppercase", theme.badgeStyle)}>
                          {p.module}
                        </span>
                      </div>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                        {p.blurb}
                      </span>
                    </div>

                    {/* Right: Circular Selection / Rank Indicator */}
                    <div className="shrink-0 flex items-center justify-center">
                      {isSelected ? (
                        <span
                          aria-hidden="true"
                          className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6B4A] to-[#FF2A85] text-white font-mono text-xs font-bold shadow-xs"
                        >
                          {rank + 1}
                        </span>
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex size-5 rounded-full border border-slate-300 bg-white transition-colors group-hover:border-slate-400"
                        />
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          <p id="priorities-full" className={cn("mt-4 text-xs font-medium text-slate-500", !isFull && "invisible")}>
            You&apos;ve selected the maximum of {MAX_PRIORITIES} priorities. Deselect one to choose a different priority.
          </p>
        </section>

        {/* Right: Reorder Panel */}
        <section aria-labelledby="ranking-heading" className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {/* Ranking Reorder Card */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 id="ranking-heading" className="flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-slate-600 uppercase">
                <ListOrdered className="size-4 text-[#FF2A85]" />
                Your ranking
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-700">
                {ranked.length} / {MAX_PRIORITIES}
              </span>
            </div>

            {ranked.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200/90 bg-slate-50/50 p-6 text-center">
                <p className="text-xs font-medium text-slate-500 leading-relaxed">
                  Select up to 3 options on the left. Your top pick will determine your primary dashboard view.
                </p>
              </div>
            ) : (
              <ol className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50">
                {ranked.map((id, i) => {
                  const { label } = byId(id);
                  return (
                    <li
                      key={id}
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(i);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null) move(dragIndex, i);
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      className={cn(
                        "flex items-center gap-2.5 py-2.5 pr-2 pl-3 transition-opacity",
                        dragIndex === i && "opacity-40"
                      )}
                    >
                      <GripVertical aria-hidden="true" className="size-4 shrink-0 cursor-grab text-slate-400 hover:text-slate-600" />
                      <span className="size-5 rounded-md bg-[#FF2A85] text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">
                        {label}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => move(i, i - 1)}
                        disabled={i === 0}
                        aria-label={`Move ${label} up`}
                        className="size-8 sm:size-7 min-h-[32px] min-w-[32px] pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-slate-400 hover:text-slate-700 touch-manipulation"
                      >
                        <ArrowUp aria-hidden="true" className="size-4 sm:size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => move(i, i + 1)}
                        disabled={i === ranked.length - 1}
                        aria-label={`Move ${label} down`}
                        className="size-8 sm:size-7 min-h-[32px] min-w-[32px] pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-slate-400 hover:text-slate-700 touch-manipulation"
                      >
                        <ArrowDown aria-hidden="true" className="size-4 sm:size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggle(id)}
                        aria-label={`Remove ${label}`}
                        className="size-8 sm:size-7 min-h-[32px] min-w-[32px] pointer-coarse:min-h-11 pointer-coarse:min-w-11 text-slate-400 hover:text-red-600 touch-manipulation"
                      >
                        <X aria-hidden="true" className="size-4 sm:size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ol>
            )}
            <p className="mt-3 text-[0.6875rem] text-slate-400">
              Drag items or click the arrows to adjust ranking order.
            </p>
          </div>

          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </section>
      </div>

      <ContinueForm
        persona="student"
        step="priorities"
        canContinue={ranked.length > 0}
        hint="Pick at least one priority to continue"
        status={<SaveStatusText status={status} error={error} onRetry={retry} />}
      />
    </>
  );
}
