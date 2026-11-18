import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { csvCell } from "@/lib/intelligence/csv";
import { runRanking, stripEmpty } from "@/lib/intelligence/rankings";
import { resolveRanking } from "@/lib/intelligence/resolve";
import type { CohortFilter } from "@/lib/intelligence/types";

const COHORT_KEYS = ["institutionId", "degreeId", "specializationId", "academicYear", "graduationYear", "careerRole"] as const;

export async function GET(req: Request) {
  const ctx = await requireAdminPermission("intelligence.export");
  const url = new URL(req.url);
  const p = Object.fromEntries(url.searchParams.entries());
  const extra = stripEmpty(Object.fromEntries(COHORT_KEYS.map((k) => [k, p[k]])) as CohortFilter);
  const ranking = await resolveRanking(p.r);
  const run = await runRanking(ranking.definition, extra);
  const students = new Map(run.cohort.map((s) => [s.id, s]));
  const cats = run.definition.categories;

  const header = ["rank", "student_id", "name", "email", "institution", "degree", "academic_year", "score", "coverage_pct", "eligible", "reason", ...cats.map((c) => `${c.name} (${c.weight}%)`)];
  const lines = [header.map(csvCell).join(",")];
  for (const r of run.results) {
    const s = students.get(r.userId);
    lines.push([
      r.rank ?? "", r.userId, s?.name ?? "", s?.email ?? "", s?.university ?? "", s?.degree ?? "", s?.academicYear ?? "",
      r.score ?? "", r.coverage, r.eligible ? "yes" : "no", r.ineligibleReasons.join(" "),
      ...r.categories.map((c) => c.score ?? ""),
    ].map(csvCell).join(","));
  }

  await recordAdminAudit({
    actorId: ctx.user.id, actorEmail: ctx.user.email || "admin", action: "intelligence.ranking_export", resource: "intelligence_ranking",
    targetId: ranking.id === "auto" ? undefined : ranking.id, details: { mode: ranking.mode, version: ranking.version, cohort: extra, rows: run.results.length },
  });

  const name = `ranking-${ranking.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
