import { CONFIDENCE_LABEL, type CategoryEvidence, type ConfidenceCheck, type ConfidenceLevel, type Conflict, type Coverage, type EvidenceState, FRESHNESS_DAYS, STATE_LABEL } from "@/lib/intelligence/evidence";

import { Card } from "./charts";

/** Colour per evidence state: green verified, blue assessed, amber self-reported/unreviewed/outdated, grey absent. */
export const STATE_STYLE: Record<EvidenceState, { dot: string; text: string }> = {
  verified: { dot: "var(--si-3)", text: "text-foreground" },
  assessed: { dot: "var(--si-1)", text: "text-foreground" },
  self_reported: { dot: "var(--si-4)", text: "text-foreground" },
  unreviewed: { dot: "var(--si-2)", text: "text-foreground" },
  outdated: { dot: "var(--si-5)", text: "text-foreground" },
  missing: { dot: "var(--si-track)", text: "text-muted-foreground" },
  unavailable: { dot: "var(--si-grid)", text: "text-muted-foreground" },
  not_collected: { dot: "transparent", text: "text-muted-foreground" },
};

export function StateDot({ state }: { state: EvidenceState }) {
  return <span aria-hidden className="inline-block size-2.5 rounded-full border border-border shrink-0" style={{ background: STATE_STYLE[state].dot }} />;
}

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—");

