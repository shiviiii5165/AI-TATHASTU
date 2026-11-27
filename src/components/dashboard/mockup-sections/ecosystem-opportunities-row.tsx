"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
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
import { AvsarBriefcase, AvsarSideGlow, AvsarWordmark, RetryButton } from "@/components/avsar/avsar-ui";
import { AVSAR_CATEGORIES, AVSAR_CATEGORY_KEYS, AVSAR_TAGLINE, COLLAB_KINDS, JOBS_UNAVAILABLE, tabClass, type AvsarCategory } from "@/components/avsar/categories";
import { officialPageHref } from "@/components/avsar/links";
import { AVSAR_LAUNCH_URL, diversifyByOrg, monogram } from "@/components/avsar/monogram";
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

// ── AVSAR: one section, real category tabs over Avsar internships + verified research ──

type FitState = ResearchCard["fit"]["state"];
type ListingCategory = Exclude<AvsarCategory, "all" | "jobs">;

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
  category: ListingCategory;
  title: string;
  organization: string;
  meta: { icon: ReactNode; text: string }[];
  deadline: string | null;
  provenance: string;
  /** Official announcement URL stored at ingestion (research only); never constructed. */
  officialUrl: string | null;
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
    category: "internships",
    title: it.title,
    organization: it.organization,
    meta,
    deadline: it.deadline ? `Apply by ${fmtDate(it.deadline)}` : null,
    provenance: "Listed on Avsar",
    officialUrl: null,
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
    category: o.kind && COLLAB_KINDS.has(o.kind) ? "collaborations" : "research",
    title: o.title,
    organization: [o.organization, o.kind ? KIND_LABEL[o.kind] ?? null : null].filter(Boolean).join(" · "),
    meta,
    deadline: o.deadline ? `Deadline: ${o.deadline}` : null,
    provenance: `${o.sourceName} · verified ${fmtDate(o.lastVerifiedAt)}`,
    officialUrl: officialPageHref(o.url),
    fit: o.fit,
    href: `/opportunities/${o.id}`,
    external: false,
  };
}

const byFit = (a: Preview, b: Preview) => FIT_ORDER[a.fit.state] - FIT_ORDER[b.fit.state];

/** Best fit first; within the same fit level, institutions alternate so one can't fill every slot. */
const rank = (list: Preview[]) =>
  (Object.keys(FIT_ORDER) as FitState[]).flatMap((s) => diversifyByOrg(list.filter((p) => p.fit.state === s)));

/** "All": best matches first, sharing the slots fairly so one source can't crowd out the others. */
function pickAll(groups: Preview[][]): Preview[] {
  const sorted = groups.map(rank);
  const out: Preview[] = [];
  for (let round = 0; out.length < PREVIEW_LIMIT && sorted.some((g) => g.length > round); round++) {
    for (const g of sorted) if (g[round] && out.length < PREVIEW_LIMIT) out.push(g[round]!);
  }
  return out.sort(byFit);
}

const TYPE_STYLE: Record<ListingCategory, { label: string; tag: string; logo: string; bar: string }> = {
  internships: { label: "Internship · Avsar", tag: "text-[#1D5FC4]", logo: "bg-[#EDF5FF] text-[#1D5FC4]", bar: "bg-[#1D5FC4]" },
  research: { label: "Research · Verified", tag: "text-[#0E7C66]", logo: "bg-[#E8FAF4] text-[#0E7C66]", bar: "bg-[#0F9F8A]" },
  collaborations: { label: "Collaboration · Verified", tag: "text-[#9A5B00]", logo: "bg-[#FFF4E5] text-[#9A5B00]", bar: "bg-[#D97706]" },
};

