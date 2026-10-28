"use client";

import {
  BarChart3,
  Bot,
  Box,
  Brain,
  Check,
  Code2,
  Compass,
  Database,
  FlaskConical,
  Image as ImageIcon,
  MessageSquare,
  Network,
  Pencil,
  Search,
  Settings,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { saveCareerDirection } from "@/app/onboarding/actions";
import { ContinueForm } from "@/components/onboarding/continue-form";
import { SaveStatusText } from "@/components/onboarding/save-status";
import { Input } from "@/components/ui/input";
import { useAutosave } from "@/hooks/use-autosave";
import { CAREER_ROLES } from "@/lib/onboarding/catalog";
import { cn } from "@/lib/utils";

const OTHER_DEBOUNCE_MS = 700;

const ROLE_ICONS: Record<string, React.ElementType> = {
  generative_ai_engineer: Brain,
  ml_engineer: BarChart3,
  ai_engineer: Code2,
  ai_researcher: FlaskConical,
  data_scientist: Database,
  deep_learning_engineer: Network,
  mlops_engineer: Settings,
  nlp_engineer: MessageSquare,
  computer_vision_engineer: ImageIcon,
  robotics_ai_engineer: Bot,
  rl_engineer: Zap,
  ai_product_founder: Box,
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

  const canContinue = selected.length > 0 || other.trim().length > 0;

  return (
    <>
      {/* Search Input matching reference UI */}
      <div className="mt-6 max-w-full">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="role-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roles or skills"
            aria-label="Search roles or skills"
            aria-describedby="role-search-count"
            className="h-11 rounded-xl sm:rounded-2xl border-slate-200 bg-white pr-10 pl-10 text-sm shadow-xs transition-colors focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20 [&::-webkit-search-cancel-button]:hidden"
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

      {/* 3-Column Roles Grid matching reference screenshot */}
      {visible.length > 0 ? (
        <ul className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3.5" aria-label="Career directions">
          {visible.map((role) => {
            const isSelected = selected.includes(role.id);
            const Icon = ROLE_ICONS[role.id] ?? Brain;

            return (
              <li key={role.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle(role.id)}
                  className={cn(
                    "group relative flex w-full items-center justify-between gap-3.5 rounded-2xl bg-white p-3.5 sm:p-4 text-left transition-all duration-200 cursor-pointer touch-manipulation",
                    "hover:border-slate-300 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2A85] active:scale-[0.99]",
                    isSelected
                      ? "border-2 border-[#FF2A85] shadow-xs"
                      : "border border-slate-200/90"
                  )}
                >
                  {/* Left: Icon Badge */}
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors",
                      isSelected
                        ? "border-slate-100 bg-slate-50 text-slate-900"
                        : "border-slate-100 bg-slate-50 text-slate-700 group-hover:bg-slate-100/70"
                    )}
                  >
                    <Icon className="size-5 stroke-[1.75]" />
                  </div>

                  {/* Center: Title + Subtitle */}
                  <div className="min-w-0 flex-1">
                    <span className="block font-sans font-bold text-sm sm:text-[0.9375rem] text-[#0F172A] leading-tight truncate">
                      {role.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 font-normal leading-tight truncate">
                      {role.blurb}
                    </span>
                  </div>

                  {/* Right: Circular Checkbox Indicator */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full transition-all duration-150",
                      isSelected
                        ? "bg-[#FF2A85] text-white"
                        : "border border-slate-300 bg-white group-hover:border-slate-400"
                    )}
                  >
                    {isSelected && <Check className="size-3 stroke-[3]" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-6 max-w-xl rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-7 text-center sm:text-left">
          <p className="font-sans font-bold text-base text-[#0F172A]">No role matches “{query.trim()}”.</p>
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

      {/* Custom other input matching reference with Pencil icon */}
      <div className="mt-6 max-w-full">
        <label htmlFor="career-other" className="block text-xs font-semibold text-slate-700">
          Other direction (optional)
        </label>
        <div className="relative mt-2">
          <Pencil aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="career-other"
            value={other}
            maxLength={120}
            onChange={(e) => changeOther(e.target.value)}
            onBlur={() => {
              if (otherTimer.current) commit(selected);
            }}
            placeholder="Describe your goal"
            className="h-11 rounded-xl sm:rounded-2xl border-slate-200 bg-white pl-10 text-sm shadow-xs transition-colors focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20"
          />
        </div>
      </div>

      {/* Sticky continue footer matching reference layout */}
      <ContinueForm
        persona="student"
        step="career_direction"
        canContinue={canContinue}
        hint="Select at least one option"
        status={<SaveStatusText status={status} error={error} onRetry={retry} />}
      />
    </>
  );
}
