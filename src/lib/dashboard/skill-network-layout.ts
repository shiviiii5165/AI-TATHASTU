// Deterministic layout for the Skills Intelligence network. Client-safe, no randomness: the same graph and width
// always give the same picture.
//
// The most evidenced skill sits at the centre; the rest are placed around it in rings, best-evidenced first, then
// relaxed so circles never touch, while skills the engine recorded as used together (evidence edges only) are
// pulled gently towards each other. Names are drawn inside the circles, so each circle is at least big enough for
// its name; beyond that, size comes only from the engine's recorded evidence count.

export type LayoutInput = { id: string; name: string; group: string; evidenceCount: number; suggested: boolean };
export type LayoutEdge = { source: string; target: string };
export type PlacedNode = { id: string; x: number; y: number; r: number; label: string; labelW: number; lines: string[] };
export type NetworkLayout = { width: number; height: number; nodes: Map<string, PlacedNode>; groups: { key: string; x: number; y: number }[] };

export const LABEL_PX = 11;
const CHAR_W = 6.6; // average glyph width at 11px semibold in the app's sans
const LINE_H = 12.5;
const MAX_LABEL = 20;
const LINE_CHARS = 11;
const MAX_LINE = 14;
const GAP = 12; // clear space between circles (room for the glow)
const EDGE_MARGIN = 10;

