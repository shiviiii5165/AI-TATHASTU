"use client";

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import {
  ArrowRight,
  Cpu,
  GitBranch,
  Network,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";

import type { SkillGraphData, SkillGraphNode } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

export interface SkillBubbleChartProps {
  skills?: Array<{
    name: string;
    strength: number;
    isDirect?: boolean;
    inferredFrom?: string[];
  }>;
  skillGraph?: SkillGraphData;
  className?: string;
  height?: number;
  fullView?: boolean;
}

interface GraphNodeDatum extends SimulationNodeDatum {
  id: string;
  name: string;
  strength: number;
  confidence: number;
  isDirect: boolean;
  category: string;
  source: string;
  reason: string;
  inferredFrom: string[];
  radius: number;
  colorGrad: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphLinkDatum extends SimulationLinkDatum<GraphNodeDatum> {
  source: string | GraphNodeDatum;
  target: string | GraphNodeDatum;
  relationship: string;
  weight: number;
}

// Built-in ontology edges for client-side resilience if backend only passes flat skill array
const FALLBACK_ONTOLOGY_EDGES: Record<string, Array<{ target: string; relationship: string; weight: number }>> = {
  PyTorch: [
    { target: "Python", relationship: "requires", weight: 0.95 },
    { target: "Deep Learning", relationship: "implements", weight: 0.95 },
    { target: "Neural Networks", relationship: "implements", weight: 0.9 },
    { target: "Machine Learning", relationship: "subdomain_of", weight: 0.85 },
  ],
  TensorFlow: [
    { target: "Python", relationship: "requires", weight: 0.9 },
    { target: "Deep Learning", relationship: "implements", weight: 0.95 },
    { target: "Machine Learning", relationship: "subdomain_of", weight: 0.85 },
  ],
  XGBoost: [
    { target: "Python", relationship: "requires", weight: 0.85 },
    { target: "Machine Learning", relationship: "subdomain_of", weight: 0.9 },
    { target: "Gradient Boosting", relationship: "implements", weight: 0.95 },
  ],
  "Deep Learning": [
    { target: "Machine Learning", relationship: "subdomain_of", weight: 0.95 },
    { target: "AI/ML", relationship: "subdomain_of", weight: 0.95 },
  ],
  "Machine Learning": [
    { target: "AI/ML", relationship: "subdomain_of", weight: 0.95 },
  ],
  LLMs: [
    { target: "Deep Learning", relationship: "requires", weight: 0.9 },
    { target: "AI/ML", relationship: "subdomain_of", weight: 0.9 },
  ],
  NLP: [
    { target: "LLMs", relationship: "prerequisite", weight: 0.85 },
    { target: "AI/ML", relationship: "subdomain_of", weight: 0.85 },
  ],
  "Computer Vision": [
    { target: "Deep Learning", relationship: "requires", weight: 0.85 },
    { target: "AI/ML", relationship: "subdomain_of", weight: 0.85 },
  ],
  React: [
    { target: "JavaScript", relationship: "requires", weight: 0.95 },
    { target: "Frontend", relationship: "implements", weight: 0.9 },
  ],
  "Next.js": [
    { target: "React", relationship: "built_on", weight: 0.95 },
    { target: "TypeScript", relationship: "requires", weight: 0.85 },
  ],
  FastAPI: [
    { target: "Python", relationship: "requires", weight: 0.95 },
    { target: "Backend", relationship: "implements", weight: 0.85 },
  ],
  Docker: [
    { target: "DevOps", relationship: "enables", weight: 0.9 },
    { target: "Containerization", relationship: "implements", weight: 0.95 },
  ],
  Kubernetes: [
    { target: "DevOps", relationship: "enables", weight: 0.95 },
    { target: "Cloud Infrastructure", relationship: "implements", weight: 0.9 },
  ],
};

function categorizeSkill(name: string): string {
  const languages = new Set(["Python", "JavaScript", "TypeScript", "SQL", "C++", "Java", "Go", "Rust"]);
  if (languages.has(name)) return "Programming Language";
  const frameworks = new Set([
    "PyTorch", "TensorFlow", "Keras", "JAX", "scikit-learn",
    "XGBoost", "LightGBM", "React", "Next.js", "FastAPI",
  ]);
  if (frameworks.has(name)) return "Framework & Libraries";
  const aiSpecialties = new Set([
    "Large Language Models", "LLMs", "Natural Language Processing", "NLP",
    "Deep Learning", "Neural Networks", "Computer Vision", "RAG", "AI Agents",
    "Vector Search", "Gradient Boosting",
  ]);
  if (aiSpecialties.has(name)) return "AI/ML Specialization";
  const infra = new Set([
    "Docker", "Kubernetes", "Containerization", "DevOps", "Cloud Infrastructure",
    "Linux", "Apache Spark", "Apache Airflow", "MLOps",
  ]);
  if (infra.has(name)) return "Infrastructure & MLOps";
  return "Core Competency";
}

function getNodeColorGradient(isDirect: boolean, isCore: boolean): string {
  if (isCore) return "from-[#2878F0] via-[#5C61F5] to-[#8554FF]";
  if (isDirect) return "from-[#2878F0] to-[#6A37EB]";
  return "from-[#8554FF] to-[#D946EF]";
}

export function SkillBubbleChart({
  skills = [],
  skillGraph,
  className = "",
  height,
  fullView = false,
}: SkillBubbleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 420, height: height || (fullView ? 360 : 250) });
  const [selectedNode, setSelectedNode] = useState<GraphNodeDatum | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [simTick, setSimTick] = useState(0);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");

  // Active dragging state
  const draggingNodeRef = useRef<GraphNodeDatum | null>(null);

  // Keep dimensions in sync with container width
  useEffect(() => {
    if (!containerRef.current) return;
    let frame = 0;
    const updateSize = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth;
        const h = height || (fullView ? 360 : 250);
        // Same size → keep the same object, so the layout isn't recomputed.
        if (w > 0) setDimensions((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
      }
    };
    // At most once per frame while the window is being resized.
    const onResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateSize);
    };
    updateSize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
    };
  }, [fullView, height]);

  // Transform input data into graph nodes & edges
  const { initialNodes, initialLinks } = useMemo(() => {
    // If backend provided skillGraph with nodes and edges, use it
    if (skillGraph && skillGraph.nodes && skillGraph.nodes.length > 0) {
      const nodeMap = new Map<string, SkillGraphNode>();
      skillGraph.nodes.forEach((n) => nodeMap.set(n.id || n.name, n));

      const nodes: GraphNodeDatum[] = skillGraph.nodes.slice(0, 16).map((n) => {
        const strength = typeof n.strength === "number" ? n.strength : 0.8;
        const confidence = n.confidence || Math.round(strength * 100);
        const isCore = n.name === "AI/ML" || n.name === "Machine Learning";
        const radius = isCore ? 30 : strength >= 0.85 ? 26 : strength >= 0.7 ? 22 : 18;

        return {
          id: n.id || n.name,
          name: n.name,
          strength,
          confidence,
          isDirect: n.isDirect ?? true,
          category: n.category || categorizeSkill(n.name),
          source: n.source || (n.isDirect ? "Direct Evidence" : "AI-inferred"),
          reason: n.reason || (n.isDirect ? "Found in verified repository code & profile evidence." : "Inferred from your related skills and projects."),
          inferredFrom: n.inferredFrom || [],
          radius,
          colorGrad: getNodeColorGradient(n.isDirect ?? true, isCore),
        };
      });

      const validNodeIds = new Set(nodes.map((n) => n.id));
      const links: GraphLinkDatum[] = (skillGraph.edges || [])
        .filter((e) => validNodeIds.has(e.source) && validNodeIds.has(e.target))
        .map((e) => ({
          source: e.source,
          target: e.target,
          relationship: e.relationship || "requires",
          weight: e.weight ?? 0.85,
        }));

      return { initialNodes: nodes, initialLinks: links };
    }

    // Otherwise, construct from skills list
    const hasSkills = skills && skills.length > 0;
    if (!hasSkills) {
      return { initialNodes: [], initialLinks: [] };
    }

    // Top skills to render
    const sliced = skills.slice(0, 10);
    const nodeNames = new Set(sliced.map((s) => s.name));
    // Always include a core hub if ML-focused skills exist
    if (!nodeNames.has("AI/ML") && sliced.some((s) => /pytorch|tensorflow|python|xgboost|deep/i.test(s.name))) {
      nodeNames.add("AI/ML");
      sliced.unshift({ name: "AI/ML", strength: 0.95, isDirect: true, inferredFrom: [] });
    }

    const nodes: GraphNodeDatum[] = sliced.map((s) => {
      const isCore = s.name === "AI/ML";
      const isDirect = s.isDirect ?? true;
      const strength = s.strength ?? 0.8;
      const confidence = Math.round(strength * 100);
      const radius = isCore ? 30 : strength >= 0.85 ? 26 : strength >= 0.7 ? 22 : 18;
      const parents = s.inferredFrom || [];

      let source = isDirect ? "Found in GitHub repo & verified evidence" : "Inferred from prerequisite competencies";
      let reason = isDirect
        ? `Directly evidenced from repository code with ${confidence}% confidence.`
        : `Inferred because you know related prerequisite skills.`;

      if (!isDirect && parents.length > 0) {
        source = `Inferred from ${parents.join(", ")}`;
        reason = `Inferred because you know [${parents.join(", ")}], which is a prerequisite for [${s.name}].`;
      }

      return {
        id: s.name,
        name: s.name,
        strength,
        confidence,
        isDirect,
        category: categorizeSkill(s.name),
        source,
        reason,
        inferredFrom: parents,
        radius,
        colorGrad: getNodeColorGradient(isDirect, isCore),
      };
    });

    const links: GraphLinkDatum[] = [];
    const seenEdges = new Set<string>();

    // Add edges from ontology
    for (const node of nodes) {
      const ontologyTargets = FALLBACK_ONTOLOGY_EDGES[node.name] || [];
      for (const edge of ontologyTargets) {
        if (nodeNames.has(edge.target)) {
          const key = `${node.name}->${edge.target}`;
          if (!seenEdges.has(key)) {
            seenEdges.add(key);
            links.push({
              source: node.name,
              target: edge.target,
              relationship: edge.relationship,
              weight: edge.weight,
            });
          }
        }
      }
      // Add edges from inferredFrom
      for (const parent of node.inferredFrom) {
        if (nodeNames.has(parent)) {
          const key = `${parent}->${node.name}`;
          if (!seenEdges.has(key)) {
            seenEdges.add(key);
            links.push({
              source: parent,
              target: node.name,
              relationship: "prerequisite",
              weight: 0.9,
            });
          }
        }
      }
    }

    return { initialNodes: nodes, initialLinks: links };
  }, [skills, skillGraph]);

  // Simulation state computed in useMemo without cascading setState in effects
  const { nodes, links, simulation } = useMemo(() => {
    if (initialNodes.length === 0) {
      return { nodes: [] as GraphNodeDatum[], links: [] as GraphLinkDatum[], simulation: null };
    }

    const { width, height } = dimensions;

    // Clone data for simulation
    const simNodes: GraphNodeDatum[] = initialNodes.map((n, i) => {
      const angle = (i / initialNodes.length) * 2 * Math.PI;
      const radiusDist = Math.min(width, height) * 0.32;
      const jitterX = ((i * 17) % 11) - 5;
      const jitterY = ((i * 23) % 11) - 5;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radiusDist + jitterX,
        y: height / 2 + Math.sin(angle) * radiusDist + jitterY,
      };
    });

    const simLinks: GraphLinkDatum[] = initialLinks.map((l) => ({ ...l }));

    const sim = forceSimulation<GraphNodeDatum>(simNodes)
      .force(
        "link",
        forceLink<GraphNodeDatum, GraphLinkDatum>(simLinks)
          .id((d) => d.id)
          .distance(fullView ? 80 : 60)
          .strength(0.65),
      )
      .force("charge", forceManyBody().strength(fullView ? -160 : -100))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collision",
        forceCollide<GraphNodeDatum>().radius((d) => d.radius + 8),
      );

    // Settle the layout synchronously, then stop d3's internal timer. Running
    // to the same convergence point (alpha decays below alphaMin by ~300 ticks)
    // gives the final layout the timer used to reach, without ~200 post-mount
    // ticks that each re-rendered (and, via key={simTick}, remounted) the SVG.
    sim.stop();
    for (let i = 0; i < 300; i++) sim.tick();

    return { nodes: simNodes, links: simLinks, simulation: sim };
  }, [initialNodes, initialLinks, dimensions, fullView]);

  useEffect(() => {
    if (!simulation) return;
    simulation.on("tick", () => {
      setSimTick((prev) => prev + 1);
    });
    return () => {
      simulation.stop();
    };
  }, [simulation]);

  // Restart layout
  const handleResetLayout = () => {
    setSimTick((t) => t + 1);
  };

  // Helper to extract link coordinates safely
  const getLinkCoords = (link: GraphLinkDatum) => {
    const s = link.source as GraphNodeDatum;
    const t = link.target as GraphNodeDatum;
    return {
      x1: s?.x ?? 0,
      y1: s?.y ?? 0,
      x2: t?.x ?? 0,
      y2: t?.y ?? 0,
      rel: link.relationship,
    };
  };

  // Check if a link connects to the currently active/hovered node
  const isLinkActive = (link: GraphLinkDatum) => {
    const activeId = hoveredNodeId || selectedNode?.id;
    if (!activeId) return false;
    const s = link.source as GraphNodeDatum;
    const t = link.target as GraphNodeDatum;
    const sId = typeof s === "object" ? s.id : s;
    const tId = typeof t === "object" ? t.id : t;
    return sId === activeId || tId === activeId;
  };

  const hasData = nodes.length > 0;

  // Connected neighbors of selected node
  const selectedNeighbors = useMemo(() => {
    if (!selectedNode) return [];
    const connected = new Set<string>();
    links.forEach((l) => {
      const s = l.source as GraphNodeDatum;
      const t = l.target as GraphNodeDatum;
      const sId = typeof s === "object" ? s.id : s;
      const tId = typeof t === "object" ? t.id : t;
      if (sId === selectedNode.id) connected.add(tId);
      if (tId === selectedNode.id) connected.add(sId);
    });
    return nodes.filter((n) => connected.has(n.id));
  }, [selectedNode, links, nodes]);

  // Pointer drag events for interactive node manipulation
  const handleNodePointerDown = (node: GraphNodeDatum, e: React.PointerEvent) => {
    e.stopPropagation();
    draggingNodeRef.current = node;
    node.fx = node.x;
    node.fy = node.y;
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingNodeRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    draggingNodeRef.current.fx = Math.max(20, Math.min(dimensions.width - 20, x));
    draggingNodeRef.current.fy = Math.max(20, Math.min(dimensions.height - 20, y));
    draggingNodeRef.current.x = draggingNodeRef.current.fx;
    draggingNodeRef.current.y = draggingNodeRef.current.fy;
    setSimTick((t) => t + 1);
  };

  const handlePointerUp = () => {
    if (draggingNodeRef.current) {
      draggingNodeRef.current.fx = null;
      draggingNodeRef.current.fy = null;
      draggingNodeRef.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xs text-card-foreground ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#F4F1FD] dark:bg-purple-950/40 text-[#8554FF]">
            <Network className="size-4" />
          </div>
          <div>
            <h2 className="font-sans text-sm font-bold text-foreground">Interactive Skill Graph</h2>
            <p className="text-[10px] text-muted-foreground">See how your skills connect</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* View mode toggle */}
          {hasData && (
            <div className="flex items-center rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("graph")}
                aria-label="Graph View"
                className={cn(
                  "rounded-md px-2 py-0.5 transition-colors touch-manipulation",
                  viewMode === "graph" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                )}
              >
                Graph
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-label="List View"
                className={cn(
                  "rounded-md px-2 py-0.5 transition-colors touch-manipulation",
                  viewMode === "list" ? "bg-white text-slate-900 shadow-2xs font-bold" : "text-slate-500 hover:text-slate-800"
                )}
              >
                List
              </button>
            </div>
          )}

          {viewMode === "graph" && (
            <button
              type="button"
              onClick={handleResetLayout}
              title="Reset layout physics"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors touch-manipulation"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}

          {!fullView && (
            <Link
              href="/skills"
              className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
            >
              <span>View All</span>
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      </div>

      {hasData ? (
        viewMode === "list" ? (
          <div className="my-2 flex-1 w-full space-y-2 overflow-y-auto max-h-[260px] pr-1" aria-label="Skills list">
            {nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNode(node)}
                className="w-full text-left flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-white hover:border-[#8554FF]/40 hover:shadow-2xs transition-all touch-manipulation cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-sans text-xs font-bold text-[#11182B] truncate">{node.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[9px] font-bold shrink-0",
                        node.isDirect
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-purple-50 text-purple-700 border border-purple-200"
                      )}
                    >
                      {node.isDirect ? "Verified" : "Inferred"}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate mt-0.5">{node.category}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs font-bold text-[#8554FF]">{node.confidence}%</span>
                  <ArrowRight className="size-3 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="relative my-2 flex-1 w-full overflow-hidden select-none">
            {/* Subtle Ambient Background Gradient Glow */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-44 w-44 rounded-full bg-gradient-to-r from-[#2878F0]/10 via-[#8554FF]/10 to-[#FF496D]/10 blur-3xl" />
            </div>

          {/* SVG Force Graph */}
          <svg
            key={simTick}
            width={dimensions.width}
            height={dimensions.height}
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="touch-none w-full h-full"
          >
            <defs>
              {/* Gradients */}
              <linearGradient id="grad-core" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2878F0" />
                <stop offset="50%" stopColor="#5C61F5" />
                <stop offset="100%" stopColor="#8554FF" />
              </linearGradient>
              <linearGradient id="grad-direct" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2878F0" />
                <stop offset="100%" stopColor="#6A37EB" />
              </linearGradient>
              <linearGradient id="grad-inferred" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8554FF" />
                <stop offset="100%" stopColor="#C084FC" />
              </linearGradient>

              {/* Glow filter for active node */}
              <filter id="glow-active" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#8554FF" floodOpacity="0.45" />
              </filter>
            </defs>

            {/* Connecting Lines (Edges) */}
            <g className="edges">
              {links.map((link, idx) => {
                const { x1, y1, x2, y2, rel } = getLinkCoords(link);
                const active = isLinkActive(link);
                return (
                  <g key={`edge-${idx}`}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={active ? "#8554FF" : "var(--border, #383C4B)"}
                      strokeWidth={active ? 2.2 : 1.2}
                      strokeDasharray={rel === "requires" ? "none" : "4 3"}
                      strokeOpacity={active ? 0.95 : 0.6}
                      className="transition-colors duration-200"
                    />
                    {/* Relationship Badge on Hover/Active */}
                    {active && (
                      <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                        <rect
                          x={-28}
                          y={-9}
                          width={56}
                          height={16}
                          rx={8}
                          fill="var(--card, #191B24)"
                          stroke="#8554FF"
                          strokeWidth={1}
                          className="shadow-xs"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill="#8554FF"
                          fontSize={9}
                          fontWeight="700"
                          className="pointer-events-none"
                        >
                          {rel}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Nodes */}
            <g className="nodes">
              {nodes.map((node) => {
                const isHovered = hoveredNodeId === node.id;
                const isSelected = selectedNode?.id === node.id;
                const isCore = node.name === "AI/ML";
                const fillGrad = isCore
                  ? "url(#grad-core)"
                  : node.isDirect
                    ? "url(#grad-direct)"
                    : "url(#grad-inferred)";

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                    className="cursor-pointer group focus:outline-none"
                    onClick={() => setSelectedNode(node)}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onPointerDown={(e) => handleNodePointerDown(node, e)}
                  >
                    {/* Pulsing ring on hover/selected */}
                    {(isHovered || isSelected) && (
                      <circle
                        r={node.radius + 6}
                        fill="none"
                        stroke="#8554FF"
                        strokeWidth={2}
                        strokeOpacity={0.6}
                        className="animate-pulse"
                      />
                    )}

                    {/* Main Node Bubble */}
                    <circle
                      r={node.radius}
                      fill={fillGrad}
                      stroke="var(--card, #191B24)"
                      strokeWidth={2}
                      filter={isSelected ? "url(#glow-active)" : undefined}
                      className="transition-transform duration-200 group-hover:scale-110"
                    />

                    {/* Node Text Label */}
                    <text
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#FFFFFF"
                      fontSize={node.radius >= 26 ? 10.5 : 8.5}
                      fontWeight="700"
                      className="pointer-events-none drop-shadow-xs select-none"
                    >
                      {node.name.length > 9 ? `${node.name.slice(0, 8)}…` : node.name}
                    </text>

                    {/* Direct Indicator Pill badge */}
                    <circle
                      cx={node.radius * 0.72}
                      cy={-node.radius * 0.72}
                      r={3.5}
                      fill={node.isDirect ? "#10B981" : "#A855F7"}
                      stroke="var(--card, #191B24)"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Floating Helper Legend */}
          <div className="absolute bottom-1 left-2 flex items-center gap-3 text-[10px] text-slate-500 bg-white/80 backdrop-blur-xs px-2.5 py-1 rounded-full border border-slate-100 shadow-2xs pointer-events-none">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#10B981]" /> Direct
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-[#A855F7]" /> Inferred
            </span>
            <span className="hidden sm:inline text-slate-400">· Click node to explain</span>
          </div>
        </div>
        )
      ) : (
        <div className="my-auto py-8 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-purple-50 text-[#8554FF] flex items-center justify-center mb-2.5">
            <Sparkles className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No Skills Connected Yet</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Connect GitHub or upload a resume to generate your interactive AI Skill Graph.
          </p>
          <Link
            href="/skills"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8554FF] text-white text-xs font-semibold hover:bg-[#703DE5] transition-colors"
          >
            <span>Confirm Skills</span>
          </Link>
        </div>
      )}

      {/* Footer Info */}
      {hasData && (
        <div className="flex items-center justify-between border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493]">
          <span className="truncate">
            {hoveredNodeId ? (
              <span className="font-semibold text-[#8554FF]">Hovered: {hoveredNodeId}</span>
            ) : selectedNode ? (
              <span className="font-semibold text-[#2878F0]">Selected: {selectedNode.name}</span>
            ) : (
              `${nodes.length} skills connected in ontology`
            )}
          </span>
          <span className="rounded-md bg-[#F4F1FD] px-2 py-0.5 text-[10px] font-bold text-[#8554FF]">
            Interactive Graph
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Task 3: Click-to-Explain Modal / Card */}
      {/* ========================================================================= */}
      {selectedNode && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedNode(null)}
        >
          <div
            className="w-[calc(100vw-2rem)] max-w-md max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xl transition-all duration-200 animate-in zoom-in-95 text-card-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#8554FF] to-[#2878F0] text-white shadow-xs">
                  <Cpu className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-sans text-base font-bold text-foreground">{selectedNode.name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        selectedNode.isDirect
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-purple-50 text-purple-700 border border-purple-200"
                      }`}
                    >
                      {selectedNode.isDirect ? "Direct Evidence" : "Graph Inferred"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{selectedNode.category}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="size-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 py-4 text-xs">
              {/* Confidence Score Bar */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-slate-700">Confidence Score</span>
                  <span className="font-mono text-sm font-bold text-[#8554FF]">
                    {selectedNode.confidence}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200/80 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#8554FF] to-[#2878F0] transition-all duration-500"
                    style={{ width: `${selectedNode.confidence}%` }}
                  />
                </div>
              </div>

              {/* Evidence Source */}
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                {selectedNode.isDirect ? (
                  <GitBranch className="size-4 text-[#10B981] shrink-0 mt-0.5" />
                ) : (
                  <Sparkles className="size-4 text-[#8554FF] shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-slate-800">Evidence Source</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{selectedNode.source}</p>
                </div>
              </div>

              {/* Logical Path / Reason: Why is this skill here? */}
              <div className="rounded-xl border border-purple-100 bg-[#FAF8FF] p-3.5">
                <div className="flex items-center gap-1.5 font-bold text-[#8554FF] mb-1.5">
                  <Sparkles className="size-3.5" />
                  <span>Why is this skill here?</span>
                </div>
                <p className="text-[11px] text-slate-700 leading-relaxed">{selectedNode.reason}</p>

                {/* Relational Flow diagram for Inferred Skills */}
                {!selectedNode.isDirect && selectedNode.inferredFrom.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-2 pt-2 border-t border-purple-100 text-[11px]">
                    <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 font-semibold text-slate-700 shadow-2xs">
                      {selectedNode.inferredFrom.join(", ")}
                    </span>
                    <span className="text-[#8554FF] font-mono text-xs">──(prerequisite)──▶</span>
                    <span className="rounded-md bg-[#8554FF] text-white px-2 py-0.5 font-bold shadow-2xs">
                      {selectedNode.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Connected Skills in Graph */}
              {selectedNeighbors.length > 0 && (
                <div>
                  <p className="font-semibold text-slate-700 mb-2">Related skills:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNeighbors.map((nb) => (
                      <button
                        type="button"
                        key={nb.id}
                        onClick={() => setSelectedNode(nb)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-slate-200 bg-white hover:border-[#8554FF] hover:text-[#8554FF] transition-colors shadow-2xs"
                      >
                        <span className={`size-1.5 rounded-full ${nb.isDirect ? "bg-emerald-500" : "bg-purple-500"}`} />
                        <span>{nb.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Link
                href="/skills"
                onClick={() => setSelectedNode(null)}
                className="text-xs font-semibold text-[#8554FF] hover:text-[#703DE5] transition-colors"
              >
                Open in Skills Catalog →
              </Link>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
