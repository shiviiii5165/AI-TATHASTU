// AVSAR Collaborations (migration 0034). Writes that must be atomic across rows (apply, accept/reject, leave/remove)
// go through the SQL functions in that migration; see src/lib/collaborations/service.ts.
import { sql } from "drizzle-orm";
import { boolean, customType, date, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { users } from "./schema";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const COLLAB_CATEGORIES = ["project", "hackathon", "research", "learning_group"] as const;
export const COLLAB_STATUSES = ["draft", "recruiting", "paused", "team_full", "in_progress", "completed", "closed", "expired", "suspended"] as const;
export const COLLAB_STAGES = ["idea", "planning", "prototype", "building", "launched"] as const;
export const COLLAB_MODES = ["remote", "hybrid", "in_person"] as const;
export const COLLAB_CREATOR_TYPES = ["student", "faculty", "alumni", "admin", "community"] as const;

export type CollabCategory = (typeof COLLAB_CATEGORIES)[number];
export type CollabStatus = (typeof COLLAB_STATUSES)[number];
export type CollabStage = (typeof COLLAB_STAGES)[number];
export type CollabMode = (typeof COLLAB_MODES)[number];
export type CollabCreatorType = (typeof COLLAB_CREATOR_TYPES)[number];
export type CollabRole = { title: string; count: number; skills: string[] };

/** Faculty/alumni status for publishing, granted by an operator. The persona chosen at sign-up never counts. */
export const collabCreatorVerifications = pgTable("collab_creator_verifications", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").$type<"faculty" | "alumni">().notNull(),
  note: text("note"),
  verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const collabPosts = pgTable(
  "collab_posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    creatorType: text("creator_type").$type<CollabCreatorType>().notNull(),
    category: text("category").$type<CollabCategory>().notNull(),
    status: text("status").$type<CollabStatus>().notNull().default("draft"),
    statusBeforeSuspension: text("status_before_suspension").$type<CollabStatus>(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    problem: text("problem").notNull().default(""),
    objectives: text("objectives").notNull().default(""),
    outcome: text("outcome").notNull().default(""),
    stage: text("stage").$type<CollabStage>().notNull().default("idea"),
    roles: jsonb("roles").$type<CollabRole[]>().notNull().default([]),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    capacity: integer("capacity").notNull().default(1),
    experience: text("experience").notNull().default(""),
    commitment: text("commitment").notNull().default(""),
    duration: text("duration").notNull().default(""),
    mode: text("mode").$type<CollabMode>().notNull().default("remote"),
    location: text("location"),
    startDate: date("start_date"),
    deadline: date("deadline"),
    links: jsonb("links").$type<string[]>().notNull().default([]),
    details: jsonb("details").$type<Record<string, string>>().notNull().default({}),
    contentHash: text("content_hash"),
    search: tsvector("search").generatedAlwaysAs(
      sql`to_tsvector('simple'::regconfig, coalesce("title", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("problem", ''))`,
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    renewedAt: timestamp("renewed_at", { withTimezone: true }),
    reminderStage: integer("reminder_stage").notNull().default(0),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    ownerActiveAt: timestamp("owner_active_at", { withTimezone: true }).notNull().defaultNow(),
    needsOwnerReview: boolean("needs_owner_review").notNull().default(false),
    ownerReviewReason: text("owner_review_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("collab_posts_discover_idx").on(t.status, t.category, t.publishedAt),
    index("collab_posts_owner_idx").on(t.ownerId, t.status),
  ],
);

export const collabMembers = pgTable(
  "collab_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => collabPosts.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"owner" | "member">().notNull().default("member"),
    role: text("role"),
    status: text("status").$type<"active" | "left" | "removed">().notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    endedBy: uuid("ended_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("collab_members_active_key").on(t.postId, t.userId).where(sql`"status" = 'active'`),
    index("collab_members_user_idx").on(t.userId, t.status),
  ],
);

export const collabApplications = pgTable(
  "collab_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").notNull().references(() => collabPosts.id, { onDelete: "cascade" }),
    applicantId: uuid("applicant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: text("role"),
    intro: text("intro").notNull(),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    motivation: text("motivation").notNull(),
    links: jsonb("links").$type<string[]>().notNull().default([]),
    status: text("status").$type<"pending" | "accepted" | "rejected" | "withdrawn">().notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("collab_applications_pending_key").on(t.postId, t.applicantId).where(sql`"status" = 'pending'`),
    index("collab_applications_post_idx").on(t.postId, t.status, t.createdAt),
    index("collab_applications_applicant_idx").on(t.applicantId, t.createdAt),
  ],
);

export const collabBlocks = pgTable(
  "collab_blocks",
  {
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedId: uuid("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: "collab_blocks_pk", columns: [t.ownerId, t.blockedId] })],
);

export const collabThreads = pgTable("collab_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => collabPosts.id, { onDelete: "cascade" }),
  kind: text("kind").$type<"team" | "enquiry">().notNull(),
  enquirerId: uuid("enquirer_id").references(() => users.id, { onDelete: "cascade" }),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collabMessages = pgTable(
  "collab_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id").notNull().references(() => collabThreads.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    hiddenBy: uuid("hidden_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("collab_messages_thread_idx").on(t.threadId, t.createdAt)],
);

export const collabReads = pgTable(
  "collab_reads",
  {
    threadId: uuid("thread_id").notNull().references(() => collabThreads.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ name: "collab_reads_pk", columns: [t.threadId, t.userId] })],
);

export const collabNotifications = pgTable(
  "collab_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    postId: uuid("post_id").references(() => collabPosts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("collab_notifications_user_idx").on(t.userId, t.createdAt)],
);

export const COLLAB_REPORT_REASONS = ["spam", "fraud", "harassment", "inappropriate", "other"] as const;
export type CollabReportReason = (typeof COLLAB_REPORT_REASONS)[number];

export const collabReports = pgTable("collab_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }),
  targetType: text("target_type").$type<"post" | "message" | "thread">().notNull(),
  targetId: uuid("target_id").notNull(),
  postId: uuid("post_id").references(() => collabPosts.id, { onDelete: "cascade" }),
  reason: text("reason").$type<CollabReportReason>().notNull(),
  details: text("details").notNull().default(""),
  status: text("status").$type<"open" | "actioned" | "dismissed">().notNull().default("open"),
  resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolution: text("resolution"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const collabModerationActions = pgTable("collab_moderation_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").references(() => collabPosts.id, { onDelete: "set null" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  actorEmail: text("actor_email").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  fromOwnerId: uuid("from_owner_id"),
  toOwnerId: uuid("to_owner_id"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CollabPost = typeof collabPosts.$inferSelect;
export type CollabApplication = typeof collabApplications.$inferSelect;
