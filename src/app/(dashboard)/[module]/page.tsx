import { ArrowLeft, Construction } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { requireOnboardedUser } from "@/lib/dal";
import { EXTRA_MODULES, NAV_ITEMS, PLACEHOLDER_SLUGS } from "@/lib/dashboard/nav";

// Placeholder for module pages that don't exist yet. Known slugs are
// prerendered; anything else is a 404.
export function generateStaticParams() {
  return PLACEHOLDER_SLUGS.map((module) => ({ module }));
}

const labelOf = (slug: string) =>
  PLACEHOLDER_SLUGS.includes(slug) ? [...NAV_ITEMS, ...EXTRA_MODULES].find((m) => m.slug === slug)?.label : undefined;

export async function generateMetadata({ params }: PageProps<"/[module]">): Promise<Metadata> {
  return { title: labelOf((await params).module) ?? "Not found" };
}

// Blocking on purpose (see below): the shell can't render before we know the
// slug is real, or unknown paths would stream with status 200.
export const instant = false;

// params are awaited before any Suspense boundary so notFound() runs before
// streaming starts and the response is a real 404 (inside a boundary it would
// stream with status 200). Known slugs come from generateStaticParams.
export default async function ModulePage({ params }: PageProps<"/[module]">) {
  const { module } = await params;
  const label = labelOf(module);
  if (!label) notFound();
  return (
    <Suspense fallback={null}>
      <ModulePlaceholder label={label} />
    </Suspense>
  );
}

async function ModulePlaceholder({ label }: { label: string }) {
  // Authoritative check (the proxy's is optimistic).
  await requireOnboardedUser();

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