export function EvidencePanel({
  categories,
  coverage,
  confidence,
  checks = [],
  conflicts = [],
}: {
  categories: CategoryEvidence[];
  coverage: Coverage;
  confidence: { level: ConfidenceLevel; reasons: string[] };
  checks?: ConfidenceCheck[];
  conflicts?: Conflict[];
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="evidence-panel">
      <Card title="Evidence coverage" subtitle="Which kinds of evidence exist for this student. Missing evidence isn't low performance." source="Student 360 records" className="lg:col-span-2">
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs">
              <span className="mt-1"><StateDot state={c.state} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold text-foreground">{c.label}</span>
                  <span className={`text-[11px] ${STATE_STYLE[c.state].text}`}>{STATE_LABEL[c.state]}{c.items ? ` · ${c.items}` : ""}</span>
                </span>
                <span className="block text-[10px] text-muted-foreground truncate">{c.note ?? c.source}{c.updatedAt ? ` · ${date(c.updatedAt)}` : ""}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-6">
        <Card title="Coverage" subtitle="Categories with any evidence ÷ categories the platform can measure for this student.">
          <div className="text-2xl font-extrabold tabular-nums text-foreground" data-testid="coverage-value">{coverage.percent}%</div>
          <div className="text-[11px] text-muted-foreground">{coverage.covered} of {coverage.measurable} categories</div>
          <div className="mt-2 h-2 rounded-full" style={{ background: "var(--si-track)" }}>
            <div className="h-2 rounded-full" style={{ width: `${coverage.percent}%`, background: "var(--si-1)" }} />
          </div>
          {(coverage.notCollected.length > 0 || coverage.unavailable.length > 0) && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Left out of the count: {[...coverage.notCollected.map((x) => `${x} (not collected yet)`), ...coverage.unavailable.map((x) => `${x} (connection problem)`)].join(", ")}.
            </p>
          )}
          <details className="mt-2 text-[11px]" data-testid="coverage-breakdown">
            <summary className="cursor-pointer font-semibold text-foreground">Breakdown</summary>
            <dl className="mt-1.5 space-y-1 text-muted-foreground">
              <div><dt className="inline font-semibold text-foreground">Categories considered: </dt><dd className="inline">{coverage.applicable}</dd></div>
              <div><dt className="inline font-semibold text-foreground">In the denominator ({coverage.measurable}): </dt><dd className="inline">{coverage.included.join(", ")}</dd></div>
              {coverage.excluded.map((x) => (
                <div key={x.label}><dt className="inline font-semibold text-foreground">Excluded, {x.label}: </dt><dd className="inline">{x.reason}</dd></div>
              ))}
              {(["verified", "assessed", "self_reported", "unreviewed"] as const).map((k) =>
                coverage.byLevel[k].length ? <div key={k}><dt className="inline font-semibold text-foreground">{STATE_LABEL[k]}: </dt><dd className="inline">{coverage.byLevel[k].join(", ")}</dd></div> : null,
              )}
              {coverage.outdated.length > 0 && <div><dt className="inline font-semibold text-foreground">Outdated: </dt><dd className="inline">{coverage.outdated.join(", ")}</dd></div>}
              {coverage.missing.length > 0 && <div><dt className="inline font-semibold text-foreground">Missing: </dt><dd className="inline">{coverage.missing.join(", ")}</dd></div>}
            </dl>
          </details>
        </Card>
        <Card title="Confidence" subtitle="How reliable the evidence is. A rule-based level, not a probability.">
          <div className="text-lg font-bold text-foreground" data-testid="confidence-value">{CONFIDENCE_LABEL[confidence.level]}</div>
          <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground list-disc pl-4">
            {confidence.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
          <details className="mt-2 text-[11px] text-muted-foreground" data-testid="confidence-trace">
            <summary className="cursor-pointer font-semibold text-foreground">Rules checked</summary>
            {checks.length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {checks.map((c) => (
                  <li key={c.rule} className="flex gap-1.5">
                    <span aria-hidden className={c.met ? "text-foreground" : "text-muted-foreground"}>{c.met ? "✓" : "✗"}</span>
                    <span><span className="sr-only">{c.met ? "Met: " : "Not met: "}</span>{c.rule} <span className="text-muted-foreground">({c.detail})</span></span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1.5 text-[10px]">Insufficient: under 3 categories with evidence. Low: nothing verified, or coverage under 40%. Moderate: 1+ verified and 40%+. High: 3+ verified and 70%+. One level lower when half the evidence is outdated (skills over {FRESHNESS_DAYS.intelligence} days, GitHub over {FRESHNESS_DAYS.github} days) or mostly unreviewed. These are fixed rules, not a statistical estimate.</p>
          </details>
        </Card>
      </div>

      <section aria-labelledby="conflicts-h" className="lg:col-span-3 rounded-2xl border border-border bg-card p-5 shadow-2xs" data-testid="conflicts">
        <h2 id="conflicts-h" className="text-xs font-bold text-foreground uppercase tracking-wider">Conflicting evidence ({conflicts.length})</h2>
        {conflicts.length === 0 ? (
          <p className="mt-2 text-[11px] text-muted-foreground">None found. Checked: dates within each education and experience entry, grades for the same qualification, and start dates for the same role across sources.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {conflicts.map((c) => (
              <li key={c.id} className="text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">{c.kind === "contradiction" ? "Contradiction" : "Possible inconsistency"}</span>
                  <span className="font-semibold text-foreground">{c.type}</span>
                  <span className="text-muted-foreground">· {c.subject}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{c.explanation} Neither value is treated as correct; the student or an admin should check.</p>
                <table className="mt-1 text-[11px]">
                  <caption className="sr-only">Conflicting values</caption>
                  <thead className="text-[10px] uppercase text-muted-foreground"><tr><th scope="col" className="pr-4 text-left font-semibold">Value</th><th scope="col" className="pr-4 text-left font-semibold">Source</th><th scope="col" className="pr-4 text-left font-semibold">Recorded</th><th scope="col" className="text-left font-semibold">Student review</th></tr></thead>
                  <tbody>
                    {c.values.map((v, i) => (
                      <tr key={i}><td className="pr-4 font-mono text-foreground">{v.value}</td><td className="pr-4">{v.source}</td><td className="pr-4">{date(v.recordedAt)}</td><td className="capitalize">{v.review}</td></tr>
                    ))}
                  </tbody>
                </table>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
