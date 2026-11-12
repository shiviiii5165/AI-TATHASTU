import { CheckCircle2, CircleAlert, ExternalLink, Lock } from "lucide-react";

import { roleLabel } from "@/components/dashboard/widgets/labels";
import { EVIDENCE_BASIS, categoryOf } from "@/lib/dashboard/intelligence";
import { currentLevelText, stateText, TONE_CLASS } from "@/lib/dashboard/plain-language";
import type { DataCoverage, GapInventoryRow, IntelligenceDoc, RoleAnalysis } from "@/lib/dashboard/types";

/**
 * The complete skill-gap inventory (career_engine.gap_inventory): every skill the goal and the student's project need,
 * plus the prerequisites they build on, in the engine's explained priority order, each with the evidence considered,
 * the requirement it relates to and what to do next. Dashboard cards show the top few; nothing is hidden here.
 */
export function GapInventory({ intelligence }: { intelligence: IntelligenceDoc }) {
  const rows = intelligence.gapInventory ?? [];
  if (!rows.length) return null;
  const open = rows.filter((r) => categoryOf(r) !== "meets");
  const met = rows.filter((r) => categoryOf(r) === "meets");
  const groups = [...new Set(open.map((r) => r.priorityGroupLabel))];
  const role = intelligence.roles[0];
  return (
    <section id="gap-inventory" className="scroll-mt-20 rounded-2xl border border-border bg-card p-5 shadow-2xs sm:p-6" aria-labelledby="gap-inventory-title">
      <h2 id="gap-inventory-title" className="text-base font-bold text-foreground">Every skill to develop</h2>
      <p className="mt-0.5 max-w-3xl text-xs text-muted-foreground">
        {role ? `What ${roleLabel(role.role)} requires` : "What your goal requires"}
        {intelligence.project?.status === "analysed" ? ", what your project needs" : ""} and the foundations they build on: {open.length} still to develop, {met.length} already shown.
        Ordered by what builds on what, then by importance. A skill we haven&apos;t seen in your work is &quot;not shown yet&quot;, never assumed missing.
      </p>
      <div className="mt-4 space-y-5">
        {groups.map((g) => (
          <div key={g}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g}</h3>
            <ol className="mt-2 divide-y divide-border rounded-xl border border-border">
              {open.filter((r) => r.priorityGroupLabel === g).map((r) => <InventoryRow key={r.skill} row={r} />)}
            </ol>
          </div>
        ))}
        {met.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Already shown at the expected level</h3>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {met.map((r) => (
                <li key={r.skill} title={r.levelBasis?.join(" · ") || r.evidence.join(" · ")} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                  <CheckCircle2 aria-hidden className="size-3" /> {r.skill} · {r.level}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function InventoryRow({ row }: { row: GapInventoryRow }) {
  const t = stateText(row);
  const basis = EVIDENCE_BASIS[row.evidenceBasis ?? "not_found"];
  return (
    <li data-skill={row.skill}>
      <details className="group px-3 py-2.5">
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span className="w-6 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{row.inventoryRank}</span>
          <span className="text-sm font-semibold text-foreground">{row.skill}</span>
          <span className={`rounded px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset ${TONE_CLASS[t.tone]}`}>{t.label}</span>
          <span className="text-[11px] text-muted-foreground">
            {currentLevelText(row)} · expected {row.expectedLevel}
          </span>
          <span className="basis-full pl-8 text-[11px] text-muted-foreground">{row.inventoryReason}</span>
        </summary>
        <dl className="mt-2 grid gap-2 pl-8 text-[11px] md:grid-cols-2">
          <div>
            <dt className="font-semibold text-foreground">Why it&apos;s here</dt>
            <dd className="text-muted-foreground">
              {row.whyItMatters}
              {row.triggers?.length ? ` From your description: “${row.triggers.slice(0, 3).join("”, “")}”.` : ""}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-foreground">Evidence considered</dt>
            <dd className="text-muted-foreground">
              <span className="font-medium text-foreground">{basis.label}.</span> {row.levelBasis?.length ? row.levelBasis.join(". ") + "." : basis.explain}
            </dd>
          </div>
          {row.expectedCriterion && (
            <div>
              <dt className="font-semibold text-foreground">What {row.expectedLevel} means here</dt>
              <dd className="text-muted-foreground">{row.expectedCriterion}</dd>
            </div>
          )}
          {row.action && (
            <div>
              <dt className="font-semibold text-foreground">What to do next</dt>
              <dd className="text-muted-foreground">{row.action}</dd>
            </div>
          )}
          {row.demonstration && (
            <div className="md:col-span-2">
              <dt className="font-semibold text-foreground">What would show it</dt>
              <dd className="text-muted-foreground">{row.demonstration} {row.nextLevel && row.proficiency !== null ? row.nextLevel : ""}</dd>
            </div>
          )}
          {(row.blockedBy?.length ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground md:col-span-2">
              <Lock aria-hidden className="size-3" /> Builds on {row.blockedBy!.join(", ")}.
            </div>
          )}
        </dl>
      </details>
    </li>
  );
}

/** What the engine read about the student, and what it couldn't. Shown so no conclusion looks better-founded than it is. */
export function DataCoveragePanel({ coverage }: { coverage?: DataCoverage }) {
  if (!coverage) return null;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs sm:p-6" aria-labelledby="coverage-title">
      <h2 id="coverage-title" className="text-base font-bold text-foreground">What this is based on</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">Every level and gap above comes only from these sources. Where something is missing, we say so rather than guess.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {coverage.sources.map((s) => (
          <li key={s.id} className="rounded-xl border border-border p-3 text-xs">
            <p className="flex items-center gap-1.5 font-semibold text-foreground">
              {s.status === "used" ? <CheckCircle2 aria-hidden className="size-3.5 text-emerald-600 dark:text-emerald-300" /> : <CircleAlert aria-hidden className="size-3.5 text-amber-600 dark:text-amber-300" />}
              {s.label}
              <span className="sr-only">{s.status === "used" ? "(used)" : "(not available)"}</span>
            </p>
            <p className="mt-0.5 text-muted-foreground">{s.detail}</p>
            {s.limits.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] text-muted-foreground">
                {s.limits.map((l) => <li key={l}>{l}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-0.5 text-[11px] text-muted-foreground">
        {coverage.limitations.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </section>
  );
}

/** The role framework's own account of the job, its specialisation tracks and the public references that informed it. */
export function FrameworkNotes({ role }: { role: RoleAnalysis }) {
  const fw = role.framework;
  if (!fw?.summary && !fw?.references?.length) return null;
  return (
    <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
      <div>
        {fw.summary && <p className="text-foreground">{fw.summary}</p>}
        {fw.distinguishingFocus && <p className="mt-1 text-muted-foreground">{fw.distinguishingFocus}</p>}
        {role.specialisations && role.specialisations.length > 0 && (
          <p className="mt-2 text-muted-foreground">
            <span className="font-semibold text-foreground">Specialisation tracks (optional): </span>
            {role.specialisations.map((t) => `${t.track} (${t.met} of ${t.total} shown)`).join(" · ")}
          </p>
        )}
      </div>
      {fw.references && fw.references.length > 0 && (
        <div>
          <p className="font-semibold text-foreground">Public references that informed this framework</p>
          <ul className="mt-1 space-y-0.5">
            {fw.references.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  {r.title} <ExternalLink aria-hidden className="size-3" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                <span className="text-muted-foreground"> · {r.publisher}, {r.kind}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted-foreground">These informed the framework; the skills, weights and expected levels are our team&apos;s own draft, not an official standard.</p>
        </div>
      )}
    </div>
  );
}
