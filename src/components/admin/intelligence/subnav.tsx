"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin/intelligence", label: "Overview", exact: true },
  { href: "/admin/intelligence/rankings", label: "Rankings" },
  { href: "/admin/intelligence/builder", label: "Ranking Builder" },
  { href: "/admin/intelligence/compare", label: "Compare" },
  { href: "/admin/intelligence/benchmarks", label: "Benchmark Catalogue" },
  { href: "/admin/intelligence/integrations", label: "Ecosystem Sources" },
  { href: "/admin/intelligence/methodology", label: "Methodology & Fairness" },
  { href: "/admin/intelligence/frameworks", label: "Career Frameworks" },
];

export function IntelligenceSubnav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Student Intelligence" className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none">
      {TABS.map((t) => {
        const active = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors",
              active ? "bg-primary text-primary-foreground font-semibold shadow-2xs" : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
