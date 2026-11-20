import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { AlertTriangle, ArrowUpRight, Bookmark, CalendarClock, Clock3, MapPin, Monitor } from "lucide-react";

import { db } from "@/db";
import { requireOnboardedUser } from "@/lib/dal";
import { AVSAR_HANDOFF_URL, getAvsarInternships, type InternshipCard, type InternshipFeed } from "@/lib/opportunities/avsar";
import { browseOpportunities, loadStudentSignals, SECTIONS, type BrowseFilters, type OpportunityView, type Section } from "@/lib/opportunities/browse";
import type { FitState } from "@/lib/opportunities/fit";
import type { OppDb } from "@/lib/opportunities/ingest";

import { AvsarBriefcase, AvsarSideGlow, AvsarWordmark, RetryButton } from "@/components/avsar/avsar-ui";
import { AVSAR_CATEGORIES, AVSAR_CATEGORY_KEYS, AVSAR_TAGLINE, COLLAB_KINDS, isAvsarCategory, JOBS_UNAVAILABLE, tabClass, type AvsarCategory } from "@/components/avsar/categories";
import { officialPageHref } from "@/components/avsar/links";
import { CollaborateHub } from "@/components/collaborate/hub";
import { hubView, uuidOrNull } from "@/components/collaborate/views";
import { monogram } from "@/components/avsar/monogram";
import { FitBadge, KIND_LABEL, fmtDate } from "./ui";

export const metadata: Metadata = { title: "AVSAR · Opportunities | AI Tathastu" };

type SP = Promise<Record<string, string | string[] | undefined>>;

// Category model shared with the dashboard section (components/avsar/categories.ts): each tab maps to one real
// source; Jobs has none yet and says so instead of borrowing internships or research.
const CATEGORIES = AVSAR_CATEGORIES;
type Category = AvsarCategory;
const FIT_ORDER: Record<FitState, number> = { strong_fit: 0, potential_fit: 1, insufficient_information: 2, not_eligible: 3 };
const WORK_MODE: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site", "on-site": "On-site" };

export default function OpportunitiesPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Hero />
      <Suspense fallback={<ListSkeleton />}>
        <OpportunitiesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// ── Hero ────────────────────────────────────────────────────────────────────

function ExploreAvsar({ variant = "primary" }: { variant?: "primary" | "subtle" }) {
  return (
    // Plain <a>: the authorised launch route redirects into Avsar's own sign-in; needs a full navigation.
    <a
      href={AVSAR_HANDOFF_URL}
      className={
        variant === "primary"
          ? "inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#1D5FC4] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(29,95,196,0.55)] transition-colors hover:bg-[#174C9E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D5FC4] active:bg-[#123E82]"
          : "inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#1D5FC4]/25 bg-[#EDF5FF] px-3.5 py-2 text-xs font-semibold text-[#1D5FC4] transition-colors hover:bg-[#DCEBFF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D5FC4]"
      }
    >
      Explore AVSAR <ArrowUpRight aria-hidden className="size-4" />
    </a>
  );
}

function Hero() {
  return (
    <section aria-labelledby="avsar-heading" className="relative overflow-hidden rounded-3xl border border-[#E7EAF3] bg-white px-5 py-7 shadow-[0_1px_2px_rgba(17,24,43,0.04),0_12px_32px_-18px_rgba(59,79,224,0.25)] sm:px-8 sm:py-9">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#1D5FC4,#7C4DDB_35%,#0F9F8A_65%,#F59E0B)] opacity-80" />
      <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-16 size-64 rounded-full bg-[radial-gradient(circle,rgba(15,159,138,0.10),transparent_65%)]" />
      <AvsarSideGlow className="-right-10 top-0 hidden size-80 xl:block" />
      {/* Briefcase beside the centred intro on wide screens; a compact mark above it on smaller ones. */}
      <div className="pointer-events-none absolute right-8 top-1/2 hidden size-[220px] -translate-y-1/2 xl:block">
        <AvsarBriefcase size={220} />
      </div>
      <div className="relative mx-auto max-w-2xl text-center xl:max-w-xl">
        <div className="relative mx-auto mb-2 size-[84px] xl:hidden">
          <AvsarSideGlow className="-inset-8" />
          <AvsarBriefcase size={84} />
        </div>
        <AvsarWordmark />
        <h1 id="avsar-heading" className="mt-4 font-heading text-[1.6rem] font-bold leading-[1.15] tracking-tight text-[#11182B] sm:text-4xl">
          Discover Opportunities for Your Timeline.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#475569] sm:text-[15px]">{AVSAR_TAGLINE}</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <ExploreAvsar />
          <a href="#avsar-listings" className="rounded-lg px-1 text-sm font-semibold text-[#11182B] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
            See your matches
          </a>
        </div>
      </div>
    </section>
  );
}

