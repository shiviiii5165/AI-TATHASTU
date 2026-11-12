import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, ArrowUpRight, Bookmark, BookmarkCheck, CheckCircle2, ExternalLink, Mail } from "lucide-react";

import { db } from "@/db";
import type { Evidenced } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { getOpportunity, loadStudentSignals, recordViewOnce, type OpportunityView } from "@/lib/opportunities/browse";
import type { OppDb } from "@/lib/opportunities/ingest";

import { confirmApplied, toggleSave } from "../actions";
import { FitBadge, KIND_LABEL, fmtDate } from "../ui";

export const metadata: Metadata = { title: "Research opportunity | AI Tathastu" };

// Per-request page (as support/tickets/[id]): no prerendered shell for arbitrary ids.
export const instant = false;

type P = Promise<{ id: string }>;

export default function OpportunityPage({ params }: { params: P }) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl animate-pulse space-y-4" role="status" aria-label="Loading"><div className="h-8 w-2/3 rounded bg-slate-200" /><div className="h-64 rounded-2xl bg-slate-100" /></div>}>
      <OpportunityContent params={params} />
    </Suspense>
  );
}

async function OpportunityContent({ params }: { params: P }) {
  const { user } = await requireOnboardedUser();
  const { id } = await params;
  const d = db as unknown as OppDb;
  const o = await getOpportunity(d, id, user.id, await loadStudentSignals(d, user.id));
  if (!o) notFound(); // not found, expired, withdrawn or no longer verified
  await recordViewOnce(d, user.id, o.id).catch(() => undefined);

  return (
    <article className="mx-auto max-w-4xl space-y-5">
      <Link href="/opportunities" className="inline-flex items-center gap-1 text-xs font-semibold text-[#475569] hover:text-[#11182B]">
        <ArrowLeft aria-hidden className="size-3.5" /> All research opportunities
      </Link>

      <header className="rounded-2xl border border-[#E7EAF3] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-bold text-[#11182B]">{o.title}</h1>
            <p className="mt-1 text-sm text-[#475569]">{[o.organization, o.researchGroup].filter(Boolean).join(" · ")}</p>
          </div>
          <FitBadge state={o.fit.state} />
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
          <Fact label="Type" value={o.kind ? KIND_LABEL[o.kind] ?? o.kind : null} />
          <Fact label="Principal investigator" value={o.principalInvestigator} evidence={o.details.principalInvestigator} />
          <Fact label="Location" value={[o.location, o.workMode, o.country].filter(Boolean).join(" · ") || null} />
          <Fact label="Application deadline" value={o.deadline} />
          <Fact label="Funding / stipend" value={o.details.stipend?.value ?? null} evidence={o.details.stipend} />
          <Fact label="Duration" value={o.details.duration?.value ?? null} evidence={o.details.duration} />
          <Fact label="Research area / project" value={o.details.researchArea?.value ?? null} evidence={o.details.researchArea} />
          <Fact label="Published" value={o.publishedAt ? fmtDate(o.publishedAt) : null} />
        </dl>
        <p className="mt-4 text-[11px] text-[#475569]">
          Source: <a href={o.sourceUrl ?? o.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{o.sourceName}</a> · verified {fmtDate(o.lastVerifiedAt)}.{" "}
          {o.extractionStatus === "extracted"
            ? "Details marked with a quote were read from the official announcement."
            : o.extractionStatus === "pending"
              ? "The official announcement hasn't been read yet; see the original for full details."
              : "The official announcement could not be read automatically (for example a scanned PDF); see the original for full details."}
        </p>
      </header>

      <section className="rounded-2xl border border-[#E7EAF3] bg-white p-5" aria-labelledby="fit-title">
        <h2 id="fit-title" className="text-sm font-bold text-[#11182B]">How this fits your profile</h2>
        <p className="mt-1 text-sm text-[#11182B]">{o.fit.summary}</p>
        {o.fit.supportedBy.length > 0 && (
          <p className="mt-2 text-xs text-[#475569]">
            Supported by: {o.fit.supportedBy.map((s) => `${s.skill} (${s.evidence === "demonstrated" ? "demonstrated" : s.evidence === "topic" ? "demonstrated; named in the project topic" : "listed, not yet demonstrated"})`).join(", ")}
          </p>
        )}
        {o.fit.notShown.length > 0 && <p className="mt-1 text-xs text-[#475569]">Not shown on your profile yet: {o.fit.notShown.join(", ")}</p>}
        <p className="mt-1 text-xs text-[#475569]">Eligibility: {o.fit.eligibility.detail} You confirm eligibility against the official announcement.</p>
        <p className="mt-2 text-[11px] text-[#617493]">This compares the requirements the source published with your profile. It is not a prediction of selection.</p>
      </section>

      <section className="rounded-2xl border border-[#E7EAF3] bg-white p-5" aria-labelledby="req-title">
        <h2 id="req-title" className="text-sm font-bold text-[#11182B]">Requirements (as published)</h2>
        <dl className="mt-3 space-y-3 text-xs">
          <Block label="Qualifications / eligibility" value={o.eligibility} evidence={o.details.qualifications} />
          <Block label="Skills" value={o.requiredSkills.length ? o.requiredSkills.join(", ") : null} evidence={o.details.skills} />
          <Block label="Age limit" value={o.details.ageLimit?.value ?? null} evidence={o.details.ageLimit} />
          <Block label="Documents" value={o.details.documents?.value.join("; ") ?? null} evidence={o.details.documents} />
        </dl>
        {o.description && (
          <>
            <h3 className="mt-4 text-xs font-bold text-[#11182B]">Description from the source</h3>
            <p className="mt-1 whitespace-pre-line text-xs text-[#11182B]">{o.description}</p>
          </>
        )}
      </section>

      <section id="how-to-apply" className="rounded-2xl border border-[#E7EAF3] bg-white p-5" aria-labelledby="apply-title">
        <h2 id="apply-title" className="text-sm font-bold text-[#11182B]">How to apply</h2>
        <ApplyBlock o={o} />
        {o.details.procedure && <p className="mt-2 text-xs text-[#475569]">The announcement says: &ldquo;{o.details.procedure.evidence}&rdquo;</p>}
        <p className="mt-3 text-[11px] text-[#617493]">Applications are submitted on the institution&apos;s side. AI Tathastu doesn&apos;t submit anything or know the outcome.</p>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#F4F6F9] pt-3">
          <form action={toggleSave} className="flex items-center gap-2">
            <input type="hidden" name="id" value={o.id} />
            <input type="hidden" name="save" value={o.saved ? "0" : "1"} />
            {!o.saved && o.deadlineAt && (
              <label className="flex items-center gap-1 text-[11px] text-[#475569]">
                <input type="checkbox" name="remind" value="1" /> Email me before the deadline
              </label>
            )}
            <button type="submit" className="inline-flex items-center gap-1 rounded-lg border border-[#E7EAF3] px-3 py-1.5 text-xs font-semibold text-[#11182B] hover:bg-[#F8FAFC] focus-visible:outline-2">
              {o.saved ? <BookmarkCheck aria-hidden className="size-3.5" /> : <Bookmark aria-hidden className="size-3.5" />}
              {o.saved ? `Saved${o.remind ? " · reminder on" : ""} (remove)` : "Save"}
            </button>
          </form>
          {o.interactions.confirmedApplied ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0E7C66]">
              <CheckCircle2 aria-hidden className="size-3.5" /> You told us you applied
            </span>
          ) : o.interactions.opened ? (
            <form action={confirmApplied}>
              <input type="hidden" name="id" value={o.id} />
              <button type="submit" className="text-xs font-semibold text-[#1D5FC4] hover:underline">I&apos;ve applied on the official site</button>
            </form>
          ) : null}
        </div>
      </section>
    </article>
  );
}

