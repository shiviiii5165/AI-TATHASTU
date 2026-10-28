"use client";

import { useState } from "react";
import Image from "next/image";
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
import { YoraModal } from "@/components/dashboard/yora-modal";

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
  ...NAV_ITEMS.filter((i) => !["eris", "meet", "cv-builder"].includes(i.slug)),
];

export function AppNav() {
  const pathname = usePathname();
  const [yoraOpen, setYoraOpen] = useState(false);

  return (
    <>
      <nav aria-label="Main" className="flex-1 flex flex-col justify-between">
        <ul className="-mx-6 flex gap-1 overflow-x-auto px-6 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:space-y-0.5">
          {ITEMS.map((item) => {
            const href = item.slug === "dashboard" ? "/dashboard" : `/${item.slug}`;
            const active =
              item.slug === "dashboard"
                ? pathname === "/dashboard"
                : pathname === href || pathname.startsWith(`${href}/`);
            const Icon = ICONS[item.slug] ?? LayoutGrid;

            return (
              <li key={item.slug} className="shrink-0">
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

        {/* Compact Yora Assistant Companion Card at bottom of sidebar on desktop */}
        <div className="hidden lg:flex flex-col mt-4 p-3 rounded-2xl bg-gradient-to-b from-[#FFF5F7] via-[#FAF5FF] to-white dark:from-[#201520] dark:via-[#1A1828] dark:to-[#161822] border border-[#F5D0DC] dark:border-[#3E2D3B] shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="relative size-9 rounded-full overflow-hidden shrink-0 border border-border shadow-2xs">
              <Image
                src="/brand/yora-avatar.jpg"
                alt="Yora AI Assistant"
                fill
                className="object-cover"
                sizes="36px"
              />
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground leading-none">Yora AI</span>
                <span className="size-1.5 rounded-full bg-[#19C58A] animate-pulse" />
              </div>
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">Career companion</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setYoraOpen(true)}
            className="w-full mt-2.5 py-1.5 px-3 rounded-xl bg-gradient-to-r from-[#FF496D] to-[#FF713D] text-white text-[11px] font-bold shadow-2xs hover:opacity-95 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Ask Yora</span>
            <Sparkles className="size-3" />
          </button>
        </div>
      </nav>

      {/* Yora Assistant Dialog */}
      <YoraModal open={yoraOpen} onOpenChange={setYoraOpen} />
    </>
  );
}
