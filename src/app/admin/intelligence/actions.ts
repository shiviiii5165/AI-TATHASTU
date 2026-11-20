"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  intelligenceRankingProfiles as profiles,
  intelligenceRankingSnapshots as snapshots,
  intelligenceRankingVersions as versions,
} from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { loadCatalogue } from "@/lib/intelligence/catalogue";
import { cohortKey, getProfile, getVersion, isMissingTable, runRanking, stripEmpty, toSnapshotRows, validateDefinition } from "@/lib/intelligence/rankings";
import type { RankingDefinition } from "@/lib/intelligence/types";

type Result = { ok: true; id?: string; message?: string } | { ok: false; error: string };

const MISSING = "Student Intelligence storage isn't set up yet: apply migration 0032_student_intelligence.sql first.";

function sanitize(def: RankingDefinition): RankingDefinition {
  const n = (v: unknown, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Number(v) || 0));
  return {
    schema: 1,
    categories: (def.categories ?? []).slice(0, 50).map((c) => ({
      id: String(c.id).slice(0, 64),
      name: String(c.name ?? "").trim().slice(0, 80),
      weight: n(c.weight),
      benchmarks: (c.benchmarks ?? []).slice(0, 200).map((b) => ({
        key: String(b.key).slice(0, 128),
        weight: n(b.weight),
        normalization: (["percentile", "minmax", "absolute", "target"] as const).includes(b.normalization) ? b.normalization : "percentile",
        target: b.target !== undefined ? n(b.target, 0, 1e9) : undefined,
      })),
    })),
    cohort: stripEmpty(def.cohort ?? {}),
    eligibility: {
      minCoverage: n(def.eligibility?.minCoverage),
      requiredBenchmarks: (def.eligibility?.requiredBenchmarks ?? []).map(String).slice(0, 50),
      provisionalCoverage: def.eligibility?.provisionalCoverage === undefined ? 75 : n(def.eligibility.provisionalCoverage),
      minIndependentShare: def.eligibility?.minIndependentShare === undefined ? 50 : n(def.eligibility.minIndependentShare),
    },
    evidencePolicy: (["any", "exclude_self_reported", "verified_only"] as const).includes(def.evidencePolicy) ? def.evidencePolicy : "any",
    missingPolicy: def.missingPolicy === "zero" || def.missingPolicy === "renormalize" ? def.missingPolicy : "neutral",
  };
}

export interface PreviewResult {
  ok: boolean;
  error?: string;
  cohortSize: number;
  ranked: number;
  issues: string[];
  top: { userId: string; name: string; rank: number | null; score: number | null; coverage: number; categories: { name: string; score: number | null }[] }[];
  topReasons: { reason: string; students: number }[];
}

/** Runs an unsaved definition over live evidence. Nothing is stored. */
export async function previewRankingAction(input: RankingDefinition): Promise<PreviewResult> {
  await requireAdminPermission("intelligence.read");
  const definition = sanitize(input);
  const { byKey } = await loadCatalogue();
  const issues = validateDefinition(definition, new Set(byKey.keys())).map((i) => i.message);
  if (definition.categories.length === 0 || definition.categories.every((c) => c.benchmarks.length === 0))
    return { ok: false, error: "Add at least one benchmark to preview.", cohortSize: 0, ranked: 0, issues, top: [], topReasons: [] };
  const run = await runRanking(definition);
  const names = new Map(run.cohort.map((s) => [s.id, s.name || s.email || "Unnamed student"]));
  const reasons = new Map<string, number>();
  for (const r of run.results) for (const why of r.ineligibleReasons) {
    const k = why.replace(/\d+(\.\d+)?%/g, "N%");
    reasons.set(k, (reasons.get(k) ?? 0) + 1);
  }
  return {
    ok: true,
    cohortSize: run.results.length,
    ranked: run.results.filter((r) => r.eligible).length,
    issues,
    top: run.results.filter((r) => r.eligible).slice(0, 10).map((r) => ({
      userId: r.userId, name: names.get(r.userId) ?? "", rank: r.rank, score: r.score, coverage: r.coverage,
      categories: r.categories.map((c) => ({ name: c.name, score: c.score })),
    })),
    topReasons: [...reasons.entries()].map(([reason, students]) => ({ reason, students })).sort((a, b) => b.students - a.students).slice(0, 4),
  };
}

