import { ArrowLeft, BadgeCheck, ExternalLink, PencilLine, PlugZap, Quote } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { roleLabel } from "@/components/dashboard/widgets/labels";
import { SourceBadge, Verification, originLabel } from "@/components/profile/provenance";
import { requireOnboardedUser } from "@/lib/dal";
import { fieldLabel } from "@/lib/profile/field-groups";
import { dateRange, loadProfile, type Entry, type Fact } from "@/lib/profile/unified";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile />
    </Suspense>
  );
}

const IDENTITY_ORDER = [
  "full_name", "headline", "location", "email", "phone", "website",
  "linkedin_url", "github_url", "leetcode_url", "hackerrank_url", "kaggle_url", "orcid_url", "stackexchange_url",
];

async function Profile() {
  const { user, state } = await requireOnboardedUser();
  const p = await loadProfile(user.id, { user, state });
  const name = p.identity.full_name?.best.value ?? p.user.name ?? "Your profile";
  const identityRows = IDENTITY_ORDER.filter((f) => p.identity[f]).map((f) => p.identity[f]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <header className="pb-6 border-b border-[#E7EAF3]">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">{name}</h1>
            {p.identity.headline && <p className="mt-1 text-sm sm:text-base font-medium text-[#64748B]">{p.identity.headline.best.value}</p>}
            <p className="mt-2 text-xs sm:text-sm text-[#8A9BB5]">
              {[p.user.degree, p.user.specialization, p.user.university, p.state?.careerRole && `Heading for ${roleLabel(p.state.careerRole)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E8FAF4] text-[#19C58A] border border-[#19C58A]/20">
              <BadgeCheck className="size-4" />
              Verified Profile
            </span>
          </div>
        </div>
        <Legend />
      </header>

      <Section id="identity" title="Identity & contact" count={identityRows.length}>
        {identityRows.length === 0 ? (
          <Empty>No confirmed identity details yet.</Empty>
        ) : (
          <dl className="divide-y rounded-lg border bg-card">
            {identityRows.map(({ best, others }) => (
              <div key={best.field} className="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
                <dt className="text-sm text-muted-foreground">{fieldLabel(best.group, best.field)}</dt>
                <dd className="min-w-0">
                  <FactValue fact={best} />
                  {others.map((o) => (
                    <p key={o.id} className="mt-1 text-xs text-muted-foreground">
                      {originLabel(o.origin)} says: {o.value}
                    </p>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Section>

      <Section id="experience" title="Experience" count={p.experience.length}>
        {p.experience.length === 0 ? (
          <Empty>No confirmed experience yet. It comes from your reviewed resume.</Empty>
        ) : (
          <EntryList entries={p.experience} title={(e) => [e.fields.role?.value, e.fields.organization?.value].filter(Boolean).join(" · ")} />
        )}
      </Section>

      <Section id="education" title="Education" count={p.education.length}>
        {p.education.length === 0 ? (
          <Empty>No confirmed education yet.</Empty>
        ) : (
          <EntryList
            entries={p.education}
            title={(e) => e.fields.institution?.value ?? e.fields.degree?.value ?? "Education"}
            subtitle={(e) => [e.fields.degree?.value, e.fields.field_of_study?.value, e.fields.grade?.value].filter(Boolean).join(" · ")}
          />
        )}
      </Section>

      <Section id="projects" title="Projects" count={p.projects.length}>
        {p.projects.length === 0 ? (
          <Empty>
            No projects yet. <Link href="/connections" className="underline underline-offset-4 hover:no-underline">Connect GitHub</Link> to
            import your repositories.
          </Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {p.projects.map((pr) => (
              <li key={pr.title + pr.links[0]} className="flex flex-col rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{pr.title}</p>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {pr.origins.map((o) => (
                      <SourceBadge key={o} origin={o} />
                    ))}
                  </div>
                </div>
                {pr.status === "matched" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Same project found in {pr.origins.map(originLabel).join(" and ")}, merged into one.
                  </p>
                )}
                {pr.descriptions[0] && <p className="mt-2 text-sm text-muted-foreground">{pr.descriptions[0]}</p>}
                {pr.technologies.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Technologies">
                    {pr.technologies.map((t) => (
                      <li key={t} className="rounded-full border px-2 py-0.5 text-xs">
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
                {pr.links.length > 0 && (
                  <ul className="mt-auto flex flex-wrap gap-x-4 pt-3">
                    {pr.links.map((l) => (
                      <li key={l}>
                        <a
                          href={l}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-sm text-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {l.replace(/^https?:\/\/(www\.)?/, "")}
                          <ExternalLink aria-hidden className="size-3" />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="skills" title="Skills" count={p.skills.length}>
        {p.skills.length === 0 ? (
          <Empty>No skills with evidence yet.</Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {p.skills.map((s) => (
              <li key={s.name} className="flex items-center gap-3 border-b py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.sources.map(originLabel).join(", ")}</p>
                </div>
                <div
                  role="meter"
                  aria-label={`${s.name} evidence strength`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(s.evidenceStrength * 100)}
                  title={`Evidence ${Math.round(s.evidenceStrength * 100)}%`}
                  className="h-1 w-14 shrink-0 overflow-hidden rounded-full bg-muted"
                >
                  <div className="h-full origin-left bg-foreground" style={{ transform: `scaleX(${s.evidenceStrength})` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function FactValue({ fact }: { fact: Fact }) {
  const isUrl = /^https?:\/\//.test(fact.value);
  return (
    <div>
      <p className="flex flex-wrap items-center gap-2 text-sm">
        {isUrl ? (
          <a href={fact.value} target="_blank" rel="noreferrer" className="break-all underline-offset-4 hover:underline">
            {fact.value.replace(/^https?:\/\//, "")}
          </a>
        ) : (
          <span className="break-words">{fact.value}</span>
        )}
        <SourceBadge origin={fact.origin} evidence={fact.evidence} />
        <Verification confirmation={fact.confirmation} origin={fact.origin} />
      </p>
      {fact.origin === "resume" && fact.evidence && fact.evidence !== fact.value && (
        <p className="mt-1 flex gap-1.5 text-xs text-muted-foreground">
          <Quote aria-hidden className="mt-0.5 size-3 shrink-0" />
          <span className="min-w-0 break-words">
            {fact.evidence}
            {fact.page && <span className="ml-1.5 font-mono">p. {fact.page}</span>}
          </span>
        </p>
      )}
    </div>
  );
}

function EntryList({ entries, title, subtitle }: { entries: Entry[]; title: (e: Entry) => string; subtitle?: (e: Entry) => string }) {
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {entries.map((e) => {
        const facts = Object.values(e.fields);
        const sub = subtitle?.(e);
        const range = dateRange(e);
        return (
          <li key={e.key} className="px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <p className="font-medium">{title(e) || "Untitled"}</p>
              {range && <p className="font-mono text-xs text-muted-foreground">{range}</p>}
            </div>
            {sub && <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>}
            {e.fields.description && <p className="mt-2 text-sm">{e.fields.description.value}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-2">
              {e.origins.map((o) => (
                <SourceBadge key={o} origin={o} />
              ))}
              {/* One indicator per kind present, e.g. confirmed + edited */}
              {[...new Map(facts.map((f) => [`${f.confirmation}:${f.origin}`, f])).values()].map((f) => (
                <Verification key={f.id} confirmation={f.confirmation} origin={f.origin} />
              ))}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Section({ id, title, count, children }: { id: string; title: string; count: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`section-${id}`} className="mt-10">
      <div className="mb-4 flex items-baseline justify-between border-b pb-2">
        <h2 id={`section-${id}`} className="font-sans text-lg sm:text-xl font-bold text-[#11182B]">
          {title}
        </h2>
        <span className="font-mono text-xs text-muted-foreground">{count}</span>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">{children}</p>;
}

function Legend() {
  const items = [
    { Icon: BadgeCheck, text: "Confirmed by you", tone: "text-success" },
    { Icon: PencilLine, text: "Edited by you", tone: "text-foreground" },
    { Icon: PlugZap, text: "From a connected source", tone: "text-muted-foreground" },
  ];
  return (
    <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="What the markers mean">
      {items.map(({ Icon, text, tone }) => (
        <li key={text} className="inline-flex items-center gap-1.5">
          <Icon aria-hidden className={cn("size-3.5", tone)} />
          {text}
        </li>
      ))}
      <li>Hover a source badge to see the quote it came from.</li>
    </ul>
  );
}

function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading your profile" className="max-w-7xl mx-auto space-y-8 animate-pulse">
      <div aria-hidden className="h-10 w-1/3 rounded-xl bg-slate-200" />
      <div aria-hidden className="h-4 w-1/4 rounded bg-slate-100" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} aria-hidden className="h-40 rounded-2xl border border-slate-200/60 bg-white" />
      ))}
    </div>
  );
}
