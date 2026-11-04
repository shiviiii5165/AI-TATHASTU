"use client";

import { forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { ArrowRight, Network, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SkillGraphData, SkillGraphEdge, SkillGraphNode, SkillStatus } from "@/lib/dashboard/types";

const STATUS: Record<SkillStatus, { label: string; explain: string }> = {
  verified: { label: "Verified", explain: "Shown by a source we read directly." },
  claimed: { label: "Claimed", explain: "Only your resume or profile says so." },
  inferred: { label: "Suggested", explain: "A related skill suggests it. Nothing shows it, so it has no score." },
};
const RELATION: Record<string, string> = {
  used_together: "Used together",
  requires: "Requires",
  built_on: "Built on",
  implements: "Implements",
  subdomain_of: "Part of",
  extends: "Extends",
  enables: "Enables",
  prerequisite: "Prerequisite",
  relates_to: "Related",
};

// The layout runs in real pixels at the card's own width, so text is always drawn at its true size.
const FONT_SIZE = 12;
const CHAR_WIDTH = 6.6;
const LINE_HEIGHT = 14;
const MARGIN = 6;
const GAP = 6;
const LINE_CHARS = 20;
const MIN_TARGET = 28;
// Every link is available in a skill's details. The picture stays readable by drawing each skill's strongest few.
const DRAWN_LINKS_PER_NODE = 3;

type LayoutNode = SkillGraphNode & SimulationNodeDatum & { radius: number; lines: string[]; boxWidth: number; boxHeight: number };
type LayoutLink = Omit<SkillGraphEdge, "source" | "target"> & SimulationLinkDatum<LayoutNode>;

const radiusOf = (node: SkillGraphNode) => (node.proficiency === null ? 8 : 8 + (node.proficiency / 100) * 8);

/** One or two lines. Only a name too long for both is shortened; its full form stays in the title and details. */
function labelLines(name: string): string[] {
  if (name.length <= LINE_CHARS) return [name];
  const words = name.split(" ");
  let first = "";
  while (words.length && (first + (first ? " " : "") + words[0]).length <= LINE_CHARS) first += (first ? " " : "") + words.shift();
  if (!first) {
    first = name.slice(0, LINE_CHARS);
    words.splice(0, words.length, name.slice(LINE_CHARS));
  }
  const rest = words.join(" ");
  return [first, rest.length > LINE_CHARS ? `${rest.slice(0, LINE_CHARS - 1)}…` : rest];
}

/** Pushes label boxes apart along whichever axis needs the smaller move. */
function separate(nodes: LayoutNode[], strength: number) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = (b.x ?? 0) - (a.x ?? 0);
      const dy = (b.y ?? 0) - (a.y ?? 0);
      const overlapX = (a.boxWidth + b.boxWidth) / 2 + GAP - Math.abs(dx);
      const overlapY = (a.boxHeight + b.boxHeight) / 2 + GAP - Math.abs(dy);
      if (overlapX <= 0 || overlapY <= 0) continue;
      if (overlapX < overlapY) {
        const push = ((dx >= 0 ? 1 : -1) * overlapX * strength) / 2;
        a.x = (a.x ?? 0) - push;
        b.x = (b.x ?? 0) + push;
      } else {
        const push = ((dy >= 0 ? 1 : -1) * overlapY * strength) / 2;
        a.y = (a.y ?? 0) - push;
        b.y = (b.y ?? 0) + push;
      }
    }
  }
}

function drawnLinks(edges: SkillGraphEdge[]): SkillGraphEdge[] {
  const ranked = [...edges].sort((a, b) => Number(b.basis === "evidence") - Number(a.basis === "evidence") || b.weight - a.weight || a.source.localeCompare(b.source) || a.target.localeCompare(b.target));
  const used = new Map<string, number>();
  return ranked.filter((edge) => {
    if ((used.get(edge.source) ?? 0) >= DRAWN_LINKS_PER_NODE || (used.get(edge.target) ?? 0) >= DRAWN_LINKS_PER_NODE) return false;
    used.set(edge.source, (used.get(edge.source) ?? 0) + 1);
    used.set(edge.target, (used.get(edge.target) ?? 0) + 1);
    return true;
  });
}

