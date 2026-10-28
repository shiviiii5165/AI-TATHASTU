"use client";

import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { useState } from "react";

import { savePriorities } from "@/app/onboarding/actions";
import { ContinueForm } from "@/components/onboarding/continue-form";
import { SaveStatusText } from "@/components/onboarding/save-status";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/use-autosave";
import { MAX_PRIORITIES, PRIORITIES } from "@/lib/onboarding/catalog";
import { cn } from "@/lib/utils";

const byId = (id: string) => PRIORITIES.find((p) => p.id === id)!;

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
      <div className="mt-6 sm:mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_20rem]">
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

              return (
                <li key={p.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    disabled={isBlocked}
                    aria-describedby={isBlocked ? "priorities-full" : undefined}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      "group relative flex w-full items-start gap-4 rounded-2xl border bg-white p-5 text-left transition-all duration-200",
                      "hover:border-slate-300 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
                      "disabled:cursor-not-allowed disabled:border-dashed disabled:bg-slate-50/50 disabled:opacity-50 disabled:hover:border-slate-200 disabled:active:scale-100",
                      isSelected
                        ? "border-[#FF2A85] bg-rose-50/30 shadow-xs ring-1 ring-[#FF2A85]"
                        : "border-slate-200/90"
                    )}
                  >
                    {/* Rank Number / Checkbox */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-7.5 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold transition-all duration-150",
                        isSelected
                          ? "bg-gradient-to-br from-[#FF6B4A] to-[#FF2A85] text-white shadow-xs"
                          : "border border-slate-200 bg-slate-50 text-slate-400 group-hover:border-slate-300"
                      )}
                    >
                      {isSelected ? rank + 1 : ""}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-sans text-base font-bold text-[#0F172A]">
                          {p.label}
                        </span>
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[0.6875rem] font-semibold text-slate-600 uppercase">
                          {p.module}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                        {p.blurb}
                      </span>
                    </span>

                    {isSelected && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 shrink-0">
                        Rank #{rank + 1}
                      </span>
                    )}
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
        <section aria-labelledby="ranking-heading" className="space-y-6 xl:sticky xl:top-24 xl:self-start">

          {/* Ranking Reorder Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 id="ranking-heading" className="font-mono text-xs font-bold tracking-wider text-slate-500 uppercase">
                Your ranking
              </h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-700">
                {ranked.length} / {MAX_PRIORITIES}
              </span>
            </div>

            {ranked.length === 0 ? (
              <p className="mt-3 rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-400">
                Select up to 3 options on the left. Your top pick will determine your primary dashboard view.
              </p>
            ) : (
              <ol className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/50">
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
                        className="size-8 sm:size-7 min-h-[32px] min-w-[32px] text-slate-400 hover:text-slate-700 touch-manipulation"
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
                        className="size-8 sm:size-7 min-h-[32px] min-w-[32px] text-slate-400 hover:text-slate-700 touch-manipulation"
                      >
                        <ArrowDown aria-hidden="true" className="size-4 sm:size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggle(id)}
                        aria-label={`Remove ${label}`}
                        className="size-8 sm:size-7 min-h-[32px] min-w-[32px] text-slate-400 hover:text-red-600 touch-manipulation"
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
