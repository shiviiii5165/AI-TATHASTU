"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Clock3,
  MapPin,
  Monitor,
  Users,
} from "lucide-react";
import Link from "next/link";
import { AvsarBriefcase, AvsarSideGlow, RetryButton } from "@/components/avsar/avsar-ui";
import { AVSAR_LAUNCH_URL, monogram } from "@/components/avsar/monogram";
import type { InternshipFeed, ResearchCard, ResearchFeed } from "@/lib/dashboard/stats";
import type { InternshipCard } from "@/lib/opportunities/avsar";

interface EcosystemOpportunitiesRowProps {
  research?: ResearchFeed;
  internships?: InternshipFeed;
}

export function EcosystemOpportunitiesRow({ research, internships }: EcosystemOpportunitiesRowProps) {
  return (
    // Mentor recommendations were a permanent "coming soon" card with no data source; removed until matching exists.
    // items-start: each card keeps its own height, so the AVSAR previews don't stretch the compact People card.
    <div id="opportunities" className="grid scroll-mt-20 grid-cols-1 items-start gap-4 xl:grid-cols-3">
      <PeopleRecommendationsCard />
      <AvsarSection research={research} internships={internships} />
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

// ── AVSAR: one section for Avsar internships + verified research ──────────────

type FitState = ResearchCard["fit"]["state"];

const FIT_LABEL: Record<FitState, { label: string; cls: string }> = {
  strong_fit: { label: "Strong fit", cls: "bg-[#E8FAF4] text-[#0E7C66]" },
  potential_fit: { label: "Potential fit", cls: "bg-[#EDF5FF] text-[#1D5FC4]" },
  insufficient_information: { label: "Not enough information", cls: "bg-[#F4F6F9] text-[#475569]" },
  not_eligible: { label: "Not eligible", cls: "bg-[#FFF4E5] text-[#9A5B00]" },
};
const FIT_ORDER: Record<FitState, number> = { strong_fit: 0, potential_fit: 1, insufficient_information: 2, not_eligible: 3 };

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

const WORK_MODE: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", "on-site": "On-site" };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const PREVIEW_LIMIT = 4;

interface Preview {
  key: string;
  type: "internship" | "research";
  title: string;
  organization: string;
  meta: { icon: ReactNode; text: string }[];
  deadline: string | null;
  fit: { state: FitState; summary: string };
  /** Internship: Avsar's own listing URL (origin-validated in lib/opportunities/avsar.ts). Research: the verified detail page. */
  href: string;
  external: boolean;
}

function fromInternship(it: InternshipCard): Preview {
  const meta: Preview["meta"] = [];
  const where = it.locations.slice(0, 2).join(", ");
  if (where) meta.push({ icon: <MapPin aria-hidden className="size-3" />, text: where });
  if (WORK_MODE[it.workMode]) meta.push({ icon: <Monitor aria-hidden className="size-3" />, text: WORK_MODE[it.workMode]! });
  if (it.durationWeeks) meta.push({ icon: <Clock3 aria-hidden className="size-3" />, text: `${it.durationWeeks} week${it.durationWeeks === 1 ? "" : "s"}` });
  return {
    key: `avsar:${it.id}`,
    type: "internship",
    title: it.title,
    organization: it.organization,
    meta,
    deadline: it.deadline ? `Apply by ${fmtDate(it.deadline)}` : null,
    fit: it.fit,
    href: it.url,
    external: true,
  };
}

function fromResearch(o: ResearchCard): Preview {
  const meta: Preview["meta"] = [];
  if (o.location) meta.push({ icon: <MapPin aria-hidden className="size-3" />, text: o.location });
  if (o.workMode) meta.push({ icon: <Monitor aria-hidden className="size-3" />, text: WORK_MODE[o.workMode.toLowerCase()] ?? o.workMode });
  return {
    key: `research:${o.id}`,
    type: "research",
    title: o.title,
    organization: [o.organization, o.kind ? KIND_LABEL[o.kind] ?? null : null].filter(Boolean).join(" · "),
    meta,
    deadline: o.deadline ? `Deadline: ${o.deadline}` : null,
    fit: o.fit,
    href: `/opportunities/${o.id}`,
    external: false,
  };
}

/** Best matches first, keeping both types visible when both have results. */
function pickPreviews(internships: Preview[], research: Preview[]): Preview[] {
  const byFit = (a: Preview, b: Preview) => FIT_ORDER[a.fit.state] - FIT_ORDER[b.fit.state];
  const i = [...internships].sort(byFit);
  const r = [...research].sort(byFit);
  // Up to half the slots each; a type with fewer results gives its slots to the other.
  const half = Math.ceil(PREVIEW_LIMIT / 2);
  const nI = Math.min(i.length, Math.max(half, PREVIEW_LIMIT - r.length));
  return [...i.slice(0, nI), ...r.slice(0, PREVIEW_LIMIT - nI)].sort(byFit);
}

const TYPE_STYLE: Record<Preview["type"], { label: string; tag: string; logo: string; bar: string }> = {
  internship: { label: "Internship · Avsar", tag: "text-[#1D5FC4]", logo: "bg-[#EDF5FF] text-[#1D5FC4]", bar: "bg-[#1D5FC4]" },
  research: { label: "Research · Verified", tag: "text-[#0E7C66]", logo: "bg-[#E8FAF4] text-[#0E7C66]", bar: "bg-[#0F9F8A]" },
};

function PreviewRow({ p }: { p: Preview }) {
  const t = TYPE_STYLE[p.type];
  const fit = FIT_LABEL[p.fit.state];
  const titleCls =
    "text-[13px] font-bold leading-snug text-[#11182B] after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none group-hover:text-[#1D5FC4]";
  return (
    <li className="group relative flex gap-3 overflow-hidden rounded-xl border border-[#EEF1F7] bg-white p-3 transition-[border-color,box-shadow] duration-150 hover:border-[#D5DBEA] hover:shadow-[0_8px_20px_-14px_rgba(29,95,196,0.4)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[#1D5FC4]">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${t.bar}`} />
      <span aria-hidden className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${t.logo}`}>{monogram(p.organization)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${t.tag}`}>{t.label}</p>
            {p.external ? (
              <a href={p.href} target="_blank" rel="noopener noreferrer" className={titleCls}>
                {p.title}
                <span className="sr-only"> at {p.organization}, opens this listing on Avsar in a new tab</span>
              </a>
            ) : (
              <Link href={p.href} className={titleCls}>
                {p.title}
                <span className="sr-only"> at {p.organization}, verified research listing on AI Tathastu</span>
              </Link>
            )}
            <p className="truncate text-[11px] font-medium text-[#475569]">{p.organization}</p>
          </div>
          <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${fit.cls}`} title="Match Intelligence">
            {fit.label}
          </span>
        </div>
        {(p.meta.length > 0 || p.deadline) && (
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#475569]">
            {p.meta.map((m) => (
              <span key={m.text} className="inline-flex items-center gap-1">
                {m.icon} {m.text}
              </span>
            ))}
            {p.deadline && (
              <span className="inline-flex items-center gap-1 font-semibold text-[#9A5B00]">
                <CalendarClock aria-hidden className="size-3" /> {p.deadline}
              </span>
            )}
          </p>
        )}
        <p className="mt-1 line-clamp-1 text-[11px] text-[#334155]">{p.fit.summary}</p>
      </div>
      {p.external && <ArrowUpRight aria-hidden className="size-3.5 shrink-0 self-center text-[#94A3B8] transition-colors group-hover:text-[#1D5FC4]" />}
    </li>
  );
}

function Note({ tone, children }: { tone: "error" | "warn" | "info"; children: ReactNode }) {
  const cls = { error: "text-[#8A1C36]", warn: "text-[#7A4A00]", info: "text-[#475569]" }[tone];
  return (
    <p role={tone === "info" ? undefined : "status"} className={`flex items-start gap-1.5 text-[11px] ${cls}`}>
      {tone !== "info" && <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

/**
 * One AVSAR section on the dashboard. Internships come only from Avsar's partner API and open their exact
 * Avsar listing; research comes only from AI Tathastu's verified catalogue (not published on Avsar) and opens
 * its verified detail page. Ratings are the existing qualitative fit states, never percentages.
 */
function AvsarSection({ research, internships }: { research?: ResearchFeed; internships?: InternshipFeed }) {
  const researchDown = !research || research.status === "unavailable";
  const avsarDown = internships?.status === "unavailable";
  const avsarOff = !internships || internships.status === "not_configured";
  const launchUrl = internships && internships.status !== "ok" ? internships.handoffUrl : internships?.browseUrl ?? AVSAR_LAUNCH_URL;

  const iPreviews = internships?.status === "ok" ? internships.items.map(fromInternship) : [];
  const rPreviews = research?.status === "ok" ? research.items.map(fromResearch) : [];
  const shown = pickPreviews(iPreviews, rPreviews);
  const total = iPreviews.length + rPreviews.length;
  const bothDown = researchDown && (avsarDown || avsarOff);
  const personalised = (research?.status === "ok" && research.personalised) || (internships?.status === "ok" && internships.personalised);

  return (
    <section
      aria-labelledby="avsar-dash-heading"
      data-testid="avsar-dashboard"
      className="relative overflow-hidden rounded-2xl border border-[#E7EAF3] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,43,0.04),0_12px_32px_-20px_rgba(59,79,224,0.3)] sm:p-5 xl:col-span-2"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#1D5FC4,#7C4DDB_35%,#0F9F8A_65%,#F59E0B)] opacity-80" />
      <AvsarSideGlow className="-right-10 top-2 size-56 sm:size-72" />

      <div className="relative grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0 sm:order-1">
          <header className="pr-20 sm:pr-0">
            <p className="inline-flex items-center gap-2 text-[11px] font-extrabold tracking-[0.22em] text-[#5B4FE0]">
              <span aria-hidden className="flex gap-1">
                <span className="size-1.5 rounded-full bg-[#1D5FC4]" />
                <span className="size-1.5 rounded-full bg-[#0F9F8A]" />
                <span className="size-1.5 rounded-full bg-[#F59E0B]" />
              </span>
              AVSAR
            </p>
            <h2 id="avsar-dash-heading" className="mt-1.5 font-heading text-lg font-bold leading-tight tracking-tight text-[#11182B] sm:text-xl">
              Discover Opportunities for Your Timeline.
            </h2>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-[#475569] sm:text-[13px]">
              Explore internships and verified research opportunities aligned with your skills, interests and career goals.
            </p>
            <p className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Opportunity types">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1D5FC4]/20 bg-[#EDF5FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#1D5FC4]">
                <span aria-hidden className="size-1.5 rounded-full bg-[#1D5FC4]" /> Internships
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#0E7C66]/20 bg-[#E8FAF4] px-2.5 py-0.5 text-[11px] font-semibold text-[#0E7C66]">
                <span aria-hidden className="size-1.5 rounded-full bg-[#0F9F8A]" /> Research
              </span>
            </p>
          </header>

          <div className="mt-3 space-y-1">
            {!bothDown && avsarDown && <Note tone="error">Avsar internships couldn&apos;t be loaded just now; showing verified research only.</Note>}
            {!bothDown && researchDown && <Note tone="error">Verified research couldn&apos;t be loaded just now; showing Avsar internships only.</Note>}
            {!bothDown && avsarOff && <Note tone="info">Avsar internships appear here once the Avsar connection is switched on.</Note>}
            {internships?.status === "ok" && internships.stale && <Note tone="warn">Couldn&apos;t refresh from Avsar. Internships last updated {fmtDate(internships.fetchedAt)}.</Note>}
            {!personalised && total > 0 && (
              <Note tone="info">
                Add skills or connect GitHub to see how each one fits you.{" "}
                <Link href="/skills" className="font-semibold text-[#5B4FE0] hover:underline">Update skills</Link>
              </Note>
            )}
          </div>

          {bothDown ? (
            <div role="alert" className="mt-3 rounded-xl border border-[#F8C9D3] bg-[#FFF5F7] px-4 py-5 text-center">
              <p className="text-sm font-bold text-[#11182B]">Opportunities couldn&apos;t be loaded</p>
              <p className="mx-auto mt-0.5 max-w-sm text-xs text-[#475569]">This is a connection problem, not an empty list.</p>
              <div className="mt-3 flex justify-center">
                <RetryButton />
              </div>
            </div>
          ) : shown.length === 0 ? (
            <div role="status" className="mt-3 rounded-xl border border-dashed border-[#DCE1EC] px-4 py-5 text-center">
              <p className="text-sm font-bold text-[#11182B]">No matching opportunities right now.</p>
              <p className="mx-auto mt-0.5 max-w-sm text-xs text-[#475569]">Discover opportunities on Avsar. New listings appear here as they are published.</p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2" aria-label="AVSAR opportunity previews">
              {shown.map((p) => (
                <PreviewRow key={p.key} p={p} />
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {/* Plain <a>: the authorised launch route redirects into Avsar's own sign-in; needs a full navigation. */}
            <a
              href={launchUrl}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#1D5FC4] px-3.5 py-2 text-xs font-semibold text-white shadow-[0_6px_16px_-8px_rgba(29,95,196,0.6)] transition-colors hover:bg-[#174C9E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D5FC4] active:bg-[#123E82]"
            >
              Explore all opportunities on AVSAR <ArrowUpRight aria-hidden className="size-3.5" />
            </a>
            {total > shown.length && (
              <Link href="/opportunities" className="text-[11px] font-semibold text-[#475569] hover:text-[#11182B] hover:underline">
                {total - shown.length} more in AVSAR
              </Link>
            )}
          </div>
        </div>

        {/* Briefcase: corner accent on phones, full illustration beside the content from sm up. */}
        <div className="absolute right-0 top-0 size-[76px] sm:static sm:order-2 sm:size-[150px] sm:self-start lg:size-[180px]">
          <AvsarBriefcase size={180} />
        </div>
      </div>
    </section>
  );
}
