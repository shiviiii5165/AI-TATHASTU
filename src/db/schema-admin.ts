import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./schema";

// ─── ADMIN TEAM & RBAC ──────────────────────────────────────────────────────

export const ADMIN_ROLES = [
  "super_admin",
  "support_admin",
  "support_agent",
  "ai_ops",
  "finance_admin",
  "content_editor",
  "security_auditor",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const adminTeamMembers = pgTable(
  "admin_team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<AdminRole>().notNull().default("support_agent"),
    customPermissions: jsonb("custom_permissions").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(true),
    department: text("department"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("admin_team_members_user_id_key").on(t.userId),
    index("admin_team_members_role_idx").on(t.role),
  ]
);

export type AdminTeamMember = typeof adminTeamMembers.$inferSelect;

// ─── ADMIN AUDIT LOGS ───────────────────────────────────────────────────────

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email").notNull(),
    action: text("action").notNull(),
    resource: text("resource").notNull(),
    targetId: text("target_id"),
    details: jsonb("details").$type<Record<string, unknown>>().default({}),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("admin_audit_logs_actor_idx").on(t.actorId),
    index("admin_audit_logs_resource_idx").on(t.resource),
    index("admin_audit_logs_created_at_idx").on(t.createdAt),
  ]
);

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;

// ─── SUPPORT TICKETS & MESSAGES ─────────────────────────────────────────────

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = [
  "new",
  "open",
  "in_progress",
  "waiting_student",
  "waiting_engineering",
  "escalated",
  "resolved",
  "closed",
  "reopened",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketNumber: text("ticket_number").notNull(),
    requesterId: uuid("requester_id").references(() => users.id, { onDelete: "set null" }),
    requesterEmail: text("requester_email").notNull(),
    requesterName: text("requester_name"),
    subject: text("subject").notNull(),
    category: text("category").notNull().default("general"),
    priority: text("priority").$type<TicketPriority>().notNull().default("medium"),
    status: text("status").$type<TicketStatus>().notNull().default("new"),
    assignedToId: uuid("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
    sourceChannel: text("source_channel").notNull().default("web"),
    firstResponseDueAt: timestamp("first_response_due_at", { withTimezone: true }),
    resolutionDueAt: timestamp("resolution_due_at", { withTimezone: true }),
    firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    resolutionNotes: text("resolution_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("support_tickets_number_key").on(t.ticketNumber),
    index("support_tickets_status_priority_idx").on(t.status, t.priority),
    index("support_tickets_assigned_to_idx").on(t.assignedToId),
    index("support_tickets_requester_idx").on(t.requesterEmail),
  ]
);

export type SupportTicket = typeof supportTickets.$inferSelect;

export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name"),
    authorEmail: text("author_email"),
    isInternalNote: boolean("is_internal_note").notNull().default(false),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("support_messages_ticket_idx").on(t.ticketId, t.createdAt),
    index("support_messages_internal_idx").on(t.ticketId, t.isInternalNote),
  ]
);

export type SupportMessage = typeof supportMessages.$inferSelect;

// ─── EMAIL TEMPLATE STUDIO & OUTBOX ─────────────────────────────────────────

export const TEMPLATE_STATUSES = ["draft", "in_review", "approved", "published", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull().default("account"),
    description: text("description"),
    subject: text("subject").notNull(),
    preheader: text("preheader"),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body").notNull(),
    variables: jsonb("variables").$type<string[]>().notNull().default([]),
    version: integer("version").notNull().default(1),
    status: text("status").$type<TemplateStatus>().notNull().default("published"),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("email_templates_slug_key").on(t.slug),
    index("email_templates_category_idx").on(t.category),
  ]
);

export type EmailTemplate = typeof emailTemplates.$inferSelect;

export const emailTemplateVersions = pgTable(
  "email_template_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => emailTemplates.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    subject: text("subject").notNull(),
    preheader: text("preheader"),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body").notNull(),
    variables: jsonb("variables").$type<string[]>().notNull().default([]),
    changeNotes: text("change_notes"),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("email_template_versions_unique_key").on(t.templateId, t.versionNumber),
  ]
);

export type EmailTemplateVersion = typeof emailTemplateVersions.$inferSelect;

