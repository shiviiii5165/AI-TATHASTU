import { ArrowLeft, Construction } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ComingSoon } from "@/components/coming-soon/coming-soon";
import { requireOnboardedUser } from "@/lib/dal";
import { EXTRA_MODULES, NAV_ITEMS } from "@/lib/dashboard/nav";

// Shared body for module pages that don't exist yet. Each placeholder slug has
// its own explicit route folder under src/app/(dashboard)/ (no catch-all), so
// unknown root paths such as /robots.txt or /foo never match the dashboard group
// and get the plain root 404 instead of the dashboard shell.
export function placeholderMetadata(slug: string): Metadata {
  return { title: labelOf(slug) };
}

const labelOf = (slug: string) => [...NAV_ITEMS, ...EXTRA_MODULES].find((m) => m.slug === slug)?.label ?? slug;

export function ModulePlaceholderPage({ module }: { module: string }) {
  return (
    <Suspense fallback={null}>
      <ModulePlaceholder label={labelOf(module)} module={module} />
    </Suspense>
  );
}

async function ModulePlaceholder({ label, module }: { label: string; module: string }) {
  // Authoritative check (the proxy's is optimistic).
  await requireOnboardedUser();

  // Mentors and AI Interview have their own animated coming-soon pages.
  if (module === "ai-interview" || module === "mentor") return <ComingSoon module={module} />;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">{label}</h1>
      </div>

      <div className="rounded-2xl border border-dashed border-[#E7EAF3] bg-white p-8 text-center max-w-xl shadow-2xs">
        <div className="size-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
          <Construction aria-hidden className="size-6" />
        </div>
        <h2 className="text-base font-bold text-[#11182B]">Not available yet</h2>
        <p className="mt-1 text-xs text-[#64748B] max-w-sm mx-auto leading-relaxed">
          We&apos;re still building this section. Your dashboard has everything that&apos;s available today.
        </p>
        <Link
          href="/dashboard"
          className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF496D] to-[#FF713D] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all touch-manipulation"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
