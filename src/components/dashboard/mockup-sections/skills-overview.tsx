"use client";

import { ArrowRight, BadgeCheck, ExternalLink, Lightbulb, List, MessageSquareQuote, Network, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { CLUSTERS, RELATIONSHIP_LABEL, clusterOf, confidenceLabel, evidenceKind, evidenceMix, groupEvidence, skillClusters, visibleEdges, whyIdentified } from "@/lib/dashboard/skill-intel";
import { LABEL_PX, layoutSkillNetwork, type NetworkLayout } from "@/lib/dashboard/skill-network-layout";
import type { SkillGraphData, SkillGraphEdge, SkillGraphNode, SkillStatus } from "@/lib/dashboard/types";

/**
 * Skills Intelligence: the engine's skill graph as a circular network.
 *  - Each skill is a circle, coloured by its catalogue group and sized only by its recorded evidence count.
 *  - How it is known is a subtle treatment: verified = tinted fill, claimed = white fill with a coloured ring,
 *    suggested = white fill with a dashed grey ring.
 *  - Thin lines join skills the engine recorded as used in the same repository, project or job. Documented
 *    relations appear only for the selected skill. Nothing else is ever drawn.
 *  - Selecting a skill highlights its real connections and shows why it was identified and its evidence.
 *  - "List" shows the same skills as text, for anyone who'd rather not read the network.
 * The full graph lives on /skills.
 */
const MAX_NODES = 16;
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

export function SkillsOverview({ skillGraph }: { skillGraph?: SkillGraphData }) {
  const nodes = useMemo(() => topSkills(skillGraph), [skillGraph]);
  const clusters = useMemo(() => skillClusters(nodes), [nodes]);
  const ids = useMemo(() => new Set(nodes.map((n) => n.id)), [nodes]);
  const edges = useMemo(() => visibleEdges(skillGraph, ids), [skillGraph, ids]);
  const evidenceEdges = useMemo(() => edges.filter((e) => e.basis === "evidence"), [edges]);
  const mix = useMemo(() => evidenceMix(nodes), [nodes]);
  const mixTotal = mix.reduce((s, m) => s + m.count, 0);

  const [view, setView] = useState<"network" | "list">("network");
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

  // Laid out at the real pixel width, so labels stay 11px on every screen.
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, nodes.length]);
  const layout = useMemo<NetworkLayout | null>(() => {
    if (!width || !nodes.length) return null;
    return layoutSkillNetwork(
      nodes.map((n) => ({ id: n.id, name: n.name, group: clusterOf(n), evidenceCount: n.evidenceCount, suggested: n.status === "inferred" })),
      evidenceEdges,
      width,
    );
  }, [nodes, evidenceEdges, width]);

  const nodeRefs = useRef(new Map<string, SVGGElement>());
  const close = useCallback(() => {
    const opener = selectedId ? nodeRefs.current.get(selectedId) : null;
    setSelectedId(null);
    opener?.focus();
  }, [selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, close]);

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5" data-testid="skills-overview">
      <div className="relative flex flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300">
            <Network aria-hidden className="size-4" />
          </div>
          <h2 className="whitespace-nowrap font-sans text-sm font-bold text-foreground">Skills Intelligence</h2>
        </div>
        <div className="flex items-center gap-2 whitespace-nowrap">
          {nodes.length > 0 && (
            <div role="group" aria-label="View" className="flex rounded-lg border border-border p-0.5 text-[11px] font-semibold">
              {(["network", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === v ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "network" ? <Network aria-hidden className="size-3" /> : <List aria-hidden className="size-3" />}
                  {v === "network" ? "Network" : "List"}
                </button>
              ))}
            </div>
          )}
          <Link href="/skills" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            <span>Full graph</span>
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        </div>
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
          {mixTotal > 0 && (
            <div className="relative mt-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[11px] font-semibold text-foreground">Evidence behind these skills</p>
                <p className="text-[11px] tabular-nums text-muted-foreground">
                  {counts.verified} verified · {counts.claimed} claimed · {counts.inferred} suggested
                </p>
              </div>
              <div className="mt-1.5 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`Evidence: ${mix.map((m) => `${m.count} from ${evidenceKind(m.kind).label}`).join(", ")}`}>
                {mix.map((m) => (
                  <span key={m.kind} className="h-full first:rounded-l-full last:rounded-r-full opacity-80" style={{ width: `${(m.count / mixTotal) * 100}%`, background: evidenceKind(m.kind).hex }} title={`${evidenceKind(m.kind).label}: ${m.count}`} />
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

          {view === "network" ? (
            <div ref={box} className="relative mt-3 w-full rounded-xl bg-slate-50/60 dark:bg-muted/20" data-testid="skill-network">
              {layout && (
                <svg width={layout.width} height={layout.height} viewBox={`0 0 ${layout.width} ${layout.height}`} className="block" role="group" aria-label={`Skill network: ${nodes.length} skills, ${evidenceEdges.length} links from your work`}>
                  <g aria-hidden>
                    {edges.map((e) => (
                      <Edge key={`${e.source}-${e.target}`} edge={e} layout={layout} focusId={focusId} nodes={nodes} />
                    ))}
                  </g>
                  {nodes.map((n) => {
                    const p = layout.nodes.get(n.id);
                    if (!p) return null;
                    return (
                      <SkillCircle
                        key={n.id}
                        node={n}
                        x={p.x}
                        y={p.y}
                        r={p.r}
                        label={p.label}
                        active={n.id === selectedId}
                        dimmed={neighbours !== null && !neighbours.has(n.id)}
                        ref={(el) => {
                          if (el) nodeRefs.current.set(n.id, el);
                          else nodeRefs.current.delete(n.id);
                        }}
                        onSelect={() => setSelectedId(n.id === selectedId ? null : n.id)}
                        onHover={(on) => setHoverId(on ? n.id : null)}
                      />
                    );
                  })}
                </svg>
              )}
            </div>
          ) : (
            <SkillList nodes={nodes} edges={edges} selectedId={selectedId} onSelect={(id) => setSelectedId(id === selectedId ? null : id)} />
          )}

          <div aria-live="polite" className="relative">
            {selected ? (
              <SkillDetail node={selected} related={related} onSelect={(id) => setSelectedId(id)} onClose={close} />
            ) : (
              <p className="mt-3 rounded-xl bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                Select a skill to see why it was identified and the evidence behind it.{" "}
                {evidenceEdges.length > 0
                  ? `Lines join skills used together in the same repository, project or job (${evidenceEdges.length}).`
                  : "None of these skills share a repository, project or job yet, so no links are drawn."}
              </p>
            )}
          </div>

          <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
            {clusters.map((c) => (
              <span key={c.key} className="flex items-center gap-1">
                <span aria-hidden className="size-2 rounded-full" style={{ background: CLUSTERS[c.key].hex }} />
                {CLUSTERS[c.key].label}
              </span>
            ))}
            <span aria-hidden className="h-3 w-px bg-border" />
            <span className="flex items-center gap-1">
              <svg aria-hidden width="10" height="10"><circle cx="5" cy="5" r="4" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="1" /></svg>
              Verified
            </span>
            <span className="flex items-center gap-1">
              <svg aria-hidden width="10" height="10"><circle cx="5" cy="5" r="4" fill="#fff" stroke="#0ea5e9" strokeWidth="1.2" /></svg>
              Claimed
            </span>
            <span className="flex items-center gap-1">
              <svg aria-hidden width="10" height="10"><circle cx="5" cy="5" r="4" fill="#fff" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2 1.5" /></svg>
              Suggested
            </span>
            {more > 0 && <span className="ml-auto">{more} more on Skills</span>}
          </div>
        </>
      )}
    </section>
  );
}

function Edge({ edge, layout, focusId, nodes }: { edge: SkillGraphEdge; layout: NetworkLayout; focusId: string | null; nodes: SkillGraphNode[] }) {
  const a = layout.nodes.get(edge.source);
  const b = layout.nodes.get(edge.target);
  if (!a || !b) return null;
  const touches = focusId !== null && (edge.source === focusId || edge.target === focusId);
  const isEvidence = edge.basis === "evidence";
  // Documented relations aren't from the user's work: only shown while one of their skills is in focus.
  if (!isEvidence && !touches) return null;
  const src = nodes.find((n) => n.id === edge.source);
  const hex = src ? CLUSTERS[clusterOf(src)].hex : "#94a3b8";
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(18, len * 0.12);
  const d = `M ${a.x} ${a.y} Q ${mx - (dy / len) * bend} ${my + (dx / len) * bend} ${b.x} ${b.y}`;
  const faded = focusId !== null && !touches;
  return isEvidence ? (
    <path
      d={d}
      data-basis="evidence"
      fill="none"
      stroke={hex}
      strokeLinecap="round"
      strokeWidth={touches ? 1.75 : 1}
      strokeOpacity={faded ? 0.06 : touches ? 0.75 : 0.22}
      className="transition-[stroke-opacity,stroke-width] duration-200"
    />
  ) : (
    <path d={d} data-basis="ontology" fill="none" stroke="#94a3b8" strokeDasharray="3 4" strokeWidth={1} strokeOpacity={0.8} />
  );
}

type CircleProps = { node: SkillGraphNode; x: number; y: number; r: number; label: string; active: boolean; dimmed: boolean; onSelect: () => void; onHover: (on: boolean) => void; ref: (el: SVGGElement | null) => void };

function SkillCircle({ node, x, y, r, label, active, dimmed, onSelect, onHover, ref }: CircleProps) {
  const c = CLUSTERS[clusterOf(node)];
  const verified = node.status === "verified";
  const suggested = node.status === "inferred";
  const fill = verified ? c.tint : "#ffffff";
  const stroke = suggested ? "#94a3b8" : c.hex;
  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <g
      ref={ref}
      role="button"
      tabIndex={0}
      data-node={node.id}
      data-status={node.status}
      aria-pressed={active}
      aria-label={`${node.name}: ${STATUS_LABEL[node.status]}${node.proficiency === null ? ", not scored" : `, ${node.level}`}, ${node.evidenceCount} evidence ${node.evidenceCount === 1 ? "item" : "items"}`}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className="cursor-pointer outline-none transition-opacity duration-200 [&:focus-visible>circle.ring]:opacity-100"
      style={{ opacity: dimmed ? 0.3 : 1 }}
    >
      <title>{node.name}</title>
      <circle className="ring opacity-0" cx={x} cy={y} r={r + 4} fill="none" stroke={c.hex} strokeWidth={1.5} strokeOpacity={0.6} style={active ? { opacity: 1 } : undefined} />
      <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={active ? 2 : verified ? 1 : 1.25} strokeDasharray={suggested ? "3 2.5" : undefined} />
      {node.evidenceCount > 0 && (
        <text x={x} y={y} dy="0.35em" textAnchor="middle" fontSize={10} fontWeight={700} fill={c.hex} className="pointer-events-none select-none tabular-nums">
          {node.evidenceCount}
        </text>
      )}
      <text x={x} y={y + r + 4 + LABEL_PX} textAnchor="middle" fontSize={LABEL_PX} fontWeight={600} className={`pointer-events-none select-none ${suggested ? "fill-muted-foreground" : "fill-foreground"}`}>
        {label}
      </text>
    </g>
  );
}

