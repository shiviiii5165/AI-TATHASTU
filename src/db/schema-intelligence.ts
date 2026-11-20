import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

import type { RankingDefinition, SnapshotRow } from "@/lib/intelligence/types";

// ─── STUDENT INTELLIGENCE (admin rankings) ──────────────────────────────────
// Migration 0032. Additive only: nothing here changes an existing table.
// The benchmark catalogue is not stored: benchmarks are measurements over the
// evidence tables (src/lib/intelligence/benchmarks.ts), and skill benchmarks
// come from the `skills` table at read time, so a new skill needs no change here.

export type RankingStatus = "draft" | "published" | "archived";

/** An admin-defined ranking. `definition` is the editable working copy; published versions are immutable rows below. */
export const intelligenceRankingProfiles = pgTable(
  "intelligence_ranking_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").$type<RankingStatus>().notNull().default("draft"),
    definition: jsonb("definition").$type<RankingDefinition>().notNull(),
    /** Latest published version number; 0 = never published. */
    publishedVersion: integer("published_version").notNull().default(0),
    createdByEmail: text("created_by_email").notNull(),
    updatedByEmail: text("updated_by_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("intelligence_ranking_profiles_status_idx").on(t.status, t.updatedAt)],
);

/** Every published definition, never updated: a published ranking can always be recomputed exactly as it was. */
export const intelligenceRankingVersions = pgTable(
  "intelligence_ranking_versions",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => intelligenceRankingProfiles.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    definition: jsonb("definition").$type<RankingDefinition>().notNull(),
    publishedByEmail: text("published_by_email").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.profileId, t.version] })],
);

/** A frozen run of one published version over one cohort. Rank movement is measured against these, never invented. */
export const intelligenceRankingSnapshots = pgTable(
  "intelligence_ranking_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => intelligenceRankingProfiles.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    cohort: jsonb("cohort").$type<Record<string, string>>().notNull().default({}),
    /** Hash of the cohort filter: movement compares snapshots of the same version and cohort only. */
    cohortKey: text("cohort_key").notNull(),
    rankedCount: integer("ranked_count").notNull(),
    ineligibleCount: integer("ineligible_count").notNull(),
    results: jsonb("results").$type<SnapshotRow[]>().notNull(),
    computedByEmail: text("computed_by_email").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("intelligence_ranking_snapshots_lookup_idx").on(t.profileId, t.version, t.cohortKey, t.computedAt)],
);

export type IntelligenceRankingProfile = typeof intelligenceRankingProfiles.$inferSelect;
export type IntelligenceRankingSnapshot = typeof intelligenceRankingSnapshots.$inferSelect;

// ─── CAREER INTELLIGENCE HISTORY AND FRAMEWORK GOVERNANCE (migration 0035) ───
// Both tables are insert-only (a database trigger refuses UPDATE).

/** One row per changed career-intelligence assessment, written by the worker (worker/intelligence/compute.py). */
export const intelligenceSnapshots = pgTable(
  "intelligence_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
    engineVersion: integer("engine_version").notNull(),
    frameworkVersion: text("framework_version"),
    fingerprint: text("fingerprint").notNull(),
    trigger: text("trigger"),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
    changes: jsonb("changes").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("intelligence_snapshots_user_idx").on(t.userId, t.computedAt)],
);

export type FrameworkReviewDecision = "approved" | "changes_requested" | "question_resolved" | "question_deferred";

/** Reviewers' decisions on a framework version, a role profile or an open research question. */
export const frameworkReviews = pgTable(
  "framework_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    frameworkVersion: text("framework_version").notNull(),
    role: text("role"),
    questionId: text("question_id"),
    decision: text("decision").$type<FrameworkReviewDecision>().notNull(),
    note: text("note").notNull(),
    reviewerId: uuid("reviewer_id"),
    reviewerEmail: text("reviewer_email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("framework_reviews_version_idx").on(t.frameworkVersion, t.role, t.createdAt)],
);
