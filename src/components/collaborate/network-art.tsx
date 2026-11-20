import { s } from "./styles";

/** Connected people forming a team: Collaborate's mark. Decorative; motion stops under reduced-motion. */
export function NetworkArt({ className = "" }: { className?: string }) {
  const nodes = [
    { x: 120, y: 46, r: 13, c: "#12b5c9", cls: s.node },
    { x: 54, y: 104, r: 10, c: "#2fbf8f", cls: `${s.node} ${s.node2}` },
    { x: 186, y: 110, r: 11, c: "#7fe3ee", cls: `${s.node} ${s.node3}` },
    { x: 92, y: 176, r: 9, c: "#2fbf8f", cls: `${s.node} ${s.node3}` },
    { x: 160, y: 184, r: 12, c: "#12b5c9", cls: `${s.node} ${s.node2}` },
  ];
  const links: [number, number][] = [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [1, 2], [0, 4]];
  return (
    <svg viewBox="0 0 240 230" aria-hidden className={className}>
      <g className={s.orbit} opacity="0.35">
        <circle cx="120" cy="115" r="96" fill="none" stroke="#7fe3ee" strokeWidth="1" strokeDasharray="2 7" />
      </g>
      {links.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={nodes[a].x} y1={nodes[a].y} x2={nodes[b].x} y2={nodes[b].y} stroke="#7fe3ee" strokeOpacity="0.55" strokeWidth="1.5" className={s.link} />
      ))}
      {nodes.map((n, i) => (
        <g key={i} className={n.cls}>
          <circle cx={n.x} cy={n.y} r={n.r + 7} fill={n.c} opacity="0.16" />
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.c} />
          <circle cx={n.x} cy={n.y - n.r * 0.25} r={n.r * 0.32} fill="#082a33" opacity="0.55" />
          <path d={`M${n.x - n.r * 0.55} ${n.y + n.r * 0.55} a${n.r * 0.55} ${n.r * 0.45} 0 0 1 ${n.r * 1.1} 0`} fill="#082a33" opacity="0.55" />
        </g>
      ))}
    </svg>
  );
}