// ── Loading ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <li className="flex gap-4 rounded-2xl border border-[#E7EAF3] bg-white p-4 sm:p-5">
      <div className="size-12 shrink-0 rounded-xl bg-[#EEF1F7]" />
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="h-4 w-2/3 rounded bg-[#EEF1F7]" />
        <div className="h-3 w-1/3 rounded bg-[#F4F6F9]" />
        <div className="flex gap-3 pt-1">
          <div className="h-3 w-20 rounded bg-[#F4F6F9]" />
          <div className="h-3 w-16 rounded bg-[#F4F6F9]" />
          <div className="h-3 w-24 rounded bg-[#F4F6F9]" />
        </div>
      </div>
      <div className="h-6 w-20 shrink-0 rounded-md bg-[#F4F6F9]" />
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse space-y-4 motion-reduce:animate-none" role="status" aria-label="Loading opportunities">
      <div className="flex gap-2">
        {[64, 96, 84, 120].map((w) => (
          <div key={w} className="h-10 rounded-full bg-[#EEF1F7]" style={{ width: w }} />
        ))}
      </div>
      <ul className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <CardSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

// ── Data ────────────────────────────────────────────────────────────────────

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

/** One card, built only from fields the source actually returned. */
interface Listing {
  key: string;
  category: "internships" | "research" | "collaborations";
  title: string;
  organization: string;
  subtitle: string | null;
  location: string | null;
  workMode: string | null;
  duration: string | null;
  deadlineText: string | null;
  fitState: FitState;
  fitSummary: string;
  /** Exact destination: Avsar's own listing URL for internships, the verified detail page for research. */
  href: string;
  external: boolean;
  apply: { href: string; label: string } | null;
  saved: boolean;
  provenance: string;
  /** The official announcement URL as stored at ingestion (research only); never constructed. */
  officialUrl: string | null;
}

function fromInternship(it: InternshipCard): Listing {
  return {
    key: `avsar:${it.id}`,
    category: "internships",
    title: it.title,
    organization: it.organization,
    subtitle: null,
    location: it.locations.slice(0, 2).join(", ") || null,
    workMode: WORK_MODE[it.workMode] ?? null,
    duration: it.durationWeeks ? `${it.durationWeeks} week${it.durationWeeks === 1 ? "" : "s"}` : null,
    deadlineText: it.deadline ? `Apply by ${fmtDate(it.deadline)}` : null,
    fitState: it.fit.state,
    fitSummary: it.fit.summary,
    // it.url is validated in lib/opportunities/avsar.ts to be on Avsar's configured origin; never constructed here.
    href: it.url,
    external: true,
    apply: { href: it.applyUrl, label: "Apply on Avsar" },
    saved: false,
    provenance: [it.stipend, "Listed on Avsar"].filter(Boolean).join(" · "),
    officialUrl: null,
  };
}

