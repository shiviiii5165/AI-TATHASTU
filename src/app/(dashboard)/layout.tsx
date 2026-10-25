import { LogOut, Plug, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/auth";
import { AppNav } from "@/components/dashboard/app-nav";
import { MobileNav } from "@/components/dashboard/mobile-nav";

import { Suspense } from "react";
import { connection } from "next/server";
import { auth } from "@/auth";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

// Shell for the dashboard and every module page.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh flex flex-col bg-[#FAFAFC] text-[#11182B]">
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
        {/* Desktop Sidebar (hidden on mobile, persistent on desktop) */}
        <aside className="hidden lg:flex flex-col gap-4 border-r border-[#E7EAF3] bg-white px-4 py-5 lg:sticky lg:top-16 lg:h-[calc(100dvh-4rem)] shadow-[1px_0_4px_rgba(15,23,42,0.02)] overflow-y-auto [scrollbar-width:none]">
          <AppNav />
          <div className="flex flex-col items-stretch gap-1 border-t border-slate-100 pt-3 mt-auto">
            <Link
              href="/settings/privacy"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/20 focus-visible:outline-none"
            >
              <ShieldCheck aria-hidden className="size-4 text-slate-400" />
              Privacy
            </Link>
            <Link
              href="/settings/integrations"
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/20 focus-visible:outline-none"
            >
              <Plug aria-hidden className="size-4 text-slate-400" />
              Integrations
            </Link>
            <SignOut />
          </div>
        </aside>

        {/* Main Content Area: pb-28 accounts for mobile bottom bar */}
        <main
          id="app-content"
          className="min-w-0 px-3 pt-4 pb-28 sm:px-6 sm:pt-6 lg:px-8 lg:pb-16 pl-safe pr-safe bg-[#FAFAFC]"
        >
          {children}
        </main>
      </div>

      {/* Mobile Primary Bottom Navigation & Drawer */}
      <Suspense fallback={null}>
        <MobileNavWithSession />
      </Suspense>
    </div>
  );
}

async function HeaderWithSession() {
  await connection();
  const session = await auth();
  return <DashboardHeader user={session?.user} />;
}

async function MobileNavWithSession() {
  await connection();
  const session = await auth();
  return (
    <MobileNav
      user={session?.user}
      onSignOut={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    />
  );
}


function SignOut({ className }: { className?: string }) {
  return (
    <form
      className={className}
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:outline-none cursor-pointer"
      >
        <LogOut aria-hidden className="size-4" />
        Sign out
      </button>
    </form>
  );
}
