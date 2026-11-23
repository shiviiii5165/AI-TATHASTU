import type { MetadataRoute } from "next";

const SITE = "https://www.aitathastu.com";

// Public, indexable pages only.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages: { path: string; priority: number }[] = [
    { path: "", priority: 1 },
    { path: "/about", priority: 0.8 },
    { path: "/collaborations", priority: 0.6 },
    { path: "/contact", priority: 0.6 },
    { path: "/privacy", priority: 0.3 },
    { path: "/terms", priority: 0.3 },
    { path: "/cookie-policy", priority: 0.3 },
  ];
  return pages.map(({ path, priority }) => ({ url: `${SITE}${path}`, changeFrequency: "monthly", priority }));
}
