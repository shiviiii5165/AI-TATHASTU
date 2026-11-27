"use client";



import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  Briefcase,
  CalendarDays,
  FileText,
  FolderGit2,
  Gauge,
  GraduationCap,
  Home,
  LayoutGrid,
  Share2,
  Sparkles,
  Trophy,
  User,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { NAV_ITEMS } from "@/lib/dashboard/nav";
import { cn } from "@/lib/utils";


const ICONS: Record<string, typeof User> = {
  dashboard: Home,
  profile: User,
  skills: Sparkles,
  projects: FolderGit2,
  achievements: Trophy,
  opportunities: Briefcase,
  internships: GraduationCap,
  learn: BookOpen,
  connections: Users,
  people: Users,
  mentor: UserRoundCheck,
  research: FileText,
  "ai-interview": Bot,
  collaborate: Share2,
  eris: Gauge,
  meet: CalendarDays,
  "cv-builder": FileText,
};

const ITEMS = [
  { slug: "dashboard", label: "Home" },
  // People & Network and Communities belong to Collaborate (one link in the sidebar's lower area); Internships
  // are a category of Opportunities. Their pages and data stay; they just aren't primary navigation.
  // AVSAR ("opportunities") is linked from the sidebar's lower area, directly below Collaborate (sidebar.tsx).
  ...NAV_ITEMS.filter((i) => !["eris", "meet", "cv-builder", "people", "collaborate", "internships", "opportunities"].includes(i.slug)),
];

export function AppNav() {
  const pathname = usePathname();


  return (
    <>
      <nav aria-label="Main" className="flex flex-col">
        <ul className="flex flex-col space-y-0.5">
          {ITEMS.map((item) => {
            const href = item.slug === "dashboard" ? "/dashboard" : `/${item.slug}`;
            const active =
              item.slug === "dashboard"
                ? pathname === "/dashboard"
                : pathname === href || pathname.startsWith(`${href}/`);
            const Icon = ICONS[item.slug] ?? LayoutGrid;

            return (
              <li key={item.slug}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all duration-150",
                    "focus-visible:ring-2 focus-visible:ring-[#FF496D]/30 focus-visible:outline-none",
                    active
                      ? "bg-gradient-to-r from-[#FF496D] to-[#FF713D] text-white font-bold shadow-xs shadow-rose-500/20"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

      </nav>
    </>
  );
}
