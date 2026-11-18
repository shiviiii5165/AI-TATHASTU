import { ArrowLeft, ExternalLink, GitCompare, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ActivityCalendar, BarList, Card, Empty, Kpi, Radar, RankLine, ScoreCell, SLOT, VERIFICATION_COLOR, VerificationBadge } from "@/components/admin/intelligence/charts";
import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { categoryOf, EVIDENCE_BASIS, evidenceBasisOf, skillsToDevelop } from "@/lib/dashboard/intelligence";
import { verificationOfBasis } from "@/lib/intelligence/catalogue";
import { ECOSYSTEM } from "@/lib/intelligence/ecosystem";
import { runRanking, studentRankHistory } from "@/lib/intelligence/rankings";
import { resolveRanking } from "@/lib/intelligence/resolve";
import { loadStudent360, type TimelineEvent } from "@/lib/intelligence/student";
import { buildEvidenceSummary } from "@/lib/intelligence/summary";

const fmt = (n: number, d = 0) => n.toLocaleString("en-IN", { maximumFractionDigits: d });
const date = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const KIND_COLOR: Record<TimelineEvent["kind"], string> = {
  account: SLOT(0), connection: SLOT(0), evidence: SLOT(6), learning: SLOT(2), credential: SLOT(3), career: SLOT(1), code: SLOT(4),
};

