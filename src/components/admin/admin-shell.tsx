"use client";

import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Cpu,
  FileText,
  Globe,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  Menu,
  Newspaper,
  Palette,
  Search,
  Send,
  ShieldCheck,
  Sliders,
  Users,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "./admin-nav";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  LifeBuoy,
  GraduationCap,
  Users,
  ShieldCheck,
  FileText,
  Mail,
  Send,
  Palette,
  Newspaper,
  Zap,
  BookOpen,
  Globe,
  Cpu,
  BarChart3,
  Sliders,
  Activity,
};

interface AdminShellProps {
  children: ReactNode;
  userEmail: string;
  userName?: string | null;
  role: string;
}

export function AdminShell({ children, userEmail, userName, role }: AdminShellProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return ADMIN_NAV_GROUPS;
    const q = searchQuery.toLowerCase().trim();
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => item.title.toLowerCase().includes(q) || group.label.toLowerCase().includes(q)
      ),
    })).filter((group) => group.items.length > 0);
  }, [searchQuery]);

  const activeItemTitle = useMemo(() => {
    for (const group of ADMIN_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.href === "/admin" && pathname === "/admin") return "Overview";
        if (item.href !== "/admin" && pathname.startsWith(item.href)) return item.title;
      }
    }
    return "Admin";
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background text-foreground flex">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-border bg-card/60 backdrop-blur-md sticky top-0 h-dvh z-30">
        {/* Brand Lockup */}
        <div className="h-16 px-5 border-b border-border flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <BrandLogo href="/admin" withTagline={false} size="sm" />
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary tracking-wide uppercase">
              Admin OS
            </span>
          </Link>
        </div>

        {/* Quick Search */}
        <div className="p-3 border-b border-border/60">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search modules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/60 hover:bg-muted/90 focus:bg-background border border-border/80 focus:border-primary text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Admin Navigation">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider mb-1.5">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = ICON_MAP[item.iconName] || LayoutDashboard;
                  const isActive =
                    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg transition-colors group",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-2xs font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-transform duration-150 group-hover:scale-110",
                            isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        <span className="truncate">{item.title}</span>
                      </div>
                      {item.badge && !isActive && (
                        <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-border bg-card/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
              {(userName?.[0] || userEmail[0]).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold truncate leading-tight">{userName || userEmail}</div>
              <div className="text-[10px] text-muted-foreground truncate uppercase font-mono tracking-tight">
                {role.replace("_", " ")}
              </div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="Exit to Student Dashboard"
          >
            <LogOut className="size-4" />
          </Link>
        </div>
      </aside>

      {/* ── Main Content Column ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 h-16 border-b border-border bg-card/80 backdrop-blur-md px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
              aria-label="Open Admin Menu"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground hidden sm:inline">Admin</span>
              <span className="text-muted-foreground/40 hidden sm:inline">/</span>
              <span className="font-semibold text-foreground">{activeItemTitle}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Healthy</span>
            </div>

            <ThemeToggleButton />

            <Link
              href="/dashboard"
              className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
            >
              <span>Exit to App</span>
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </header>

        {/* Page Content Surface */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* ── Mobile Navigation Drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-card border-r border-border h-full flex flex-col z-10 p-4">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <BrandLogo href="/admin" withTagline={false} size="sm" />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-4 space-y-5">
              {ADMIN_NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase px-2 mb-1">
                    {group.label}
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = ICON_MAP[item.iconName] || LayoutDashboard;
                      const isActive =
                        item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg",
                            isActive
                              ? "bg-primary text-primary-foreground font-semibold"
                              : "text-muted-foreground hover:text-foreground hover:bg-accent"
                          )}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span>{item.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="pt-4 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">{role}</span>
              <Link href="/dashboard" className="text-xs text-primary font-semibold">
                Exit to App →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