function PreviewRow({ p }: { p: Preview }) {
  const t = TYPE_STYLE[p.category];
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
                <span className="sr-only"> at {p.organization}, verified listing with its official source</span>
              </Link>
            )}
            <p className="truncate text-[11px] font-medium text-[#475569]">{p.organization}</p>
          </div>
          <span className={`hidden shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold sm:inline ${fit.cls}`} title="Match Intelligence">
            {fit.label}
          </span>
        </div>
        {/* Phones: the rating sits under the title so long titles keep the full width. */}
        <span className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold sm:hidden ${fit.cls}`}>{fit.label}</span>
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
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[#617493]">
          <span className="truncate">{p.provenance}</span>
          {p.officialUrl && (
            <a href={p.officialUrl} target="_blank" rel="noopener noreferrer" className="relative z-10 inline-flex items-center gap-0.5 font-semibold text-[#0E7C66] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
              Official page <ArrowUpRight aria-hidden className="size-2.5" />
              <span className="sr-only"> for {p.title} (new tab)</span>
            </a>
          )}
        </p>
      </div>
      {p.external && <ArrowUpRight aria-hidden className="size-3.5 shrink-0 self-center text-[#94A3B8] transition-colors group-hover:text-[#1D5FC4]" />}
    </li>
  );
}

function Note({ tone, children }: { tone: "error" | "warn" | "info"; children: ReactNode }) {
  const cls = { error: "text-[#8A1C36]", warn: "text-[#7A4A00]", info: "text-[#475569]" }[tone];
  return (
    <p role={tone === "info" ? undefined : "status"} className={`flex items-start justify-center gap-1.5 text-center text-[11px] ${cls}`}>
      {tone !== "info" && <AlertTriangle aria-hidden className="mt-px size-3.5 shrink-0" />}
      <span>{children}</span>
    </p>
  );
}

function StateBox({ tone = "empty", title, body, action }: { tone?: "empty" | "error"; title: string; body: string; action?: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl px-4 py-5 text-center ${tone === "error" ? "border border-[#F8C9D3] bg-[#FFF5F7]" : "border border-dashed border-[#DCE1EC]"}`}
    >
      <p className="text-sm font-bold text-[#11182B]">{title}</p>
      <p className="mx-auto mt-0.5 max-w-sm text-xs text-[#475569]">{body}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * The single AVSAR section on the dashboard. Tabs switch listings in place (client state; the data is already
 * here from the server). Internships come only from Avsar and open their exact Avsar listing; research and
 * collaborations come only from the verified catalogue and open their verified detail page (which links the
 * official source). Jobs has no source and says so. Ratings are qualitative fit states, never percentages.
 */