function fromResearch(o: OpportunityView): Listing {
  return {
    key: `research:${o.id}`,
    category: o.kind && COLLAB_KINDS.has(o.kind) ? "collaborations" : "research",
    title: o.title,
    organization: o.organization,
    // Role and field from the listing intelligence (insight.ts), not the source's own category, which is often wrong.
    subtitle: [o.researchGroup, o.insight?.position && o.insight.position !== "other" ? o.insight.positionLabel : o.kind ? KIND_LABEL[o.kind] ?? null : null, o.insight?.disciplines[0]].filter(Boolean).join(" · ") || null,
    location: [o.location, o.country].filter(Boolean).join(", ") || null,
    workMode: o.workMode ? WORK_MODE[o.workMode.toLowerCase()] ?? o.workMode : null,
    duration: null,
    deadlineText: o.deadline ? `Deadline: ${o.deadline}` : null,
    fitState: o.fit.state,
    fitSummary: o.fit.summary,
    href: `/opportunities/${o.id}`,
    external: false,
    apply: o.apply.kind !== "unavailable" ? { href: `/opportunities/${o.id}/apply`, label: "Apply on official site" } : null,
    saved: o.saved,
    provenance: `${o.sourceName} · verified ${fmtDate(o.lastVerifiedAt)}`,
    officialUrl: officialPageHref(o.url),
  };
}