/** Deterministic. Width is fixed by the card, and height grows to fit, so nothing clips and nothing needs scrolling inside the card. */
function layout(graph: SkillGraphData, width: number) {
  const inner = width - MARGIN * 2;
  const nodes: LayoutNode[] = graph.nodes.map((n, i) => {
    const lines = labelLines(n.name);
    const radius = radiusOf(n);
    const textWidth = Math.max(...lines.map((l) => l.length)) * CHAR_WIDTH;
    const boxWidth = Math.min(inner, Math.max(MIN_TARGET, radius * 2, textWidth));
    const boxHeight = radius * 2 + 4 + lines.length * LINE_HEIGHT;
    const angle = (i / graph.nodes.length) * 2 * Math.PI;
    return { ...n, radius, lines, boxWidth, boxHeight, x: width / 2 + Math.cos(angle) * inner * 0.4, y: Math.sin(angle) * inner * 0.4 };
  });
  const clamp = () => {
    for (const n of nodes) n.x = Math.min(width - MARGIN - n.boxWidth / 2, Math.max(MARGIN + n.boxWidth / 2, n.x ?? 0));
  };
  const links: LayoutLink[] = drawnLinks(graph.edges).map((e) => ({ ...e }));
  const simulation = forceSimulation<LayoutNode>(nodes)
    .force("link", forceLink<LayoutNode, LayoutLink>(links).id((d) => d.id).distance(80).strength(0.12))
    .force("charge", forceManyBody().strength(-80))
    .force("x", forceX(width / 2).strength(0.06))
    .force("y", forceY(0).strength(0.05))
    .stop();
  for (let i = 0; i < 240; i++) {
    simulation.tick();
    separate(nodes, 0.7);
    clamp();
  }
  // The forces have settled; only the boxes matter now, until no label touches another.
  for (let i = 0; i < 400; i++) {
    separate(nodes, 1);
    clamp();
  }
  const top = Math.min(...nodes.map((n) => (n.y ?? 0) - n.boxHeight / 2)) - MARGIN;
  const bottom = Math.max(...nodes.map((n) => (n.y ?? 0) + n.boxHeight / 2)) + MARGIN;
  return { nodes, links, width, height: bottom - top, viewBox: `0 ${top} ${width} ${bottom - top}` };
}

function nodeFill(status: SkillStatus) {
  return status === "verified" ? "var(--primary)" : "var(--card)";
}
function nodeStroke(status: SkillStatus) {
  return status === "verified" ? "var(--primary)" : "var(--muted-foreground)";
}

function Marker({ status }: { status: SkillStatus }) {
  return (
    <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className="shrink-0">
      <circle cx="6" cy="6" r="4.5" fill={nodeFill(status)} stroke={nodeStroke(status)} strokeWidth="1.5" strokeDasharray={status === "inferred" ? "2 2" : undefined} />
    </svg>
  );
}

export interface SkillBubbleChartProps {
  skillGraph?: SkillGraphData;
  className?: string;
  fullView?: boolean;
}