export async function saveRankingDraftAction(input: { id?: string; name: string; description?: string; definition: RankingDefinition }): Promise<Result> {
  const ctx = await requireAdminPermission("intelligence.manage");
  const email = ctx.user.email || "admin";
  const name = input.name.trim().slice(0, 120);
  if (!name) return { ok: false, error: "Give the ranking a name." };
  const definition = sanitize(input.definition);
  try {
    if (input.id) {
      const existing = await getProfile(input.id);
      if (!existing) return { ok: false, error: "Ranking not found." };
      if (existing.status === "archived") return { ok: false, error: "Restore the ranking before editing it." };
      await db.update(profiles).set({ name, description: input.description?.trim() || null, definition, updatedByEmail: email, updatedAt: new Date() }).where(eq(profiles.id, input.id));
      await recordAdminAudit({ actorId: ctx.user.id, actorEmail: email, action: "intelligence.ranking_save", resource: "intelligence_ranking", targetId: input.id });
      revalidatePath("/admin/intelligence", "layout");
      return { ok: true, id: input.id, message: "Draft saved. Published versions are unchanged until you publish." };
    }
    const [row] = await db.insert(profiles).values({ name, description: input.description?.trim() || null, definition, createdByEmail: email, updatedByEmail: email }).returning({ id: profiles.id });
    await recordAdminAudit({ actorId: ctx.user.id, actorEmail: email, action: "intelligence.ranking_create", resource: "intelligence_ranking", targetId: row.id });
    revalidatePath("/admin/intelligence", "layout");
    return { ok: true, id: row.id, message: "Draft created." };
  } catch (err) {
    return { ok: false, error: isMissingTable(err) ? MISSING : err instanceof Error ? err.message : "Save failed." };
  }
}

/** Freezes the current draft as the next immutable version. Refused when weights don't total 100%. */
export async function publishRankingAction(id: string): Promise<Result> {
  const ctx = await requireAdminPermission("intelligence.manage");
  const email = ctx.user.email || "admin";
  try {
    const profile = await getProfile(id);
    if (!profile) return { ok: false, error: "Ranking not found." };
    const { byKey } = await loadCatalogue();
    const issues = validateDefinition(profile.definition, new Set(byKey.keys()));
    if (issues.length) return { ok: false, error: `Can't publish: ${issues[0].message}` };
    const version = profile.publishedVersion + 1;
    await db.batch([
      db.insert(versions).values({ profileId: id, version, definition: profile.definition, publishedByEmail: email }),
      db.update(profiles).set({ status: "published", publishedVersion: version, updatedByEmail: email, updatedAt: new Date() }).where(eq(profiles.id, id)),
    ]);
    await recordAdminAudit({ actorId: ctx.user.id, actorEmail: email, action: "intelligence.ranking_publish", resource: "intelligence_ranking", targetId: id, details: { version } });
    revalidatePath("/admin/intelligence", "layout");
    return { ok: true, id, message: `Published as version ${version}.` };
  } catch (err) {
    return { ok: false, error: isMissingTable(err) ? MISSING : err instanceof Error ? err.message : "Publish failed." };
  }
}

export async function duplicateRankingAction(id: string): Promise<Result> {
  const ctx = await requireAdminPermission("intelligence.manage");
  const email = ctx.user.email || "admin";
  try {
    const profile = await getProfile(id);
    if (!profile) return { ok: false, error: "Ranking not found." };
    const [row] = await db.insert(profiles).values({
      name: `${profile.name} (copy)`.slice(0, 120), description: profile.description, definition: profile.definition, createdByEmail: email, updatedByEmail: email,
    }).returning({ id: profiles.id });
    await recordAdminAudit({ actorId: ctx.user.id, actorEmail: email, action: "intelligence.ranking_duplicate", resource: "intelligence_ranking", targetId: row.id, details: { from: id } });
    revalidatePath("/admin/intelligence", "layout");
    return { ok: true, id: row.id, message: "Copy created as a draft." };
  } catch (err) {
    return { ok: false, error: isMissingTable(err) ? MISSING : err instanceof Error ? err.message : "Duplicate failed." };
  }
}