async function OpportunitiesContent({ searchParams }: { searchParams: SP }) {
  const { user } = await requireOnboardedUser();
  const sp = await searchParams;
  const rawCat = one(sp.cat);
  const cat: Category = isAvsarCategory(rawCat) ? rawCat : "all";
  const section = (one(sp.section) && one(sp.section)! in SECTIONS ? one(sp.section) : "all") as Section;
  // Detailed research filters apply to the Research tab only; All and Collaborations browse the full verified catalogue.
  const filters: BrowseFilters =
    cat === "research"
      ? {
          section,
          q: one(sp.q),
          organization: one(sp.org),
          country: one(sp.country),
          workMode: one(sp.mode),
          closingWithinDays: one(sp.closing) ? Number(one(sp.closing)) || undefined : undefined,
          stipendPublished: one(sp.stipend) === "1",
          educationLevel: one(sp.edu),
        }
      : { section: "all" };

  const wantsAvsar = cat === "all" || cat === "internships";
  // Jobs has no source: nothing is fetched for it, so it can never show another category's records.
  const wantsResearch = cat === "all" || cat === "research" || cat === "collaborations";

  const student = await loadStudentSignals(db as unknown as OppDb, user.id).catch((err) => {
    console.error("[opportunities] signals unavailable:", err instanceof Error ? err.message : err);
    return null;
  });

  const [research, avsar] = await Promise.all([
    wantsResearch && student
      ? browseOpportunities(db as unknown as OppDb, user.id, student, filters).catch((err) => {
          console.error("[opportunities] unavailable:", err instanceof Error ? err.message : err);
          return null;
        })
      : Promise.resolve(null),
    wantsAvsar && student ? getAvsarInternships(student) : Promise.resolve<InternshipFeed | null>(null),
  ]);

  const researchFailed = wantsResearch && !research;
  const avsarFailed = wantsAvsar && (!avsar || avsar.status === "unavailable");
  const avsarOff = wantsAvsar && avsar?.status === "not_configured";

  let listings: Listing[] = [
    ...(avsar?.status === "ok" ? avsar.items.map(fromInternship) : []),
    ...(research?.items ?? []).map(fromResearch),
  ];
  if (cat !== "all") listings = listings.filter((l) => l.category === cat);
  listings.sort((a, b) => FIT_ORDER[a.fitState] - FIT_ORDER[b.fitState]);

  const everyRequestedSourceFailed = (!wantsAvsar || avsarFailed || avsarOff) && (!wantsResearch || researchFailed) && (avsarFailed || researchFailed);

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ cat, ...(cat === "research" ? { section, q: filters.q, org: filters.organization, country: filters.country, mode: filters.workMode, edu: filters.educationLevel, closing: one(sp.closing), stipend: one(sp.stipend) } : {}), ...over })) if (v && !(k === "cat" && v === "all")) p.set(k, v);
    const s = p.toString();
    return s ? `/opportunities?${s}` : "/opportunities";
  };

  const activeFilters = [filters.q, filters.organization, filters.country, filters.workMode, filters.educationLevel, filters.closingWithinDays, filters.stipendPublished || undefined].filter(Boolean).length;

  return (
    <section id="avsar-listings" aria-label="AVSAR opportunities" className="scroll-mt-20 space-y-4">
      {/* Links (soft navigation, no full reload): the category lives in the URL, so it can be shared and survives refresh. */}
      <nav aria-label="Opportunity categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:justify-center sm:px-0">
        {AVSAR_CATEGORY_KEYS.map((c) => {
          const meta = CATEGORIES[c];
          const on = c === cat;
          return (
            <Link
              key={c}
              href={qs({ cat: c, section: undefined })}
              aria-current={on ? "page" : undefined}
              scroll={false}
              className={tabClass(c, on)}
            >
              <span aria-hidden className={`size-2 rounded-full ${on ? "bg-white" : meta.dot}`} />
              {meta.label}
            </Link>
          );
        })}
      </nav>

      {/* Collaborations: the team-building marketplace first; verified external collaboration calls stay listed below it. */}
      {cat === "collaborations" && (
        <>
          <CollaborateHub
            signedIn
            basePath="/opportunities?cat=collaborations"
            initialView={hubView(one(sp.view))}
            initialPost={uuidOrNull(one(sp.post))}
            initialThread={uuidOrNull(one(sp.thread))}
          />
          <h2 className="pt-4 text-sm font-bold text-[#11182B]">Verified collaboration calls</h2>
          <p className="-mt-3 text-xs text-[#475569]">Open calls for collaborators published by universities, institutes and labs, confirmed at their official source.</p>
        </>
      )}

      {cat === "research" && <ResearchControls section={section} qs={qs} filters={filters} closing={one(sp.closing)} facets={research?.facets} counts={research?.counts} activeFilters={activeFilters} />}

      {!everyRequestedSourceFailed && avsarFailed && (
        <Notice tone="error" action={<RetryButton />}>
          We couldn&apos;t load internships from Avsar just now{wantsResearch && !researchFailed ? ", so only research listings are shown" : ""}.
        </Notice>
      )}
      {!everyRequestedSourceFailed && researchFailed && (
        <Notice tone="error" action={<RetryButton />}>
          We couldn&apos;t load verified research listings just now{wantsAvsar && !avsarFailed ? ", so only Avsar internships are shown" : ""}.
        </Notice>
      )}
      {avsarOff && (
        <Notice tone="info" action={<ExploreAvsar variant="subtle" />}>
          Personalised Avsar internships appear here once the Avsar connection is switched on. You can browse and apply on Avsar now.
        </Notice>
      )}
      {avsar?.status === "ok" && avsar.stale && (
        <Notice tone="warn">Couldn&apos;t refresh from Avsar. Showing internships last updated {fmtDate(avsar.fetchedAt)}.</Notice>
      )}
      {student && student.demonstrated.size + student.listed.size === 0 && listings.length > 0 && (
        <Notice tone="info">
          Add skills or connect GitHub so Match Intelligence can explain how each opportunity fits you.{" "}
          <Link href="/skills" className="font-semibold text-[#5B4FE0] hover:underline">Update skills</Link>
        </Notice>
      )}

      {cat === "jobs" ? (
        <JobsUnavailable />
      ) : everyRequestedSourceFailed || !student ? (
        <ErrorState />
      ) : listings.length === 0 ? (
        cat === "all" ? (
          <BrandedEmpty />
        ) : cat === "internships" && avsarOff ? null : (
          <CategoryEmpty cat={cat} section={section} filtered={activeFilters > 0} />
        )
      ) : (
        <ul className="space-y-3" aria-label={`${CATEGORIES[cat].label} opportunities`}>
          {listings.map((l) => (
            <ListingCard key={l.key} l={l} />
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Research-only controls (existing sections and filters, unchanged in behaviour) ──

function ResearchControls({
  section,
  qs,
  filters,
  closing,
  facets,
  counts,
  activeFilters,
}: {
  section: Section;
  qs: (o: Record<string, string | undefined>) => string;
  filters: BrowseFilters;
  closing?: string;
  facets?: { organizations: string[]; countries: string[]; workModes: string[] };
  /** Listings per section, from the listing intelligence; empty position sections are hidden. */
  counts?: Partial<Record<Section, number>>;
  activeFilters: number;
}) {
  const select = "w-full min-h-10 rounded-lg border border-[#E7EAF3] bg-white px-2 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#0E7C66]";
  return (
    <div className="space-y-3">
      <nav aria-label="Research sections" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
        {(Object.keys(SECTIONS) as Section[]).filter((s) => !counts || s === section || ["all", "recommended", "saved"].includes(s) || (counts[s] ?? 0) > 0).map((s) => (
          <Link
            key={s}
            href={qs({ section: s })}
            scroll={false}
            aria-current={s === section ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${s === section ? "border-[#0E7C66]/30 bg-[#E8FAF4] text-[#0E7C66]" : "border-[#E7EAF3] bg-white text-[#475569] hover:text-[#11182B]"}`}
          >
            {SECTIONS[s]}
            {counts && <span className="ml-1 tabular-nums opacity-70">{counts[s] ?? 0}</span>}
          </Link>
        ))}
      </nav>
      <details open={activeFilters > 0} className="group rounded-2xl border border-[#E7EAF3] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[#11182B] focus-visible:outline-2 focus-visible:outline-offset-2">
          <span>Filters{activeFilters > 0 ? ` (${activeFilters} active)` : ""}</span>
          <span aria-hidden className="text-xs text-[#617493] group-open:hidden">Show</span>
          <span aria-hidden className="hidden text-xs text-[#617493] group-open:inline">Hide</span>
        </summary>
        <form method="get" action="/opportunities" className="grid grid-cols-1 gap-2 border-t border-[#F4F6F9] p-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filter research opportunities">
          <input type="hidden" name="cat" value="research" />
          <input type="hidden" name="section" value={section} />
          <label className="lg:col-span-2">
            <span className="sr-only">Search</span>
            <input name="q" defaultValue={filters.q} placeholder="Search title, lab or research area" className={select} />
          </label>
          <label>
            <span className="sr-only">Organisation</span>
            <select name="org" defaultValue={filters.organization ?? ""} className={select}>
              <option value="">All organisations</option>
              {facets?.organizations.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Country</span>
            <select name="country" defaultValue={filters.country ?? ""} className={select}>
              <option value="">All countries</option>
              {facets?.countries.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Work mode</span>
            <select name="mode" defaultValue={filters.workMode ?? ""} className={select}>
              <option value="">Any work mode</option>
              {facets?.workModes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Education required</span>
            <select name="edu" defaultValue={filters.educationLevel ?? ""} className={select}>
              <option value="">Any education</option>
              <option value="bachelor's degree">Bachelor&apos;s degree</option>
              <option value="master's degree">Master&apos;s degree</option>
              <option value="PhD">PhD</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Deadline</span>
            <select name="closing" defaultValue={closing ?? ""} className={select}>
              <option value="">Any deadline</option>
              <option value="7">Closing within 7 days</option>
              <option value="30">Closing within 30 days</option>
            </select>
          </label>
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[#475569]">
              <input type="checkbox" name="stipend" value="1" defaultChecked={filters.stipendPublished} /> Stipend published
            </label>
            <button type="submit" className="min-h-10 rounded-lg bg-[#11182B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#25304A] focus-visible:outline-2 focus-visible:outline-offset-2">
              Apply filters
            </button>
          </div>
        </form>
      </details>
    </div>
  );
}

// ── Cards ───────────────────────────────────────────────────────────────────

const CARD_ACCENT: Record<Listing["category"], { bar: string; logo: string; tag: string; label: string }> = {
  internships: { bar: "bg-[#1D5FC4]", logo: "bg-[#EDF5FF] text-[#1D5FC4]", tag: "text-[#1D5FC4]", label: "Internship" },
  research: { bar: "bg-[#0F9F8A]", logo: "bg-[#E8FAF4] text-[#0E7C66]", tag: "text-[#0E7C66]", label: "Research" },
  collaborations: { bar: "bg-[#D97706]", logo: "bg-[#FFF4E5] text-[#9A5B00]", tag: "text-[#9A5B00]", label: "Collaboration" },
};

function ListingCard({ l }: { l: Listing }) {
  const a = CARD_ACCENT[l.category];
  const meta: { icon: ReactNode; text: string }[] = [];
  if (l.location) meta.push({ icon: <MapPin aria-hidden className="size-3.5" />, text: l.location });
  if (l.workMode) meta.push({ icon: <Monitor aria-hidden className="size-3.5" />, text: l.workMode });
  if (l.duration) meta.push({ icon: <Clock3 aria-hidden className="size-3.5" />, text: l.duration });

  const titleCls =
    "text-[15px] font-bold leading-snug text-[#11182B] after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:outline-none group-hover:text-[#1D5FC4]";

  return (
    <li className="group relative flex gap-3.5 overflow-hidden rounded-2xl border border-[#E7EAF3] bg-white p-4 shadow-[0_1px_2px_rgba(17,24,43,0.04)] transition-[box-shadow,border-color,transform] duration-150 hover:-translate-y-px hover:border-[#D5DBEA] hover:shadow-[0_10px_24px_-14px_rgba(29,95,196,0.35)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-[#1D5FC4] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:gap-4 sm:p-5">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${a.bar}`} />
      <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold sm:size-12 ${a.logo}`}>
        {monogram(l.organization)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={`text-[11px] font-bold uppercase tracking-wider ${a.tag}`}>{a.label}</p>
            <h3 className="mt-0.5">
              {l.external ? (
                <a href={l.href} target="_blank" rel="noopener noreferrer" className={titleCls}>
                  {l.title}
                  <span className="sr-only"> at {l.organization}, opens this listing on Avsar in a new tab</span>
                </a>
              ) : (
                <Link href={l.href} className={titleCls}>
                  {l.title}
                </Link>
              )}
            </h3>
            <p className="mt-0.5 truncate text-[13px] font-medium text-[#475569]">
              {[l.organization, l.subtitle].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#617493]">Match</span>
            <FitBadge state={l.fitState} />
          </div>
        </div>

        {meta.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#475569]" aria-label="Details">
            {meta.map((m) => (
              <li key={m.text} className="inline-flex items-center gap-1">
                {m.icon} {m.text}
              </li>
            ))}
          </ul>
        )}

        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#334155]">{l.fitSummary}</p>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F4F6F9] pt-2.5 text-[11px] text-[#475569]">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {l.deadlineText && (
              <span className="inline-flex items-center gap-1 font-semibold text-[#9A5B00]">
                <CalendarClock aria-hidden className="size-3.5" /> {l.deadlineText}
              </span>
            )}
            <span>{l.provenance}</span>
            {l.officialUrl && (
              <a href={l.officialUrl} target="_blank" rel="noopener noreferrer" className="relative z-10 inline-flex items-center gap-0.5 font-semibold text-[#0E7C66] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2">
                Official page <ArrowUpRight aria-hidden className="size-3" />
                <span className="sr-only"> for {l.title} (new tab)</span>
              </a>
            )}
            {l.saved && (
              <span className="inline-flex items-center gap-1 font-semibold text-[#5B4FE0]">
                <Bookmark aria-hidden className="size-3" /> Saved
              </span>
            )}
          </span>
          {l.apply && (
            <a
              href={l.apply.href}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex min-h-9 items-center gap-1 rounded-lg bg-[#11182B] px-3 font-semibold text-white transition-colors hover:bg-[#25304A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D5FC4]"
            >
              {l.apply.label} <ArrowUpRight aria-hidden className="size-3.5" />
              <span className="sr-only"> for {l.title} (new tab)</span>
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

// ── States ──────────────────────────────────────────────────────────────────

function Notice({ tone, children, action }: { tone: "error" | "warn" | "info"; children: ReactNode; action?: ReactNode }) {
  const cls = {
    error: "border-[#F8C9D3] bg-[#FFF5F7] text-[#8A1C36]",
    warn: "border-[#F6DDB0] bg-[#FFFAF0] text-[#7A4A00]",
    info: "border-[#E3E0FB] bg-[#F7F6FF] text-[#3B3486]",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-xs ${cls}`}>
      <p className="flex items-start gap-2">
        {tone !== "info" && <AlertTriangle aria-hidden className="mt-px size-4 shrink-0" />}
        <span>{children}</span>
      </p>
      {action}
    </div>
  );
}

function ErrorState() {
  return (
    <div role="alert" className="rounded-3xl border border-[#F8C9D3] bg-white px-6 py-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#FFF0F4] text-[#E0264E]">
        <AlertTriangle aria-hidden className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-bold text-[#11182B]">Opportunities couldn&apos;t be loaded</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#475569]">
        Something went wrong while loading listings. This is a connection problem, not an empty list.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <RetryButton />
        <ExploreAvsar variant="subtle" />
      </div>
    </div>
  );
}

function BrandedEmpty() {
  return (
    <div role="status" className="relative overflow-hidden rounded-3xl border border-[#E7EAF3] bg-white px-6 py-10 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#1D5FC4,#7C4DDB_35%,#0F9F8A_65%,#F59E0B)] opacity-80" />
      <div className="mx-auto size-[96px]">
        <AvsarBriefcase size={96} />
      </div>
      <p className="mt-3 text-xs font-extrabold tracking-[0.22em] text-[#5B4FE0]">AVSAR</p>
      <h2 className="mt-1.5 text-lg font-bold text-[#11182B]">No matching opportunities right now.</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#475569]">Discover opportunities on Avsar. New listings appear here as they are published.</p>
      <div className="mt-5 flex justify-center">
        <ExploreAvsar />
      </div>
    </div>
  );
}

function JobsUnavailable() {
  return (
    <div role="status" className="rounded-3xl border border-[#E7EAF3] bg-white px-6 py-10 text-center">
      <span aria-hidden className="mx-auto block size-2.5 rounded-full bg-[#E0264E]" />
      <h2 className="mt-3 text-base font-bold text-[#11182B]">{JOBS_UNAVAILABLE.title}</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#475569]">{JOBS_UNAVAILABLE.body}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link href="/opportunities?cat=internships" scroll={false} className="inline-flex min-h-10 items-center rounded-xl border border-[#E7EAF3] px-3.5 text-xs font-semibold text-[#11182B] hover:text-[#1D5FC4] focus-visible:outline-2 focus-visible:outline-offset-2">
          See internships
        </Link>
        <Link href="/opportunities?cat=research&section=all" scroll={false} className="inline-flex min-h-10 items-center rounded-xl border border-[#E7EAF3] px-3.5 text-xs font-semibold text-[#11182B] hover:text-[#0E7C66] focus-visible:outline-2 focus-visible:outline-offset-2">
          See research
        </Link>
      </div>
    </div>
  );
}

function CategoryEmpty({ cat, section, filtered }: { cat: Exclude<Category, "all">; section: Section; filtered: boolean }) {
  const body =
    cat === "internships"
      ? "Avsar has no open internships right now. New ones appear here when they're published."
      : cat === "collaborations"
        ? "No verified collaboration calls are open right now."
        : filtered
          ? "No verified research listings match these filters. Try clearing them."
          : section === "recommended"
            ? "No strong research matches yet. Browse all research, or add skills so matches can be explained."
            : section === "saved"
              ? "Save a research opportunity from its page to keep it here."
              : "No verified research listings in this section right now.";
  return (
    <div role="status" className="rounded-3xl border border-[#E7EAF3] bg-white px-6 py-10 text-center">
      <h2 className="text-base font-bold text-[#11182B]">Nothing in {CATEGORIES[cat].label} right now</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#475569]">{body}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        <Link href="/opportunities" scroll={false} className="inline-flex min-h-10 items-center rounded-xl border border-[#E7EAF3] px-3.5 text-xs font-semibold text-[#11182B] hover:border-[#7C4DDB]/40 hover:text-[#5B4FE0] focus-visible:outline-2 focus-visible:outline-offset-2">
          Show all opportunities
        </Link>
        {cat === "research" && section !== "all" && (
          <Link href="/opportunities?cat=research&section=all" scroll={false} className="inline-flex min-h-10 items-center rounded-xl border border-[#E7EAF3] px-3.5 text-xs font-semibold text-[#11182B] hover:text-[#0E7C66] focus-visible:outline-2 focus-visible:outline-offset-2">
            All research
          </Link>
        )}
        {cat === "internships" && <ExploreAvsar variant="subtle" />}
      </div>
    </div>
  );
}
