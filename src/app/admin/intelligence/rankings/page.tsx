import { ArrowDown, ArrowUp, Download, Info, Minus, Plus, Search } from "lucide-react";
import Link from "next/link";

import { Card, Empty, Kpi, ScoreCell, SLOT, VerificationBadge } from "@/components/admin/intelligence/charts";
import { CohortFilters } from "@/components/admin/intelligence/cohort-filters";
import { RankingControls } from "@/components/admin/intelligence/ranking-controls";
import { hasPermission, requireAdminPermission } from "@/lib/admin/rbac";
import { loadCohortOptions } from "@/lib/intelligence/overview";
import { cohortKey, previousSnapshot, runRanking, stripEmpty } from "@/lib/intelligence/rankings";
import { resolveRanking } from "@/lib/intelligence/resolve";
import { type CohortFilter, EVIDENCE_POLICY_LABEL, MISSING_POLICY_LABEL, NORMALIZATION_LABEL } from "@/lib/intelligence/types";

const COHORT_KEYS = ["institutionId", "degreeId", "specializationId", "academicYear", "graduationYear", "careerRole"] as const;
const PAGE_SIZES = [10, 20, 25, 50, 100];
const fmt = (n: number, d = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: d });

export default async function RankingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireAdminPermission("intelligence.read");
  const p = await searchParams;
  const extra = stripEmpty(Object.fromEntries(COHORT_KEYS.map((k) => [k, p[k]])) as CohortFilter);
  const [ranking, options] = await Promise.all([resolveRanking(p.r), loadCohortOptions()]);
  const run = await runRanking(ranking.definition, extra);
  const def = run.definition;

  const fullCohort = { ...stripEmpty(def.cohort), ...extra } as Record<string, string>;
  const prev = ranking.mode === "published" ? await previousSnapshot(ranking.id, ranking.version, cohortKey(fullCohort)) : null;
  const prevRank = new Map((prev?.results ?? []).map((r) => [r.userId, r.rank]));

  const students = new Map(run.cohort.map((s) => [s.id, s]));
  const q = p.q?.trim().toLowerCase() ?? "";
  // Search filters what is shown; it never changes anyone's rank.
  const matches = (id: string) => {
    if (!q) return true;
    const s = students.get(id);
    return Boolean(s && (s.name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q) || s.id === q));
  };
  const sort = p.sort ?? "rank";
  const dir = p.dir === "asc" ? 1 : -1;
  const firmOnly = p.firm === "1";
  // Hiding provisional rows changes what's shown, never anyone's rank.
  const eligible = run.results.filter((r) => r.eligible && matches(r.userId) && (!firmOnly || !r.provisional));
  const provisionalCount = run.results.filter((r) => r.eligible && r.provisional).length;
  const ineligible = run.results.filter((r) => !r.eligible && matches(r.userId));
  if (sort !== "rank") {
    const val = (r: (typeof eligible)[number]) => (sort === "coverage" ? r.coverage : r.categories.find((c) => c.id === sort)?.score ?? -1);
    eligible.sort((a, b) => (val(a) - val(b)) * dir || (a.rank ?? 0) - (b.rank ?? 0));
  }
  const size = PAGE_SIZES.includes(Number(p.size)) ? Number(p.size) : 25;
  const pages = Math.max(1, Math.ceil(eligible.length / size));
  const page = Math.min(Math.max(1, Number(p.page) || 1), pages);
  const rows = eligible.slice((page - 1) * size, page * size);

  const qs = (over: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...p, ...over })) if (v) u.set(k, v);
    return `?${u.toString()}`;
  };
  const backUrl = `/admin/intelligence/rankings${qs({})}`;
  const totalRanked = run.results.filter((r) => r.eligible).length;
  const meanCoverage = run.results.length ? run.results.reduce((s, r) => s + r.coverage, 0) / run.results.length : 0;
  const canManage = hasPermission(ctx, "intelligence.manage");
  const canExport = hasPermission(ctx, "intelligence.export");

  const sortLink = (key: string, label: string) => {
    const active = sort === key;
    const nextDir = active && dir === -1 ? "asc" : "desc";
    return (
      <Link href={qs({ sort: key, dir: nextDir, page: undefined })} className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}>
        {label}{active && (dir === -1 ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      {!ranking.storageAvailable && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-foreground">
          Saved rankings need migration <span className="font-mono">0032_student_intelligence.sql</span>. Until it is applied you can explore the automatic ranking; creating and publishing rankings is disabled.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Students in cohort" value={fmt(run.results.length)} color={SLOT(0)} />
        <Kpi label="Ranked" value={fmt(totalRanked)} sub={`${fmt(totalRanked - provisionalCount)} firm · ${fmt(provisionalCount)} provisional · ${fmt(run.results.length - totalRanked)} not ranked`} color={SLOT(2)} />
        <Kpi label="Saved rankings" value={fmt(ranking.options.length)} sub="Drafts and published" color={SLOT(6)} />
        <Kpi label="Mean evidence coverage" value={`${fmt(meanCoverage)}%`} sub="Share of ranking weight backed by evidence" color={SLOT(1)} />
      </div>

      <form method="GET" className="rounded-2xl border border-border bg-card p-3.5 shadow-2xs flex flex-col lg:flex-row lg:items-end gap-3">
        {COHORT_KEYS.map((k) => p[k] ? <input key={k} type="hidden" name={k} value={p[k]} /> : null)}
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground space-y-1 lg:w-80">
          <span>Ranking</span>
          <select name="r" defaultValue={ranking.id} className="w-full bg-muted/60 border border-border text-xs rounded-lg px-2 py-1.5 normal-case tracking-normal font-normal text-foreground">
            <option value="auto">Auto · all available evidence (equal weights)</option>
            {ranking.options.map((o) => <option key={o.id} value={o.id}>{o.name} {o.version ? `· v${o.version}` : "· draft"}</option>)}
          </select>
        </label>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground space-y-1 flex-1">
          <span>Search (doesn&apos;t change ranks)</span>
          <span className="relative block">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <input name="q" defaultValue={p.q} placeholder="Name, email or student ID…" className="w-full bg-muted/60 border border-border text-xs rounded-lg pl-8 pr-3 py-1.5 normal-case tracking-normal font-normal text-foreground outline-none focus:border-primary" />
          </span>
        </label>
        <button type="submit" className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">Show</button>
        {canManage && ranking.storageAvailable && (
          <Link href="/admin/intelligence/builder" className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: "var(--si-3)" }}>
            <Plus className="size-3.5" /> Create ranking
          </Link>
        )}
      </form>

      <CohortFilters action="/admin/intelligence/rankings" options={options} values={p} hidden={{ r: p.r, q: p.q }} />

      <Card
        title={ranking.name}
        subtitle={
          ranking.mode === "auto"
            ? "Derived default: every measurement with data, equal weights, 50% minimum coverage, unmeasured evidence at the cohort midpoint. Build your own ranking for decisions."
            : ranking.mode === "draft"
              ? "Preview of an unpublished draft. Publish it to freeze a version and enable snapshots."
              : `Published version ${ranking.version}${prev ? ` · movement vs snapshot of ${new Date(prev.computedAt).toLocaleDateString("en-IN")}` : " · no snapshot yet, so no movement is shown"}`
        }
        action={
          <div className="flex items-center gap-2">
            <RankingControls id={ranking.id} mode={ranking.mode} canManage={canManage && ranking.storageAvailable} cohort={extra as Record<string, string>} />
            {canExport && (
              <a href={`/admin/intelligence/rankings/export${qs({})}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors">
                <Download className="size-3.5" /> CSV
              </a>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-1.5 mb-4 text-[10px]">
          {def.categories.map((c, i) => (
            <span key={c.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-border text-foreground">
              <span className="size-2 rounded-full" style={{ background: SLOT(i) }} />{c.name} · {c.weight}%
            </span>
          ))}
          <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">{EVIDENCE_POLICY_LABEL[def.evidencePolicy]}</span>
          <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">Min coverage {def.eligibility.minCoverage}%</span>
          <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">{MISSING_POLICY_LABEL[def.missingPolicy]}</span>
          <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">Firm at ≥{def.eligibility.provisionalCoverage ?? 75}% coverage and ≥{def.eligibility.minIndependentShare ?? 50}% independent evidence</span>
          <Link href={qs({ firm: firmOnly ? undefined : "1", page: undefined })} className={`px-2 py-1 rounded-full border ${firmOnly ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>
            {firmOnly ? "Showing firm ranks only" : "Hide provisional ranks"}
          </Link>
        </div>

        {rows.length === 0 ? (
          <Empty>{q ? "No ranked student matches this search." : "No student in this cohort has enough evidence for this ranking yet."}</Empty>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-y border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4">{sortLink("rank", "#")}</th>
                  <th className="py-2.5 px-2">Move</th>
                  <th className="py-2.5 px-4">Student</th>
                  <th className="py-2.5 px-4">Score</th>
                  {def.categories.map((c) => <th key={c.id} className="py-2.5 px-3 whitespace-nowrap">{sortLink(c.id, c.name)}</th>)}
                  <th className="py-2.5 px-4">{sortLink("coverage", "Coverage")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((r) => {
                  const s = students.get(r.userId);
                  const before = prevRank.get(r.userId);
                  const move = before && r.rank ? before - r.rank : null;
                  const href = `/admin/intelligence/students/${r.userId}?r=${ranking.id}&back=${encodeURIComponent(backUrl)}`;
                  return (
                    <tr key={r.userId} className="hover:bg-accent/40 transition-colors align-top">
                      <td className="py-3 px-4 font-mono font-bold text-foreground">{r.rank}</td>
                      <td className="py-3 px-2">
                        {!prev ? <span className="text-muted-foreground">—</span>
                          : before === undefined || before === null ? <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400">new</span>
                          : move === 0 ? <Minus className="size-3.5 text-muted-foreground" />
                          : <span className={`inline-flex items-center text-[11px] font-semibold ${move! > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{move! > 0 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}{Math.abs(move!)}</span>}
                      </td>
                      <td className="py-3 px-4 min-w-[220px]">
                        <Link href={href} className="font-semibold text-foreground hover:text-primary">{s?.name || "Unnamed student"}</Link>
                        {r.provisional && (
                          <span title={r.provisionalReasons.join(" ")} className="ml-2 inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-700 dark:text-amber-400">Provisional</span>
                        )}
                        <div className="text-[11px] text-muted-foreground">{s?.email} · {fmt(r.independentShare)}% independent evidence</div>
                        <details className="mt-1">
                          <summary className="text-[10px] text-primary cursor-pointer select-none">Why this score</summary>
                          <div className="mt-2 space-y-2 text-[11px]">
                            {r.categories.map((c) => (
                              <div key={c.id}>
                                <div className="font-semibold text-foreground">{c.name} ({c.weight}%): {c.score === null ? "no evidence" : fmt(c.score, 1)} · coverage {fmt(c.coverage)}%</div>
                                <ul className="pl-3 text-muted-foreground space-y-0.5">
                                  {c.benchmarks.map((b) => (
                                    <li key={b.key}>
                                      {b.label} ({b.weight}%):{" "}
                                      {b.status === "scored" ? `${fmt(b.raw ?? 0, 1)} → ${fmt(b.normalized ?? 0, 1)}` : b.status === "excluded_by_policy" ? "excluded by evidence policy" : "no evidence"}
                                      {b.verification && <> · <VerificationBadge v={b.verification} /></>}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </details>
                      </td>
                      <td className="py-3 px-4"><span className="text-base font-extrabold tabular-nums text-foreground">{fmt(r.score ?? 0, 1)}</span></td>
                      {r.categories.map((c, i) => <td key={c.id} className="py-3 px-3"><ScoreCell value={c.score} color={SLOT(i)} /></td>)}
                      <td className="py-3 px-4"><ScoreCell value={r.coverage} color="var(--si-grid)" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>Showing {rows.length ? (page - 1) * size + 1 : 0}–{(page - 1) * size + rows.length} of {eligible.length} ranked{q ? " matching" : ""}</span>
          <div className="flex items-center gap-1.5">
            {PAGE_SIZES.map((n) => <Link key={n} href={qs({ size: String(n), page: undefined })} className={`px-2 py-1 rounded-md border border-border ${n === size ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>{n}</Link>)}
            <span className="mx-2">Page {page} / {pages}</span>
            {page > 1 && <Link href={qs({ page: String(page - 1) })} className="px-2 py-1 rounded-md border border-border hover:bg-accent">Prev</Link>}
            {page < pages && <Link href={qs({ page: String(page + 1) })} className="px-2 py-1 rounded-md border border-border hover:bg-accent">Next</Link>}
          </div>
        </div>
      </Card>

      {ineligible.length > 0 && (
        <Card title={`Not ranked · ${ineligible.length} students`} subtitle="Students without enough accepted evidence get no rank and no implied score, so their rank never suggests a weakness that was simply never measured.">
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr><th className="py-2 px-4">Student</th><th className="py-2 px-4">Coverage</th><th className="py-2 px-4">Reason</th></tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {ineligible.slice(0, 100).map((r) => {
                  const s = students.get(r.userId);
                  return (
                    <tr key={r.userId}>
                      <td className="py-2.5 px-4"><Link href={`/admin/intelligence/students/${r.userId}?r=${ranking.id}&back=${encodeURIComponent(backUrl)}`} className="font-medium text-foreground hover:text-primary">{s?.name || "Unnamed student"}</Link><div className="text-[11px] text-muted-foreground">{s?.email}</div></td>
                      <td className="py-2.5 px-4 w-40"><ScoreCell value={r.coverage} color="var(--si-grid)" /></td>
                      <td className="py-2.5 px-4 text-muted-foreground">{r.ineligibleReasons.join(" ")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {ineligible.length > 100 && <p className="mt-3 text-[11px] text-muted-foreground">First 100 shown. Export CSV for the full list.</p>}
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[11px] text-muted-foreground">
        <Info className="size-4 shrink-0 mt-0.5" />
        <span>
          Final score = Σ(category weight × category score) over categories with evidence; category score = Σ(benchmark weight × normalised benchmark score) over benchmarks with evidence.
          Normalisation per benchmark: {[...new Set(def.categories.flatMap((c) => c.benchmarks.map((b) => NORMALIZATION_LABEL[b.normalization])))].join(", ") || "—"}.
          Ties share a rank. Computed {run.computedAt.toLocaleString("en-IN")} from live evidence.
        </span>
      </div>
    </div>
  );
}
