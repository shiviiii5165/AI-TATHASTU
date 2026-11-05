"use client";

import { ArrowRight, Network, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { SkillGraphData, SkillGraphNode, SkillStatus } from "@/lib/dashboard/types";

/**
 * Compact Skills Intelligence for the dashboard: the user's top skills as chips, coloured by how they
 * are known (verified / claimed / suggested), with a proficiency bar only where a real score exists.
 * Selecting a skill opens a small popover beside it with its level, the evidence actually recorded,
 * and the skills it connects to. The full interactive graph lives on /skills.
 * Everything shown comes from the intelligence engine's skill graph; nothing is filled in.
 */
const MAX_CHIPS = 10;
const MAX_EVIDENCE = 3;
const MAX_RELATED = 4;
const POPOVER_WIDTH = 272;

const STATUS: Record<SkillStatus, { label: string; chip: string; dot: string }> = {
  verified: {
    label: "Verified",
    chip: "border-primary/30 bg-primary/10 text-foreground hover:bg-primary/15",
    dot: "bg-primary",
  },
  claimed: {
    label: "Claimed",
    chip: "border-border bg-muted/60 text-foreground hover:bg-muted",
    dot: "bg-muted-foreground",
  },
  inferred: {
    label: "Suggested",
    chip: "border-dashed border-muted-foreground/40 bg-card text-muted-foreground hover:text-foreground",
    dot: "border border-dashed border-muted-foreground bg-transparent",
  },
};

const ORDER: Record<SkillStatus, number> = { verified: 0, claimed: 1, inferred: 2 };

export function topSkills(graph: SkillGraphData | undefined, max = MAX_CHIPS): SkillGraphNode[] {
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
      return { id: other, name: names.get(other) ?? other, inGraph: names.has(other) };
    });
}

export function SkillsOverview({ skillGraph }: { skillGraph?: SkillGraphData }) {
  const chips = useMemo(() => topSkills(skillGraph), [skillGraph]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());

  const selected = skillGraph?.nodes.find((n) => n.id === selectedId) ?? null;
  const related = useMemo(() => (selected ? relatedSkills(skillGraph, selected.id) : []), [selected, skillGraph]);
  const more = skillGraph ? Math.max(0, skillGraph.totalSkills - chips.length) : 0;

  const close = useCallback(() => {
    const opener = selectedId ? chipRefs.current.get(selectedId) : null;
    setSelectedId(null);
    opener?.focus();
  }, [selectedId]);

  // Open a skill, placing the popover just below its chip and kept inside the card's width.
  const select = useCallback((id: string) => {
    const box = container.current;
    if (!box) return;
    const boxRect = box.getBoundingClientRect();
    const width = Math.min(POPOVER_WIDTH, boxRect.width);
    const chip = chipRefs.current.get(id);
    if (chip) {
      const r = chip.getBoundingClientRect();
      const left = Math.min(Math.max(0, r.left - boxRect.left), Math.max(0, boxRect.width - width));
      setPos({ top: r.bottom - boxRect.top + 6, left, width });
    }
    // A related skill without a chip keeps the popover where it is.
    setSelectedId(id);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    popover.current?.querySelector<HTMLElement>("button[data-close]")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (popover.current?.contains(target)) return;
      if ([...chipRefs.current.values()].some((c) => c.contains(target))) return;
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [selectedId, close]);

  return (
    <section className="flex h-full flex-col rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5" data-testid="skills-overview">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Network aria-hidden className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-foreground">Skills Intelligence</h2>
        </div>
        <Link href="/skills" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <span>View all</span>
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>

      <div ref={container} className="relative mt-3 flex-1">
        {chips.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-6 text-center">
            <p className="text-xs font-semibold text-foreground">No skills yet</p>
            <p className="mt-1 max-w-[240px] text-[11px] text-muted-foreground">Connect GitHub or confirm your resume to see your skills here.</p>
            <Link href="/connections" className="mt-3 text-xs font-semibold text-primary hover:underline">
              Add evidence
            </Link>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-2" aria-label="Your top skills">
            {chips.map((node) => {
              const s = STATUS[node.status];
              const active = node.id === selectedId;
              return (
                <li key={node.id}>
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) chipRefs.current.set(node.id, el);
                      else chipRefs.current.delete(node.id);
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={active}
                    onClick={() => (active ? close() : select(node.id))}
                    title={`${node.name}: ${s.label}${node.proficiency === null ? "" : `, ${node.level}`}`}
                    className={`group inline-flex max-w-full flex-col items-stretch gap-1 rounded-xl border px-2.5 py-1.5 text-left text-xs font-semibold transition-all duration-150 motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${s.chip} ${active ? "ring-2 ring-primary/40 motion-safe:shadow-[0_0_0_4px] motion-safe:shadow-primary/10" : ""}`}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span aria-hidden className={`size-2 shrink-0 rounded-full ${s.dot}`} />
                      <span className="truncate">{node.name}</span>
                    </span>
                    {node.proficiency !== null && (
                      <span aria-hidden className="block h-1 w-full overflow-hidden rounded-full bg-border">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.max(6, Math.min(100, node.proficiency))}%` }} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected && pos && (
          <div
            ref={popover}
            role="dialog"
            aria-labelledby="skill-popover-title"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
            className="absolute z-30 rounded-xl border border-border bg-popover p-3.5 text-popover-foreground shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 id="skill-popover-title" className="truncate text-sm font-bold text-foreground">
                  {selected.name}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selected.proficiency === null ? `${STATUS[selected.status].label} · Not assessed` : `${selected.level} · ${STATUS[selected.status].label}`}
                </p>
              </div>
              <button
                type="button"
                data-close
                onClick={close}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X aria-hidden className="size-3.5" />
              </button>
            </div>

            <p className="mt-2.5 text-[11px] font-semibold text-foreground">Evidence</p>
            {selected.evidence.length > 0 ? (
              <ul className="mt-1 space-y-0.5 text-[11px] text-muted-foreground">
                {selected.evidence.slice(0, MAX_EVIDENCE).map((e, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span aria-hidden>•</span>
                    <span className="min-w-0 truncate" title={e.label}>
                      {e.label}
                    </span>
                  </li>
                ))}
                {selected.evidence.length > MAX_EVIDENCE && <li className="pl-3">+{selected.evidence.length - MAX_EVIDENCE} more on Skills</li>}
              </ul>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {selected.inferredFrom.length ? `Suggested by ${selected.inferredFrom.join(", ")}.` : "None recorded yet."}
              </p>
            )}

            {related.length > 0 && (
              <>
                <p className="mt-2.5 text-[11px] font-semibold text-foreground">Related skills</p>
                <ul className="mt-1 flex flex-wrap gap-1">
                  {related.map((r) => (
                    <li key={r.id}>
                      {r.inGraph ? (
                        <button
                          type="button"
                          onClick={() => select(r.id)}
                          className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {r.name}
                        </button>
                      ) : (
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{r.name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[11px] text-muted-foreground">
          {(Object.keys(STATUS) as SkillStatus[]).map((status) => (
            <span key={status} className="flex items-center gap-1">
              <span aria-hidden className={`size-2 rounded-full ${STATUS[status].dot}`} />
              {STATUS[status].label}
            </span>
          ))}
          {more > 0 && <span className="ml-auto">{more} more on Skills</span>}
        </div>
      )}
    </section>
  );
}
