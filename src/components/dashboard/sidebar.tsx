import { ArrowUpRight, LogOut, Plug, Share2, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/auth";
import { AppNav } from "@/components/dashboard/app-nav";

/**
 * THE dashboard sidebar: the main navigation (AppNav) and the lower area (Collaborate, Privacy, Integrations,
 * Sign out). Rendered by the desktop sidebar AND inside the mobile drawer, so a phone, a tablet and a zoomed-in
 * laptop all show the same menu with the same labels and order. Change navigation here (or in lib/dashboard/nav.ts),
 * never in a second copy.
 */
export function SidebarContent() {
  return (
    <>
      <AppNav />
      <div className="flex flex-col items-stretch gap-1 border-t border-border pt-3">
        {/* Plain <a>: a server redirect into Collaborate's own sign-in (OAuth), never prefetched. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler that redirects off-site; needs a full navigation */}
        <a
          href="/integrations/launch/collaborate"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/20 focus-visible:outline-none"
        >
          <Share2 aria-hidden className="size-4 text-muted-foreground" />
          <span className="flex-1">Collaborate</span>
          <ArrowUpRight aria-hidden className="size-3.5 text-muted-foreground" />
          <span className="sr-only">(opens Collaborate)</span>
        </a>
        <Link
          href="/settings/privacy"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/20 focus-visible:outline-none"
        >
          <ShieldCheck aria-hidden className="size-4 text-muted-foreground" />
          Privacy
        </Link>
        <Link
          href="/settings/integrations"
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/20 focus-visible:outline-none"
        >
          <Plug aria-hidden className="size-4 text-muted-foreground" />
          Integrations
        </Link>
        <SignOut />
      </div>
    </>
  );
}

/** Server action form (Next.js action origin checks apply); same on every screen size. */
function SignOut() {
  return (
    <form
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