function AvsarSection({ research, internships }: { research?: ResearchFeed; internships?: InternshipFeed }) {
  const [cat, setCat] = useState<AvsarCategory>("all");
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const researchDown = !research || research.status === "unavailable";
  const avsarDown = internships?.status === "unavailable";
  const avsarOff = !internships || internships.status === "not_configured";
  const launchUrl = internships && internships.status !== "ok" ? internships.handoffUrl : internships?.browseUrl ?? AVSAR_LAUNCH_URL;

  const groups: Record<ListingCategory, Preview[]> = { internships: [], research: [], collaborations: [] };
  if (internships?.status === "ok") groups.internships = internships.items.map(fromInternship);
  if (research?.status === "ok") for (const r of research.items.map(fromResearch)) groups[r.category].push(r);

  const total = groups.internships.length + groups.research.length + groups.collaborations.length;
  const pool = cat === "all" ? total : cat === "jobs" ? 0 : groups[cat].length;
  const shown = cat === "all" ? pickAll([groups.internships, groups.research, groups.collaborations]) : cat === "jobs" ? [] : rank(groups[cat]).slice(0, PREVIEW_LIMIT);
  const bothDown = researchDown && (avsarDown || avsarOff);
  const personalised = (research?.status === "ok" && research.personalised) || (internships?.status === "ok" && internships.personalised);

  // Per-category source state: a failed source is never shown as "nothing here".
  const catFailed = cat === "internships" ? avsarDown : cat === "research" || cat === "collaborations" ? researchDown : cat === "all" ? bothDown : false;

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = AVSAR_CATEGORY_KEYS.length;
    const next = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setCat(AVSAR_CATEGORY_KEYS[next]!);
    tabRefs.current[next]?.focus();
  };

  return (
    <section
      aria-labelledby="avsar-dash-heading"
      data-testid="avsar-dashboard"
      className="relative overflow-hidden rounded-2xl border border-[#E7EAF3] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,43,0.04),0_12px_32px_-20px_rgba(59,79,224,0.3)] sm:p-6 xl:col-span-2"
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#1D5FC4,#7C4DDB_35%,#0F9F8A_65%,#F59E0B)] opacity-80" />
      <AvsarSideGlow className="-right-12 -top-6 hidden size-72 md:block" />

      {/* Briefcase: beside the centred intro once there is room, a compact mark above it on phones. */}
      <div className="pointer-events-none absolute right-4 top-6 hidden size-[130px] md:block xl:right-3 xl:size-[140px]">
        <AvsarBriefcase size={140} />
      </div>

      <header className="relative mx-auto max-w-md text-center md:max-w-[24rem]">
        <div className="relative mx-auto mb-1 size-[64px] md:hidden">
          <AvsarSideGlow className="-inset-6" />
          <AvsarBriefcase size={64} />
        </div>
        <AvsarWordmark size="md" />
        <h2 id="avsar-dash-heading" className="mt-3 font-heading text-lg font-bold leading-tight tracking-tight text-[#11182B] sm:text-xl">
          Discover Opportunities for Your Timeline.
        </h2>
        <p className="mt-1.5 text-xs leading-relaxed text-[#475569] sm:text-[13px]">{AVSAR_TAGLINE}</p>
      </header>

      <div
        role="tablist"
        aria-label="AVSAR categories"
        className="relative -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:justify-center sm:px-0"
      >
        {AVSAR_CATEGORY_KEYS.map((c, i) => {
          const on = c === cat;
          return (
            <button
              key={c}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`avsar-tab-${c}`}
              aria-selected={on}
              aria-controls="avsar-dash-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setCat(c)}
              onKeyDown={(e) => onKey(e, i)}
              className={tabClass(c, on)}
            >
              <span aria-hidden className={`size-2 rounded-full ${on ? "bg-white" : AVSAR_CATEGORIES[c].dot}`} />
              {AVSAR_CATEGORIES[c].label}
            </button>
          );
        })}
      </div>

      <div id="avsar-dash-panel" role="tabpanel" aria-labelledby={`avsar-tab-${cat}`} className="relative mt-3">
        <div className="space-y-1">
          {cat === "all" && !bothDown && avsarDown && <Note tone="error">Avsar internships couldn&apos;t be loaded just now; other categories are shown.</Note>}
          {cat === "all" && !bothDown && researchDown && <Note tone="error">Verified research couldn&apos;t be loaded just now; Avsar internships are shown.</Note>}
          {(cat === "all" || cat === "internships") && avsarOff && !bothDown && <Note tone="info">Avsar internships appear here once the Avsar connection is switched on.</Note>}
          {(cat === "all" || cat === "internships") && internships?.status === "ok" && internships.stale && (
            <Note tone="warn">Couldn&apos;t refresh from Avsar. Internships last updated {fmtDate(internships.fetchedAt)}.</Note>
          )}
          {!personalised && shown.length > 0 && (
            <Note tone="info">
              Add skills or connect GitHub to see how each one fits you.{" "}
              <Link href="/skills" className="font-semibold text-[#5B4FE0] hover:underline">Update skills</Link>
            </Note>
          )}
        </div>

        <div className="mt-2">
          {cat === "jobs" ? (
            <StateBox title={JOBS_UNAVAILABLE.title} body={JOBS_UNAVAILABLE.body} />
          ) : catFailed ? (
            <StateBox
              tone="error"
              title={cat === "all" ? "Opportunities couldn't be loaded" : `${AVSAR_CATEGORIES[cat].label} couldn't be loaded`}
              body="This is a connection problem, not an empty list."
              action={<RetryButton />}
            />
          ) : shown.length === 0 ? (
            cat === "all" ? (
              <StateBox title="No matching opportunities right now." body="Discover opportunities on Avsar. New listings appear here as they are published." />
            ) : cat === "internships" ? (
              avsarOff ? null : <StateBox title="No open internships on Avsar right now" body="New internships appear here as soon as Avsar publishes them." />
            ) : cat === "research" ? (
              <StateBox title="No verified research opportunities right now" body="Only openings confirmed on an official university, institute or lab page appear here." />
            ) : (
              <StateBox title="No verified collaboration calls right now" body="Collaboration calls appear here once confirmed at their official source." />
            )
          ) : (
            <>
            {pool > shown.length && (
              <p className="mb-1.5 text-center text-[11px] text-[#475569]" data-testid="avsar-preview-count">
                Showing your top {shown.length} of {pool} open {cat === "all" ? "opportunities" : AVSAR_CATEGORIES[cat].label.toLowerCase()}
              </p>
            )}
            <ul className="space-y-2" aria-label={`${AVSAR_CATEGORIES[cat].label} opportunity previews`}>
              {shown.map((p) => (
                <PreviewRow key={p.key} p={p} />
              ))}
            </ul>
            </>
          )}
        </div>

        {cat === "collaborations" && (
          <Link
            href="/opportunities?cat=collaborations"
            data-testid="avsar-collaborate-cta"
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[#B5D8DE] bg-[#F2FAFB] px-3.5 py-3 text-left transition-colors duration-150 hover:border-[#0E8F9A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E8F9A]"
          >
            <span>
              <span className="block text-[13px] font-bold text-[#0B2530]">Build a team in Collaborate</span>
              <span className="block text-[11px] text-[#4A6470]">Post a project, hackathon team or research idea, or join one.</span>
            </span>
            <ArrowUpRight aria-hidden className="size-4 shrink-0 text-[#0E8F9A]" />
          </Link>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {/* Plain <a>: the authorised launch route redirects into Avsar's own sign-in; needs a full navigation. */}
          <a
            href={launchUrl}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[#1D5FC4] px-4 py-2 text-xs font-semibold text-white shadow-[0_6px_16px_-8px_rgba(29,95,196,0.6)] transition-colors hover:bg-[#174C9E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D5FC4] active:bg-[#123E82]"
          >
            Explore all opportunities on AVSAR <ArrowUpRight aria-hidden className="size-3.5" />
          </a>
          {pool > shown.length && (
            <Link
              href={cat === "all" ? "/opportunities" : `/opportunities?cat=${cat}${cat === "research" ? "&section=all" : ""}`}
              className="text-[11px] font-semibold text-[#475569] hover:text-[#11182B] hover:underline"
            >
              View all {pool} {cat === "all" ? "" : `${AVSAR_CATEGORIES[cat].label.toLowerCase()} `}in AVSAR
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
