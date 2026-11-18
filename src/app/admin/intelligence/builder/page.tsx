import { RankingBuilder } from "@/components/admin/intelligence/ranking-builder";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { loadCatalogue, loadSignals } from "@/lib/intelligence/catalogue";
import { loadCohortOptions } from "@/lib/intelligence/overview";
import { getProfile, listProfiles } from "@/lib/intelligence/rankings";

export default async function BuilderPage({ searchParams }: { searchParams: Promise<{ id?: string; preset?: string }> }) {
  await requireAdminPermission("intelligence.manage");
  const { id, preset } = await searchParams;
  const [{ list, skills }, options, state, profile] = await Promise.all([loadCatalogue(), loadCohortOptions(), listProfiles(), id ? getProfile(id) : null]);
  const signals = await loadSignals({}, skills);
  const coverage: Record<string, number> = {};
  for (const row of signals.values()) for (const k of row.keys()) coverage[k] = (coverage[k] ?? 0) + 1;

  if (!state.available) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-foreground">
        The Ranking Builder stores rankings in the tables added by migration <span className="font-mono">0032_student_intelligence.sql</span>. Apply it (see DEPLOYMENT.md, “Migrations”) and reload.
      </div>
    );
  }

  // "Rank by this" from the catalogue: a one-benchmark starting point (e.g. Top 20 by one skill). Still fully editable.
  const seed = !profile && preset ? list.find((b) => b.key === preset) : undefined;
  const presetInitial = seed
    ? {
        id: "", name: `Top students · ${seed.label}`, description: "", status: "draft", publishedVersion: 0,
        definition: {
          schema: 1 as const,
          categories: [{ id: "c1", name: seed.label, weight: 100, benchmarks: [{ key: seed.key, weight: 100, normalization: seed.defaultNormalization, target: seed.defaultTarget }] }],
          cohort: {}, eligibility: { minCoverage: 100, requiredBenchmarks: [seed.key] }, evidencePolicy: "any" as const, missingPolicy: "neutral" as const,
        },
      }
    : null;

  return (
    <RankingBuilder
      catalogue={list.map((b) => ({ key: b.key, label: b.label, family: b.family, description: b.description, unit: b.unit, verification: b.verification, defaultNormalization: b.defaultNormalization, defaultTarget: b.defaultTarget, scale: b.scale, students: coverage[b.key] ?? 0 }))}
      totalStudents={signals.size}
      options={options}
      initial={profile ? { id: profile.id, name: profile.name, description: profile.description ?? "", status: profile.status, publishedVersion: profile.publishedVersion, definition: profile.definition } : presetInitial}
    />
  );
}
