import Link from "next/link";
import { Suspense } from "react";

import { Card, Empty } from "@/components/admin/intelligence/charts";
import { FrameworkReviewForm } from "@/components/admin/intelligence/framework-review-form";
import { hasPermission, requireAdminPermission } from "@/lib/admin/rbac";
import { assessmentQuality, FRAMEWORK, reviewsFor, roleProfile, roleSummaries } from "@/lib/intelligence/frameworks";

const DECISION_LABEL = { approved: "Approved", changes_requested: "Changes requested", question_resolved: "Resolved", question_deferred: "Deferred" } as const;
const STATE_LABEL: Record<string, string> = { not_enough_evidence: "Not enough evidence", early: "Early", developing: "Developing", strong: "Strong", requirements_demonstrated: "Requirements demonstrated" };
const day = (d: Date | string) => new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Research governance for the career-intelligence frameworks (workstream D): what each role profile asks for, the
 * sources behind it and their checks, open research questions, reviewers' decisions, and assessment quality by
 * methodology version. Viewing needs intelligence.read; recording a review needs intelligence.manage.
 */
export default function FrameworksPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  return (
    <Suspense fallback={<div role="status" aria-label="Loading" className="h-64 animate-pulse rounded-2xl border bg-muted" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const ctx = await requireAdminPermission("intelligence.read");
  const canReview = hasPermission(ctx, "intelligence.manage");
  const role = (await searchParams).role;
  const profile = role ? roleProfile(role) : null;
  const [reviews, quality] = await Promise.all([reviewsFor(FRAMEWORK.frameworkVersion), assessmentQuality()]);
  const latest = (r: string | null) => reviews?.find((x) => x.role === r && !x.questionId);

  return (
    <div className="space-y-6">
      <Card title={`Career framework ${FRAMEWORK.frameworkVersion}`} subtitle={`Status: ${FRAMEWORK.status.replaceAll("_", " ")}. ${FRAMEWORK.provenance.basis}`} source="worker/intelligence/frameworks/role_frameworks.json">
        <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
          <div>
            <p className="font-semibold text-foreground">Change log</p>
            <ol className="mt-1 space-y-1 text-muted-foreground">
              {(FRAMEWORK.provenance.changes ?? []).map((c) => <li key={c.version}><b className="text-foreground">{c.version}</b> ({c.at}): {c.summary}</li>)}
              {!(FRAMEWORK.provenance.changes ?? []).length && <li>No recorded changes.</li>}
            </ol>
          </div>
          <div>
            <p className="font-semibold text-foreground">Career levels</p>
            <p className="mt-1 text-muted-foreground">{FRAMEWORK.careerLevels.rule}</p>
            <p className="mt-1 text-muted-foreground">Basis: {FRAMEWORK.careerLevels.basis}, {FRAMEWORK.careerLevels.status.replaceAll("_", " ")}. {FRAMEWORK.careerLevels.note}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          A framework changes only through a reviewed code change that bumps its version. Recording a decision here documents the review; it doesn&apos;t change any assessment.
          {reviews === null && " Reviews and assessment history need migration 0035, which isn't applied to this database yet."}
        </p>
      </Card>

      {profile ? (
        <section aria-labelledby="role-h" className="space-y-4">
          <Link href="/admin/intelligence/frameworks" className="text-xs text-muted-foreground hover:text-foreground">← All roles</Link>
          <Card title={profile.label} subtitle={profile.summary ?? ""} source={`roles.${profile.id}`}>
            <p className="text-xs text-muted-foreground">{profile.distinguishingFocus}</p>
            <p className="mt-2 text-xs">Review status: <b>{latest(profile.id) ? `${DECISION_LABEL[latest(profile.id)!.decision]} by ${latest(profile.id)!.reviewerEmail} on ${day(latest(profile.id)!.createdAt)}` : "Not reviewed"}</b></p>
            <div className="mt-4 space-y-4">
              {profile.byDomain.map((d) => (
                <div key={d.key}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{d.label}</h3>
                  <div className="mt-1 overflow-x-auto">
                    <table className="w-full min-w-[760px] text-xs">
                      <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-2">Competency</th><th className="pr-2">Tier</th><th className="pr-2">Weight</th><th className="pr-2">Junior / Intermediate / Senior</th><th className="pr-2">Evidence</th><th>Why the role needs it</th></tr></thead>
                      <tbody>
                        {d.rows.map((r) => (
                          <tr key={r.competency} className="border-t border-border align-top">
                            <td className="py-1.5 pr-2 font-semibold text-foreground">{r.competency}{r.definition?.realises && <span className="block font-normal text-muted-foreground">evidence of {r.definition.realises}</span>}</td>
                            <td className="pr-2">{r.tier}</td>
                            <td className="pr-2 tabular-nums">{r.weight}</td>
                            <td className="pr-2">{r.careerLevels ? `${r.careerLevels.junior} / ${r.careerLevels.intermediate} / ${r.careerLevels.senior}` : r.expectedLevel}</td>
                            <td className="pr-2">{r.evidenceRequirement}</td>
                            <td className="text-muted-foreground">{r.rationale}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Sources" subtitle="Each with the result of the last link check and, where a competency depends on it, what was read." source="provenance.references">
            <ul className="space-y-2 text-xs">
              {profile.references.map((r) => (
                <li key={r.id}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold hover:underline">{r.title}</a> · {r.publisher} · {r.kind}
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${r.linkCheck?.result === "reachable" ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>{r.linkCheck ? `${r.linkCheck.result.replaceAll("_", " ")} ${r.linkCheck.at}` : `checked ${r.checkedAt}`}</span>
                  <span className="block text-muted-foreground">Informs: {r.informs}</span>
                  {r.contentCheck && <span className="block text-muted-foreground">Read {r.contentCheck.at}: {r.contentCheck.finding}</span>}
                </li>
              ))}
            </ul>
          </Card>
          {profile.openQuestions.length > 0 && (
            <Card title="Open research questions for this role" source="openQuestions">
              <ul className="space-y-1 text-xs">{profile.openQuestions.map((q) => <li key={q.id}><b>{q.question}</b> ({q.status}) <span className="text-muted-foreground">{q.note}</span></li>)}</ul>
            </Card>
          )}
          {canReview && <FrameworkReviewForm role={profile.id} questions={profile.openQuestions} />}
        </section>
      ) : (
        <>
          <Card title="Role profiles" subtitle="Every current role. Open one to see its competencies by domain, career-level targets and sources." source="roles">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="text-left text-muted-foreground"><tr><th className="py-1 pr-2">Role</th><th className="pr-2">Required</th><th className="pr-2">Supporting</th><th className="pr-2">Domains</th><th className="pr-2">Sources</th><th className="pr-2">Open questions</th><th>Review</th></tr></thead>
                <tbody>
                  {roleSummaries().map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1.5 pr-2"><Link href={`/admin/intelligence/frameworks?role=${r.id}`} className="font-semibold hover:underline">{r.label}</Link></td>
                      <td className="pr-2 tabular-nums">{r.required}</td>
                      <td className="pr-2 tabular-nums">{r.supporting}</td>
                      <td className="pr-2 tabular-nums">{r.domains}</td>
                      <td className="pr-2 tabular-nums">{r.references}{r.unreachableReferences ? <span className="text-amber-700"> ({r.unreachableReferences} not reachable)</span> : null}</td>
                      <td className="pr-2 tabular-nums">{r.openQuestions}</td>
                      <td>{latest(r.id) ? DECISION_LABEL[latest(r.id)!.decision] : "Not reviewed"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Open research questions" subtitle="Recorded instead of guessed. Resolve one with a source, then change the framework in a new version." source="openQuestions">
            <ul className="space-y-2 text-xs">
              {FRAMEWORK.openQuestions.map((q) => {
                const decided = reviews?.find((x) => x.questionId === q.id);
                return (
                  <li key={q.id}>
                    <b>{q.question}</b> <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{q.status}</span>
                    {decided && <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-900">{DECISION_LABEL[decided.decision]} {day(decided.createdAt)}</span>}
                    <span className="block text-muted-foreground">{q.note}</span>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card title="Assessment quality by methodology version" subtitle="From the immutable assessment history. Aggregates only." source="intelligence_snapshots">
            {!quality ? (
              <Empty>Not available yet: needs migration 0035 (intelligence_snapshots) and at least one recomputed student.</Empty>
            ) : (
              <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2">
                <table className="w-full">
                  <thead className="text-left text-muted-foreground"><tr><th className="py-1">Engine</th><th>Framework</th><th>Assessments</th><th>Method-only changes</th></tr></thead>
                  <tbody>{quality.byVersion.map((v) => <tr key={`${v.engine}-${v.framework}`} className="border-t border-border"><td className="py-1">v{v.engine}</td><td>{v.framework ?? "—"}</td><td className="tabular-nums">{v.n}</td><td className="tabular-nums">{v.methodologyOnly}</td></tr>)}</tbody>
                </table>
                <table className="w-full">
                  <thead className="text-left text-muted-foreground"><tr><th className="py-1">Primary goal</th><th>Latest alignment</th><th>Students</th></tr></thead>
                  <tbody>{quality.latestStates.map((s) => <tr key={`${s.role}-${s.state}`} className="border-t border-border"><td className="py-1">{s.role}</td><td>{STATE_LABEL[s.state] ?? s.state}</td><td className="tabular-nums">{s.n}</td></tr>)}</tbody>
                </table>
              </div>
            )}
          </Card>

          {canReview && <FrameworkReviewForm role={null} questions={FRAMEWORK.openQuestions} />}
          {reviews && reviews.length > 0 && (
            <Card title="Review log" subtitle={`Decisions on ${FRAMEWORK.frameworkVersion}, newest first. Never edited.`} source="framework_reviews">
              <ol className="space-y-1 text-xs">{reviews.map((r) => <li key={r.id}>{day(r.createdAt)} · <b>{DECISION_LABEL[r.decision]}</b> · {r.role ?? (r.questionId ? `question ${r.questionId}` : "framework")} · {r.reviewerEmail}: <span className="text-muted-foreground">{r.note}</span></li>)}</ol>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
