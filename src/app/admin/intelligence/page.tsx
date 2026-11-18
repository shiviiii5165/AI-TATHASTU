import { BarList, Card, Columns, Donut, Kpi, SLOT, VERIFICATION_COLOR } from "@/components/admin/intelligence/charts";
import { CohortFilters } from "@/components/admin/intelligence/cohort-filters";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { loadCohortOptions, loadOverview } from "@/lib/intelligence/overview";
import { stripEmpty } from "@/lib/intelligence/rankings";
import { type CohortFilter, VERIFICATION_LABEL, VERIFICATION_ORDER } from "@/lib/intelligence/types";

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const fmt = (n: number) => n.toLocaleString("en-IN");

export default async function IntelligenceOverviewPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPermission("intelligence.read");
  const params = await searchParams;
  const cohort = stripEmpty(params as CohortFilter);
  const [o, options] = await Promise.all([loadOverview(cohort), loadCohortOptions()]);
  const T = o.totals;
  const families = [...new Set(o.coverage.map((c) => c.def.family))];

  return (
    <div className="space-y-6">
      <CohortFilters action="/admin/intelligence" options={options} values={params} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Students" value={fmt(T.students)} sub={`${fmt(T.newLast30)} joined in the last 30 days`} color={SLOT(0)} />
        <Kpi label="Engine-assessed" value={fmt(T.withIntelligence)} sub={`${pct(T.withIntelligence, T.students)} have a computed intelligence profile`} color={SLOT(2)} />
        <Kpi label="Rank-ready evidence" value={fmt(T.rankable)} sub="Students with 3+ benchmark values" color={SLOT(6)} />
        <Kpi label="Connected a source" value={fmt(T.withConnectedSource)} sub={`${fmt(T.withGithub)} with a synced GitHub calendar · ${fmt(T.withResume)} uploaded a resume`} color={SLOT(1)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Evidence coverage by benchmark" subtitle="How many students in this cohort have a value for each measurement. Low coverage means a benchmark can't rank many students fairly yet." source="Evidence tables, live">
          <div className="space-y-5">
            {families.map((fam, fi) => (
              <div key={fam}>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{fam}</div>
                <BarList color={SLOT(fi)} max={Math.max(T.students, 1)}
                  items={o.coverage.filter((c) => c.def.family === fam).map((c) => ({ label: c.def.label, value: c.students, display: `${fmt(c.students)} · ${pct(c.students, T.students)}` }))} />
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="How the evidence was obtained" subtitle="Every benchmark value by verification level. Rankings can exclude self-reported or AI-assessed evidence." source="All benchmark values in this cohort">
            <Donut
              items={VERIFICATION_ORDER.map((v) => ({ label: VERIFICATION_LABEL[v], value: o.verificationMix.find((m) => m.verification === v)?.values ?? 0, color: VERIFICATION_COLOR[v] }))}
              center={fmt(o.verificationMix.reduce((s, m) => s + m.values, 0))}
              sub="Values, not students: one student contributes one value per benchmark."
            />
          </Card>
          <Card title="Most demonstrated skills" subtitle={`Students rated Working or above by the career engine. Drawn from ${fmt(o.skillCount)} skills in the skill graph; no fixed list.`} source="profile_views (career engine)">
            <BarList colorBy="slot" items={o.skillLeaders.map((s) => ({ label: s.label, value: s.students, display: `${fmt(s.students)} · avg ${Math.round(s.mean)}` }))} />
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="ERIS readiness distribution" subtitle="Readiness for each student's primary goal, 0–100. Students without enough evidence have no score and aren't plotted." source="eris_scores" className="lg:col-span-2">
          <Columns items={o.erisHistogram.map((b) => ({ label: b.bucket, value: b.students }))} color={SLOT(6)} unit=" students" />
        </Card>
        <Card title="Intelligence freshness" subtitle="Time since each student's profile was last recomputed." source="profile_views.updated_at">
          <BarList colorBy="slot" items={o.freshness.map((f) => ({ label: f.label, value: f.students }))} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Institutions" subtitle="Top institutions by students in this cohort." source="users, institutions">
          <BarList color={SLOT(0)} items={o.byInstitution.map((r) => ({ label: r.label, value: r.students }))} />
        </Card>
        <Card title="Career goals" subtitle="Primary goal chosen at onboarding." source="onboarding_state">
          <BarList color={SLOT(2)} items={o.byGoal.map((r) => ({ label: r.label, value: r.students }))} />
        </Card>
        <Card title="Academic year" source="users">
          <BarList color={SLOT(3)} items={o.byYear.map((r) => ({ label: r.label, value: r.students }))} />
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Registrations, last 12 months" subtitle="New student accounts per month." source="users.created_at" className="lg:col-span-2">
          <Columns items={o.registrations.map((r) => ({ label: r.month.slice(2), value: r.students }))} color={SLOT(0)} unit=" students" />
        </Card>
        <Card title="Connected sources" subtitle="Students with each connector linked." source="connections">
          <BarList colorBy="slot" items={o.connectors.map((r) => ({ label: r.label, value: r.students }))} />
        </Card>
      </div>
    </div>
  );
}
