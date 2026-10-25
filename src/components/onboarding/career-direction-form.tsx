"use client";

import {
  Binary,
  Bot,
  Brain,
  Check,
  Compass,
  Cpu,
  Eye,
  FlaskConical,
  Layers,
  Lightbulb,
  Network,
  Rocket,
  Search,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { saveCareerDirection } from "@/app/onboarding/actions";
import { ContinueForm } from "@/components/onboarding/continue-form";
import { SaveStatusText } from "@/components/onboarding/save-status";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutosave } from "@/hooks/use-autosave";
import { CAREER_ROLES } from "@/lib/onboarding/catalog";
import { cn } from "@/lib/utils";

const OTHER_DEBOUNCE_MS = 700;

const ROLE_ICONS: Record<string, React.ElementType> = {
  generative_ai_engineer: Sparkles,
  ml_engineer: Brain,
  ai_engineer: Bot,
  ai_researcher: FlaskConical,
  data_scientist: Binary,
  deep_learning_engineer: Network,
  mlops_engineer: Layers,
  nlp_engineer: Cpu,
  computer_vision_engineer: Eye,
  robotics_ai_engineer: Bot,
  rl_engineer: Rocket,
  ai_product_founder: Lightbulb,
  still_exploring: Compass,
};

export function CareerDirectionForm({ initialRoles, initialOther }: { initialRoles: string[]; initialOther: string }) {
  // Ordered: index 0 is the primary direction.
  const [selected, setSelected] = useState<string[]>(initialRoles);
  const [other, setOther] = useState(initialOther);
  const [query, setQuery] = useState("");
  const { status, error, save, retry } = useAutosave(saveCareerDirection);
  const otherTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(otherTimer.current), []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CAREER_ROLES;
    return CAREER_ROLES.filter((r) => r.label.toLowerCase().includes(q) || r.blurb.toLowerCase().includes(q));
  }, [query]);

  function commit(roles: string[], otherText = other) {
    clearTimeout(otherTimer.current);
    otherTimer.current = undefined;
    setSelected(roles);
    void save({ roles, other: otherText.trim() });
  }

  function toggle(id: string) {
    commit(selected.includes(id) ? selected.filter((r) => r !== id) : [...selected, id]);
  }

  function makePrimary(id: string) {
    commit([id, ...selected.filter((r) => r !== id)]);
  }

  function changeOther(value: string) {
    setOther(value);
    clearTimeout(otherTimer.current);
    otherTimer.current = setTimeout(() => {
      otherTimer.current = undefined;
      void save({ roles: selected, other: value.trim() });
    }, OTHER_DEBOUNCE_MS);
  }

  function applyQueryAsOther() {
    const value = query.trim();
    setOther(value);
    setQuery("");
    commit(selected, value);
  }

  const labelFor = (id: string) => CAREER_ROLES.find((r) => r.id === id)?.label ?? id;
  const canContinue = selected.length > 0 || other.trim().length > 0;

  return (
    <>
      {/* Search Input */}
      <div className="mt-7 max-w-xl">
        <Label htmlFor="role-search" className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Search roles or domains
        </Label>
        <div className="relative mt-2">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="role-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Try “vision”, “research”, or “LLM”"
            aria-describedby="role-search-count"
            className="h-11 rounded-xl border-slate-200 pr-10 pl-10 text-base md:text-sm shadow-xs transition-colors focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20 [&::-webkit-search-cancel-button]:hidden"
            autoComplete="off"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute top-1/2 right-1.5 flex size-9 min-h-[36px] min-w-[36px] -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 touch-manipulation"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
        <p id="role-search-count" aria-live="polite" className="sr-only">
          {query ? `${visible.length} of ${CAREER_ROLES.length} roles match` : `${CAREER_ROLES.length} roles`}
        </p>
      </div>

      {/* Roles Cards Grid */}
      {visible.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Career directions">
          {visible.map((role) => {
            const rank = selected.indexOf(role.id);
            const isSelected = rank !== -1;
            const Icon = ROLE_ICONS[role.id] ?? Sparkles;

            return (
              <li key={role.id} className="flex">
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle(role.id)}
                  className={cn(
                    "group relative flex h-full w-full flex-col justify-between rounded-2xl border bg-white p-4.5 sm:p-5 pr-11 sm:pr-12 text-left transition-all duration-200 cursor-pointer touch-manipulation",
                    "hover:border-slate-300 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]",
                    isSelected
                      ? "border-[#FF2A85] bg-rose-50/30 shadow-xs ring-2 ring-[#FF2A85]/20"
                      : "border-slate-200/90"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "grid size-9 place-items-center rounded-xl transition-colors duration-150",
                        isSelected
                          ? "bg-gradient-to-br from-[#FF6B4A] to-[#FF2A85] text-white shadow-xs"
                          : "bg-slate-100 text-slate-600 group-hover:bg-rose-50 group-hover:text-[#FF2A85]"
                      )}
                    >
                      <Icon className="size-4.5" />
                    </div>
                    <span className="font-heading font-bold text-base text-[#0F172A] leading-snug">
                      {role.label}
                    </span>
                  </div>

                  <span className="mt-2.5 text-xs leading-relaxed text-slate-500">
                    {role.blurb}
                  </span>

                  {rank === 0 && selected.length > 1 && (
                    <span className="mt-3 inline-flex items-center gap-1 rounded-md bg-rose-100/80 px-2 py-0.5 font-mono text-[0.6875rem] font-bold text-rose-800 uppercase">
                      Primary direction
                    </span>
                  )}

                  {/* Selection Checkmark Indicator */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "absolute top-5 right-5 flex size-5.5 items-center justify-center rounded-full border transition-all duration-150",
                      isSelected
                        ? "border-[#FF2A85] bg-gradient-to-br from-[#FF6B4A] to-[#FF2A85] text-white shadow-xs"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    {isSelected && <Check className="size-3.5 stroke-[2.5]" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-6 max-w-xl rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-7 text-center sm:text-left">
          <p className="font-heading font-bold text-base text-[#0F172A]">No role matches “{query.trim()}”.</p>
          <p className="mt-1 text-sm text-slate-500">
            You can use this as your custom direction. We&apos;ll tailor intelligence and opportunities around it.
          </p>
          <button
            type="button"
            onClick={applyQueryAsOther}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF2A85] px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95"
          >
            Use “{query.trim()}” as my direction
          </button>
        </div>
      )}

      {/* Multiple selection primary chooser notice */}
      {selected.length > 1 && (
        <fieldset className="mt-7 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50/70 p-5 text-amber-900 shadow-xs">
          <legend className="sr-only">Choose your primary direction</legend>
          <p className="flex items-start gap-2.5 text-sm leading-relaxed font-medium">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-amber-700" />
            <span>
              You&apos;ve selected {selected.length} directions. Pick one as your <strong>primary</strong> focus for dashboard widgets; the others remain saved as secondary interests.
            </span>
          </p>
          <div className="mt-3.5 flex flex-wrap gap-2 pl-7">
            {selected.map((id, i) => (
              <label
                key={id}
                className={cn(
                  "flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 select-none touch-manipulation",
                  i === 0
                    ? "border-[#FF2A85] bg-white text-[#0F172A] shadow-xs ring-1 ring-[#FF2A85]"
                    : "border-amber-300/80 bg-white/80 text-amber-900 hover:bg-white"
                )}
              >
                <input
                  type="radio"
                  name="primary-role"
                  checked={i === 0}
                  onChange={() => makePrimary(id)}
                  className="size-4 accent-[#FF2A85]"
                />
                {labelFor(id)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {/* Custom other input */}
      <div className="mt-8 max-w-xl">
        <Label htmlFor="career-other" className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Not listed? Describe your direction <span className="font-normal text-slate-400 lowercase">(optional)</span>
        </Label>
        <Input
          id="career-other"
          value={other}
          maxLength={120}
          onChange={(e) => changeOther(e.target.value)}
          onBlur={() => {
            if (otherTimer.current) commit(selected);
          }}
          placeholder="e.g. AI for drug discovery, LLM alignment"
          className="mt-2 h-11 rounded-xl border-slate-200 text-base md:text-sm shadow-xs transition-colors focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20"
        />
      </div>

      {/* Sticky continue footer */}
      <ContinueForm
        persona="student"
        step="career_direction"
        canContinue={canContinue}
        hint="Pick at least one direction to continue"
        status={<SaveStatusText status={status} error={error} onRetry={retry} />}
      />
    </>
  );
}
