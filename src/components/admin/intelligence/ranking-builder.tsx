"use client";

import { ArrowDown, ArrowUp, CheckCircle2, Eye, Layers, Loader2, Plus, RotateCcw, Rocket, Save, Search, Trash2, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { previewRankingAction, publishRankingAction, saveRankingDraftAction, type PreviewResult } from "@/app/admin/intelligence/actions";
import { evenWeights, validateDefinition } from "@/lib/intelligence/engine";
import type { CohortOptions } from "@/lib/intelligence/overview";
import {
  type BenchmarkScale,
  type CategoryDef,
  EVIDENCE_POLICY_LABEL,
  type EvidencePolicy,
  type Normalization,
  NORMALIZATION_LABEL,
  type RankingDefinition,
  VERIFICATION_LABEL,
  type Verification,
} from "@/lib/intelligence/types";

export interface BuilderBenchmark {
  key: string;
  label: string;
  family: string;
  description: string;
  unit: string;
  verification: Verification;
  defaultNormalization: Normalization;
  defaultTarget?: number;
  scale: BenchmarkScale;
  students: number;
}

const SLOT = (i: number) => `var(--si-${(i % 8) + 1})`;
const VCOLOR: Record<Verification, string> = { verified: "var(--si-3)", external: "var(--si-1)", engine: "var(--si-7)", ai_assessed: "var(--si-5)", self_reported: "var(--si-4)" };
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10));
const COHORT_FIELDS: { name: keyof CohortOptions; label: string }[] = [
  { name: "institutionId", label: "Institution" }, { name: "degreeId", label: "Degree" }, { name: "specializationId", label: "Specialization" },
  { name: "academicYear", label: "Academic year" }, { name: "graduationYear", label: "Graduation year" }, { name: "careerRole", label: "Career goal" },
];

const EMPTY: RankingDefinition = {
  schema: 1, categories: [], cohort: {}, eligibility: { minCoverage: 50, requiredBenchmarks: [] }, evidencePolicy: "exclude_self_reported", missingPolicy: "neutral",
};

function Total({ value, label }: { value: number; label: string }) {
  const ok = Math.abs(value - 100) < 0.01;
  const rest = Math.round((100 - value) * 100) / 100;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
      {ok ? <CheckCircle2 className="size-3.5" /> : <TriangleAlert className="size-3.5" />}
      {label} {Math.round(value * 100) / 100}%{!ok && ` · ${rest > 0 ? `${rest}% left` : `${-rest}% over`}`}
    </span>
  );
}

