// SVG charts for Student Intelligence. Server-renderable (no chart library, no client JS): every mark has a native
// tooltip (<title>) and a hover highlight from intelligence.css. Colours come from the scoped --si-* palette; text always
// uses the theme's text colours, never a series colour.

import type { ReactNode } from "react";

import type { Verification } from "@/lib/intelligence/types";
import { VERIFICATION_LABEL } from "@/lib/intelligence/types";

export const SLOT = (i: number) => `var(--si-${(i % 8) + 1})`;

export const VERIFICATION_COLOR: Record<Verification, string> = {
  verified: "var(--si-3)",
  external: "var(--si-1)",
  engine: "var(--si-7)",
  ai_assessed: "var(--si-5)",
  self_reported: "var(--si-4)",
};

const fmt = (n: number, d = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: d, minimumFractionDigits: 0 });

export function Card({ title, subtitle, source, children, className = "", action }: { title: string; subtitle?: string; source?: string; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-5 shadow-2xs ${className}`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">{title}</h2>
          {subtitle && <p className="mt-1 text-[11px] text-muted-foreground leading-snug">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
      {source && <p className="mt-3 text-[10px] text-muted-foreground">Source: {source}</p>}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground py-6 text-center border border-dashed border-border rounded-xl">{children}</p>;
}

/** Horizontal bars: magnitude by category. One colour per bar only when the bars are different entities. */
export function BarList({ items, color, max, unit = "", colorBy = "single" }: {
  items: { label: string; value: number; display?: string; href?: string }[];
  color?: string;
  max?: number;
  unit?: string;
  colorBy?: "single" | "slot";
}) {
  if (!items.length) return <Empty>No data yet.</Empty>;
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-2.5 si-marks">
      {items.map((it, i) => {
        const pct = top > 0 ? Math.max(0, Math.min(100, (it.value / top) * 100)) : 0;
        const fill = colorBy === "slot" ? SLOT(i) : color ?? SLOT(0);
        return (
          <li key={it.label + i} className="si-mark" title={`${it.label}: ${it.display ?? fmt(it.value, 1)}${unit}`}>
            <div className="flex items-baseline justify-between gap-3 text-[11px]">
              <span className="truncate text-foreground">{it.label}</span>
              <span className="font-mono tabular-nums text-muted-foreground shrink-0">{it.display ?? fmt(it.value, 1)}{unit}</span>
            </div>
            <div className="mt-1 h-2 rounded-full" style={{ background: "var(--si-track)" }}>
              <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: fill, minWidth: it.value > 0 ? 4 : 0 }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Vertical columns (histograms, monthly counts). */
export function Columns({ items, color = SLOT(0), height = 140, unit = "" }: { items: { label: string; value: number }[]; color?: string; height?: number; unit?: string }) {
  if (!items.length || items.every((i) => i.value === 0)) return <Empty>No data in this range.</Empty>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const w = 100 / items.length;
  return (
    <div>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full si-marks" style={{ height }} role="img" aria-label="Column chart">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={100} y1={height * g} y2={height * g} stroke="var(--si-grid)" strokeWidth={0.3} vectorEffect="non-scaling-stroke" />)}
        {items.map((it, i) => {
          const h = (it.value / max) * (height - 4);
          return (
            <rect key={it.label} className="si-mark" x={i * w + w * 0.14} width={w * 0.72} y={height - h} height={Math.max(h, it.value > 0 ? 1.5 : 0)} rx={0.8} fill={color}>
              <title>{`${it.label}: ${fmt(it.value)}${unit}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1.5 flex text-[9px] text-muted-foreground font-mono">
        {items.map((it, i) => (
          <span key={it.label} className="text-center truncate" style={{ width: `${w}%` }}>{items.length > 12 && i % 2 ? "" : it.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Donut for a part-to-whole of a few named parts, always with a labelled legend (identity never colour-alone). */
export function Donut({ items, center, sub }: { items: { label: string; value: number; color: string }[]; center?: string; sub?: string }) {
  const total = items.reduce((s, i) => s + i.value, 0);
  if (!total) return <Empty>No evidence recorded yet.</Empty>;
  const r = 40;
  const c = 2 * Math.PI * r;
  const arcs = items.filter((i) => i.value > 0).map((it) => ({ ...it, len: (it.value / total) * c }));
  const offsets = arcs.map((_, i) => arcs.slice(0, i).reduce((s, a) => s + a.len, 0));
  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <svg viewBox="0 0 100 100" className="size-36 shrink-0 -rotate-90 si-marks" role="img" aria-label="Donut chart">
        <circle cx={50} cy={50} r={r} fill="none" stroke="var(--si-track)" strokeWidth={12} />
        {arcs.map((it, i) => {
          const gap = arcs.length > 1 ? Math.min(1.2, it.len / 3) : 0;
          return (
            <circle key={it.label} className="si-mark" cx={50} cy={50} r={r} fill="none" stroke={it.color} strokeWidth={12}
              strokeDasharray={`${Math.max(it.len - gap, 0.1)} ${c}`} strokeDashoffset={-offsets[i]}>
              <title>{`${it.label}: ${fmt(it.value)} (${fmt((it.value / total) * 100, 1)}%)`}</title>
            </circle>
          );
        })}
        {center && (
          <text x={50} y={50} transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="central" className="fill-foreground" style={{ fontSize: 14, fontWeight: 800 }}>
            {center}
          </text>
        )}
      </svg>
      <ul className="space-y-1.5 text-[11px] w-full">
        {items.map((it) => (
          <li key={it.label} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 min-w-0"><span className="size-2.5 rounded-sm shrink-0" style={{ background: it.color }} /><span className="truncate text-foreground">{it.label}</span></span>
            <span className="font-mono tabular-nums text-muted-foreground">{fmt(it.value)} · {fmt((it.value / total) * 100, 0)}%</span>
          </li>
        ))}
        {sub && <li className="text-[10px] text-muted-foreground pt-1">{sub}</li>}
      </ul>
    </div>
  );
}

/** Radar for one student's category profile against a reference (e.g. cohort median). Max 3 series. Null = no evidence (gap in the shape, not 0). */
export function Radar({ axes, series }: { axes: string[]; series: { name: string; values: (number | null)[]; color: string; dashed?: boolean }[] }) {
  if (axes.length < 3) return <Empty>A radar needs at least three categories; see the bars instead.</Empty>;
  const cx = 110, cy = 110, R = 80;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    return [cx + Math.cos(a) * R * (v / 100), cy + Math.sin(a) * R * (v / 100)] as const;
  };
  return (
    <div>
      <svg viewBox="0 0 220 220" className="w-full max-w-[320px] mx-auto" role="img" aria-label="Category radar">
        {[25, 50, 75, 100].map((g) => (
          <polygon key={g} points={axes.map((_, i) => pt(i, g).join(",")).join(" ")} fill="none" stroke="var(--si-grid)" strokeWidth={0.8} />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 100);
          const [lx, ly] = pt(i, 122);
          return (
            <g key={a}>
              <line x1={cx} y1={cy} x2={x} y2={y} stroke="var(--si-grid)" strokeWidth={0.8} />
              <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central" className="fill-muted-foreground" style={{ fontSize: 7.5 }}>{a.length > 16 ? `${a.slice(0, 15)}…` : a}</text>
            </g>
          );
        })}
        {series.map((s) => (
          <g key={s.name}>
            <polygon points={s.values.map((v, i) => pt(i, v ?? 0).join(",")).join(" ")} fill={s.color} fillOpacity={s.dashed ? 0 : 0.16} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinejoin="round" />
            {s.values.map((v, i) => {
              if (v === null) return null;
              const [x, y] = pt(i, v);
              return <circle key={i} cx={x} cy={y} r={3.2} fill={s.color} stroke="var(--card)" strokeWidth={1.5}><title>{`${s.name} · ${axes[i]}: ${fmt(v, 1)}`}</title></circle>;
            })}
          </g>
        ))}
      </svg>
      <div className="flex flex-wrap justify-center gap-4 text-[11px] mt-1">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-foreground"><span className="w-3 h-0.5 rounded" style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
    </div>
  );
}

/** GitHub-style activity calendar, one sequential hue (GitHub's own 0–4 quartile levels). */
export function ActivityCalendar({ days }: { days: { date: string; count: number; level: number }[] }) {
  if (!days.length) return <Empty>No contribution calendar synced.</Empty>;
  const first = new Date(days[0].date);
  const pad = first.getUTCDay();
  const cells = [...Array(pad).fill(null), ...days] as ({ date: string; count: number; level: number } | null)[];
  const weeks = Math.ceil(cells.length / 7);
  const s = 11;
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${weeks * s} ${7 * s}`} className="min-w-[560px] w-full si-marks" role="img" aria-label="Contribution calendar">
        {cells.map((d, i) => d && (
          <rect key={d.date} className={`si-mark si-seq-${Math.max(0, Math.min(4, d.level))}`} x={Math.floor(i / 7) * s} y={(i % 7) * s} width={s - 2} height={s - 2} rx={2}>
            <title>{`${d.date}: ${d.count} contribution${d.count === 1 ? "" : "s"}`}</title>
          </rect>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
        Less
        {[0, 1, 2, 3, 4].map((l) => <svg key={l} viewBox="0 0 10 10" className="size-2.5"><rect className={`si-seq-${l}`} width={10} height={10} rx={2} /></svg>)}
        More
      </div>
    </div>
  );
}

/** Rank over snapshots: a single series, lower is better, so the axis is inverted. */
export function RankLine({ points, total }: { points: { at: string; rank: number }[]; total: number }) {
  if (points.length < 2) return <Empty>Rank history appears after two snapshots of the same ranking.</Empty>;
  const W = 300, H = 110, P = 14;
  const maxR = Math.max(total, ...points.map((p) => p.rank), 2);
  const x = (i: number) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (r: number) => P + ((r - 1) / (maxR - 1)) * (H - 2 * P);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.rank)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Rank history">
      <line x1={P} x2={W - P} y1={y(1)} y2={y(1)} stroke="var(--si-grid)" />
      <text x={W - P} y={y(1) - 4} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 8 }}>#1</text>
      <path d={d} fill="none" stroke={SLOT(0)} strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.rank)} r={4} fill={SLOT(0)} stroke="var(--card)" strokeWidth={2}>
          <title>{`${new Date(p.at).toLocaleDateString("en-IN")}: #${p.rank}`}</title>
        </circle>
      ))}
    </svg>
  );
}