export async function setRankingArchivedAction(id: string, archived: boolean): Promise<Result> {
  const ctx = await requireAdminPermission("intelligence.manage");
  const email = ctx.user.email || "admin";
  try {
    const profile = await getProfile(id);
    if (!profile) return { ok: false, error: "Ranking not found." };
    const status = archived ? "archived" : profile.publishedVersion > 0 ? "published" : "draft";
    await db.update(profiles).set({ status, updatedByEmail: email, updatedAt: new Date() }).where(eq(profiles.id, id));
    await recordAdminAudit({ actorId: ctx.user.id, actorEmail: email, action: archived ? "intelligence.ranking_archive" : "intelligence.ranking_restore", resource: "intelligence_ranking", targetId: id });
    revalidatePath("/admin/intelligence", "layout");
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: isMissingTable(err) ? MISSING : err instanceof Error ? err.message : "Update failed." };
  }
}

/** Runs the latest published version over a cohort and freezes the result: the baseline for later rank movement. */
export async function takeSnapshotAction(id: string, cohort: Record<string, string>): Promise<Result> {
  const ctx = await requireAdminPermission("intelligence.manage");
  const email = ctx.user.email || "admin";
  try {
    const profile = await getProfile(id);
    if (!profile) return { ok: false, error: "Ranking not found." };
    if (profile.publishedVersion === 0) return { ok: false, error: "Publish the ranking before taking a snapshot." };
    const ver = await getVersion(id, profile.publishedVersion);
    if (!ver) return { ok: false, error: "The published version is missing." };
    const extra = stripEmpty(cohort);
    const run = await runRanking(ver.definition, extra);
    const fullCohort = { ...stripEmpty(ver.definition.cohort as Record<string, string>), ...extra } as Record<string, string>;
    const rows = toSnapshotRows(run.results);
    await db.insert(snapshots).values({
      profileId: id, version: ver.version, cohort: fullCohort, cohortKey: cohortKey(fullCohort),
      rankedCount: rows.filter((r) => r.eligible).length, ineligibleCount: rows.filter((r) => !r.eligible).length,
      results: rows, computedByEmail: email,
    });
    await recordAdminAudit({ actorId: ctx.user.id, actorEmail: email, action: "intelligence.ranking_snapshot", resource: "intelligence_ranking", targetId: id, details: { version: ver.version, cohort: fullCohort, students: rows.length } });
    revalidatePath("/admin/intelligence", "layout");
    return { ok: true, id, message: `Snapshot saved: ${rows.filter((r) => r.eligible).length} ranked, ${rows.filter((r) => !r.eligible).length} not eligible.` };
  } catch (err) {
    return { ok: false, error: isMissingTable(err) ? MISSING : err instanceof Error ? err.message : "Snapshot failed." };
  }
}

/**
 * Records a reviewer's decision on the current career-intelligence framework, one of its role profiles or an open
 * research question (workstream D). Insert-only and audit-logged. It documents the review; publishing a reviewed
 * framework (status, reviewedBy) remains a versioned code change, so assessments never change under a student silently.
 */
export async function recordFrameworkReviewAction(input: { role?: string | null; questionId?: string | null; decision: string; note: string }): Promise<Result> {
  const ctx = await requireAdminPermission("intelligence.manage");
  const { FRAMEWORK, isCurrentRole, openQuestionIds, recordReview } = await import("@/lib/intelligence/frameworks");
  const decisions = ["approved", "changes_requested", "question_resolved", "question_deferred"] as const;
  const decision = decisions.find((d) => d === input?.decision);
  const note = String(input?.note ?? "").trim().slice(0, 2000);
  const role = input?.role ? String(input.role) : null;
  const questionId = input?.questionId ? String(input.questionId) : null;
  if (!decision) return { ok: false, error: "Choose a decision." };
  if (note.length < 10) return { ok: false, error: "Say what you checked (at least 10 characters). The note is the record of the review." };
  if (role && !isCurrentRole(role)) return { ok: false, error: "Unknown role." };
  if (questionId && !openQuestionIds().includes(questionId)) return { ok: false, error: "Unknown research question." };
  if (decision.startsWith("question_") !== Boolean(questionId)) return { ok: false, error: "Question decisions need a question; role and framework decisions must not have one." };
  const saved = await recordReview({
    version: FRAMEWORK.frameworkVersion, role, questionId, decision, note, reviewerId: ctx.user.id, reviewerEmail: ctx.user.email ?? "unknown",
  });
  if (!saved.ok) return saved;
  await recordAdminAudit({
    actorId: ctx.user.id, actorEmail: ctx.user.email ?? "unknown", action: "framework.review", resource: "career_frameworks",
    details: { version: FRAMEWORK.frameworkVersion, role, questionId, decision },
  });
  revalidatePath("/admin/intelligence/frameworks");
  return { ok: true, message: "Review recorded." };
}
