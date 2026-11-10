// Deterministic layout for the Skills Intelligence network. Client-safe, no randomness: the same graph and width
// always give the same picture. Skills are grouped by category around the centre; circles and their labels are
// pushed apart until nothing overlaps; connected skills (engine evidence edges only) are pulled slightly together.
// Node size comes only from the engine's recorded evidence count.

export type LayoutInput = { id: string; name: string; group: string; evidenceCount: number; suggested: boolean };
export type LayoutEdge = { source: string; target: string };
export type PlacedNode = { id: string; x: number; y: number; r: number; label: string; labelW: number };
export type NetworkLayout = { width: number; height: number; nodes: Map<string, PlacedNode>; groups: { key: string; x: number; y: number }[] };

export const LABEL_PX = 11;
const CHAR_W = 6.1; // average glyph width at 11px in the app's sans
const MAX_LABEL = 16;
const LABEL_GAP = 4; // circle edge to label baseline area
const LABEL_H = 14;
const PAD = 6;

/** Circle size from recorded evidence only. With few skills on screen every circle is drawn larger, uniformly. */
export function nodeRadius(evidenceCount: number, suggested: boolean, roomy = false): number {
  const base = roomy ? 18 : 13;
  if (suggested || evidenceCount <= 0) return base;
  return Math.round(base + 1 + (roomy ? 12 : 10) * Math.sqrt(Math.min(evidenceCount, 16) / 16));
}

export function shortLabel(name: string): string {
  return name.length > MAX_LABEL ? `${name.slice(0, MAX_LABEL - 1).trimEnd()}…` : name;
}

type Box = { hw: number; top: number; bottom: number };
const boxOf = (n: PlacedNode): Box => ({ hw: Math.max(n.r, n.labelW / 2) + PAD / 2, top: n.r + PAD / 2, bottom: n.r + LABEL_GAP + LABEL_H + PAD / 2 });

/** Pairs whose circle-plus-label boxes overlap. Exported for tests. */
export function overlaps(layout: NetworkLayout): [string, string][] {
  const list = [...layout.nodes.values()];
  const out: [string, string][] = [];
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j], ba = boxOf(a), bb = boxOf(b);
      const xOverlap = Math.abs(a.x - b.x) < ba.hw + bb.hw - PAD;
      const [up, low, bu, bl] = a.y <= b.y ? [a, b, ba, bb] : [b, a, bb, ba];
      const yOverlap = low.y - up.y < bu.bottom + bl.top - PAD;
      if (xOverlap && yOverlap) out.push([a.id, b.id]);
    }
  return out;
}

/** Nodes whose circle or label would be cut off by the drawing area. Exported for tests. */
export function outOfBounds(layout: NetworkLayout): string[] {
  return [...layout.nodes.values()]
    .filter((n) => {
      const b = boxOf(n);
      return n.x - b.hw + PAD / 2 < 0 || n.x + b.hw - PAD / 2 > layout.width || n.y - n.r < 0 || n.y + n.r + LABEL_GAP + LABEL_H > layout.height;
    })
    .map((n) => n.id);
}