/** Compact 0–100 bar for tables. Null renders as an explicit "no evidence" state, never as 0. */
export function ScoreCell({ value, color = SLOT(0) }: { value: number | null; color?: string }) {
  if (value === null) return <span className="text-[10px] text-muted-foreground italic">no evidence</span>;
  return (
    <div className="flex items-center gap-2 min-w-[86px]" title={fmt(value, 1)}>
      <div className="h-1.5 flex-1 rounded-full" style={{ background: "var(--si-track)" }}>
        <div className="h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
      </div>
      <span className="font-mono tabular-nums text-[11px] text-foreground w-8 text-right">{fmt(value, 0)}</span>
    </div>
  );
}

export function VerificationBadge({ v }: { v: Verification | null }) {
  if (!v) return <span className="text-[10px] text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-foreground">
      <span className="size-2 rounded-full" style={{ background: VERIFICATION_COLOR[v] }} />
      {VERIFICATION_LABEL[v]}
    </span>
  );
}

export function Kpi({ label, value, sub, color, href }: { label: string; value: string; sub?: string; color: string; href?: string }) {
  const inner = (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs h-full relative overflow-hidden">
      <span className="absolute left-0 top-0 h-full w-1" style={{ background: color }} />
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="mt-1.5 text-2xl font-extrabold tracking-tight text-foreground tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
  return href ? <a href={href} className="block hover:opacity-90 transition-opacity">{inner}</a> : inner;
}
