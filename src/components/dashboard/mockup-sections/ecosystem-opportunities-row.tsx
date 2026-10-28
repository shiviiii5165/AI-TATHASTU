"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  Briefcase,
  GraduationCap,
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <PeopleRecommendationsCard />
      <MentorRecommendationsCard />
      <OpportunitiesCard opportunities={opportunities} />
      <NetworkInternshipsCard internships={internships} />
    </div>
  );
}

function PeopleRecommendationsCard() {
  const [people, setPeople] = useState<
    Array<{
      id: string;
      name: string;
      role: string;
      institution: string | null;
      reason: string;
      matchPercentage: number;
      initials: string;
      color: string;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/collaboration/matches")
      .then((res) => res.json())
      .then((data) => {
        if (data?.matches && data.matches.length > 0) {
          setPeople(data.matches.slice(0, 3));
        }
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const hasPeople = people.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#E6F8FB] text-[#00AEC7]">
            <Users className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">People You Should Know</h2>
        </div>
        <Link
          href="/people"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View All</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {hasPeople ? (
        <div className="my-auto divide-y divide-[#F4F6F9] py-1">
          {people.map((p, i) => {
            return (
              <div key={p.id || i} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      p.color || "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {p.initials || "PR"}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-xs font-bold text-[#11182B]">{p.name}</p>
                      <span className="rounded-xs bg-[#E8FAF4] px-1 py-0.2 text-[9px] font-bold text-[#19C58A]">
                        {p.matchPercentage}%
                      </span>
                    </div>
                    <p className="truncate text-[10px] text-[#617493]">
                      {[p.role, p.institution].filter(Boolean).join(" · ")}
                    </p>
                    <p className="truncate text-[9px] text-[#8C9AA8]">{p.reason}</p>
                  </div>
                </div>
                {/* No connection backend yet, so link to the profile list instead of a fake "Connected". */}
                <Link
                  href="/people"
                  className="shrink-0 min-h-[34px] inline-flex items-center rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-[11px] font-bold text-[#2878F0] transition-colors hover:bg-[#EDF5FF] touch-manipulation"
                >
                  View
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-cyan-50 text-[#00AEC7] flex items-center justify-center mb-2.5">
            <Users className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">
            {loading ? "Discovering Peers…" : "No Collaborators Found"}
          </p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            As your skills and projects sync, nearby researchers and peers will appear here.
          </p>
          <Link
            href="/people"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00AEC7] text-white text-xs font-semibold hover:bg-[#0098AD] transition-colors"
          >
            <span>Browse Network</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>Discoverable people</span>
        <span className="font-medium text-[#00AEC7]">
          {hasPeople ? `${people.length} active matches` : "Pending"}
        </span>
      </div>
    </div>
  );
}

function MentorRecommendationsCard() {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#F4F1FD] text-[#8554FF]">
            <GraduationCap className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Recommended Mentors</h2>
        </div>
        <Link
          href="/mentor"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View All</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* No mentor-matching data source exists for students yet; don't show
          invented people. Faculty/alumni matches appear in the widgets below. */}
      <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
        <div className="size-10 rounded-full bg-[#F3EFFF] text-[#8554FF] flex items-center justify-center mb-2.5">
          <GraduationCap className="size-5" />
        </div>
        <p className="text-xs font-bold text-[#11182B]">Mentor recommendations coming soon</p>
        <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
          Faculty and alumni who fit your goals will appear here once mentor matching launches.
        </p>
      </div>

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>1-on-1 guidance</span>
        <span className="font-semibold text-[#8554FF]">Coming soon</span>
      </div>
    </div>
  );
}

function OpportunitiesCard({ opportunities = [] }: { opportunities?: OpportunityItem[] }) {
  const hasOpps = opportunities.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#FFF0F4] text-[#FF496D]">
            <Briefcase className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Relevant Opportunities</h2>
        </div>
        <Link
          href="/opportunities"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View All</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
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
                  <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold ${matchColor}`}>
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
          <p className="text-xs font-bold text-[#11182B]">No Opportunities Found</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Confirm more skills on your profile to calculate opportunity matches.
          </p>
          <Link
            href="/skills"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FF496D] text-white text-xs font-semibold hover:bg-[#E0264E] transition-colors"
          >
            <span>Update Skills</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>Active listings</span>
        <span className="font-semibold text-[#FF496D]">
          {hasOpps ? `${opportunities.length} Opportunities` : "0 Listings"}
        </span>
      </div>
    </div>
  );
}

function NetworkInternshipsCard({ internships = [] }: { internships?: OpportunityItem[] }) {
  const hasInternships = internships.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#EDF5FF] text-[#2878F0]">
            <Sparkles className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Internships for Your Network</h2>
        </div>
        <Link
          href="/internships"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View All</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
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
                  <span className="shrink-0 text-[9px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md">
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
          <p className="text-xs font-bold text-[#11182B]">No Active Internships</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Add your academic background to find student internships and campus opportunities.
          </p>
          <Link
            href="/internships"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2878F0] text-white text-xs font-semibold hover:bg-[#2063CC] transition-colors"
          >
            <span>Explore Roles</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>From your network</span>
        <span className="font-medium text-[#2878F0]">
          {hasInternships ? "Referrals open" : "0 Active"}
        </span>
      </div>
    </div>
  );
}
