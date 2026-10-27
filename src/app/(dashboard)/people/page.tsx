import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

import { requireOnboardedUser } from "@/lib/dal";
import { similarPeople } from "@/lib/people";
import { Suspense } from "react";
import { PeopleListClient } from "@/components/dashboard/people-list-client";

const ROLE_LABEL = { student: "Student", faculty: "Faculty / Mentor", alumni: "Alumni" } as const;

export const metadata: Metadata = {
  title: "People & Research Network | AI Tathastu",
};

export default function PeoplePage() {
  return (
    <Suspense fallback={<PeopleSkeleton />}>
      <PeopleContent />
    </Suspense>
  );
}

function PeopleSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-10 w-64 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 bg-slate-100 rounded-2xl border border-slate-200/60" />
        ))}
      </div>
    </div>
  );
}

async function PeopleContent() {
  const { user } = await requireOnboardedUser();

  // Discoverable people only (mentor_discovery consent), ranked in Postgres by
  // pgvector distance to this user's embedding. No floor or default on the score.
  const people = await similarPeople({ id: user.id, role: user.role }, 24);

  const scoredPeers = people.map((p) => ({
    id: p.id,
    name: p.name || "AI Tathastu member",
    role: ROLE_LABEL[p.role],
    institution: p.institution,
    department: p.department,
    matchPercentage: p.similarity === null ? null : Math.round(p.similarity * 100),
    summary: p.summary,
    initials: (p.name || "AT")
      .split(/\s+/)
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
  }));

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">
              People & Collaboration Network
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Ranked peer researchers, co-authors, and mentors scored by vector cosine similarity against your skills and goals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#EDF5FF] text-[#2878F0] border border-[#2878F0]/20">
              <Users className="size-3.5" />
              {scoredPeers.length} Potential Collaborators
            </span>
          </div>
        </div>
      </div>

      {/* People Grid with Client Interaction */}
      <PeopleListClient initialPeers={scoredPeers} />
    </div>
  );
}