export function SkillBubbleChart({ skillGraph, className = "", fullView = false }: SkillBubbleChartProps) {
  const [view, setView] = useState<"graph" | "list">("graph");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const drawn = useMemo(() => (skillGraph?.nodes.length && width > 0 ? layout(skillGraph, width) : null), [skillGraph, width]);
  const hasNodes = Boolean(skillGraph?.nodes.length);
  const selected = skillGraph?.nodes.find((n) => n.id === selectedId) ?? null;
  const related = useMemo(() => (selected && skillGraph ? skillGraph.edges.filter((e) => e.source === selected.id || e.target === selected.id) : []), [selected, skillGraph]);
  const hidden = skillGraph ? skillGraph.totalSkills - skillGraph.nodes.length : 0;
  const linkCount = (id: string) => skillGraph?.edges.filter((e) => e.source === id || e.target === id).length ?? 0;

  const open = (id: string) => {
    if (!selectedId) opener.current = document.activeElement as HTMLElement | null;
    setSelectedId(id);
  };
  const close = () => {
    setSelectedId(null);
    opener.current?.focus();
  };

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null);
        opener.current?.focus();
      }
      if (e.key !== "Tab" || !dialog.current) return;
      const focusable = dialog.current.querySelectorAll<HTMLElement>("a[href], button");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  return (
    <section className={`flex h-full flex-col rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5 ${className}`} data-testid="skill-graph">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Network aria-hidden className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-foreground">Skill Graph</h2>
        </div>
        <div className="flex items-center gap-2">
          {hasNodes && (
            <div role="group" aria-label="Show as" className="flex rounded-lg bg-muted p-0.5 text-[11px] font-semibold">
              {(["graph", "list"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                  className={`rounded-md px-2 py-1 capitalize transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === mode ? "bg-card text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {mode}
                </button>
              ))}
            </div>
          )}
          {!fullView && (
            <Link href="/skills" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <span>View all</span>
              <ArrowRight aria-hidden className="size-3" />
            </Link>
          )}
        </div>
      </div>

      <div ref={frame} className="mt-2 min-w-0 flex-1">
        {!hasNodes ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <p className="text-xs font-semibold text-foreground">No skills to connect yet</p>
            <p className="mt-1 max-w-[240px] text-[11px] text-muted-foreground">Connect GitHub or confirm your resume, and skills you used together will link up here.</p>
            <Link href="/connections" className="mt-3 text-xs font-semibold text-primary hover:underline">
              Add evidence
            </Link>
          </div>
        ) : view === "list" ? (
          <ul className="divide-y divide-border" aria-label="Skills">
            {skillGraph!.nodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  onClick={() => open(node.id)}
                  className="flex min-h-9 w-full items-center justify-between gap-2 py-2 text-left text-xs transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Marker status={node.status} />
                    <span className="break-words font-semibold">{node.name}</span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] text-muted-foreground">
                    {STATUS[node.status].label} · {node.level} · {linkCount(node.id)} {linkCount(node.id) === 1 ? "link" : "links"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : drawn ? (
          <svg data-testid="skill-graph-canvas" width={drawn.width} height={drawn.height} viewBox={drawn.viewBox} role="group" aria-label={`Your ${drawn.nodes.length} top skills and how they connect. The list view shows the same skills.`} className="block max-w-full">
            <g aria-hidden>
              {drawn.links.map((link, i) => {
                const s = link.source as LayoutNode;
                const t = link.target as LayoutNode;
                const active = selectedId !== null && (s.id === selectedId || t.id === selectedId);
                return (
                  <line
                    key={i}
                    x1={s.x}
                    y1={(s.y ?? 0) - s.boxHeight / 2 + s.radius}
                    x2={t.x}
                    y2={(t.y ?? 0) - t.boxHeight / 2 + t.radius}
                    stroke={active ? "var(--primary)" : "var(--muted-foreground)"}
                    strokeOpacity={active ? 1 : 0.45}
                    strokeWidth={link.basis === "evidence" ? 1.4 : 1}
                    strokeDasharray={link.basis === "evidence" ? undefined : "3 3"}
                  />
                );
              })}
            </g>
            {drawn.nodes.map((node) => (
              <g
                key={node.id}
                transform={`translate(${node.x}, ${(node.y ?? 0) - node.boxHeight / 2 + node.radius})`}
                role="button"
                tabIndex={0}
                data-node={node.id}
                aria-label={`${node.name}: ${STATUS[node.status].label}, ${node.level}. ${linkCount(node.id)} links. Show evidence.`}
                onClick={() => open(node.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    open(node.id);
                  }
                }}
                className="cursor-pointer outline-none [&:focus-visible>circle]:stroke-foreground [&:focus-visible>circle]:stroke-[3]"
              >
                <title>{node.name}</title>
                <rect data-hit x={-node.boxWidth / 2} y={-node.radius} width={node.boxWidth} height={node.boxHeight} fill="transparent" />
                <circle r={node.radius} fill={nodeFill(node.status)} stroke={node.id === selectedId ? "var(--foreground)" : nodeStroke(node.status)} strokeWidth={node.id === selectedId ? 2.5 : 1.5} strokeDasharray={node.status === "inferred" ? "3 3" : undefined} />
                <text y={node.radius + 2} textAnchor="middle" fill="var(--foreground)" fontSize={FONT_SIZE} fontWeight={600} paintOrder="stroke" stroke="var(--card)" strokeWidth={3} className="pointer-events-none select-none">
                  {node.lines.map((line, i) => (
                    <tspan key={i} x={0} dy={LINE_HEIGHT - (i === 0 ? 2 : 0)}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            ))}
          </svg>
        ) : (
          <div aria-hidden className="h-72 animate-pulse rounded-lg bg-muted" />
        )}
      </div>

      {hasNodes && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
          {(Object.keys(STATUS) as SkillStatus[]).map((status) => (
            <span key={status} className="flex items-center gap-1" title={STATUS[status].explain}>
              <Marker status={status} />
              {STATUS[status].label}
            </span>
          ))}
          <span>Solid line: used together</span>
          <span>Dashed: related</span>
          {hidden > 0 && <span className="ml-auto">{hidden} more on Skills</span>}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={close}>
          <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="skill-detail-title" className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 id="skill-detail-title" className="text-base font-bold text-foreground">
                  {selected.name}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {STATUS[selected.status].label} · {selected.proficiency === null ? "Not assessed" : `${selected.level}, ${Math.round(selected.proficiency)} of 100`}
                </p>
              </div>
              <button type="button" autoFocus onClick={close} aria-label="Close" className="rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <X aria-hidden className="size-4" />
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{STATUS[selected.status].explain}</p>

            <h4 className="mt-4 text-xs font-semibold text-foreground">Evidence</h4>
            {selected.evidence.length > 0 ? (
              <ul className="mt-1.5 space-y-1.5 text-xs">
                {selected.evidence.map((e, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2">
                    {e.ref?.startsWith("https://") ? (
                      <a href={e.ref} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-primary hover:underline">
                        {e.label}
                      </a>
                    ) : (
                      <span className="min-w-0 truncate text-foreground">{e.label}</span>
                    )}
                    <span className="shrink-0 text-[11px] capitalize text-muted-foreground">{e.kind}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{selected.inferredFrom.length ? `Suggested by ${selected.inferredFrom.join(", ")}.` : "None recorded."}</p>
            )}

            {related.length > 0 && (
              <>
                <h4 className="mt-4 text-xs font-semibold text-foreground">Connected to</h4>
                <ul className="mt-1.5 space-y-1 text-xs">
                  {related.map((e) => {
                    const other = e.source === selected.id ? e.target : e.source;
                    return (
                      <li key={`${e.source}-${e.target}`} className="flex items-baseline justify-between gap-2">
                        <button type="button" onClick={() => setSelectedId(other)} className="min-w-0 truncate text-left font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          {other}
                        </button>
                        <span className="shrink-0 truncate text-[11px] text-muted-foreground" title={e.evidence.join(", ")}>
                          {e.basis === "evidence" ? `In ${e.evidence[0]}` : RELATION[e.relationship] ?? "Related"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
