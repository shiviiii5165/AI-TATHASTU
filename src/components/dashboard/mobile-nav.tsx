"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  Briefcase,
  ChevronRight,
  FileText,
  FolderGit2,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  Moon,
  Plug,
  ShieldCheck,
  Sparkles,
  Sun,
  Trophy,
  User,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";
import { cn } from "@/lib/utils";
import { YoraModal } from "@/components/dashboard/yora-modal";
import { useTheme } from "@/components/theme-provider";

interface MobileNavProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string | null;
  };
  onSignOut?: () => Promise<void>;
}

export function MobileNav({ user, onSignOut }: MobileNavProps) {
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [yoraOpen, setYoraOpen] = useState(false);

  const displayName = user?.name?.trim() || (user?.email ? user.email.split("@")[0] : "Scholar");
  const displayRole =
    user?.role === "faculty"
      ? "Faculty / Mentor"
      : user?.role === "alumni"
        ? "Alumni"
        : "Student";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AT";

  // Primary 4 tabs for bottom navigation + More trigger
  const primaryTabs = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/skills", label: "Skills", icon: Sparkles },
    { href: "/projects", label: "Projects", icon: FolderGit2 },
    { href: "/opportunities", label: "Opportunities", icon: Briefcase },
  ];

  const isMoreActive =
    drawerOpen ||
    (!primaryTabs.some(
      (t) => pathname === t.href || (t.href !== "/dashboard" && pathname.startsWith(t.href))
    ) &&
      pathname !== "/dashboard");

  return (
    <>
      {/* =========================================================================
          1. FIXED MOBILE BOTTOM NAVIGATION BAR
      ========================================================================= */}
      <nav
        aria-label="Mobile primary navigation"
        className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden"
      >
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0px)]">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active =
              tab.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold transition-all duration-150 touch-manipulation",
                  active
                    ? "text-[#FF2A85] font-bold"
                    : "text-slate-500 hover:text-slate-900 active:scale-95"
                )}
              >
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-lg transition-transform",
                    active && "bg-gradient-to-tr from-[#FFE4E6] to-[#FCE7F3] shadow-2xs scale-105"
                  )}
                >
                  <Icon className={cn("size-4.5 stroke-[2.2]", active ? "text-[#FF2A85]" : "text-slate-500")} />
                </div>
                <span className="leading-none">{tab.label}</span>
                {active && (
                  <span
                    className="absolute -bottom-1 h-0.75 w-5 rounded-full bg-gradient-to-r from-[#FF6B4A] to-[#FF2A85]"
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}

          {/* 5th Tab: "More" trigger opening the navigation drawer */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open full menu and modules"
            aria-expanded={drawerOpen}
            className={cn(
              "relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold transition-all duration-150 touch-manipulation cursor-pointer",
              isMoreActive
                ? "text-[#FF2A85] font-bold"
                : "text-slate-500 hover:text-slate-900 active:scale-95"
            )}
          >
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-lg transition-transform",
                isMoreActive && "bg-gradient-to-tr from-[#FFE4E6] to-[#FCE7F3] shadow-2xs scale-105"
              )}
            >
              <Menu className={cn("size-4.5 stroke-[2.2]", isMoreActive ? "text-[#FF2A85]" : "text-slate-500")} />
            </div>
            <span className="leading-none">More</span>
            {isMoreActive && (
              <span
                className="absolute -bottom-1 h-0.75 w-5 rounded-full bg-gradient-to-r from-[#FF6B4A] to-[#FF2A85]"
                aria-hidden="true"
              />
            )}
          </button>
        </div>
      </nav>

      {/* =========================================================================
          2. SLIDE-OUT MOBILE NAVIGATION DRAWER
      ========================================================================= */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="flex flex-col w-[85vw] max-w-sm p-0 bg-white overflow-hidden"
        >
          {/* Drawer Brand & User Profile Header */}
          <SheetHeader className="p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white text-left">
            <div className="flex items-center justify-between">
              <BrandLogo size="sm" withTagline={false} />
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div className="relative size-11 rounded-full overflow-hidden border border-slate-200 shadow-xs shrink-0 bg-gradient-to-tr from-[#FF496D] to-[#8554FF] text-white flex items-center justify-center font-bold text-sm">
                {user?.image ? (
                  <Image src={user.image} alt={displayName} fill className="object-cover" sizes="44px" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-sm font-bold text-slate-900 truncate">
                  {displayName}
                </SheetTitle>
                <p className="text-xs text-slate-500 font-medium">{displayRole}</p>
                <Link
                  href="/profile"
                  onClick={() => setDrawerOpen(false)}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#FF2A85] hover:underline"
                >
                  <span>View profile</span>
                  <ChevronRight className="size-3" />
                </Link>
              </div>
            </div>
          </SheetHeader>

          {/* Drawer Navigation Links */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 [scrollbar-width:none]">
            {/* Ask Yora AI Feature Banner */}
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false);
                setYoraOpen(true);
              }}
              className="w-full flex items-center justify-between p-3 rounded-2xl bg-gradient-to-r from-[#FFF1F2] via-[#FAF5FF] to-white border border-[#FCE7F3] shadow-2xs hover:shadow-xs transition-all text-left cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#FF496D] to-[#8554FF] text-white shadow-xs">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Ask Yora Assistant</p>
                  <p className="text-[11px] text-slate-500">AI career intelligence & insights</p>
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* Section 1: Core Modules */}
            <div>
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Core Workspace
              </p>
              <div className="space-y-0.5">
                {[
                  { href: "/dashboard", label: "Dashboard Overview", icon: Home },
                  { href: "/profile", label: "My Profile & Identity", icon: User },
                  { href: "/skills", label: "Skills & Inferred Graph", icon: Sparkles },
                  { href: "/projects", label: "Projects & Repositories", icon: FolderGit2 },
                  { href: "/achievements", label: "Achievements & Patents", icon: Trophy },
                ].map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors min-h-[44px]",
                        active
                          ? "bg-rose-50 text-[#FF2A85] font-bold"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-[#FF2A85]" : "text-slate-400")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Career & Opportunities */}
            <div>
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Career & Learning
              </p>
              <div className="space-y-0.5">
                {[
                  { href: "/opportunities", label: "Opportunities", icon: Briefcase },
                  { href: "/internships", label: "Internships", icon: GraduationCap },
                  { href: "/learn", label: "Learning Paths", icon: BookOpen },
                  { href: "/cv-builder", label: "CV Builder", icon: FileText },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors min-h-[44px]",
                        active
                          ? "bg-rose-50 text-[#FF2A85] font-bold"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-[#FF2A85]" : "text-slate-400")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Section 3: People & Network */}
            <div>
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Network & Collaboration
              </p>
              <div className="space-y-0.5">
                {[
                  { href: "/people", label: "People & Network", icon: Users },
                  { href: "/mentor", label: "Mentors", icon: UserRoundCheck },
                  { href: "/research", label: "Research Calls", icon: FileText },
                  { href: "/ai-interview", label: "AI Interview Practice", icon: Bot },
                  { href: "/collaborate", label: "Communities", icon: Users },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setDrawerOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition-colors min-h-[44px]",
                        active
                          ? "bg-rose-50 text-[#FF2A85] font-bold"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon className={cn("size-4 shrink-0", active ? "text-[#FF2A85]" : "text-slate-400")} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Settings & Data Governance */}
            <div>
              <p className="px-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Settings & Privacy
              </p>
              <div className="space-y-0.5">
                <Link
                  href="/settings/privacy"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px]"
                >
                  <ShieldCheck className="size-4 text-slate-400 shrink-0" />
                  <span>Privacy & AI Consent</span>
                </Link>
                <Link
                  href="/settings/integrations"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent min-h-[44px]"
                >
                  <Plug className="size-4 text-slate-400 shrink-0" />
                  <span>Connected Sources</span>
                </Link>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 dark:text-muted-foreground hover:bg-slate-50 dark:hover:bg-accent min-h-[44px] cursor-pointer"
                  aria-label="Toggle light and dark mode"
                >
                  <div className="flex items-center gap-3">
                    {resolvedTheme === "dark" ? (
                      <Moon className="size-4 text-[#B69CFF] shrink-0" />
                    ) : (
                      <Sun className="size-4 text-[#F59E0B] shrink-0" />
                    )}
                    <span>Appearance: {resolvedTheme === "dark" ? "Dark Mode" : "Light Mode"}</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-slate-400">
                    Switch →
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Drawer Footer with Sign Out */}
          <div className="p-4 border-t border-border bg-card pb-[max(1rem,env(safe-area-inset-bottom))]">
            {onSignOut ? (
              <button
                type="button"
                onClick={onSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-card px-4 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors shadow-2xs min-h-[44px] cursor-pointer"
              >
                <LogOut className="size-4" />
                <span>Sign out</span>
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setDrawerOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs min-h-[44px]"
              >
                <LogOut className="size-4" />
                <span>Sign out</span>
              </Link>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Yora Assistant Modal */}
      <YoraModal open={yoraOpen} onOpenChange={setYoraOpen} userName={displayName} />
    </>
  );
}
