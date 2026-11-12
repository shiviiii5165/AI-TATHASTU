"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Briefcase,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { InternshipFeed, ResearchCard, ResearchFeed } from "@/lib/dashboard/stats";

interface EcosystemOpportunitiesRowProps {
  research?: ResearchFeed;
  internships?: InternshipFeed;
}

export function EcosystemOpportunitiesRow({ research, internships }: EcosystemOpportunitiesRowProps) {
  return (
    // Mentor recommendations were a permanent "coming soon" card with no data source; removed until matching exists.
    // items-start: each card keeps its own height, so a long research list doesn't stretch the compact People card.
    <div id="opportunities" className="grid scroll-mt-20 grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
      <PeopleRecommendationsCard />
      <OpportunitiesCard research={research} />
      <NetworkInternshipsCard feed={internships} />
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

const FIT_LABEL: Record<ResearchCard["fit"]["state"], { label: string; cls: string }> = {
  strong_fit: { label: "Strong fit", cls: "bg-[#E8FAF4] text-[#0E7C66]" },
  potential_fit: { label: "Potential fit", cls: "bg-[#EDF5FF] text-[#1D5FC4]" },
  insufficient_information: { label: "Not enough information", cls: "bg-[#F4F6F9] text-[#475569]" },
  not_eligible: { label: "Not eligible", cls: "bg-[#FFF4E5] text-[#9A5B00]" },
};

const KIND_LABEL: Record<string, string> = {
  research_assistant: "Research assistant",
  research_project: "Research project",
  research_internship: "Research internship",
  collaboration: "Student collaboration",
  funded_programme: "Funded programme",
  call_for_collaborators: "Call for collaborators",
  phd_position: "PhD position",
  fellowship: "Fellowship / postdoc",
};

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

function CardShell({ icon, iconCls, title, children }: { icon: ReactNode; iconCls: string; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center gap-2 border-b border-[#F0F2F7] pb-3">
        <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>{icon}</div>
        <h2 className="font-sans text-sm font-bold text-[#11182B]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="my-auto flex flex-col items-center px-2 py-6 text-center" role="status">
      <p className="text-xs font-bold text-[#11182B]">{title}</p>
      <p className="mt-1 max-w-[240px] text-[11px] text-[#475569]">{body}</p>
      {action}
    </div>
  );
}

/**
 * Verified, active research opportunities from curated official sources (lib/opportunities).
 * Each shows its source, when it was last verified, a published deadline only if one exists,
 * and the reason it fits (or doesn't), with no match percentage.
 */
function OpportunitiesCard({ research }: { research?: ResearchFeed }) {
  const icon = <Briefcase aria-hidden className="size-4" />;
  const shell = (children: ReactNode) => (
    <CardShell icon={icon} iconCls="bg-[#FFF0F4] text-[#E0264E]" title="Research opportunities">
      {children}
    </CardShell>
  );
  if (!research || research.status === "unavailable") {
    return shell(<EmptyState title="Research listings are temporarily unavailable" body="We couldn't load verified opportunities just now. Please check back later." />);
  }
  if (research.items.length === 0) {
    return shell(<EmptyState title="No verified research opportunities right now" body="Only openings confirmed on an official university, lab or programme page are listed here, so this stays empty until one is verified." />);
  }
  const shown = research.items.slice(0, 3);
  return shell(
    <>
      {!research.personalised && (
        <p className="pt-2 text-[11px] text-[#475569]">
          Add skills or connect GitHub to see how each one fits you. <Link href="/skills" className="font-semibold text-[#E0264E] hover:underline">Update skills</Link>
        </p>
      )}
      <ul className="divide-y divide-[#F4F6F9] py-1" aria-label="Research opportunities" data-testid="research-opportunities">
        {shown.map((o) => {
          const fit = FIT_LABEL[o.fit.state];
          const meta = [o.organization, o.researchGroup, o.kind ? KIND_LABEL[o.kind] ?? null : null, [o.location, o.workMode].filter(Boolean).join(" · ") || null].filter(Boolean);
          const unmet = o.fit.notShown.slice(0, 3);
          return (
            <li key={o.id} className="py-2.5">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/opportunities/${o.id}`} className="text-xs font-bold leading-snug text-[#11182B] hover:text-[#E0264E] focus-visible:outline-2">{o.title}</Link>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${fit.cls}`}>{fit.label}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#475569]">{meta.join(" · ")}</p>
              <p className="mt-1 text-[11px] text-[#11182B]">{o.fit.summary}</p>
              {unmet.length > 0 && o.fit.state !== "not_eligible" && (
                <p className="mt-0.5 text-[11px] text-[#475569]">Not shown on your profile yet: {unmet.join(", ")}</p>
              )}
              {o.fit.eligibility.status !== "met" && o.fit.state !== "not_eligible" && (
                <p className="mt-0.5 text-[11px] text-[#475569]">Eligibility: {o.fit.eligibility.detail}</p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#475569]">
                {o.deadline ? <span className="font-semibold text-[#9A5B00]">Deadline: {o.deadline}</span> : <span>No deadline published</span>}
                <span>
                  {o.sourceName} · verified {fmtDate(o.lastVerifiedAt)}
                </span>
                <Link href={`/opportunities/${o.id}`} className="font-semibold text-[#11182B] hover:underline focus-visible:outline-2">View details</Link>
                <a href={`/opportunities/${o.id}/apply`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-[#E0264E] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                  Apply on official site <ArrowUpRight aria-hidden className="size-3" />
                  <span className="sr-only">(opens {o.sourceName} in a new tab)</span>
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-[#F8FAFC] pt-2 text-[11px] text-[#475569]">
        <span>{research.items.length > 3 ? `And ${research.items.length - 3} more verified` : "Verified at their official sources"}</span>
        <Link href="/opportunities" className="font-semibold text-[#E0264E] hover:underline">Browse all</Link>
      </div>
    </>,
  );
}

const WORK_MODE: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

const avsarButton = (href: string, label = "Browse internships on Avsar") => (
  // Plain <a>: a route handler that redirects into Avsar's own sign-in; needs a full navigation.
  <a
    href={href}
    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1D5FC4] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#174C9E] focus-visible:outline-2 focus-visible:outline-offset-2"
  >
    {label} <ArrowUpRight aria-hidden className="size-3.5" />
  </a>
);

/**
 * Internships from Avsar's partner API (lib/opportunities/avsar.ts), explained against the student's
 * Intelligence Engine signals. View details and Apply both open Avsar, which handles sign-in,
 * eligibility and the application itself; nothing is submitted or recorded in AI Tathastu.
 */
function NetworkInternshipsCard({ feed }: { feed?: InternshipFeed }) {
  const shell = (children: ReactNode) => (
    <CardShell icon={<Sparkles aria-hidden className="size-4" />} iconCls="bg-[#EDF5FF] text-[#1D5FC4]" title="Internships">
      {children}
    </CardShell>
  );
  if (!feed || feed.status === "not_configured") {
    return shell(
      <EmptyState
        title="Internship matches aren't connected yet"
        body="Internships are published and managed on Avsar. Personalised matches appear here once the Avsar connection is switched on; you can browse and apply on Avsar now."
        action={avsarButton(feed?.handoffUrl ?? "/integrations/launch/avasar")}
      />,
    );
  }
  if (feed.status === "unavailable") {
    return shell(
      <EmptyState
        title="Avsar is temporarily unavailable"
        body="We couldn't load internships from Avsar just now. Please try again later, or open Avsar directly."
        action={avsarButton(feed.handoffUrl, "Open Avsar")}
      />,
    );
  }
  if (feed.items.length === 0) {
    return shell(<EmptyState title="No active internships on Avsar right now" body="Avsar has no open internships at the moment. New ones appear here when they're published." action={avsarButton(feed.browseUrl)} />);
  }
  const shown = feed.items.slice(0, 3);
  return shell(
    <>
      {feed.stale && (
        <p className="pt-2 text-[11px] text-[#9A5B00]" role="status">
          Couldn&apos;t refresh from Avsar. Showing listings last updated {fmtDate(feed.fetchedAt)}.
        </p>
      )}
      {!feed.personalised && (
        <p className="pt-2 text-[11px] text-[#475569]">
          Add skills or connect GitHub to see how each internship fits you. <Link href="/skills" className="font-semibold text-[#1D5FC4] hover:underline">Update skills</Link>
        </p>
      )}
      <ul className="divide-y divide-[#F4F6F9] py-1" aria-label="Internships from Avsar" data-testid="avsar-internships">
        {shown.map((it) => {
          const fit = FIT_LABEL[it.fit.state];
          const where = [it.locations.slice(0, 2).join(", ") || null, WORK_MODE[it.workMode]].filter(Boolean).join(" · ");
          const unmet = it.fit.notShown.slice(0, 3);
          return (
            <li key={it.id} className="py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold leading-snug text-[#11182B]">{it.title}</p>
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${fit.cls}`}>{fit.label}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-[#475569]">{[it.organization, where].filter(Boolean).join(" · ")}</p>
              <p className="mt-1 text-[11px] text-[#11182B]">{it.fit.summary}</p>
              {unmet.length > 0 && it.fit.state !== "not_eligible" && (
                <p className="mt-0.5 text-[11px] text-[#475569]">Not shown on your profile yet: {unmet.join(", ")}</p>
              )}
              {(it.checks.length > 0 || (it.fit.eligibility.status === "unknown" && it.fit.state !== "not_eligible")) && (
                <p className="mt-0.5 text-[11px] text-[#475569]">
                  Check on Avsar: {[...(it.fit.eligibility.status === "unknown" ? [it.fit.eligibility.detail] : []), ...it.checks].slice(0, 3).join(" · ")}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#475569]">
                {it.deadline && <span className="font-semibold text-[#9A5B00]">Apply by {fmtDate(it.deadline)}</span>}
                {it.stipend && <span>{it.stipend}</span>}
                <a href={it.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1D5FC4] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                  View details<span className="sr-only"> for {it.title} on Avsar (new tab)</span>
                </a>
                <a href={it.applyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 rounded-md bg-[#1D5FC4] px-2 py-0.5 font-semibold text-white hover:bg-[#174C9E] focus-visible:outline-2 focus-visible:outline-offset-2">
                  Apply on Avsar <ArrowUpRight aria-hidden className="size-3" />
                  <span className="sr-only"> (opens Avsar in a new tab; you apply there)</span>
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between border-t border-[#F8FAFC] pt-2 text-[11px] text-[#475569]">
        <span>{feed.items.length > 3 ? `And ${feed.items.length - 3} more on Avsar` : "From Avsar"}</span>
        {/* Plain <a>: authorised launch route into Avsar. */}
        <a href={feed.browseUrl} className="font-semibold text-[#1D5FC4] hover:underline">Browse all</a>
      </div>
    </>,
  );
}