function SkillList({ nodes, edges, selectedId, onSelect }: { nodes: SkillGraphNode[]; edges: SkillGraphEdge[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const links = (id: string) => edges.filter((e) => e.basis === "evidence" && (e.source === id || e.target === id)).length;
  return (
    <ul className="mt-3 divide-y divide-border rounded-xl border border-border" aria-label="Skills">
      {nodes.map((n) => {
        const c = CLUSTERS[clusterOf(n)];
        return (
          <li key={n.id}>
            <button
              type="button"
              aria-pressed={n.id === selectedId}
              onClick={() => onSelect(n.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: c.hex }} />
              <span className="min-w-0 flex-1 truncate font-semibold text-foreground">{n.name}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">{STATUS_LABEL[n.status]}</span>
              <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                {n.evidenceCount} evidence · {links(n.id)} {links(n.id) === 1 ? "link" : "links"}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SkillDetail({ node, related, onSelect, onClose }: { node: SkillGraphNode; related: ReturnType<typeof relatedSkills>; onSelect: (id: string) => void; onClose: () => void }) {
  const meta = CLUSTERS[clusterOf(node)];
  const groups = groupEvidence(node.evidence);
  const Icon = node.status === "verified" ? BadgeCheck : node.status === "claimed" ? MessageSquareQuote : Lightbulb;
  return (
    <div role="region" aria-label={`${node.name} evidence`} className="mt-3 rounded-xl border border-border p-3 motion-safe:animate-in motion-safe:fade-in" style={{ background: `${meta.tint}66` }}>
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
            <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, node.proficiency))}%`, background: meta.hex, opacity: 0.75 }} />
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
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${r.edge.basis === "evidence" ? "bg-card text-foreground ring-1 ring-border hover:bg-muted" : "border border-dashed border-border text-muted-foreground hover:text-foreground"}`}
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
