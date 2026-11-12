import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, Bookmark, Briefcase, CalendarClock, MapPin } from "lucide-react";

import { db } from "@/db";
import { requireOnboardedUser } from "@/lib/dal";
import { browseOpportunities, loadStudentSignals, SECTIONS, type BrowseFilters, type OpportunityView, type Section } from "@/lib/opportunities/browse";
import type { OppDb } from "@/lib/opportunities/ingest";

import { FitBadge, KIND_LABEL, fmtDate } from "./ui";

export const metadata: Metadata = { title: "Research opportunities | AI Tathastu" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function OpportunitiesPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <OpportunitiesContent searchParams={searchParams} />
    </Suspense>
  );
}

function ListSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-4" role="status" aria-label="Loading opportunities">
      <div className="h-9 w-72 rounded-xl bg-slate-200" />
      <div className="h-12 rounded-xl bg-slate-100" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-36 rounded-2xl bg-slate-100" />
      ))}
    </div>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

async function OpportunitiesContent({ searchParams }: { searchParams: SP }) {
  const { user } = await requireOnboardedUser();
  const sp = await searchParams;
  const section = (one(sp.section) && one(sp.section)! in SECTIONS ? one(sp.section) : "recommended") as Section;
  const filters: BrowseFilters = {
    section,
    q: one(sp.q),
    organization: one(sp.org),
    country: one(sp.country),
    workMode: one(sp.mode),
    closingWithinDays: one(sp.closing) ? Number(one(sp.closing)) || undefined : undefined,
    stipendPublished: one(sp.stipend) === "1",
    educationLevel: one(sp.edu),
  };

  const activeFilters = [filters.q, filters.organization, filters.country, filters.workMode, filters.educationLevel, filters.closingWithinDays, filters.stipendPublished || undefined].filter(Boolean).length;

  let data: Awaited<ReturnType<typeof browseOpportunities>> | null = null;
  try {
    const student = await loadStudentSignals(db as unknown as OppDb, user.id);
    data = await browseOpportunities(db as unknown as OppDb, user.id, student, filters);
  } catch (err) {
    console.error("[opportunities] unavailable:", err instanceof Error ? err.message : err);
  }

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ section, q: filters.q, org: filters.organization, country: filters.country, mode: filters.workMode, edu: filters.educationLevel, closing: one(sp.closing), stipend: one(sp.stipend), ...over })) if (v) p.set(k, v);
    return `/opportunities?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#11182B]">Research opportunities</h1>
        <p className="mt-1 max-w-3xl text-sm text-[#475569]">
          Openings collected automatically from official university, laboratory and research-institute pages. Only listings verified at their source and still open are shown; you apply on the official site.
        </p>
      </header>

      <nav aria-label="Opportunity sections" className="flex gap-1.5 overflow-x-auto pb-1">
        {(Object.keys(SECTIONS) as Section[]).map((s) => (
          <Link
            key={s}
            href={qs({ section: s })}
            aria-current={s === section ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${s === section ? "border-[#E0264E] bg-[#E0264E] text-white" : "border-[#E7EAF3] bg-white text-[#475569] hover:border-[#E0264E]/40 hover:text-[#11182B]"}`}
          >
            {SECTIONS[s]}
          </Link>
        ))}
      </nav>

      {/* Collapsible so the listings stay above the fold on phones; opens by itself when a filter is active. */}
      <details open={activeFilters > 0} className="group rounded-2xl border border-[#E7EAF3] bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-[#11182B] focus-visible:outline-2 focus-visible:outline-offset-2">
          <span>Filters{activeFilters > 0 ? ` (${activeFilters} active)` : ""}</span>
          <span aria-hidden className="text-xs text-[#617493] group-open:hidden">Show</span>
          <span aria-hidden className="hidden text-xs text-[#617493] group-open:inline">Hide</span>
        </summary>
      <form method="get" action="/opportunities" className="grid grid-cols-1 gap-2 border-t border-[#F4F6F9] p-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filter opportunities">
        <input type="hidden" name="section" value={section} />
        <label className="lg:col-span-2">
          <span className="sr-only">Search</span>
          <input name="q" defaultValue={filters.q} placeholder="Search title, lab or research area" className="w-full rounded-lg border border-[#E7EAF3] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-[#E0264E]" />
        </label>
        <label>
          <span className="sr-only">Organisation</span>
          <select name="org" defaultValue={filters.organization ?? ""} className="w-full rounded-lg border border-[#E7EAF3] px-2 py-2 text-sm">
            <option value="">All organisations</option>
            {data?.facets.organizations.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Country</span>
          <select name="country" defaultValue={filters.country ?? ""} className="w-full rounded-lg border border-[#E7EAF3] px-2 py-2 text-sm">
            <option value="">All countries</option>
            {data?.facets.countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Work mode</span>
          <select name="mode" defaultValue={filters.workMode ?? ""} className="w-full rounded-lg border border-[#E7EAF3] px-2 py-2 text-sm">
            <option value="">Any work mode</option>
            {data?.facets.workModes.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Education required</span>
          <select name="edu" defaultValue={filters.educationLevel ?? ""} className="w-full rounded-lg border border-[#E7EAF3] px-2 py-2 text-sm">
            <option value="">Any education</option>
            <option value="bachelor's degree">Bachelor&apos;s degree</option>
            <option value="master's degree">Master&apos;s degree</option>
            <option value="PhD">PhD</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Deadline</span>
          <select name="closing" defaultValue={one(sp.closing) ?? ""} className="w-full rounded-lg border border-[#E7EAF3] px-2 py-2 text-sm">
            <option value="">Any deadline</option>
            <option value="7">Closing within 7 days</option>
            <option value="30">Closing within 30 days</option>
          </select>
        </label>
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[#475569]">
            <input type="checkbox" name="stipend" value="1" defaultChecked={filters.stipendPublished} /> Stipend published
          </label>
          <button type="submit" className="rounded-lg bg-[#11182B] px-3 py-2 text-xs font-semibold text-white hover:bg-[#25304A] focus-visible:outline-2 focus-visible:outline-offset-2">
            Apply filters
          </button>
        </div>
      </form>
      </details>

      {!data ? (
        <State title="Research opportunities are temporarily unavailable" body="We couldn't load verified listings just now. Please try again shortly." />
      ) : data.items.length === 0 ? (
        <State
          title={section === "saved" ? "No saved opportunities yet" : section === "recommended" ? "No strong matches right now" : "No verified opportunities match"}
          body={
            section === "saved"
              ? "Save an opportunity from its page to keep it here and, if you like, get a reminder before its deadline."
              : section === "recommended"
                ? "Recommendations need listed skills to compare. Browse All opportunities, or add skills and connect GitHub so matches can be explained."
                : "Try another section or clear the filters. Listings appear here only once they are verified at their official source."
          }
          action={section !== "all" ? <Link href="/opportunities?section=all" className="mt-3 inline-block text-xs font-semibold text-[#E0264E] hover:underline">See all opportunities</Link> : undefined}
        />
      ) : (
        <ul className="space-y-3" aria-label={SECTIONS[section]}>
          {data.items.map((o) => (
            <OpportunityCard key={o.id} o={o} />
          ))}
        </ul>
      )}
    </div>
  );
}

function State({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E7EAF3] bg-white px-6 py-10 text-center" role="status">
      <p className="text-sm font-bold text-[#11182B]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-[#475569]">{body}</p>
      {action}
    </div>
  );
}

function OpportunityCard({ o }: { o: OpportunityView }) {
  const where = [o.location, o.workMode, o.country].filter(Boolean).join(" · ");
  return (
    <li className="rounded-2xl border border-[#E7EAF3] bg-white p-4 shadow-2xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/opportunities/${o.id}`} className="text-sm font-bold text-[#11182B] hover:text-[#E0264E] focus-visible:outline-2">
            {o.title}
          </Link>
          <p className="mt-0.5 text-xs text-[#475569]">
            {[o.organization, o.researchGroup, o.principalInvestigator ? `PI: ${o.principalInvestigator}` : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <FitBadge state={o.fit.state} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#475569]">
        {o.kind && (
          <span className="inline-flex items-center gap-1">
            <Briefcase aria-hidden className="size-3" /> {KIND_LABEL[o.kind] ?? o.kind}
          </span>
        )}
        {where && (
          <span className="inline-flex items-center gap-1">
            <MapPin aria-hidden className="size-3" /> {where}
          </span>
        )}
        <span className="inline-flex items-center gap-1 font-semibold text-[#9A5B00]">
          <CalendarClock aria-hidden className="size-3" /> {o.deadline ? `Deadline: ${o.deadline}` : "No deadline published"}
        </span>
        {o.details.stipend && <span>Stipend: {o.details.stipend.value}</span>}
        {o.saved && (
          <span className="inline-flex items-center gap-1 text-[#1D5FC4]">
            <Bookmark aria-hidden className="size-3" /> Saved
          </span>
        )}
      </div>
      <p className="mt-2 text-xs text-[#11182B]">{o.fit.summary}</p>
      {o.eligibility && <p className="mt-1 line-clamp-2 text-[11px] text-[#475569]">Eligibility (as published): {o.eligibility}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F4F6F9] pt-2 text-[11px] text-[#475569]">
        <span>
          {o.sourceName} · verified {fmtDate(o.lastVerifiedAt)}
        </span>
        <span className="flex items-center gap-3">
          <Link href={`/opportunities/${o.id}`} className="font-semibold text-[#11182B] hover:underline">View details</Link>
          {o.apply.kind !== "unavailable" && (
            <a href={`/opportunities/${o.id}/apply`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 rounded-md bg-[#E0264E] px-2 py-1 font-semibold text-white hover:bg-[#C21E43] focus-visible:outline-2 focus-visible:outline-offset-2">
              Apply on official site <ArrowUpRight aria-hidden className="size-3" />
            </a>
          )}
        </span>
      </div>
    </li>
  );
}