export function shortLabel(name: string): string {
  return name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1).trimEnd()}…` : name;
}

/** The name as it is drawn inside the circle: one line, or two split at a space when it is long. */
export function labelLines(name: string): string[] {
  const clip = (s: string) => (s.length > MAX_LINE ? `${s.slice(0, MAX_LINE - 1).trimEnd()}…` : s);
  if (name.length <= LINE_CHARS) return [name];
  // Split the full name at the space or hyphen that gives the most even two lines, then shorten each line.
  let best: [string, string] | null = null;
  for (let i = 1; i < name.length - 1; i++) {
    const ch = name[i];
    if (ch !== " " && ch !== "-") continue;
    const pair: [string, string] = ch === " " ? [name.slice(0, i), name.slice(i + 1)] : [name.slice(0, i + 1), name.slice(i + 1)];
    if (!best || Math.max(pair[0].length, pair[1].length) < Math.max(best[0].length, best[1].length)) best = pair;
  }
  return best ? [clip(best[0]), clip(best[1])] : [clip(name)];
}

/**
 * Circle radius: from recorded evidence only (suggestions, which have none, are never ranked), and never smaller
 * than the name inside it needs. `roomy` scales every circle up uniformly when few skills are on screen.
 */
export function nodeRadius(evidenceCount: number, suggested: boolean, roomy = false, name = ""): number {
  const scale = roomy ? 1.15 : 1;
  const byEvidence = suggested || evidenceCount <= 0 ? 26 : 28 + 14 * Math.sqrt(Math.min(evidenceCount, 16) / 16);
  const lines = name ? labelLines(name) : [];
  const widest = Math.max(0, ...lines.map((l) => l.length * CHAR_W));
  const textBlock = lines.length * LINE_H + (suggested || evidenceCount <= 0 ? 0 : LINE_H); // + the evidence count line
  const byLabel = Math.max(widest / 2 + 8, textBlock / 2 + 9);
  return Math.round(Math.max(byEvidence * scale, byLabel));
}

/** Pairs of circles closer than the minimum gap. Exported for tests. */
export function overlaps(layout: NetworkLayout): [string, string][] {
  const list = [...layout.nodes.values()];
  const out: [string, string][] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + GAP / 2) out.push([a.id, b.id]);
    }
  return out;
}

/** Circles that would be cut off by the drawing area. Exported for tests. */
export function outOfBounds(layout: NetworkLayout): string[] {
  return [...layout.nodes.values()].filter((n) => n.x - n.r < 0 || n.x + n.r > layout.width || n.y - n.r < 0 || n.y + n.r > layout.height).map((n) => n.id);
}

function attempt(input: LayoutInput[], edges: LayoutEdge[], width: number, height: number): NetworkLayout {
  const roomy = input.length <= 10;
  const cx = width / 2, cy = height / 2;
  // Best-evidenced first: the centre, then rings outward. Ties keep the input order.
  const order = input.map((n, i) => ({ n, i })).sort((a, b) => b.n.evidenceCount - a.n.evidenceCount || a.i - b.i);
  const nodes: PlacedNode[] = [];
  let ring = 0, placedInRing = 0, ringCapacity = 1, ringRadius = 0;
  for (const { n } of order) {
    if (placedInRing >= ringCapacity) {
      ring++;
      placedInRing = 0;
      ringRadius = ring * 92;
      ringCapacity = Math.max(5, Math.floor((2 * Math.PI * ringRadius) / 100));
    }
    const angle = ring === 0 ? 0 : -Math.PI / 2 + (2 * Math.PI * placedInRing) / ringCapacity + ring * 0.5;
    const lines = labelLines(n.name);
    const label = shortLabel(n.name);
    nodes.push({ id: n.id, x: cx + ringRadius * Math.cos(angle) * (width / Math.max(width, height)), y: cy + ringRadius * Math.sin(angle) * (height / Math.max(width, height)), r: nodeRadius(n.evidenceCount, n.suggested, roomy, n.name), label, labelW: label.length * CHAR_W, lines });
    placedInRing++;
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = edges.map((e) => [byId.get(e.source), byId.get(e.target)] as const).filter((p): p is readonly [PlacedNode, PlacedNode] => Boolean(p[0] && p[1]));

  for (let iter = 0; iter < 500; iter++) {
    const settling = iter < 380;
    if (settling) {
      for (const n of nodes) { // gentle gravity keeps one balanced cluster around the centre
        n.x += (cx - n.x) * 0.012;
        n.y += (cy - n.y) * 0.012;
      }
      for (const [a, b] of links) {
        const dx = b.x - a.x, dy = b.y - a.y;
        a.x += dx * 0.006; a.y += dy * 0.006; b.x -= dx * 0.006; b.y -= dy * 0.006;
      }
    }
    for (let i = 0; i < nodes.length; i++)
      for (let k = i + 1; k < nodes.length; k++) {
        const a = nodes[i], b = nodes[k];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        const need = a.r + b.r + GAP;
        if (d >= need) continue;
        if (d < 0.01) { dx = Math.cos(i + k); dy = Math.sin(i + k); d = 1; } // coincident: a fixed, not random, direction
        const push = (need - d) / 2 + 0.25;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
    for (const n of nodes) {
      n.x = Math.min(width - n.r - EDGE_MARGIN, Math.max(n.r + EDGE_MARGIN, n.x));
      n.y = Math.min(height - n.r - EDGE_MARGIN, Math.max(n.r + EDGE_MARGIN, n.y));
    }
  }
  return { width, height, nodes: byId, groups: [] };
}

/** Lays the network out at the given pixel width, growing the height until no circles touch or are clipped. */
export function layoutSkillNetwork(input: LayoutInput[], edges: LayoutEdge[], width: number): NetworkLayout {
  const w = Math.max(240, Math.floor(width));
  const roomy = input.length <= 10;
  const area = input.reduce((s, n) => s + (2 * nodeRadius(n.evidenceCount, n.suggested, roomy, n.name) + GAP) ** 2, 0);
  let height = Math.round(Math.min(1400, Math.max(w < 480 ? 360 : 340, Math.min(w * 0.68, 520), (area * 1.5) / w)));
  let layout = attempt(input, edges, w, height);
  for (let tries = 0; tries < 8 && (overlaps(layout).length || outOfBounds(layout).length); tries++) {
    height = Math.round(height * 1.12);
    layout = attempt(input, edges, w, height);
  }
  return cropToContent(layout);
}

/** Trims empty space above and below the drawing (positions shift, nothing else changes). */
function cropToContent(layout: NetworkLayout, margin = 18): NetworkLayout {
  const list = [...layout.nodes.values()];
  if (!list.length) return layout;
  const top = Math.min(...list.map((n) => n.y - n.r));
  const bottom = Math.max(...list.map((n) => n.y + n.r));
  const height = Math.max(240, Math.ceil(bottom - top + 2 * margin));
  const shift = margin - top + (height - (bottom - top + 2 * margin)) / 2;
  return { width: layout.width, height, nodes: new Map(list.map((n) => [n.id, { ...n, y: n.y + shift }])), groups: layout.groups };
}
