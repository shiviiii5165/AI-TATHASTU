import { Suspense } from "react";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { SidebarContent } from "@/components/dashboard/sidebar";
import { getSession } from "@/lib/dal";

// Shell for the dashboard and every module page.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="app-type min-h-dvh flex flex-col bg-background text-foreground">
      <a
        href="#app-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      {/* Top Global Header */}
      <Suspense fallback={<DashboardHeader />}>
        <HeaderWithSession />
      </Suspense>

      {/* Body: Left Sidebar (Desktop) + Main Content + Mobile Bottom Navigation */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)]">
        {/* Desktop Sidebar (hidden on small screens, where the same SidebarContent opens in the drawer) */}
        <aside className="hidden lg:flex flex-col gap-4 border-r border-border bg-card px-4 py-5 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] shadow-[1px_0_4px_rgba(15,23,42,0.02)] overflow-y-auto [scrollbar-width:none]">
          <SidebarContent />
        </aside>

        {/* Main Content Area: pb-28 accounts for mobile bottom bar */}
        <main
          id="app-content"
          className="min-w-0 px-3 pt-4 pb-28 sm:px-6 sm:pt-6 lg:px-8 lg:pb-16 pl-safe pr-safe bg-background"
        >
          {children}
        </main>
      </div>

      {/* Small screens: bottom bar + a drawer holding the very same sidebar as desktop */}
      <MobileNav>
        <SidebarContent />
      </MobileNav>
    </div>
  );
}

async function HeaderWithSession() {
  const session = await getSession();
  return <DashboardHeader user={session?.user} />;
}