function ApplyBlock({ o }: { o: OpportunityView }) {
  const a = o.apply;
  if (a.kind === "portal") {
    return (
      <div className="mt-2 space-y-2 text-xs text-[#11182B]">
        <p>The announcement links to an application page.</p>
        <a href={`/opportunities/${o.id}/apply`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#E0264E] px-3 py-1.5 font-semibold text-white hover:bg-[#C21E43]">
          Apply on the official site <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
        <p>
          <a href={a.announcementUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">Read the official announcement <ExternalLink aria-hidden className="size-3" /></a>
        </p>
      </div>
    );
  }
  if (a.kind === "email") {
    return (
      <div className="mt-2 space-y-2 text-xs text-[#11182B]">
        <p>The official announcement asks applicants to apply by email to:</p>
        <p className="inline-flex items-center gap-1 font-semibold"><Mail aria-hidden className="size-3.5" /> {a.email}</p>
        <p>Follow the subject line, format and attachments the announcement specifies.</p>
        <a href={a.announcementUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#E0264E] px-3 py-1.5 font-semibold text-white hover:bg-[#C21E43]">
          Open the official announcement <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
      </div>
    );
  }
  if (a.kind === "announcement") {
    return (
      <div className="mt-2 space-y-2 text-xs text-[#11182B]">
        <p>Apply by following the instructions in the official announcement.</p>
        <a href={`/opportunities/${o.id}/apply`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-[#E0264E] px-3 py-1.5 font-semibold text-white hover:bg-[#C21E43]">
          Open the official announcement <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
      </div>
    );
  }
  return <p className="mt-2 text-xs text-[#475569]">The source hasn&apos;t published a verified application destination for this listing. Check the official source page above.</p>;
}

function Fact({ label, value, evidence }: { label: string; value: string | null; evidence?: Evidenced<unknown> }) {
  return (
    <div>
      <dt className="text-[11px] text-[#617493]">{label}</dt>
      <dd className="text-[#11182B]" title={evidence ? `From the announcement${evidence.page ? ` (p. ${evidence.page})` : ""}: "${evidence.evidence}"` : undefined}>
        {value ?? <span className="text-[#94A3B8]">Not stated by the source</span>}
      </dd>
    </div>
  );
}

function Block({ label, value, evidence }: { label: string; value: string | null; evidence?: Evidenced<unknown> }) {
  return (
    <div>
      <dt className="font-semibold text-[#11182B]">{label}</dt>
      <dd className="mt-0.5 text-[#475569]">
        {value ?? <span className="text-[#94A3B8]">Not stated by the source</span>}
        {evidence && value && <span className="mt-0.5 block text-[11px] italic text-[#617493]">Quote{evidence.page ? ` (p. ${evidence.page})` : ""}: &ldquo;{evidence.evidence}&rdquo;</span>}
      </dd>
    </div>
  );
}