export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateSlug: text("template_slug"),
    recipient: text("recipient").notNull(),
    senderProfile: text("sender_profile").notNull().default("support"),
    subject: text("subject").notNull(),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body").notNull(),
    status: text("status").notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lastError: text("last_error"),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    index("email_deliveries_status_due_idx").on(t.status, t.nextAttemptAt),
    index("email_deliveries_recipient_idx").on(t.recipient),
  ]
);

export type EmailDelivery = typeof emailDeliveries.$inferSelect;

// ─── AI OBSERVABILITY & COST BUDGETS ────────────────────────────────────────

export const aiProviderTelemetry = pgTable(
  "ai_provider_telemetry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(), // "groq" | "gemini" | "openrouter"
    model: text("model").notNull(),
    healthStatus: text("health_status").notNull().default("healthy"),
    latencyMs: integer("latency_ms").notNull().default(0),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    costEstimateUsd: numeric("cost_estimate_usd", { precision: 10, scale: 6 }).notNull().default("0.000000"),
    isError: boolean("is_error").notNull().default(false),
    errorMessage: text("error_message"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_provider_telemetry_provider_model_idx").on(t.provider, t.model),
    index("ai_provider_telemetry_timestamp_idx").on(t.timestamp),
  ]
);

export type AiProviderTelemetry = typeof aiProviderTelemetry.$inferSelect;

export const aiCostBudgets = pgTable(
  "ai_cost_budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    period: text("period").notNull().default("monthly"),
    budgetUsd: numeric("budget_usd", { precision: 10, scale: 2 }).notNull().default("100.00"),
    spentUsd: numeric("spent_usd", { precision: 10, scale: 2 }).notNull().default("0.00"),
    warningThresholdPercent: integer("warning_threshold_percent").notNull().default(80),
    criticalThresholdPercent: integer("critical_threshold_percent").notNull().default(95),
    hardLimitEnabled: boolean("hard_limit_enabled").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export type AiCostBudget = typeof aiCostBudgets.$inferSelect;

// ─── CMS, KNOWLEDGE BASE & NEWSLETTER ───────────────────────────────────────

export const cmsAnnouncements = pgTable(
  "cms_announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    type: text("type").notNull().default("info"), // "info" | "warning" | "alert" | "maintenance"
    targetAudience: text("target_audience").notNull().default("all"), // "all" | "student" | "faculty" | "alumni"
    isActive: boolean("is_active").notNull().default(true),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("cms_announcements_active_idx").on(t.isActive, t.startsAt),
  ]
);

export type CmsAnnouncement = typeof cmsAnnouncements.$inferSelect;

export const knowledgeBaseArticles = pgTable(
  "knowledge_base_articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    category: text("category").notNull().default("general"),
    content: text("content").notNull(),
    isInternalOnly: boolean("is_internal_only").notNull().default(false),
    isPublished: boolean("is_published").notNull().default(true),
    viewCount: integer("view_count").notNull().default(0),
    helpfulCount: integer("helpful_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("kb_articles_slug_key").on(t.slug),
    index("kb_articles_category_idx").on(t.category),
    index("kb_articles_published_idx").on(t.isPublished, t.isInternalOnly),
  ]
);

export type KnowledgeBaseArticle = typeof knowledgeBaseArticles.$inferSelect;

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    status: text("status").notNull().default("subscribed"), // "subscribed" | "unsubscribed" | "bounced"
    consentSource: text("consent_source").notNull().default("website_footer"),
    subscribedAt: timestamp("subscribed_at", { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("newsletter_subscribers_email_key").on(t.email),
    index("newsletter_subscribers_status_idx").on(t.status),
  ]
);

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;

export const newsletterCampaigns = pgTable(
  "newsletter_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    subject: text("subject").notNull(),
    htmlContent: text("html_content").notNull(),
    status: text("status").notNull().default("draft"), // "draft" | "scheduled" | "sending" | "sent" | "cancelled"
    recipientCount: integer("recipient_count").notNull().default(0),
    deliveredCount: integer("delivered_count").notNull().default(0),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("newsletter_campaigns_status_idx").on(t.status),
  ]
);

export type NewsletterCampaign = typeof newsletterCampaigns.$inferSelect;

