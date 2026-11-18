import { Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { sql } from "drizzle-orm";

import { Card, Empty, SLOT, VerificationBadge } from "@/components/admin/intelligence/charts";
import { db } from "@/db";
import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { runRanking } from "@/lib/intelligence/rankings";
import { resolveRanking } from "@/lib/intelligence/resolve";

const MAX = 5;
const fmt = (n: number, d = 1) => n.toLocaleString("en-IN", { maximumFractionDigits: d });

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string; q?: string; r?: string }> }) {
  const ctx = await requireAdminPermission("intelligence.read");
  const sp = await searchParams;
  const ids = [...new Set((sp.ids ?? "").split(",").filter((x) => /^[0-9a-f-]{36}$/i.test(x)))].slice(0, MAX);
  const ranking = await resolveRanking(sp.r);
  const run = await runRanking(ranking.definition);
  const byId = new Map(run.results.map((r) => [r.userId, r]));
  const people = new Map(run.cohort.map((s) => [s.id, s]));
  const chosen = ids.filter((i) => byId.has(i));
  const missing = ids.filter((i) => !byId.has(i));
  if (chosen.length) await recordAdminAudit({ actorId: ctx.user.id, actorEmail: ctx.user.email || "admin", action: "intelligence.compare", resource: "student_360", details: { students: chosen } });

  let found: { id: string; name: string | null; email: string | null }[] = [];
  if (sp.q?.trim() && chosen.length < MAX) {
    const q = `%${sp.q.trim()}%`;
    const { rows } = await db.execute(sql`SELECT id::text AS id, name, email FROM users WHERE role = 'student' AND deleted_at IS NULL AND (name ILIKE ${q} OR email ILIKE ${q}) ORDER BY name LIMIT 10`);
    found = (rows as typeof found).filter((r) => !chosen.includes(r.id));
  }
  const link = (next: string[]) => `/admin/intelligence/compare?ids=${next.join(",")}${sp.r ? `&r=${sp.r}` : ""}`;
  const cats = run.definition.categories;

  return (
    <div className="space-y-6">
      <Card title="Students to compare" subtitle={`Up to ${MAX}, compared on “${ranking.name}”. Scores are normalised within that ranking's cohort, so they're comparable; missing evidence is flagged, not zero.`}>
        <div className="flex flex-wrap gap-2">
          {chosen.map((id, i) => (
            <span key={id} className="inline-flex items-center gap-2 pl-2.5 pr-1 py-1 rounded-full border border-border text-xs">
              <span className="size-2.5 rounded-full" style={{ background: SLOT(i) }} />
              <Link href={`/admin/intelligence/students/${id}`} className="text-foreground hover:text-primary">{people.get(id)?.name || people.get(id)?.email}</Link>
              <Link href={link(chosen.filter((x) => x !== id))} aria-label="Remove" className="p-0.5 rounded-full hover:bg-accent"><X className="size-3" /></Link>
            </span>
          ))}
          {chosen.length === 0 && <span className="text-xs text-muted-foreground">Search below to add students.</span>}
        </div>
        {missing.length > 0 && <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">{missing.length} selected student(s) are outside this ranking&apos;s cohort and can&apos;t be compared on it.</p>}
        {chosen.length < MAX && (
          <form method="GET" className="mt-4 flex gap-2">
            <input type="hidden" name="ids" value={chosen.join(",")} />
            {sp.r && <input type="hidden" name="r" value={sp.r} />}
            <span className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <input name="q" defaultValue={sp.q} placeholder="Find a student by name or email" className="w-full bg-muted/60 border border-border text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-primary" />
            </span>
            <button className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">Search</button>
          </form>
        )}
        {found.length > 0 && (
          <ul className="mt-2 divide-y divide-border/60 max-w-md">
            {found.map((f) => (
              <li key={f.id}><Link href={link([...chosen, f.id])} className="flex items-center justify-between gap-2 py-1.5 text-xs hover:text-primary"><span>{f.name || "Unnamed"} <span className="text-muted-foreground">{f.email}</span></span><Plus className="size-3.5" /></Link></li>
            ))}
          </ul>
        )}
      </Card>

      {chosen.length < 2 ? <Empty>Pick at least two students to compare.</Empty> : (
        <>
          <Card title="Category scores" subtitle="Grouped by category; each colour is one student, in the order above.">
            <div className="space-y-4">
              {cats.map((c, ci) => (
                <div key={c.id}>
                  <div className="text-[11px] font-semibold text-foreground mb-1.5">{c.name} <span className="text-muted-foreground font-normal">({c.weight}%)</span></div>
                  <div className="space-y-1">
                    {chosen.map((id, i) => {
                      const v = byId.get(id)!.categories[ci]?.score ?? null;
                      return (
                        <div key={id} className="flex items-center gap-2 text-[11px]" title={`${people.get(id)?.name}: ${v === null ? "no evidence" : fmt(v)}`}>
                          <div className="flex-1 h-2.5 rounded-full" style={{ background: "var(--si-track)" }}>
                            {v !== null && <div className="h-2.5 rounded-full" style={{ width: `${v}%`, background: SLOT(i), minWidth: 4 }} />}
                          </div>
                          <span className="w-20 text-right font-mono tabular-nums text-foreground">{v === null ? <span className="italic text-muted-foreground">no evidence</span> : fmt(v)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Benchmark detail" subtitle="Raw values with their verification level. A dash means no accepted evidence.">
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr><th className="py-2 px-4">Benchmark</th>{chosen.map((id, i) => <th key={id} className="py-2 px-4 whitespace-nowrap"><span className="inline-block size-2 rounded-full mr-1.5" style={{ background: SLOT(i) }} />{people.get(id)?.name?.split(" ")[0] || "Student"}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <tr className="font-semibold"><td className="py-2 px-4 text-foreground">Rank · score · coverage</td>{chosen.map((id) => { const r = byId.get(id)!; return <td key={id} className="py-2 px-4 text-foreground">{r.rank ? `#${r.rank}` : "not ranked"} · {r.score === null ? "—" : fmt(r.score)} · {fmt(r.coverage, 0)}%</td>; })}</tr>
                  {cats.flatMap((c) => c.benchmarks.map((b, bi) => (
                    <tr key={`${c.id}-${b.key}`}>
                      <td className="py-2 px-4 text-foreground">{byId.get(chosen[0])!.categories.find((x) => x.id === c.id)?.benchmarks[bi]?.label ?? b.key}<div className="text-[10px] text-muted-foreground">{c.name}</div></td>
                      {chosen.map((id) => {
                        const br = byId.get(id)!.categories.find((x) => x.id === c.id)?.benchmarks[bi];
                        return <td key={id} className="py-2 px-4">{br?.status === "scored" ? <><span className="font-mono text-foreground">{fmt(br.raw ?? 0)}</span> <span className="text-[10px] text-muted-foreground">→ {fmt(br.normalized ?? 0, 0)}</span><div><VerificationBadge v={br.verification} /></div></> : <span className="text-muted-foreground">—</span>}</td>;
                      })}
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