export default async function Student360Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ r?: string; back?: string }> }) {
  const ctx = await requireAdminPermission("intelligence.read");
  const { id } = await params;
  const sp = await searchParams;
  const s = await loadStudent360(id);
  if (!s) notFound();

  await recordAdminAudit({ actorId: ctx.user.id, actorEmail: ctx.user.email || "admin", action: "intelligence.student_view", resource: "student_360", targetId: id });

  const ranking = await resolveRanking(sp.r);
  const [run, history] = await Promise.all([runRanking(ranking.definition), studentRankHistory(id)]);
  const mine = run.results.find((r) => r.userId === id) ?? null;
  const ranked = run.results.filter((r) => r.eligible).length;
  const catMedians = run.definition.categories.map((c) => median(run.results.map((r) => r.categories.find((x) => x.id === c.id)?.score).filter((v): v is number => v !== null && v !== undefined)));

  const intel = s.intel;
  const skills = [...(intel?.skills ?? [])].sort((a, b) => (b.proficiency ?? -1) - (a.proficiency ?? -1));
  const assessed = skills.filter((k) => k.proficiency !== null);
  const verifiedSkills = assessed.filter((k) => { const v = verificationOfBasis(k.evidenceBasis, k.evidenceState); return v === "verified" || v === "external"; });
  const gaps = skillsToDevelop(intel ?? undefined, s.goal.role);
  const primaryEris = s.eris.find((e) => e.role === s.goal.role) ?? null;
  const certsVerified = s.learning.filter((l) => l.kind === "certification" && l.verification === "verified").length;
  const certsListed = (s.facts.certifications ?? []).length;
  const pubs = s.facts.publications ?? [];
  const summary = buildEvidenceSummary(s, mine, run.definition.categories.length ? ranking.name : null);
  const back = sp.back?.startsWith("/admin/intelligence") ? sp.back : "/admin/intelligence/rankings";
  const languages = new Map<string, number>();
  for (const r of s.repos) for (const [l, b] of Object.entries(r.languages)) languages.set(l, (languages.get(l) ?? 0) + Number(b || 0));
  const langTotal = [...languages.values()].reduce((a, b) => a + b, 0);

  const nav = ["overview", "skills", "gaps", "code", "credentials", "career", "timeline", "ecosystem"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link href={back} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"><ArrowLeft className="size-3.5" /> Back to rankings</Link>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center shrink-0">{(s.user.name?.[0] || s.user.email?.[0] || "S").toUpperCase()}</div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground">{s.user.name || "Unnamed student"}</h2>
              <p className="text-xs text-muted-foreground font-mono">{s.user.email}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {[s.institution, s.user.degree as string, s.user.specialization as string, s.user.academicYear as string].filter(Boolean).join(" · ") || "Academic details not provided"}
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${s.user.deletedAt ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>{s.user.deletedAt ? "Deleted" : "Active"}</span>
          <Link href={`/admin/intelligence/compare?ids=${id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent"><GitCompare className="size-3.5" /> Compare</Link>
          <Link href={`/admin/students/${id}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent"><ShieldCheck className="size-3.5" /> Account admin</Link>
        </div>
      </div>

      {(s.admin.basis === "includes_unreviewed" || s.admin.onboardingComplete === false || !s.intel) && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[11px] text-foreground space-y-0.5">
          {!s.intel && <p>No intelligence profile has been computed for this student yet.</p>}
          {s.admin.onboardingComplete === false && <p>Onboarding not finished: this profile is visible to admins only; the student hasn&apos;t seen it.</p>}
          {s.admin.basis === "includes_unreviewed" && <p>Includes {s.admin.unreviewedFacts} resume fact(s) the student hasn&apos;t reviewed yet. They count only as self-reported description, never as proof.</p>}
        </div>
      )}

      <nav className="flex gap-1.5 overflow-x-auto text-[11px]">
        {nav.map((n) => <a key={n} href={`#${n}`} className="px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent capitalize whitespace-nowrap">{n}</a>)}
      </nav>

      <section id="overview" className="space-y-6 scroll-mt-20">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi label="Rank" value={mine?.rank ? `#${mine.rank}` : "Not ranked"} sub={mine?.rank ? `of ${fmt(ranked)} · ${ranking.name}` : mine?.ineligibleReasons[0] ?? ranking.name} color={SLOT(0)} />
          <Kpi label="Composite score" value={mine?.score !== null && mine?.score !== undefined ? fmt(mine.score, 1) : "—"} sub={mine ? `${fmt(mine.coverage)}% evidence coverage` : undefined} color={SLOT(2)} />
          <Kpi label="ERIS (primary goal)" value={primaryEris ? fmt(primaryEris.score) : "—"} sub={s.goal.label ?? "No goal chosen"} color={SLOT(6)} />
          <Kpi label="Verified skills" value={fmt(verifiedSkills.length)} sub={`${fmt(assessed.length)} assessed in total`} color={SLOT(1)} href="#skills" />
          <Kpi label="Skills to develop" value={fmt(gaps.length)} sub="From the career engine" color={SLOT(7)} href="#gaps" />
          <Kpi label="GitHub (year)" value={s.github?.total !== null && s.github?.total !== undefined ? fmt(s.github.total) : "—"} sub={s.github?.syncedAt ? `synced ${date(s.github.syncedAt)}` : "not connected"} color={SLOT(3)} href="#code" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Category performance" subtitle={`${ranking.name}. The dashed outline is the cohort median. A missing point means no evidence, not 0.`} source="Ranking engine, live" className="lg:col-span-1">
            {mine ? (
              <Radar axes={run.definition.categories.map((c) => c.name)} series={[
                { name: "Cohort median", values: catMedians, color: "var(--si-grid)", dashed: true },
                { name: s.user.name || "Student", values: mine.categories.map((c) => c.score), color: SLOT(0) },
              ]} />
            ) : <Empty>Not in this ranking&apos;s cohort.</Empty>}
          </Card>
          <Card title="Score breakdown" subtitle="Each category with its weight, score and how much of it has evidence." className="lg:col-span-1">
            {mine ? (
              <ul className="space-y-3">
                {mine.categories.map((c, i) => (
                  <li key={c.id}>
                    <div className="flex justify-between text-[11px]"><span className="font-semibold text-foreground">{c.name} <span className="text-muted-foreground font-normal">({c.weight}%)</span></span><span className="text-muted-foreground">coverage {fmt(c.coverage)}%</span></div>
                    <div className="mt-1"><ScoreCell value={c.score} color={SLOT(i)} /></div>
                  </li>
                ))}
              </ul>
            ) : <Empty>No ranking data.</Empty>}
          </Card>
          <Card title="Evidence summary" subtitle="Rule-based, not AI-generated: each statement cites the record behind it." className="lg:col-span-1">
            {summary.length ? (
              <ul className="space-y-2.5">
                {summary.map((line, i) => (
                  <li key={i} className="text-xs text-foreground leading-relaxed">
                    <span className="inline-block size-1.5 rounded-full mr-2 align-middle" style={{ background: line.tone === "strength" ? "var(--si-3)" : line.tone === "gap" ? "var(--si-2)" : "var(--si-1)" }} />
                    {line.text}
                    <span className="block text-[10px] text-muted-foreground pl-3.5">{line.source}</span>
                  </li>
                ))}
              </ul>
            ) : <Empty>Not enough evidence to summarise yet.</Empty>}
          </Card>
        </div>

        <Card title="Ranking history" subtitle="Rank in each saved snapshot that included this student." source="intelligence_ranking_snapshots">
          {history.length === 0 ? <Empty>No snapshot includes this student yet.</Empty> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[...new Set(history.map((h) => h.profileId))].slice(0, 4).map((pid) => {
                const pts = history.filter((h) => h.profileId === pid && h.rank !== null);
                return (
                  <div key={pid}>
                    <div className="text-[11px] font-semibold text-foreground mb-1">{pts[0]?.name ?? history.find((h) => h.profileId === pid)?.name}</div>
                    <RankLine points={pts.map((h) => ({ at: h.computedAt, rank: Number(h.rank) }))} total={Math.max(...pts.map((h) => h.rankedCount), 2)} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <section id="skills" className="scroll-mt-20">
        <Card title={`Skill inventory · ${skills.length}`} subtitle={intel ? `Career engine v${intel.engineVersion}, computed ${date(intel.computedAt)}. Levels need evidence; a listed skill alone isn't assessed.` : "The career engine hasn't computed this student yet."} source="profile_views.view.intelligence">
          {skills.length === 0 ? <Empty>No skills recorded.</Empty> : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr><th className="py-2 px-4">Skill</th><th className="py-2 px-4">Level</th><th className="py-2 px-4 w-44">Proficiency</th><th className="py-2 px-4">Evidence</th><th className="py-2 px-4">Last evidence</th><th className="py-2 px-4">Next level</th></tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {skills.slice(0, 60).map((k) => {
                    const basis = evidenceBasisOf(k);
                    const v = verificationOfBasis(k.evidenceBasis, k.evidenceState);
                    return (
                      <tr key={k.name} className="align-top">
                        <td className="py-2.5 px-4 font-medium text-foreground">{k.name}<div className="text-[10px] text-muted-foreground">{k.kind ?? k.category}</div></td>
                        <td className="py-2.5 px-4 text-foreground">{k.proficiency === null ? <span className="text-muted-foreground italic">Not assessed</span> : k.level}</td>
                        <td className="py-2.5 px-4"><ScoreCell value={k.proficiency} color={v ? VERIFICATION_COLOR[v] : SLOT(0)} /></td>
                        <td className="py-2.5 px-4"><div className="text-foreground">{EVIDENCE_BASIS[basis].label}</div><div className="text-[10px] text-muted-foreground max-w-[260px]">{k.levelBasis?.[0] ?? `${k.evidenceCount} item(s)`}</div><VerificationBadge v={v} /></td>
                        <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">{date(k.lastEvidenceAt)}</td>
                        <td className="py-2.5 px-4 text-[11px] text-muted-foreground max-w-[240px]">{k.nextLevel ?? k.levelCap ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {skills.length > 60 && <p className="px-5 pt-2 text-[11px] text-muted-foreground">Top 60 by proficiency shown of {skills.length}.</p>}
            </div>
          )}
        </Card>
      </section>

      <section id="gaps" className="scroll-mt-20">
        <Card title="Priority skill gaps" subtitle={`Against ${s.goal.label ?? "the student's goal"} and their stated project, in the engine's priority order. Role frameworks are ${intel?.framework?.status ?? "draft"}: guidance, not an industry standard.`} source="Career engine gap inventory">
          {gaps.length === 0 ? <Empty>{intel ? "No open gaps for the chosen goal." : "Not computed yet."}</Empty> : (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-y border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                  <tr><th className="py-2 px-4">Skill</th><th className="py-2 px-4">Current</th><th className="py-2 px-4">Expected</th><th className="py-2 px-4 w-40">Progress to expected</th><th className="py-2 px-4">State</th><th className="py-2 px-4">Why / next step</th></tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {gaps.slice(0, 15).map((g) => (
                    <tr key={g.skill} className="align-top">
                      <td className="py-2.5 px-4 font-medium text-foreground">{g.skill}<div className="text-[10px] text-muted-foreground">{g.tier ?? ""} {g.priority ? `· ${g.priority} priority` : ""}</div></td>
                      <td className="py-2.5 px-4 text-foreground">{g.proficiency === null ? <span className="italic text-muted-foreground">Not shown</span> : `${g.level} (${fmt(g.proficiency)})`}</td>
                      <td className="py-2.5 px-4 text-foreground">{g.expectedLevel} ({fmt(g.expected)})</td>
                      <td className="py-2.5 px-4"><ScoreCell value={g.expected ? Math.min(100, ((g.proficiency ?? 0) / g.expected) * 100) : null} color={SLOT(1)} /></td>
                      <td className="py-2.5 px-4 text-foreground">{g.categoryLabel ?? categoryOf(g).replace(/_/g, " ")}</td>
                      <td className="py-2.5 px-4 text-[11px] text-muted-foreground max-w-[300px]">{g.whyItMatters ?? g.rationale ?? ""}{g.action ? <div className="text-foreground mt-0.5">{g.action}</div> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      <section id="code" className="grid grid-cols-1 lg:grid-cols-3 gap-6 scroll-mt-20">
        <Card title="Contribution activity" subtitle={s.github?.login ? `GitHub @${s.github.login}. Restricted (private) contributions are counted by GitHub but not itemised.` : undefined} source="github_contributions (OAuth)" className="lg:col-span-2">
          <ActivityCalendar days={s.github?.days ?? []} />
          {s.github?.totals && (
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              {(["commits", "pullRequests", "issues", "reviews", "repositories"] as const).map((k, i) => (
                <div key={k} className="rounded-lg border border-border p-2"><div className="text-lg font-extrabold tabular-nums" style={{ color: SLOT(i) }}>{fmt(Number(s.github!.totals![k] ?? 0))}</div><div className="text-[10px] text-muted-foreground capitalize">{k.replace(/([A-Z])/g, " $1")}</div></div>
              ))}
            </div>
          )}
        </Card>
        <Card title="Languages in code" subtitle="Share of bytes across synced repositories." source="code_repositories">
          <BarList colorBy="slot" unit="%" items={[...languages.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([l, b]) => ({ label: l, value: langTotal ? (b / langTotal) * 100 : 0 }))} />
        </Card>
        <Card title="Projects" subtitle="Merged from resume, profile and GitHub. Corroborated = matched to one of the student's repositories." source="unified_projects" className="lg:col-span-1">
          {s.projects.length === 0 ? <Empty>No projects recorded.</Empty> : (
            <ul className="space-y-2.5">
              {s.projects.slice(0, 12).map((p) => (
                <li key={p.title} className="text-xs">
                  <div className="flex items-center justify-between gap-2"><span className="font-medium text-foreground truncate">{p.title}</span><VerificationBadge v={p.status === "matched" ? "verified" : "self_reported"} /></div>
                  {p.technologies.length > 0 && <div className="text-[10px] text-muted-foreground truncate">{p.technologies.join(" · ")}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Repositories" subtitle="Impact is an AI judgement of each repository, shown with its rationale." source="code_repositories, github_scores" className="lg:col-span-2">
          {s.repos.length === 0 ? <Empty>No repositories synced.</Empty> : (
            <ul className="divide-y divide-border/60">
              {s.repos.slice(0, 10).map((r) => (
                <li key={r.name} className="py-2.5 flex items-start justify-between gap-4 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground flex items-center gap-1.5">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-primary inline-flex items-center gap-1">{r.name}<ExternalLink className="size-3" /></a> : r.name}</div>
                    {r.rationale && <div className="text-[11px] text-muted-foreground line-clamp-2">{r.rationale}</div>}
                    <div className="text-[10px] text-muted-foreground">★ {r.stars} · last commit {date(r.lastCommitAt)}</div>
                  </div>
                  <div className="w-28 shrink-0"><ScoreCell value={r.impact} color={VERIFICATION_COLOR.ai_assessed} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section id="credentials" className="grid grid-cols-1 lg:grid-cols-3 gap-6 scroll-mt-20">
        <Card title="Certifications" subtitle={`${certsVerified} verified · ${certsListed} listed on resume/profile`} source="learning_records, profile_facts">
          {s.learning.filter((l) => l.kind === "certification").length + certsListed === 0 ? <Empty>No certifications.</Empty> : (
            <ul className="space-y-2">
              {s.learning.filter((l) => l.kind === "certification").map((l) => (
                <li key={l.title} className="text-xs flex justify-between gap-2"><span className="text-foreground">{l.title}<span className="block text-[10px] text-muted-foreground">{l.provider ?? ""} {l.completedAt ? `· ${date(l.completedAt)}` : ""}</span></span><VerificationBadge v={l.verification === "verified" ? "verified" : "self_reported"} /></li>
              ))}
              {(s.facts.certifications ?? []).map((f) => (
                <li key={f.key} className="text-xs flex justify-between gap-2"><span className="text-foreground">{f.fields.name || "Untitled"}<span className="block text-[10px] text-muted-foreground">{[f.fields.issuer, f.fields.date].filter(Boolean).join(" · ")}</span></span><VerificationBadge v="self_reported" /></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Research & publications" subtitle={`${pubs.filter((p) => p.origin === "orcid").length} from ORCID · ${pubs.filter((p) => p.origin !== "orcid").length} listed`} source="profile_facts (publications)">
          {pubs.length === 0 ? <Empty>No publications. Patents and citation counts have no source yet.</Empty> : (
            <ul className="space-y-2">
              {pubs.map((p) => <li key={p.key} className="text-xs flex justify-between gap-2"><span className="text-foreground">{p.fields.title || "Untitled"}<span className="block text-[10px] text-muted-foreground">{[p.fields.venue, p.fields.date].filter(Boolean).join(" · ")}</span></span><VerificationBadge v={p.origin === "orcid" ? "external" : "self_reported"} /></li>)}
            </ul>
          )}
        </Card>
        <Card title="Achievements & academics" subtitle="Self-reported unless stated. There is no institution feed for CGPA or marks yet." source="profile_facts">
          <ul className="space-y-2">
            {(s.facts.education ?? []).map((e) => <li key={e.key} className="text-xs"><span className="text-foreground">{[e.fields.degree, e.fields.field_of_study].filter(Boolean).join(", ") || "Education"}</span><span className="block text-[10px] text-muted-foreground">{[e.fields.institution, e.fields.grade && `grade ${e.fields.grade}`, e.fields.end_date].filter(Boolean).join(" · ")}</span></li>)}
            {(s.facts.achievements ?? []).map((a) => <li key={a.key} className="text-xs"><span className="text-foreground">{a.fields.title || "Achievement"}</span><span className="block text-[10px] text-muted-foreground">{[a.fields.date, a.fields.description].filter(Boolean).join(" · ").slice(0, 140)}</span></li>)}
            {!(s.facts.education?.length || s.facts.achievements?.length) && <Empty>Nothing recorded.</Empty>}
          </ul>
        </Card>
      </section>

      <section id="career" className="grid grid-cols-1 lg:grid-cols-3 gap-6 scroll-mt-20">
        <Card title="Readiness by goal" subtitle="ERIS per career goal the student selected." source="eris_scores">
          <BarList colorBy="slot" max={100} items={s.eris.map((e) => ({ label: e.label, value: e.score, display: fmt(e.score) }))} />
        </Card>
        <Card title="Experience" subtitle="Self-reported internships and positions." source="profile_facts (experience)">
          {(s.facts.experience ?? []).length === 0 ? <Empty>None recorded.</Empty> : (
            <ul className="space-y-2">{(s.facts.experience ?? []).map((x) => <li key={x.key} className="text-xs"><span className="text-foreground">{x.fields.role || "Role"} · {x.fields.organization || "Organisation"}</span><span className="block text-[10px] text-muted-foreground">{[x.fields.start_date, x.fields.end_date].filter(Boolean).join(" – ")}</span></li>)}</ul>
          )}
        </Card>
        <Card title="Opportunity activity" subtitle="On AI Tathastu only. Avsar's application outcomes aren't shared back yet." source="opportunity_interactions">
          {s.opportunities.length === 0 ? <Empty>No application activity.</Empty> : (
            <ul className="space-y-2">{s.opportunities.slice(0, 10).map((o, i) => <li key={i} className="text-xs"><span className="text-foreground">{o.title}</span><span className="block text-[10px] text-muted-foreground">{o.organization} · {o.kind === "confirmed_applied" ? "confirmed applied" : "opened application"} · {date(o.at)}</span></li>)}</ul>
          )}
        </Card>
      </section>

      <section id="timeline" className="scroll-mt-20">
        <Card title="Activity timeline" subtitle="Dated records only, newest first. Nothing is synthesised." source="AI Tathastu records">
          {s.timeline.length === 0 ? <Empty>No dated activity.</Empty> : (
            <ol className="relative border-l border-border ml-2 space-y-3">
              {s.timeline.slice(0, 40).map((e, i) => (
                <li key={i} className="pl-4 relative">
                  <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full ring-2 ring-card" style={{ background: KIND_COLOR[e.kind] }} />
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs"><span className="font-mono text-[10px] text-muted-foreground">{date(e.at)}</span><span className="text-foreground font-medium">{e.title}</span><VerificationBadge v={e.verification} /></div>
                  <div className="text-[10px] text-muted-foreground truncate">{e.source}{e.detail ? ` · ${e.detail}` : ""}</div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </section>

      <section id="ecosystem" className="scroll-mt-20">
        <Card title="Ecosystem sources" subtitle="What each product contributes for this student today. Products without a data contract show that plainly instead of placeholder numbers.">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ECOSYSTEM.map((p, i) => {
              const consent = p.clientId ? s.integrations.find((x) => x.client === p.clientId) : null;
              const status = p.id === "ai_tathastu" ? "Source of this profile" : !p.integrated ? "No integration" : consent?.revokedAt ? "Disconnected by student" : consent?.linkedAt ? `Linked ${date(consent.linkedAt)}` : "Not linked";
              return (
                <div key={p.id} className="rounded-xl border border-border p-3" style={{ borderTop: `3px solid ${SLOT(i)}` }}>
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-foreground">{p.name}</span><span className="text-[10px] text-muted-foreground">{status}</span></div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{p.flow}</p>
                  {consent && !consent.revokedAt && <p className="mt-1 text-[10px] text-muted-foreground">Shared: {Object.entries(consent.scopes).filter(([, v]) => v).map(([k]) => k).join(", ") || "identity only"}</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">Connected sources: {s.connections.map((c) => `${c.source} (${c.status}${c.lastSyncAt ? `, ${date(c.lastSyncAt)}` : ""})`).join(", ") || "none"}.</p>
        </Card>
      </section>
    </div>
  );
}