function attempt(input: LayoutInput[], edges: LayoutEdge[], width: number, height: number): NetworkLayout {
  const roomy = input.length <= 10;
  const groupKeys = [...new Set(input.map((n) => n.group))];
  const cx = width / 2, cy = height / 2;
  const rx = Math.max(0, width / 2 - 80), ry = Math.max(0, height / 2 - 70);
  const groups = groupKeys.map((key, i) => {
    if (groupKeys.length === 1) return { key, x: cx, y: cy };
    const a = -Math.PI / 2 + (2 * Math.PI * i) / groupKeys.length;
    return { key, x: cx + rx * 0.8 * Math.cos(a), y: cy + ry * 0.8 * Math.sin(a) };
  });
  const centre = new Map(groups.map((g) => [g.key, g]));
  const counter = new Map<string, number>();

  const nodes: PlacedNode[] = input.map((n) => {
    const j = counter.get(n.group) ?? 0;
    counter.set(n.group, j + 1);
    const g = centre.get(n.group)!;
    const angle = j * 2.39996; // golden angle: an even spiral, no randomness
    const dist = 30 * Math.sqrt(j);
    const label = shortLabel(n.name);
    return { id: n.id, x: g.x + dist * Math.cos(angle), y: g.y + dist * Math.sin(angle), r: nodeRadius(n.evidenceCount, n.suggested, roomy), label, labelW: label.length * CHAR_W };
  });
  const groupOf = new Map(input.map((n) => [n.id, n.group]));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links = edges.map((e) => [byId.get(e.source), byId.get(e.target)] as const).filter((p): p is readonly [PlacedNode, PlacedNode] => Boolean(p[0] && p[1]));

  for (let iter = 0; iter < 400; iter++) {
    const pull = iter < 300 ? 0.02 : 0;
    for (const n of nodes) {
      const g = centre.get(groupOf.get(n.id)!)!;
      n.x += (g.x - n.x) * pull;
      n.y += (g.y - n.y) * pull;
    }
    if (iter < 300) {
      for (const [a, b] of links) {
        const dx = b.x - a.x, dy = b.y - a.y;
        a.x += dx * 0.004; a.y += dy * 0.004; b.x -= dx * 0.004; b.y -= dy * 0.004;
      }
    }
    for (let i = 0; i < nodes.length; i++)
      for (let k = i + 1; k < nodes.length; k++) {
        const a = nodes[i], b = nodes[k], ba = boxOf(a), bb = boxOf(b);
        const needX = ba.hw + bb.hw - Math.abs(a.x - b.x);
        const aboveA = a.y <= b.y;
        const needY = (aboveA ? ba.bottom + bb.top : bb.bottom + ba.top) - Math.abs(a.y - b.y);
        if (needX <= 0 || needY <= 0) continue;
        if (needX < needY) {
          const s = (a.x < b.x || (a.x === b.x && i < k) ? -1 : 1) * (needX / 2 + 0.5);
          a.x += s; b.x -= s;
        } else {
          const s = (aboveA ? -1 : 1) * (needY / 2 + 0.5);
          a.y += s; b.y -= s;
        }
      }
    for (const n of nodes) {
      const b = boxOf(n);
      n.x = Math.min(width - b.hw + PAD / 2, Math.max(b.hw - PAD / 2, n.x));
      n.y = Math.min(height - (n.r + LABEL_GAP + LABEL_H), Math.max(n.r + 1, n.y));
    }
  }
  return { width, height, nodes: new Map(nodes.map((n) => [n.id, n])), groups };
}

/** Lays the network out at the given pixel width, growing the height until nothing overlaps or is clipped. */
export function layoutSkillNetwork(input: LayoutInput[], edges: LayoutEdge[], width: number): NetworkLayout {
  const w = Math.max(240, Math.floor(width));
  const area = input.reduce((s, n) => {
    const r = nodeRadius(n.evidenceCount, n.suggested, input.length <= 10);
    return s + (2 * Math.max(r, (shortLabel(n.name).length * CHAR_W) / 2) + PAD) * (2 * r + LABEL_GAP + LABEL_H + PAD);
  }, 0);
  let height = Math.round(Math.min(1100, Math.max(w < 480 ? 340 : 300, Math.min(w * 0.6, 460), (area * 2.4) / w)));
  let layout = attempt(input, edges, w, height);
  for (let tries = 0; tries < 6 && (overlaps(layout).length || outOfBounds(layout).length); tries++) {
    height = Math.round(height * 1.15);
    layout = attempt(input, edges, w, height);
  }
  return cropToContent(layout);
}

/** Trims empty space above and below the drawing (positions shift, nothing else changes). */
function cropToContent(layout: NetworkLayout, margin = 14): NetworkLayout {
  const list = [...layout.nodes.values()];
  if (!list.length) return layout;
  const top = Math.min(...list.map((n) => n.y - n.r));
  const bottom = Math.max(...list.map((n) => n.y + n.r + LABEL_GAP + LABEL_H));
  const shift = margin - top;
  const height = Math.max(200, Math.ceil(bottom - top + 2 * margin));
  const extra = (height - (bottom - top + 2 * margin)) / 2; // centre the content when the minimum height applies
  const moved = (y: number) => y + shift + extra;
  return {
    width: layout.width,
    height,
    nodes: new Map(list.map((n) => [n.id, { ...n, y: moved(n.y) }])),
    groups: layout.groups.map((g) => ({ ...g, y: moved(g.y) })),
  };
}
