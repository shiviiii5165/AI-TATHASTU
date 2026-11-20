// Class names for collaborate.css. Not a CSS module on purpose: next.config's Turbopack "*.css" rule also matches
// *.module.css and emits it as global CSS with the raw names, so a module's `import s` yielded undefined classes and
// generic names (.grid, .card) leaked onto Tailwind utilities app-wide. Prefixed global names avoid both.
import "./collaborate.css";

export const s = {
  root: "collab-root",
  hero: "collab-hero",
  grid: "collab-grid",
  node: "collab-node",
  node2: "collab-node2",
  node3: "collab-node3",
  link: "collab-link",
  orbit: "collab-orbit",
  card: "collab-card",
  enter: "collab-enter",
  avatarStack: "collab-avatarStack",
} as const;
