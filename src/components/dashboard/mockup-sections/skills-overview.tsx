"use client";

import { ArrowRight, BadgeCheck, ExternalLink, Lightbulb, MessageSquareQuote, Network, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  CLUSTERS,
  RELATIONSHIP_LABEL,
  clusterOf,
  confidenceLabel,
  evidenceKind,
  evidenceMix,
  groupEvidence,
  skillClusters,
  visibleEdges,
  whyIdentified,
} from "@/lib/dashboard/skill-intel";
import type { SkillGraphData, SkillGraphEdge, SkillGraphNode, SkillStatus } from "@/lib/dashboard/types";

/**
 * Skills Intelligence: the engine's skill graph as an evidence-backed clustered network.
 *  - Skills are grouped by their catalogue category, each group with its own colour.
 *  - How a skill is known is shown by its shape: solid (verified by independent work), outlined
 *    (only your own claim) or dashed (suggested from related skills, never scored).
 *  - Lines are drawn only for edges the engine recorded: solid where two skills were used in the same
 *    repository, project or job; dashed where a documented relation links them (shown on selection).
 *  - Selecting a skill shows why it was identified and the evidence actually recorded for it.
 * The full graph lives on /skills.
 */
const MAX_NODES = 14;
const MAX_RELATED = 5;

const ORDER: Record<SkillStatus, number> = { verified: 0, claimed: 1, inferred: 2 };
const STATUS_LABEL: Record<SkillStatus, string> = { verified: "Verified", claimed: "Claimed by you", inferred: "AI-suggested" };

export function topSkills(graph: SkillGraphData | undefined, max = MAX_NODES): SkillGraphNode[] {
  if (!graph?.nodes.length) return [];
  return [...graph.nodes]
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.proficiency ?? -1) - (a.proficiency ?? -1) || b.evidenceCount - a.evidenceCount || a.name.localeCompare(b.name))
    .slice(0, max);
}

export function relatedSkills(graph: SkillGraphData | undefined, id: string, max = MAX_RELATED) {
  if (!graph) return [];
  const names = new Map(graph.nodes.map((n) => [n.id, n.name]));
  return graph.edges
    .filter((e) => e.source === id || e.target === id)
    .sort((a, b) => Number(b.basis === "evidence") - Number(a.basis === "evidence") || b.weight - a.weight)
    .slice(0, max)
    .map((e) => {
      const other = e.source === id ? e.target : e.source;
      return { id: other, name: names.get(other) ?? other, inGraph: names.has(other), edge: e };
    });
}

type Point = { x: number; y: number };

