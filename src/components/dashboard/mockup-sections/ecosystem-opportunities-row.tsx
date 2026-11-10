"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Briefcase,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { OpportunityItem } from "@/lib/dashboard/stats";

interface EcosystemOpportunitiesRowProps {
  opportunities?: OpportunityItem[];
  internships?: OpportunityItem[];
}

export function EcosystemOpportunitiesRow({
  opportunities = [],
  internships = [],
}: EcosystemOpportunitiesRowProps) {
  return (
    // Mentor recommendations were a permanent "coming soon" card with no data source; removed until matching exists.
    <div id="opportunities" className="grid scroll-mt-20 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      <PeopleRecommendationsCard />
      <OpportunitiesCard opportunities={opportunities} />
      <NetworkInternshipsCard internships={internships} />
    </div>
  );
}

/**
 * A short preview of relevant people (at most three) from the existing matching: discoverable people only
 * (mentor_discovery), ranked by profile similarity, each with one genuine reason (lib/people-preview.ts).
 * Full discovery, profiles and connecting live in Collaborate, reached through the authorised launch route.
 */
function PeopleRecommendationsCard() {
  const [people, setPeople] = useState<Array<{ id: string; name: string; role: string; institution: string | null; reason: string; initials: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/collaboration/matches")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.matches)) setPeople(data.matches.slice(0, 3));
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs" data-testid="people-preview">
      <div className="flex items-center gap-2 border-b border-[#F0F2F7] pb-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#E6F8FB] text-[#00AEC7]">
          <Users aria-hidden className="size-4" />
        </div>
        <h2 className="font-sans text-sm font-bold text-[#11182B]">People you may know</h2>
      </div>

      {loading ? (
        <p className="py-4 text-xs text-[#617493]" role="status">Looking for people…</p>
      ) : people.length > 0 ? (
        <ul className="divide-y divide-[#F4F6F9] py-1" aria-label="People you may know">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-2.5 py-2.5">
              <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {p.initials}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-[#11182B]">{p.name}</span>
                <span className="block truncate text-[11px] text-[#617493]">{[p.role, p.institution].filter(Boolean).join(" · ")}</span>
                <span className="block truncate text-[11px] text-[#0E7C66]">{p.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-xs text-[#617493]">No suggestions yet. People appear here when your skills overlap and they&apos;ve chosen to be discoverable.</p>
      )}

      {/* Plain <a>: a server redirect into Collaborate's own sign-in (authorised launch), never prefetched. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- route handler that redirects off-site; needs a full navigation */}
      <a
        href="/integrations/launch/collaborate"
        className="mt-auto inline-flex items-center gap-1 self-start border-t border-transparent pt-2 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
      >
        Explore more on Collaborate
        <ArrowUpRight aria-hidden className="size-3.5" />
      </a>
    </div>
  );
}

function OpportunitiesCard({ opportunities = [] }: { opportunities?: OpportunityItem[] }) {
  const hasOpps = opportunities.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#FFF0F4] text-[#FF496D]">
            <Briefcase className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Research opportunities</h2>
        </div>
      </div>

      {hasOpps ? (
        <div className="my-auto divide-y divide-[#F4F6F9] py-1">
          {opportunities.slice(0, 3).map((o) => {
            const isHigh = (o.matchPercentage ?? 0) >= 80;
            const matchColor = isHigh
              ? "text-[#19C58A] bg-[#E8FAF4]"
              : "text-[#2878F0] bg-[#EDF5FF]";

            return (
              <div key={o.id} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-xs font-bold text-[#11182B]" title={o.title}>
                      {o.title}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#617493] truncate">{o.org}</p>
                  </div>
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${matchColor}`} title="Share of its required skills found on your profile">
                    {o.match}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-rose-50 text-[#FF496D] flex items-center justify-center mb-2.5">
            <Briefcase className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No open research opportunities</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[220px]">
            Research roles and grants appear here when they&apos;re listed, matched against your confirmed skills.
          </p>
          <Link
            href="/skills"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF496D] text-white text-xs font-semibold hover:bg-[#E0264E] transition-colors"
          >
            <span>Update Skills</span>
          </Link>
        </div>
      )}

      {opportunities.length > 3 && (
        <p className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493]">And {opportunities.length - 3} more listed</p>
      )}
    </div>
  );
}

function NetworkInternshipsCard({ internships = [] }: { internships?: OpportunityItem[] }) {
  const hasInternships = internships.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#EDF5FF] text-[#2878F0]">
            <Sparkles className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Internships</h2>
        </div>
      </div>

      {hasInternships ? (
        <div className="my-auto divide-y divide-[#F4F6F9] py-1">
          {internships.slice(0, 3).map((item) => (
            <div key={item.id} className="py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-xs font-bold text-[#11182B]" title={item.title}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#617493] truncate">
                    {item.org} {item.location ? `· ${item.location}` : ""}
                  </p>
                </div>
                {item.deadline && (
                  <span className="shrink-0 text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
                    {item.deadline}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-blue-50 text-[#2878F0] flex items-center justify-center mb-2.5">
            <Sparkles className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No open internships</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[220px]">
            Internships appear here when they&apos;re listed, with their deadlines.
          </p>
        </div>
      )}

      {internships.length > 3 && (
        <p className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493]">And {internships.length - 3} more listed</p>
      )}
    </div>
  );
}