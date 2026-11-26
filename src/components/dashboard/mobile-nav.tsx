"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, FolderGit2, Home, Menu, Sparkles } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Small screens (phones, tablets, and laptops zoomed past the desktop breakpoint): a bottom bar for the most used
 * sections, and a "More" drawer that shows EXACTLY the desktop sidebar (`children` = components/dashboard/sidebar.tsx
 * SidebarContent), so navigation looks and reads the same at every size. No second menu is kept here.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Same labels as the sidebar.
  const primaryTabs = [
    { href: "/dashboard", label: "Home", icon: Home },
    { href: "/skills", label: "Skills", icon: Sparkles },
    { href: "/projects", label: "Projects", icon: FolderGit2 },
    { href: "/opportunities", label: "AVSAR", icon: Briefcase },
  ];
  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`));
  const isMoreActive = drawerOpen || !primaryTabs.some((t) => isActive(t.href));

  return (
    <>
      <nav aria-label="Mobile primary navigation" className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2 pb-[env(safe-area-inset-bottom,0px)]">
          {primaryTabs.map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold transition-colors duration-150 touch-manipulation",
                  active ? "text-[#FF496D] font-bold" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon aria-hidden className="size-4.5 stroke-[2.2]" />
                <span className="leading-none">{tab.label}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open full menu and modules"
            aria-expanded={drawerOpen}
            className={cn(
              "relative flex min-h-[44px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold transition-colors duration-150 touch-manipulation cursor-pointer",
              isMoreActive ? "text-[#FF496D] font-bold" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Menu aria-hidden className="size-4.5 stroke-[2.2]" />
            <span className="leading-none">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-64 max-w-[85vw] flex-col gap-0 overflow-hidden bg-card p-0">
          <SheetHeader className="border-b border-border px-4 py-4 text-left">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <BrandLogo size="sm" />
          </SheetHeader>
          {/* A link in the sidebar closes the drawer once used (Sign out is left alone: closing first would cancel its form). */}
          <div
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] [scrollbar-width:none]"
            onClickCapture={(e) => {
              if ((e.target as HTMLElement).closest("a")) setDrawerOpen(false);
            }}
          >
            {children}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
