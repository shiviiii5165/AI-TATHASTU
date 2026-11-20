import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { CollaborateHub } from "@/components/collaborate/hub";
import { hubView, uuidOrNull } from "@/components/collaborate/views";
import { optionalViewerId } from "@/lib/collaborations/http";

export const metadata: Metadata = {
  title: "Collaborate · Find teammates for projects, hackathons and research | AI Tathastu",
  description: "Browse student, faculty and alumni collaborations on AI Tathastu: projects, hackathon teams, research and learning groups. Sign in to request to join.",
};

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/**
 * Public Collaborate (no sign-in): Discover and collaboration details for everyone. Applying, asking and every
 * private view need an account; signed-in members are pointed to the full experience inside AVSAR.
 */
export default function PublicCollaborationsPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="min-h-dvh bg-[#F6FAFB] dark:bg-[#0A161B]">
      <header className="border-b border-[#D6E9EC] bg-white/90 backdrop-blur dark:border-[#1F3C45] dark:bg-[#0E1D23]/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <BrandLogo href="/" withTagline={false} size="sm" />
          <Suspense fallback={null}>
            <HeaderAction />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Suspense fallback={<div role="status" aria-label="Loading" className="h-64 animate-pulse rounded-3xl bg-[#E2F6F7] motion-reduce:animate-none" />}>
          <Hub searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function HeaderAction() {
  await connection();
  const signedIn = !!(await optionalViewerId());
  return signedIn ? (
    <Link href="/opportunities?cat=collaborations" className="rounded-lg px-3 py-2 text-sm font-semibold text-[#0A6F78] hover:underline dark:text-[#66D7E0]">Open in AVSAR</Link>
  ) : (
    <Link href="/login?callbackUrl=%2Fcollaborations" className="rounded-lg bg-[#0E8F9A] px-3 py-2 text-sm font-semibold text-white hover:bg-[#0A6F78]">Sign in</Link>
  );
}

async function Hub({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const signedIn = !!(await optionalViewerId());
  return (
    <CollaborateHub
      signedIn={signedIn}
      basePath="/collaborations"
      initialView={hubView(one(sp.view))}
      initialPost={uuidOrNull(one(sp.post))}
      initialThread={uuidOrNull(one(sp.thread))}
    />
  );
}