export function SkillsOverview({ skillGraph }: { skillGraph?: SkillGraphData }) {
  const nodes = useMemo(() => topSkills(skillGraph), [skillGraph]);
  const clusters = useMemo(() => skillClusters(nodes), [nodes]);
  const ids = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(() => visibleEdges(skillGraph, ids), [skillGraph, ids]);
  const evidenceEdges = edges.filter((e) => e.basis === "evidence");
  const mix = useMemo(() => evidenceMix(nodes), [nodes]);
  const mixTotal = mix.reduce((s, m) => s + m.count, 0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const focusId = selectedId ?? hoverId;
  const selected = nodes.find((n) => n.id === selectedId) ?? skillGraph?.nodes.find((n) => n.id === selectedId) ?? null;
  const related = useMemo(() => (selected ? relatedSkills(skillGraph, selected.id) : []), [selected, skillGraph]);
  const neighbours = useMemo(() => {
    if (!focusId) return null;
    const s = new Set([focusId]);
    for (const e of edges) if (e.source === focusId || e.target === focusId) s.add(e.source === focusId ? e.target : e.source);
    return s;
  }, [focusId, edges]);

  const counts = useMemo(() => ({ verified: nodes.filter((n) => n.status === "verified").length, claimed: nodes.filter((n) => n.status === "claimed").length, inferred: nodes.filter((n) => n.status === "inferred").length }), [nodes]);
  const more = skillGraph ? Math.max(0, skillGraph.totalSkills - nodes.length) : 0;

  // Edge geometry: measured from where the skill buttons actually render, so lines always join real nodes.
  const box = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const [points, setPoints] = useState<Map<string, Point>>(new Map());
  const [size, setSize] = useState({ w: 0, h: 0 });
  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const next = new Map<string, Point>();
    refs.current.forEach((b, id) => {
      const br = b.getBoundingClientRect();
      next.set(id, { x: br.left - r.left + br.width / 2, y: br.top - r.top + br.height / 2 });
    });
    setPoints(next);
    setSize({ w: r.width, h: r.height });
  }, []);
  useLayoutEffect(() => {
    measure();
    const el = box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, nodes]);

  const close = useCallback(() => {
    const opener = selectedId ? refs.current.get(selectedId) : null;
    setSelectedId(null);
    opener?.focus();
  }, [selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, close]);

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5" data-testid="skills-overview">
      <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 size-52 rounded-full bg-gradient-to-br from-violet-400/15 via-sky-400/10 to-teal-400/10 blur-2xl" />
      <div className="relative flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 via-sky-500 to-teal-400 text-white shadow-sm shadow-sky-500/30">
            <Network aria-hidden className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-foreground">Skills Intelligence</h2>
        </div>
        <Link href="/skills" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <span>Full graph</span>
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>

      {nodes.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <p className="text-xs font-semibold text-foreground">No skills identified yet</p>
          <p className="mt-1 max-w-[280px] text-[11px] text-muted-foreground">
            Skills appear here once there&apos;s evidence for them: a GitHub repository, a project or job on your confirmed resume, a certification or an assessment. Nothing is guessed in the meantime.
          </p>
          <div className="mt-3 flex gap-3">
            <Link href="/connections" className="text-xs font-semibold text-primary hover:underline">
              Connect GitHub
            </Link>
            <Link href="/onboarding/resume" className="text-xs font-semibold text-primary hover:underline">
              Confirm your resume
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Where the evidence comes from: counts of recorded evidence items behind the skills shown. */}
          {mixTotal > 0 && (
            <div className="relative mt-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold text-foreground">Evidence behind these skills</p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {counts.verified} verified · {counts.claimed} claimed · {counts.inferred} suggested
                </p>
              </div>
              <div className="mt-1.5 flex h-2 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Evidence: ${mix.map((m) => `${m.count} from ${evidenceKind(m.kind).label}`).join(", ")}`}>
                {mix.map((m) => (
                  <span key={m.kind} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(m.count / mixTotal) * 100}%`, background: evidenceKind(m.kind).hex }} title={`${evidenceKind(m.kind).label}: ${m.count}`} />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                {mix.map((m) => (
                  <span key={m.kind} className="flex items-center gap-1">
                    <span aria-hidden className="size-1.5 rounded-full" style={{ background: evidenceKind(m.kind).hex }} />
                    {evidenceKind(m.kind).label} {m.count}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div ref={box} className="relative mt-3" data-testid="skill-network">
            <svg aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-visible" width={size.w} height={size.h}>
              {edges.map((e, i) => (
                <EdgePath key={`${e.source}-${e.target}`} edge={e} a={points.get(e.source)} b={points.get(e.target)} focusId={focusId} index={i} nodes={nodes} />
              ))}
            </svg>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {clusters.map((c) => {
                const meta = CLUSTERS[c.key];
                return (
                  <div key={c.key} className={`rounded-xl border p-2 ${meta.soft} ${c.nodes.length > 4 ? "sm:col-span-2" : ""}`} data-cluster={c.key}>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: c.key === "suggested" ? undefined : meta.hex }}>
                      <span aria-hidden className="size-1.5 rounded-full" style={{ background: meta.hex }} />
                      <span className={c.key === "suggested" ? "text-muted-foreground" : ""}>{meta.label}</span>
                      <span className="font-semibold text-muted-foreground">{c.nodes.length}</span>
                    </p>
                    <ul className="flex flex-wrap gap-1.5" aria-label={meta.label}>
                      {c.nodes.map((n, i) => (
                        <li key={n.id}>
                          <SkillNode
                            node={n}
                            index={i}
                            active={n.id === selectedId}
                            dimmed={neighbours !== null && !neighbours.has(n.id)}
                            ref={(el) => {
                              if (el) refs.current.set(n.id, el);
                              else refs.current.delete(n.id);
                            }}
                            onSelect={() => setSelectedId(n.id === selectedId ? null : n.id)}
                            onHover={(on) => setHoverId(on ? n.id : null)}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <div aria-live="polite" className="relative">
            {selected ? (
              <SkillDetail node={selected} related={related} onSelect={(id) => setSelectedId(id)} onClose={close} />
            ) : (
              <p className="mt-3 rounded-xl bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
                Select a skill to see why it was identified and the evidence behind it.{" "}
                {evidenceEdges.length > 0
                  ? `Lines join skills used together in the same repository, project or job (${evidenceEdges.length}).`
                  : "None of these skills share a repository, project or job yet, so no links are drawn."}
              </p>
            )}
          </div>

          <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span aria-hidden className="size-2.5 rounded-full bg-gradient-to-br from-violet-500 to-sky-500" />
              Verified
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden className="size-2.5 rounded-full border-2 border-violet-500 bg-card" />
              Claimed
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden className="size-2.5 rounded-full border border-dashed border-muted-foreground" />
              Suggested
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden className="h-0.5 w-4 rounded bg-sky-500" />
              Used together
            </span>
            <span className="flex items-center gap-1">
              <span aria-hidden className="w-4 border-t border-dashed border-muted-foreground" />
              Documented relation
            </span>
            {more > 0 && <span className="ml-auto">{more} more on Skills</span>}
          </div>
        </>
      )}
    </section>
  );
}

function EdgePath({ edge, a, b, focusId, index, nodes }: { edge: SkillGraphEdge; a?: Point; b?: Point; focusId: string | null; index: number; nodes: SkillGraphNode[] }) {
  if (!a || !b) return null;
  const touches = focusId !== null && (edge.source === focusId || edge.target === focusId);
  const isEvidence = edge.basis === "evidence";
  // Documented relations stay hidden until one of their skills is in focus, so the default view is only real co-use.
  if (!isEvidence && !touches) return null;
  const src = nodes.find((n) => n.id === edge.source);
  const hex = src ? CLUSTERS[clusterOf(src)].hex : "#64748b";
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Arc clear of the pills in between, so a link never looks like it runs through another skill.
  const bend = Math.min(56, 14 + len * 0.3);
  const sign = dx >= 0 ? -1 : 1;
  const d = `M ${a.x} ${a.y} Q ${mx + sign * (dy / len) * bend * -1} ${my + sign * (dx / len) * bend} ${b.x} ${b.y}`;
  const faded = focusId !== null && !touches;
  return isEvidence ? (
    <path
      d={d}
      data-basis="evidence"
      pathLength={1}
      strokeDasharray="1"
      fill="none"
      stroke={hex}
      strokeLinecap="round"
      strokeWidth={touches ? 2.5 : 1.25 + Math.min(edge.weight, 3) * 0.35}
      strokeOpacity={faded ? 0.08 : touches ? 0.9 : 0.4}
      style={{ animationDelay: `${300 + index * 60}ms`, filter: touches ? `drop-shadow(0 0 3px ${hex})` : undefined }}
      className="transition-[stroke-opacity,stroke-width] duration-200 motion-safe:animate-[graphLinkDraw_700ms_ease-out_both] motion-reduce:animate-none"
    />
  ) : (
    <path d={d} data-basis="ontology" fill="none" stroke="currentColor" strokeDasharray="3 4" strokeWidth={1.25} className="text-muted-foreground/70 motion-safe:animate-in motion-safe:fade-in" />
  );
}

type NodeProps = { node: SkillGraphNode; index: number; active: boolean; dimmed: boolean; onSelect: () => void; onHover: (on: boolean) => void; ref: (el: HTMLButtonElement | null) => void };

function SkillNode({ node, index, active, dimmed, onSelect, onHover, ref }: NodeProps) {
  const hex = CLUSTERS[clusterOf(node)].hex;
  const shape =
    node.status === "verified"
      ? { className: "text-white shadow-sm", style: { background: `linear-gradient(135deg, ${hex}, ${hex}cc)`, boxShadow: active ? `0 0 0 3px ${hex}40, 0 0 14px ${hex}80` : `0 1px 6px ${hex}40` } }
      : node.status === "claimed"
        ? { className: "bg-card text-foreground", style: { border: `2px solid ${hex}`, boxShadow: active ? `0 0 0 3px ${hex}33` : undefined } }
        : { className: "bg-card text-muted-foreground border border-dashed border-muted-foreground/60", style: { boxShadow: active ? `0 0 0 3px ${hex}33` : undefined } };
  const score = node.proficiency;
  return (
    <button
      type="button"
      ref={ref}
      aria-pressed={active}
      aria-label={`${node.name}: ${STATUS_LABEL[node.status]}${score === null ? ", not scored" : `, ${node.level}`}, ${node.evidenceCount} evidence ${node.evidenceCount === 1 ? "item" : "items"}`}
      onClick={onSelect}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      style={{ ...shape.style, animationDelay: `${index * 50}ms` }}
      className={`relative z-20 inline-flex max-w-[11rem] items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-[opacity,transform] duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-90 motion-safe:fill-mode-both motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${shape.className} ${dimmed ? "opacity-35" : ""} ${active ? "scale-105" : ""}`}
    >
      {node.status === "verified" && <BadgeCheck aria-hidden className="size-3 shrink-0" />}
      <span className="truncate">{node.name}</span>
      {node.evidenceCount > 0 && (
        <span className={`shrink-0 rounded-full px-1 text-[9px] font-bold tabular-nums ${node.status === "verified" ? "bg-white/25" : "bg-muted text-muted-foreground"}`}>{node.evidenceCount}</span>
      )}
    </button>
  );
}

function SkillDetail({ node, related, onSelect, onClose }: { node: SkillGraphNode; related: ReturnType<typeof relatedSkills>; onSelect: (id: string) => void; onClose: () => void }) {
  const meta = CLUSTERS[clusterOf(node)];
  const groups = groupEvidence(node.evidence);
  const Icon = node.status === "verified" ? BadgeCheck : node.status === "claimed" ? MessageSquareQuote : Lightbulb;
  return (
    <div role="region" aria-label={`${node.name} evidence`} className="mt-3 rounded-xl border border-border bg-gradient-to-br from-muted/60 to-transparent p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 truncate text-sm font-bold text-foreground">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: meta.hex }} />
            {node.name}
          </h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground">
            <Icon aria-hidden className="size-3" />
            {STATUS_LABEL[node.status]} · {meta.label}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close skill details" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <X aria-hidden className="size-3.5" />
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-foreground">{whyIdentified(node)}</p>

      {node.proficiency !== null ? (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>
              Proficiency: <span className="font-semibold text-foreground">{node.level}</span>
            </span>
            <span>Confidence: {confidenceLabel(node.confidence)}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={`${Math.round(node.proficiency)} of 100`}>
            <div className="h-full origin-left rounded-full motion-safe:animate-[skillBarGrow_700ms_cubic-bezier(0.22,1,0.36,1)_both]" style={{ width: `${Math.max(0, Math.min(100, node.proficiency))}%`, background: `linear-gradient(90deg, ${meta.hex}99, ${meta.hex})` }} />
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[10px] text-muted-foreground">No proficiency shown: there isn&apos;t enough independent evidence to score it.</p>
      )}

      {groups.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {groups.map((g) => (
            <div key={g.kind}>
              <p className="flex items-center gap-1 text-[10px] font-semibold text-foreground">
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: evidenceKind(g.kind).hex }} />
                {evidenceKind(g.kind).label}
              </p>
              <ul className="mt-0.5 space-y-0.5 pl-2.5 text-[11px] text-muted-foreground">
                {g.items.map((e, i) => (
                  <li key={i} className="flex min-w-0 items-center gap-1">
                    {e.ref && /^https?:\/\//.test(e.ref) ? (
                      <a href={e.ref} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline">
                        <span className="truncate">{e.label}</span>
                        <ExternalLink aria-hidden className="size-2.5 shrink-0" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : (
                      <span className="truncate" title={e.label}>
                        {e.label}
                      </span>
                    )}
                    {e.at && <span className="shrink-0 text-[10px] tabular-nums">· {e.at.slice(0, 7)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {node.evidenceCount > node.evidence.length && <p className="pl-2.5 text-[10px] text-muted-foreground">+{node.evidenceCount - node.evidence.length} more on Skills</p>}
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-2.5">
          <p className="text-[10px] font-semibold text-foreground">Connected skills</p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {related.map((r) => {
              const label = RELATIONSHIP_LABEL[r.edge.relationship] ?? "Related";
              const why = r.edge.basis === "evidence" ? `${label}: ${r.edge.evidence.join(", ")}` : `${label} (documented relation, not from your work)`;
              return (
                <li key={r.id}>
                  {r.inGraph ? (
                    <button
                      type="button"
                      title={why}
                      onClick={() => onSelect(r.id)}
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${r.edge.basis === "evidence" ? "bg-primary/10 text-foreground hover:bg-primary/20" : "border border-dashed border-border text-muted-foreground hover:text-foreground"}`}
                    >
                      {r.name}
                      <span className="sr-only">: {why}</span>
                    </button>
                  ) : (
                    <span title={why} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {r.name}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
