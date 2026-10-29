"use client";

import { Check, CircleAlert, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { saveResearch } from "@/app/onboarding/persona-actions";
import { PlatformIcon } from "@/components/icons/platform-icons";
import { ContinueForm } from "@/components/onboarding/continue-form";
import { SaveStatusText } from "@/components/onboarding/save-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAutosave } from "@/hooks/use-autosave";
import { CAREER_ROLES } from "@/lib/onboarding/catalog";
import { cn } from "@/lib/utils";

const MAX_INTERESTS = 15;
const AREAS = CAREER_ROLES.filter((r) => r.id !== "still_exploring");

const POPULAR_SUGGESTIONS = [
  "Large Language Models",
  "Computer Vision",
  "Reinforcement Learning",
  "Multimodal AI",
  "AI Safety & Alignment",
  "Federated Learning",
  "Robotics & Control",
  "Graph Neural Networks",
  "Natural Language Processing",
  "Explainable AI",
  "Bioinformatics",
  "Diffusion Models",
];

export type OrcidCard =
  | { state: "unavailable" }
  | { state: "not_connected"; error: string | null }
  | { state: "connected"; orcid: string; importing: boolean };

/** Faculty Step 2: research interests (tags), the student directions they can mentor in, and ORCID. */
export function ResearchForm({
  initialInterests,
  initialAreas,
  orcid,
}: {
  initialInterests: string[];
  initialAreas: string[];
  orcid: OrcidCard;
}) {
  const [interests, setInterests] = useState(initialInterests);
  const [areas, setAreas] = useState(initialAreas);
  const [draft, setDraft] = useState("");
  const { status, error, save, retry } = useAutosave(saveResearch);

  function commit(nextInterests = interests, nextAreas = areas) {
    setInterests(nextInterests);
    setAreas(nextAreas);
    void save({ interests: nextInterests, areas: nextAreas });
  }

  function addDraft(textToAdd = draft) {
    const items = textToAdd.split(",").map((s) => s.trim().replace(/\s+/g, " ")).filter(Boolean);
    if (!items.length) return;
    const seen = new Set(interests.map((i) => i.toLowerCase()));
    const added = items.filter((i) => i.length <= 80 && !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase()));
    if (textToAdd === draft) setDraft("");
    if (added.length) commit([...interests, ...added].slice(0, MAX_INTERESTS));
  }

  function toggleSuggestion(suggestion: string) {
    const exists = interests.some((i) => i.toLowerCase() === suggestion.toLowerCase());
    if (exists) {
      commit(interests.filter((i) => i.toLowerCase() !== suggestion.toLowerCase()));
    } else if (interests.length < MAX_INTERESTS) {
      commit([...interests, suggestion]);
    }
  }

  const full = interests.length >= MAX_INTERESTS;

  return (
    <>
      <div className="onb-frame mt-6 sm:mt-8 space-y-10">
        {/* Section 1: Research Interests */}
        <section
          aria-labelledby="interests-heading"
          className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-[#FF2A85] tracking-wide uppercase">
                  Step 2 · Focus
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {interests.length}/{MAX_INTERESTS} added
                </span>
              </div>
              <h2
                id="interests-heading"
                className="mt-2 font-heading text-lg sm:text-xl font-bold tracking-tight text-[#0F172A]"
              >
                Research interests & subfields
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Topics you work on, publish in, or teach. Enter custom tags or select from common areas.
              </p>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Label htmlFor="interest-input" className="sr-only">
              Add a research interest
            </Label>
            <div className="relative flex-1">
              <Input
                id="interest-input"
                value={draft}
                disabled={full}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addDraft();
                  }
                }}
                placeholder={
                  full
                    ? `${MAX_INTERESTS} added: remove one to add another`
                    : "e.g. Multimodal learning, Federated learning (press Enter or comma)"
                }
                maxLength={200}
                className="h-12 rounded-xl border border-slate-200 bg-slate-50/50 px-4 text-base md:text-sm text-[#0F172A] shadow-xs placeholder:text-slate-400 focus-visible:bg-white focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20"
              />
            </div>
            <Button
              type="button"
              className="h-12 px-3 sm:px-6 rounded-xl text-sm font-semibold bg-[#0F172A] hover:bg-slate-800 text-white shadow-xs transition-all flex items-center gap-1.5 shrink-0"
              onClick={() => addDraft()}
              disabled={full || !draft.trim()}
            >
              <Plus data-icon="inline-start" aria-hidden className="size-4" />
              Add
            </Button>
          </div>

          {/* Quick suggestions */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
              <Sparkles className="size-3 text-amber-500" />
              Suggested subfields
            </p>
            <div className="flex flex-wrap gap-2">
              {POPULAR_SUGGESTIONS.map((s) => {
                const isSelected = interests.some((i) => i.toLowerCase() === s.toLowerCase());
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSuggestion(s)}
                    disabled={full && !isSelected}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-all duration-150 shadow-2xs",
                      isSelected
                        ? "border-[#FF2A85] bg-rose-50 text-rose-700 ring-1 ring-[#FF2A85]/30"
                        : "border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    {isSelected ? <Check className="size-3.5 stroke-[2.5]" /> : <Plus className="size-3 text-slate-400" />}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active interests chips */}
          {interests.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Active research tags ({interests.length})
                </span>
                <button
                  type="button"
                  onClick={() => commit([], areas)}
                  className="text-xs font-medium text-slate-400 hover:text-rose-600 transition-colors"
                >
                  Clear all
                </button>
              </div>
              <ul className="flex flex-wrap gap-2" aria-label="Your research interests">
                {interests.map((i) => (
                  <li
                    key={i}
                    className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 pr-2 pl-3.5 text-xs font-semibold text-slate-800 shadow-2xs hover:border-rose-300 transition-all"
                  >
                    <span>{i}</span>
                    <button
                      type="button"
                      onClick={() => commit(interests.filter((x) => x !== i))}
                      aria-label={`Remove ${i}`}
                      className="flex size-5 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-[#FF2A85] focus-visible:outline-none"
                    >
                      <X aria-hidden className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Section 2: Mentorship Areas */}
        <section
          aria-labelledby="areas-heading"
          className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs"
        >
          <div>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-[11px] font-bold text-purple-700 tracking-wide uppercase">
              Step 2 · Matching
            </span>
            <h2
              id="areas-heading"
              className="mt-2 font-heading text-lg sm:text-xl font-bold tracking-tight text-[#0F172A]"
            >
              Areas you can mentor in <span className="font-normal text-slate-400 text-sm">(optional)</span>
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Students preparing for these career directions will see you as a recommended mentor.
            </p>
          </div>

          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {AREAS.map((a) => {
              const on = areas.includes(a.id);
              return (
                <li key={a.id}>
                  <button
                    key={a.id}
                    type="button"
                    aria-label={a.label}
                    aria-pressed={on}
                    onClick={() => commit(interests, on ? areas.filter((x) => x !== a.id) : [...areas, a.id])}
                    className={cn(
                      "w-full text-left flex items-start gap-3 rounded-2xl border p-4 transition-all duration-150 shadow-2xs",
                      "focus-visible:ring-2 focus-visible:ring-[#FF2A85] focus-visible:outline-none",
                      on
                        ? "border-[#FF2A85] bg-rose-50/30 ring-1 ring-[#FF2A85]/30 shadow-xs"
                        : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                        on
                          ? "border-[#FF2A85] bg-[#FF2A85] text-white"
                          : "border-slate-300 bg-white"
                      )}
                    >
                      {on && <Check className="size-3.5 stroke-[2.5]" />}
                    </div>
                    <div className="min-w-0">
                      <p className={cn("text-xs font-bold leading-snug", on ? "text-[#0F172A]" : "text-slate-800")}>
                        {a.label}
                      </p>
                      <p aria-hidden="true" className="mt-0.5 text-[11px] leading-tight text-slate-500 line-clamp-1">
                        {a.blurb}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Section 3: ORCID Academic Integration */}
        <section
          aria-labelledby="orcid-heading"
          className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50/70 p-2.5 shadow-xs">
                <PlatformIcon sourceId="orcid" className="size-6" />
              </div>
              <div>
                <h2 id="orcid-heading" className="font-heading text-lg font-bold text-[#0F172A] leading-snug">
                  ORCID iD Record
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Global verified identifier for researchers & faculty
                </p>
              </div>
            </div>
            {orcid.state === "connected" && (
              <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
                <Check className="size-3 stroke-[2.5]" /> Connected
              </span>
            )}
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            Link your ORCID record to automatically import publications, citations, affiliations, and grant works. We only read public data and never request editing permissions.
          </p>

          <OrcidStatus card={orcid} />
        </section>
      </div>

      <ContinueForm
        step="research_expertise"
        persona="faculty"
        canContinue={interests.length > 0}
        hint="Add at least one research interest"
        status={<SaveStatusText status={status} error={error} onRetry={retry} />}
      />
    </>
  );
}

function OrcidStatus({ card }: { card: OrcidCard }) {
  const [leaving, setLeaving] = useState(false);
  if (card.state === "unavailable") {
    return (
      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-500">
        ORCID sign-in isn&apos;t set up yet. You can connect it later from Connections.
      </div>
    );
  }
  if (card.state === "connected") {
    return (
      <div className="mt-4 flex items-center gap-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          {card.importing ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4 stroke-[2.5]" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-bold text-slate-800">{card.orcid}</p>
          <p className="text-[11px] text-slate-500">
            {card.importing ? "Importing publications in the background..." : "Verified and actively syncing"}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {card.error && (
        <p role="alert" className="w-full flex items-start gap-1.5 text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
          <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          {card.error}
        </p>
      )}
      <Button
        type="button"
        className="h-10 px-5 rounded-xl text-xs font-semibold bg-[#0F172A] hover:bg-slate-800 text-white shadow-xs transition-all flex items-center gap-2"
        disabled={leaving}
        onClick={() => {
          setLeaving(true);
          window.location.assign(new URL("/api/connectors/orcid/start?from=research", window.location.origin).href);
        }}
      >
        {leaving && <LoaderCircle data-icon="inline-start" aria-hidden className="size-3.5 animate-spin" />}
        Connect ORCID
      </Button>
    </div>
  );
}
