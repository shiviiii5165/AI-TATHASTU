import { Search } from "lucide-react";

import { Card, SLOT, VerificationBadge } from "@/components/admin/intelligence/charts";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { loadCatalogue, loadSignals, SKILL_FAMILY } from "@/lib/intelligence/catalogue";
import { NORMALIZATION_LABEL } from "@/lib/intelligence/types";

const fmt = (n: number, d = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: d });

export default async function BenchmarksPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPermission("intelligence.read");
  const { q } = await searchParams;
  const { list, skills } = await loadCatalogue();
  const signals = await loadSignals({}, skills);
  const stats = new Map<string, number[]>();
  for (const row of signals.values()) for (const [k, v] of row) stats.set(k, [...(stats.get(k) ?? []), v.value]);
  const needle = q?.trim().toLowerCase();
  const visible = list.filter((b) => !needle || b.label.toLowerCase().includes(needle) || b.family.toLowerCase().includes(needle));
  const families = [...new Set(visible.map((b) => b.family))];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs text-xs text-muted-foreground space-y-1.5">
        <p><span className="font-semibold text-foreground">{fmt(list.length)} benchmarks</span>: {fmt(list.length - skills.length)} measurements of kinds of evidence, plus one per skill in the skill graph ({fmt(skills.length)}, read live from the <span className="font-mono">skills</span> table).</p>
        <p>Nothing here names a fixed technology or career. A new skill appears as soon as the engine meets it in any student&apos;s evidence; rankings choose and weight benchmarks freely. Benchmarks for CGPA from an institution, assessments, mentorship and interviews will join the catalogue once those sources exist.</p>
      </div>
      <form method="GET" className="relative max-w-md">
        <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
        <input name="q" defaultValue={q} placeholder="Search benchmarks or families…" className="w-full bg-card border border-border text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-primary" />
      </form>
      {families.map((fam, fi) => {
        const items = visible.filter((b) => b.family === fam);
        const shown = fam === SKILL_FAMILY ? items.sort((a, b) => (stats.get(b.key)?.length ?? 0) - (stats.get(a.key)?.length ?? 0)).slice(0, 150) : items;
        return (
          <Card key={fam} title={`${fam} · ${items.length}`} subtitle={fam === SKILL_FAMILY ? "Career-engine proficiency per skill. Verification follows each value's strongest evidence. Sorted by students with data." : undefined}>
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr><th className="py-2 px-4">Benchmark</th><th className="py-2 px-4">Evidence</th><th className="py-2 px-4">Default normalisation</th><th className="py-2 px-4 w-48">Students with data</th><th className="py-2 px-4">Median</th></tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {shown.map((b) => {
                    const vs = (stats.get(b.key) ?? []).sort((a, c) => a - c);
                    const med = vs.length ? vs[Math.floor(vs.length / 2)] : null;
                    const share = signals.size ? (vs.length / signals.size) * 100 : 0;
                    return (
                      <tr key={b.key} className="align-top">
                        <td className="py-2.5 px-4">
                          <div className="font-medium text-foreground flex items-center gap-2">{b.label}
                            {vs.length > 0 && <a href={`/admin/intelligence/builder?preset=${encodeURIComponent(b.key)}`} className="text-[10px] font-semibold text-primary hover:underline">Rank by this</a>}
                          </div>
                          {fam !== SKILL_FAMILY && <div className="text-[11px] text-muted-foreground max-w-xl">{b.description}</div>}
                        </td>
                        <td className="py-2.5 px-4"><VerificationBadge v={b.verification} /><div className="text-[10px] text-muted-foreground">{b.source}</div></td>
                        <td className="py-2.5 px-4 text-muted-foreground">{NORMALIZATION_LABEL[b.defaultNormalization]}{b.defaultTarget ? ` (${b.defaultTarget} ${b.unit})` : ""}</td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2"><div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--si-track)" }}><div className="h-1.5 rounded-full" style={{ width: `${share}%`, background: SLOT(fi), minWidth: vs.length ? 3 : 0 }} /></div><span className="font-mono tabular-nums text-foreground">{fmt(vs.length)}</span></div>
                        </td>
                        <td className="py-2.5 px-4 font-mono tabular-nums text-foreground">{med === null ? "—" : `${fmt(med, 1)} ${b.unit}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {shown.length < items.length && <p className="px-5 pt-2 text-[11px] text-muted-foreground">{items.length - shown.length} more skills: search to find one.</p>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
