// Persistent dashboard navigation (plan §3.5). Modules without a page yet
// render the shared placeholder (components/dashboard/module-placeholder.tsx)
// from an explicit folder per slug. A test keeps the folders and this list in sync.

export const NAV_ITEMS = [
  { slug: "profile", label: "My Profile" },
  { slug: "skills", label: "Skills" },
  { slug: "projects", label: "Projects" },
  { slug: "achievements", label: "Achievements" },
  // Displayed as the AVSAR product brand; slug and route stay "opportunities".
  { slug: "opportunities", label: "AVSAR" },
  { slug: "internships", label: "Internships" },
  { slug: "learn", label: "Learning" },
  { slug: "people", label: "People & Network" },
  { slug: "mentor", label: "Mentors" },
  { slug: "research", label: "Research" },
  { slug: "ai-interview", label: "AI Interview" },
  { slug: "collaborate", label: "Communities" },
  { slug: "eris", label: "ERIS" },
  { slug: "meet", label: "Meet" },
  { slug: "cv-builder", label: "CV Builder" },
] as const;


// Linked from widgets but not in the nav.
export const EXTRA_MODULES = [{ slug: "avasar", label: "Avasar" }] as const;

export const MODULE_SLUGS: string[] = [...NAV_ITEMS, ...EXTRA_MODULES].map((m) => m.slug);

// Modules with their own real route under src/app/(dashboard)/. Every other slug
// has an explicit placeholder folder using components/dashboard/module-placeholder.
export const BUILT_MODULES = [
  "connections",
  "profile",
  "skills",
  "projects",
  "achievements",
  "opportunities",
  "learn",
  "learning",
  "people",
  "settings",
];
export const PLACEHOLDER_SLUGS = MODULE_SLUGS.filter((s) => !BUILT_MODULES.includes(s));

/** True for an in-app path that only leads to the "Not available yet" placeholder. Dashboard actions must not link there. */
export function isPlaceholderPath(href: string): boolean {
  if (!href.startsWith("/")) return false;
  const slug = href.split(/[/?#]/)[1] ?? "";
  return PLACEHOLDER_SLUGS.includes(slug);
}
