import Link from "next/link";

import { Card, Empty } from "@/components/admin/intelligence/charts";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { evidenceAvailability, GAP_FLAG_POINTS, MIN_GROUP_SIZE, reviewRankings } from "@/lib/intelligence/fairness";
import { EVIDENCE_POLICY_LABEL, MISSING_POLICY_LABEL } from "@/lib/intelligence/types";

const RATE_LABEL = { profile: "Assessed profile", resume: "Resume", connected: "Connected account", projects: "Described projects" } as const;
const date = (d: Date) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Methodology & fairness review: how each ranking scores students, and whether evidence is collected evenly.
 * Decision support only; these scores must not be used alone for admissions, rejection or hiring.
 */
export default async function MethodologyPage({ searchParams }: { searchParams: Promise<{ by?: string }> }) {
  await requireAdminPermission("intelligence.read");
  const by = (await searchParams).by === "academic_year" ? "academic_year" : "institution";
  const [review, availability] = await Promise.all([reviewRankings(), evidenceAvailability(by)]);

  return (
    <div className="space-y-6">
      <section aria-labelledby="principles" className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
        <h2 id="principles" className="text-sm font-bold text-foreground">How scores are made fair</h2>
        <ul className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground list-disc pl-4">
          <li><strong className="text-foreground">Missing isn&apos;t low.</strong> No evidence is never scored as 0; new rankings can&apos;t be published that way.</li>
          <li><strong className="text-foreground">Coverage gates ranking.</strong> Students below a ranking&apos;s minimum evidence coverage are listed as not ranked, not ranked last.</li>
          <li><strong className="text-foreground">Thin evidence is flagged.</strong> Low coverage or mostly self-reported evidence marks a rank provisional.</li>
          <li><strong className="text-foreground">Claims stay claims.</strong> Each value keeps its verification level; policies can exclude self-reported evidence.</li>
          <li><strong className="text-foreground">Versioned.</strong> Every snapshot stores the ranking version that produced it.</li>
          <li><strong className="text-foreground">No protected attributes.</strong> Scores use evidence only; no demographic data is an input.</li>
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">Rankings support decisions; they don&apos;t make them. Don&apos;t use a rank alone for admission, rejection or hiring.</p>
      </section>

      <section aria-labelledby="concepts" className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-2" data-testid="concepts">
        <h2 id="concepts" className="text-sm font-bold text-foreground">Four separate measures</h2>
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Performance</strong> is what the evidence shows (the ranking score).{" "}
          <strong className="text-foreground">Coverage</strong> is how much evidence exists.{" "}
          <strong className="text-foreground">Confidence</strong> is how reliable it is.{" "}
          <strong className="text-foreground">Comparability</strong> is whether two students&apos; evidence is equivalent enough to compare. They&apos;re shown side by side, never merged into one number.
        </p>
        {[
          ["Coverage", "12 evidence categories per student: profile, education, academic results, skills, projects, project verification, resume, GitHub, certifications, learning, assessments, experience and achievements. Coverage = categories with any evidence ÷ categories the platform can measure. Categories it doesn't collect yet (assessments) and those blocked by a failing connection are left out of the count, so they never lower a student's coverage."],
          ["Confidence", "A rule-based level, not a probability. Insufficient: under 3 categories with evidence. Low: nothing independently verified, or coverage under 40%. Moderate: at least 1 verified category and 40%+ coverage. High: at least 3 verified categories and 70%+ coverage. One level lower when half the evidence is outdated or most of it is unreviewed resume extraction."],
          ["Verified vs. claimed", "Verified: projects matched to the student's own repositories, issuer-verified certificates, data from GitHub or ORCID. Assessed: levels the career engine or an AI model derived from the evidence. Self-reported: what the student stated or confirmed. Not reviewed: extracted from a resume and not yet checked by the student."],
          ["Freshness", "Skills older than 180 days and GitHub data older than 90 days are shown as outdated. Outdated evidence still counts as present, but lowers confidence."],
          ["Comparability", "Checked per dimension for the students being compared: not comparable when evidence is on different scales; compare with care when verification levels, institutions or recency differ; not enough evidence when anyone lacks it (named). Different years of study and wide coverage gaps are called out."],
          ["Grade scales", "Grades are only used when their scale is stated or unambiguous (8.6/10, 3.4/4, 86%). Grade points and percentages are never converted into each other: institutions use different conversion rules, and none is known here. If a ranking's cohort mixes scales, grades are left out for everyone (no evidence, not 0). There is no institution grade feed; all grades are self-reported."],
          ["Known blind spots", "No assessment or test results are stored. Contradictions between sources (e.g. resume vs. GitHub) aren't detected. Institutions' grading standards aren't known. Evidence availability can differ by institution (see below), which affects rankings."],
        ].map(([t, body]) => (
          <details key={t} className="rounded-lg border border-border px-3 py-2 text-xs">
            <summary className="cursor-pointer font-semibold text-foreground">{t}</summary>
            <p className="mt-1.5 text-muted-foreground">{body}</p>
          </details>
        ))}
      </section>

      <Card title="Rankings and their rules" subtitle="Every saved ranking, checked against today's rules." source="intelligence_ranking_profiles, versions, snapshots">
        {!review.available ? (
          <Empty>Ranking tables aren&apos;t available in this database.</Empty>
        ) : review.rankings.length === 0 ? (
          <Empty>No saved rankings yet. The automatic ranking uses the cohort midpoint for missing evidence.</Empty>
        ) : (
          <div className="relative overflow-x-auto -mx-5">
            <table className="w-full text-left text-xs" data-testid="ranking-review">
              <caption className="sr-only">Saved rankings and their methodology</caption>
              <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr>
                  <th scope="col" className="py-2 px-4">Ranking</th>
                  <th scope="col" className="py-2 px-4">Version</th>
                  <th scope="col" className="py-2 px-4">Missing evidence</th>
                  <th scope="col" className="py-2 px-4">Evidence accepted</th>
                  <th scope="col" className="py-2 px-4">Min. coverage</th>
                  <th scope="col" className="py-2 px-4">Last snapshot</th>
                  <th scope="col" className="py-2 px-4">Problems</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {review.rankings.map((r) => (
                  <tr key={r.id} className="align-top">
                    <td className="py-2.5 px-4">
                      <Link href={`/admin/intelligence/rankings?r=${r.id}`} className="font-semibold text-foreground hover:text-primary">{r.name}</Link>
                      <span className="block text-[10px] text-muted-foreground capitalize">{r.status}</span>
                    </td>
                    <td className="py-2.5 px-4 text-muted-foreground">{r.publishedVersion ? `v${r.publishedVersion}` : "Draft"} · {r.versionCount} published</td>
                    <td className={`py-2.5 px-4 ${r.definition.missingPolicy === "zero" ? "font-semibold text-rose-700 dark:text-rose-400" : "text-foreground"}`}>{MISSING_POLICY_LABEL[r.definition.missingPolicy]}</td>
                    <td className="py-2.5 px-4 text-foreground">{EVIDENCE_POLICY_LABEL[r.definition.evidencePolicy]}</td>
                    <td className="py-2.5 px-4 text-foreground">{r.definition.eligibility.minCoverage}%</td>
                    <td className="py-2.5 px-4 text-muted-foreground">
                      {r.latestSnapshot ? `v${r.latestSnapshot.version}: ${r.latestSnapshot.rankedCount} ranked, ${r.latestSnapshot.ineligibleCount} not ranked · ${date(r.latestSnapshot.computedAt)}` : "None"}
                    </td>
                    <td className="py-2.5 px-4">
                      {r.issues.length === 0 ? <span className="text-muted-foreground">None</span> : (
                        <ul className="space-y-0.5 text-rose-700 dark:text-rose-400">{r.issues.map((i, k) => <li key={k}>{i.message}</li>)}</ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Evidence availability by group"
        subtitle={`Share of active student accounts with each kind of evidence. Groups under ${MIN_GROUP_SIZE} students are hidden. A gap of ${GAP_FLAG_POINTS}+ points from all students is highlighted: that group's rankings rest on less evidence. It says nothing about ability.`}
        source="users, profile_views, files, connections, profile_facts"
        action={
          <nav aria-label="Group by" className="flex gap-1 text-[11px]">
            {(["institution", "academic_year"] as const).map((b) => (
              <Link key={b} href={`/admin/intelligence/methodology?by=${b}`} aria-current={b === by ? "page" : undefined} className={`px-2 py-1 rounded-md ${b === by ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"}`}>
                {b === "institution" ? "Institution" : "Academic year"}
              </Link>
            ))}
          </nav>
        }
      >
        {availability.overall.students === 0 ? (
          <Empty>No student accounts yet.</Empty>
        ) : (
          <div className="relative overflow-x-auto -mx-5">
            <table className="w-full text-left text-xs" data-testid="availability">
              <caption className="sr-only">Evidence availability by {by === "institution" ? "institution" : "academic year"}</caption>
              <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr>
                  <th scope="col" className="py-2 px-4">{by === "institution" ? "Institution" : "Academic year"}</th>
                  <th scope="col" className="py-2 px-4 text-right">Students</th>
                  {Object.values(RATE_LABEL).map((l) => <th key={l} scope="col" className="py-2 px-4 text-right">{l}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {[availability.overall, ...availability.groups].map((g, i) => (
                  <tr key={g.group + i} className={i === 0 ? "font-semibold bg-muted/20" : ""}>
                    <th scope="row" className="py-2 px-4 text-left font-medium text-foreground">{g.group}</th>
                    <td className="py-2 px-4 text-right font-mono">{g.students}</td>
                    {(Object.keys(RATE_LABEL) as (keyof typeof RATE_LABEL)[]).map((k) => (
                      <td key={k} className={`py-2 px-4 text-right font-mono ${g.flagged.includes(k) ? "text-amber-800 dark:text-amber-400 font-bold" : ""}`}>
                        {g.rates[k]}%{g.flagged.includes(k) && <span className="sr-only"> (large gap)</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {availability.smallGroupsHidden > 0 && <p className="px-5 pt-2 text-[11px] text-muted-foreground">{availability.smallGroupsHidden} smaller group(s) hidden.</p>}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground">Limits: these are descriptive rates, not a statistical test. Groups use institution and academic year only.</p>
      </Card>
    </div>
  );
}