function WeightInput({ value, onChange, color, label }: { value: number; onChange: (n: number) => void; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 w-full sm:w-56">
      <input type="range" min={0} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} weight slider`} className="flex-1" style={{ accentColor: color }} />
      <input type="number" min={0} max={100} step={0.5} value={value} onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} aria-label={`${label} weight percent`}
        className="w-16 bg-muted/60 border border-border text-xs rounded-md px-1.5 py-1 text-right font-mono tabular-nums outline-none focus:border-primary" />
      <span className="text-[11px] text-muted-foreground">%</span>
    </div>
  );
}

export function RankingBuilder({ catalogue, totalStudents, options, initial }: {
  catalogue: BuilderBenchmark[];
  totalStudents: number;
  options: CohortOptions;
  initial: { id: string; name: string; description: string; status: string; publishedVersion: number; definition: RankingDefinition } | null;
}) {
  const router = useRouter();
  const byKey = useMemo(() => new Map(catalogue.map((b) => [b.key, b])), [catalogue]);
  const families = useMemo(() => [...new Set(catalogue.map((b) => b.family))], [catalogue]);
  const [id, setId] = useState(initial?.id || undefined);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [def, setDef] = useState<RankingDefinition>(initial?.definition ?? EMPTY);
  const [picker, setPicker] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const issues = useMemo(() => validateDefinition(def, new Set(byKey.keys())), [def, byKey]);
  const catTotal = def.categories.reduce((s, c) => s + c.weight, 0);
  const used = new Set(def.categories.flatMap((c) => c.benchmarks.map((b) => b.key)));

  const setCats = (fn: (cs: CategoryDef[]) => CategoryDef[]) => setDef((d) => ({ ...d, categories: fn(d.categories) }));
  const setCat = (cid: string, fn: (c: CategoryDef) => CategoryDef) => setCats((cs) => cs.map((c) => (c.id === cid ? fn(c) : c)));

  const addCategory = (nm = "New category", keys: string[] = []) =>
    setCats((cs) => {
      const w = evenWeights(keys.length);
      return [...cs, { id: uid(), name: nm, weight: 0, benchmarks: keys.map((k, i) => ({ key: k, weight: w[i], normalization: byKey.get(k)!.defaultNormalization, target: byKey.get(k)!.defaultTarget })) }];
    });
  const addFamily = (fam: string) => addCategory(fam, catalogue.filter((b) => b.family === fam && b.students > 0 && !used.has(b.key)).map((b) => b.key));
  const distributeCategories = () => setCats((cs) => { const w = evenWeights(cs.length); return cs.map((c, i) => ({ ...c, weight: w[i] })); });
  const distributeBenchmarks = (cid: string) => setCat(cid, (c) => { const w = evenWeights(c.benchmarks.length); return { ...c, benchmarks: c.benchmarks.map((b, i) => ({ ...b, weight: w[i] })) }; });
  const move = (i: number, d: -1 | 1) => setCats((cs) => { const n = [...cs]; const j = i + d; if (j < 0 || j >= n.length) return cs; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const addBenchmark = (cid: string, key: string) => {
    const b = byKey.get(key)!;
    setCat(cid, (c) => ({ ...c, benchmarks: [...c.benchmarks, { key, weight: c.benchmarks.length ? 0 : 100, normalization: b.defaultNormalization, target: b.defaultTarget }] }));
  };

  const filtered = catalogue.filter((b) => !used.has(b.key) && (!query || b.label.toLowerCase().includes(query.toLowerCase()) || b.family.toLowerCase().includes(query.toLowerCase())));

  const save = (publish: boolean) =>
    start(async () => {
      setMsg(null);
      const r = await saveRankingDraftAction({ id, name, description, definition: def });
      if (!r.ok) return setMsg({ ok: false, text: r.error });
      setId(r.id);
      if (publish && r.id) {
        const p = await publishRankingAction(r.id);
        if (!p.ok) return setMsg({ ok: false, text: p.error });
        setMsg({ ok: true, text: p.message ?? "Published." });
        router.push(`/admin/intelligence/rankings?r=${r.id}`);
        return;
      }
      setMsg({ ok: true, text: r.message ?? "Saved." });
      if (!id && r.id) router.replace(`/admin/intelligence/builder?id=${r.id}`);
    });
  const runPreview = () => start(async () => setPreview(await previewRankingAction(def)));

  const section = "rounded-2xl border border-border bg-card p-5 shadow-2xs";
  const h2 = "text-xs font-bold text-foreground uppercase tracking-wider";
  const btn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
      <div className="xl:col-span-2 space-y-6">
        <section className={section}>
          <h2 className={h2}>1 · Ranking information</h2>
          <div className="mt-3 grid gap-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ranking name, e.g. Placement readiness 2026" maxLength={120}
              className="w-full bg-muted/60 border border-border text-sm rounded-lg px-3 py-2 outline-none focus:border-primary font-semibold" />
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this ranking is for and who should use it" rows={2}
              className="w-full bg-muted/60 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary" />
            {initial?.id && <p className="text-[11px] text-muted-foreground">Status: {initial.status} · {initial.publishedVersion ? `published v${initial.publishedVersion}; edits stay a draft until you publish again` : "never published"}</p>}
          </div>
        </section>

        <section className={section}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className={h2}>2 · Categories & category weights</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Total value={catTotal} label="Total" />
              <button type="button" className={btn} onClick={distributeCategories} disabled={!def.categories.length}><RotateCcw className="size-3.5" /> Even split</button>
              <button type="button" className={btn} onClick={() => addCategory()}><Plus className="size-3.5" /> Category</button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Categories are yours to define. Start from an evidence family or build any combination; there is no fixed list.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {families.map((f) => {
              const avail = catalogue.filter((b) => b.family === f && b.students > 0 && !used.has(b.key)).length;
              return (
                <button key={f} type="button" disabled={!avail} onClick={() => addFamily(f)} className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-border text-[11px] hover:bg-accent disabled:opacity-40" title={avail ? `Add a category with ${avail} benchmarks that have data` : "No unused benchmark with data"}>
                  <Layers className="size-3" /> {f} <span className="text-muted-foreground">({avail})</span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-4">
            {def.categories.length === 0 && <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">No categories yet. Add one, or start from an evidence family above.</p>}
            {def.categories.map((c, ci) => {
              const bTotal = c.benchmarks.reduce((s, b) => s + b.weight, 0);
              return (
                <div key={c.id} className="rounded-xl border border-border bg-background/50 p-4" style={{ borderLeft: `4px solid ${SLOT(ci)}` }}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <input value={c.name} onChange={(e) => setCat(c.id, (x) => ({ ...x, name: e.target.value }))} aria-label="Category name"
                      className="flex-1 bg-transparent border-b border-border text-sm font-semibold py-1 outline-none focus:border-primary" />
                    <WeightInput value={c.weight} onChange={(n) => setCat(c.id, (x) => ({ ...x, weight: n }))} color={SLOT(ci)} label={c.name} />
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label="Move up" className="p-1 rounded hover:bg-accent" onClick={() => move(ci, -1)}><ArrowUp className="size-3.5" /></button>
                      <button type="button" aria-label="Move down" className="p-1 rounded hover:bg-accent" onClick={() => move(ci, 1)}><ArrowDown className="size-3.5" /></button>
                      <button type="button" aria-label="Remove category" className="p-1 rounded hover:bg-accent text-rose-600" onClick={() => setCats((cs) => cs.filter((x) => x.id !== c.id))}><Trash2 className="size-3.5" /></button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Benchmarks & benchmark weights</span>
                    <div className="flex items-center gap-2">
                      {c.benchmarks.length > 0 && <Total value={bTotal} label="Within category" />}
                      <button type="button" className={btn} disabled={!c.benchmarks.length} onClick={() => distributeBenchmarks(c.id)}><RotateCcw className="size-3.5" /> Even</button>
                      <button type="button" className={btn} onClick={() => { setPicker(picker === c.id ? null : c.id); setQuery(""); }}><Plus className="size-3.5" /> Benchmark</button>
                    </div>
                  </div>

                  {picker === c.id && (
                    <div className="mt-2 rounded-lg border border-border bg-card p-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                        <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${catalogue.length} benchmarks (measurements and every skill in the skill graph)…`}
                          className="w-full bg-muted/60 border border-border text-xs rounded-md pl-8 pr-8 py-1.5 outline-none focus:border-primary" />
                        <button type="button" aria-label="Close" className="absolute right-2 top-1.5" onClick={() => setPicker(null)}><X className="size-4 text-muted-foreground" /></button>
                      </div>
                      <ul className="mt-2 max-h-64 overflow-y-auto divide-y divide-border/60">
                        {filtered.slice(0, 80).map((b) => (
                          <li key={b.key}>
                            <button type="button" onClick={() => { addBenchmark(c.id, b.key); setPicker(null); }} className="w-full text-left px-2 py-1.5 hover:bg-accent rounded flex items-center justify-between gap-3">
                              <span className="min-w-0">
                                <span className="block text-xs text-foreground truncate">{b.label}</span>
                                <span className="block text-[10px] text-muted-foreground truncate">{b.family} · {b.description}</span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block text-[10px] font-mono text-foreground">{b.students}/{totalStudents}</span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><span className="size-1.5 rounded-full" style={{ background: VCOLOR[b.verification] }} />{VERIFICATION_LABEL[b.verification]}</span>
                              </span>
                            </button>
                          </li>
                        ))}
                        {filtered.length === 0 && <li className="text-xs text-muted-foreground p-2">No matching unused benchmark.</li>}
                        {filtered.length > 80 && <li className="text-[10px] text-muted-foreground p-2">{filtered.length - 80} more: refine the search.</li>}
                      </ul>
                    </div>
                  )}

                  <ul className="mt-2 space-y-2">
                    {c.benchmarks.map((b) => {
                      const meta = byKey.get(b.key);
                      return (
                        <li key={b.key} className="rounded-lg bg-muted/30 px-3 py-2">
                          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-foreground truncate">{meta?.label ?? `Unknown: ${b.key}`}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: meta ? VCOLOR[meta.verification] : "gray" }} />{meta ? VERIFICATION_LABEL[meta.verification] : "—"}</span>
                                <span>{meta?.students ?? 0} students with data</span>
                              </div>
                            </div>
                            <select value={b.normalization} aria-label="Normalization"
                              onChange={(e) => setCat(c.id, (x) => ({ ...x, benchmarks: x.benchmarks.map((y) => (y.key === b.key ? { ...y, normalization: e.target.value as Normalization, target: y.target ?? meta?.defaultTarget } : y)) }))}
                              className="bg-muted/60 border border-border text-[11px] rounded-md px-1.5 py-1">
                              {(Object.keys(NORMALIZATION_LABEL) as Normalization[]).filter((n) => n !== "absolute" || meta?.scale === "percent").map((n) => <option key={n} value={n}>{NORMALIZATION_LABEL[n]}</option>)}
                            </select>
                            {b.normalization === "target" && (
                              <label className="text-[10px] text-muted-foreground flex items-center gap-1">Target
                                <input type="number" min={0} value={b.target ?? ""} onChange={(e) => setCat(c.id, (x) => ({ ...x, benchmarks: x.benchmarks.map((y) => (y.key === b.key ? { ...y, target: Number(e.target.value) || 0 } : y)) }))}
                                  className="w-16 bg-muted/60 border border-border text-xs rounded-md px-1.5 py-1 font-mono" />
                                <span>{meta?.unit}</span>
                              </label>
                            )}
                            <WeightInput value={b.weight} color={SLOT(ci)} label={meta?.label ?? b.key}
                              onChange={(n) => setCat(c.id, (x) => ({ ...x, benchmarks: x.benchmarks.map((y) => (y.key === b.key ? { ...y, weight: n } : y)) }))} />
                            <button type="button" aria-label="Remove benchmark" className="p-1 rounded hover:bg-accent text-rose-600 self-end lg:self-auto"
                              onClick={() => setCat(c.id, (x) => ({ ...x, benchmarks: x.benchmarks.filter((y) => y.key !== b.key) }))}><X className="size-3.5" /></button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>

          {def.categories.length > 0 && (
            <div className="mt-4">
              <div className="flex h-3 rounded-full overflow-hidden" style={{ background: "var(--si-track)" }} aria-label="Category weight composition">
                {def.categories.map((c, i) => c.weight > 0 && <div key={c.id} title={`${c.name}: ${c.weight}%`} style={{ width: `${Math.min(c.weight, 100)}%`, background: SLOT(i), borderRight: "2px solid var(--card)" }} />)}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                {def.categories.map((c, i) => <span key={c.id} className="inline-flex items-center gap-1"><span className="size-2 rounded-sm" style={{ background: SLOT(i) }} />{c.name} {c.weight}%</span>)}
              </div>
            </div>
          )}
        </section>

        <section className={section}>
          <h2 className={h2}>3 · Student population</h2>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {COHORT_FIELDS.map((f) => (
              <label key={f.name} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground space-y-1">
                <span>{f.label}</span>
                <select value={def.cohort[f.name] ?? ""} onChange={(e) => setDef((d) => ({ ...d, cohort: { ...d.cohort, [f.name]: e.target.value || undefined } }))}
                  className="w-full bg-muted/60 border border-border text-xs rounded-lg px-2 py-1.5 normal-case tracking-normal font-normal text-foreground">
                  <option value="">All</option>
                  {options[f.name].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>
            ))}
          </div>
        </section>

        <section className={section}>
          <h2 className={h2}>4 · Evidence & eligibility</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] font-semibold text-foreground mb-1">Which evidence counts</legend>
              {(Object.keys(EVIDENCE_POLICY_LABEL) as EvidencePolicy[]).map((p) => (
                <label key={p} className="flex items-center gap-2 text-xs"><input type="radio" name="policy" checked={def.evidencePolicy === p} onChange={() => setDef((d) => ({ ...d, evidencePolicy: p }))} />{EVIDENCE_POLICY_LABEL[p]}</label>
              ))}
            </fieldset>
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] font-semibold text-foreground mb-1">When a benchmark has no evidence</legend>
              <label className="flex items-center gap-2 text-xs"><input type="radio" name="missing" checked={def.missingPolicy === "neutral"} onChange={() => setDef((d) => ({ ...d, missingPolicy: "neutral" }))} />Place it at the cohort midpoint (recommended: one strong value can&apos;t top a broad ranking)</label>
              <label className="flex items-center gap-2 text-xs"><input type="radio" name="missing" checked={def.missingPolicy === "renormalize"} onChange={() => setDef((d) => ({ ...d, missingPolicy: "renormalize" }))} />Leave it out and re-weight the rest (for narrow, specialist rankings)</label>
              <label className="flex items-center gap-2 text-xs"><input type="radio" name="missing" checked={def.missingPolicy === "zero"} onChange={() => setDef((d) => ({ ...d, missingPolicy: "zero" }))} />Count it as 0 (penalises students who weren&apos;t measured)</label>
            </fieldset>
            <label className="text-[11px] font-semibold text-foreground space-y-1">
              <span>Minimum evidence coverage to be ranked: {def.eligibility.minCoverage}%</span>
              <input type="range" min={0} max={100} value={def.eligibility.minCoverage} className="w-full" style={{ accentColor: "var(--si-3)" }}
                onChange={(e) => setDef((d) => ({ ...d, eligibility: { ...d.eligibility, minCoverage: Number(e.target.value) } }))} />
              <span className="block text-[10px] font-normal text-muted-foreground">Share of the total weight that must be backed by accepted evidence. Students below it are listed as not ranked, with the reason.</span>
            </label>
            <label className="text-[11px] font-semibold text-foreground space-y-1">
              <span>Firm (not provisional) from {def.eligibility.provisionalCoverage ?? 75}% coverage</span>
              <input type="range" min={0} max={100} value={def.eligibility.provisionalCoverage ?? 75} className="w-full" style={{ color: "var(--si-4)" }}
                onChange={(e) => setDef((d) => ({ ...d, eligibility: { ...d.eligibility, provisionalCoverage: Number(e.target.value) } }))} />
              <span className="block text-[10px] font-normal text-muted-foreground">Below this, a student is still ranked but marked Provisional.</span>
            </label>
            <label className="text-[11px] font-semibold text-foreground space-y-1">
              <span>…and {def.eligibility.minIndependentShare ?? 50}% evidence independent of self-report</span>
              <input type="range" min={0} max={100} value={def.eligibility.minIndependentShare ?? 50} className="w-full" style={{ color: "var(--si-4)" }}
                onChange={(e) => setDef((d) => ({ ...d, eligibility: { ...d.eligibility, minIndependentShare: Number(e.target.value) } }))} />
              <span className="block text-[10px] font-normal text-muted-foreground">Verified, external-platform, engine or AI evidence, as a share of what was scored.</span>
            </label>
            <div className="text-[11px] font-semibold text-foreground space-y-1">
              <span>Required benchmarks (must have evidence)</span>
              <div className="flex flex-wrap gap-1.5">
                {[...used].map((k) => {
                  const on = def.eligibility.requiredBenchmarks.includes(k);
                  return (
                    <button key={k} type="button" onClick={() => setDef((d) => ({ ...d, eligibility: { ...d.eligibility, requiredBenchmarks: on ? d.eligibility.requiredBenchmarks.filter((x) => x !== k) : [...d.eligibility.requiredBenchmarks, k] } }))}
                      className={`px-2 py-0.5 rounded-full border text-[10px] font-normal ${on ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-accent"}`}>
                      {byKey.get(k)?.label ?? k}
                    </button>
                  );
                })}
                {used.size === 0 && <span className="text-[10px] font-normal text-muted-foreground">Add benchmarks first.</span>}
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-20 self-start">
        <section className={section}>
          <h2 className={h2}>Validation</h2>
          {issues.length === 0 ? (
            <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="size-4" /> Ready to publish.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {issues.slice(0, 8).map((i, n) => <li key={n} className="text-[11px] text-amber-700 dark:text-amber-400 flex gap-1.5"><TriangleAlert className="size-3.5 shrink-0 mt-0.5" />{i.message}</li>)}
            </ul>
          )}
          <div className="mt-4 grid gap-2">
            <button type="button" disabled={pending} onClick={runPreview} className={btn}><Eye className="size-3.5" /> Preview on live evidence</button>
            <button type="button" disabled={pending || !name.trim()} onClick={() => save(false)} className={btn}><Save className="size-3.5" /> Save draft</button>
            <button type="button" disabled={pending || !name.trim() || issues.length > 0} onClick={() => save(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50" style={{ background: "var(--si-3)" }}>
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Rocket className="size-3.5" />} Save & publish
            </button>
          </div>
          {msg && <p role="status" className={`mt-3 text-xs ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{msg.text}</p>}
          <p className="mt-3 text-[10px] text-muted-foreground">Publishing freezes an immutable version. Earlier versions and their snapshots are never recalculated.</p>
        </section>

        {preview && (
          <section className={section}>
            <h2 className={h2}>Preview</h2>
            {!preview.ok ? <p className="mt-3 text-xs text-muted-foreground">{preview.error}</p> : (
              <>
                <p className="mt-2 text-[11px] text-muted-foreground">{preview.ranked} of {preview.cohortSize} students ranked.</p>
                <ol className="mt-3 space-y-2">
                  {preview.top.map((t) => (
                    <li key={t.userId} className="text-xs">
                      <div className="flex items-center justify-between gap-2"><span className="truncate"><span className="font-mono font-bold mr-1.5">{t.rank}</span>{t.name}</span><span className="font-mono font-bold">{t.score?.toFixed(1)}</span></div>
                      <div className="mt-1 flex h-1.5 rounded-full overflow-hidden" style={{ background: "var(--si-track)" }}>
                        {t.categories.map((c, i) => <div key={c.name} title={`${c.name}: ${c.score ?? "no evidence"}`} style={{ width: `${((c.score ?? 0) * (def.categories[i]?.weight ?? 0)) / 100}%`, background: SLOT(i) }} />)}
                      </div>
                    </li>
                  ))}
                  {preview.top.length === 0 && <li className="text-xs text-muted-foreground">No student meets the eligibility rules.</li>}
                </ol>
                {preview.topReasons.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Why students aren&apos;t ranked</div>
                    <ul className="mt-1.5 space-y-1">{preview.topReasons.map((r) => <li key={r.reason} className="text-[11px] text-muted-foreground">{r.students} · {r.reason}</li>)}</ul>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
