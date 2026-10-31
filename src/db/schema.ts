import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

import type { OnboardingStep } from "@/lib/onboarding/steps";

const bytea = customType<{ data: Buffer; driverData: Buffer | string }>({
  dataType: () => "bytea",
  // Drivers hex-encode a Buffer param themselves (neon-http sends "\\x…").
  // Reads may come back as a Buffer or as that "\\x…" string.
  fromDriver: (v) => (typeof v === "string" ? Buffer.from(v.replace(/^\\x/, ""), "hex") : Buffer.from(v)),
  toDriver: (v) => v,
});

// ─── IDENTITY AND AUTH ──────────────────────────────────────────────────────

// Who the account is for. Drives the onboarding flow, the dashboard widgets
// and the integrations' identity. Existing accounts default to student.
export const PERSONAS = ["student", "faculty", "alumni"] as const;
export type Persona = (typeof PERSONAS)[number];
export const userRole = pgEnum("user_role", PERSONAS);

// `email` is plain text (the Auth.js adapter requires a text/varchar column);
// case-insensitive uniqueness comes from the lower(email) index and the
// adapter wrapper in src/auth.ts, which lowercases every email it writes.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    emailVerified: timestamp("email_verified", { mode: "date", withTimezone: true }),
    name: text("name"),
    image: text("avatar_url"),
    university: text("university"),
    degree: text("degree"),
    specialization: text("specialization"),
    academicYear: text("academic_year"),
    city: text("city"),
    country: text("country"),
    role: userRole("role").notNull().default("student"),
    // Faculty / mentors.
    department: text("department"),
    academicTitle: text("academic_title"),
    // Alumni (and faculty with an industry role).
    company: text("company"),
    jobTitle: text("job_title"),
    graduationYear: integer("graduation_year"),
    // Normalized academic profile (Step 3). The text columns above (university,
    // degree, specialization, academic_year, city, country) stay filled from the
    // catalogue names for everything that still reads them.
    state: text("state"),
    institutionId: uuid("institution_id").references((): AnyPgColumn => institutions.id, { onDelete: "set null" }),
    campusId: uuid("campus_id").references((): AnyPgColumn => campuses.id, { onDelete: "set null" }),
    degreeId: uuid("degree_id").references((): AnyPgColumn => degrees.id, { onDelete: "set null" }),
    specializationId: uuid("specialization_id").references((): AnyPgColumn => specializations.id, { onDelete: "set null" }),
    currentAcademicYear: text("current_academic_year"),
    expectedGraduationYear: integer("expected_graduation_year"),
    // Operators (/admin). Also granted by ADMIN_EMAILS; see src/lib/admin.ts.
    isAdmin: boolean("is_admin").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_lower_key").on(sql`lower(${t.email})`)],
);

export const accounts = pgTable(
  "auth_accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("auth_accounts_user_id_idx").on(t.userId),
  ],
);

// Unused while session.strategy = "jwt", but kept so switching to database
// sessions later is a config change rather than a migration.
export const sessions = pgTable("auth_sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "auth_verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

export type ConsentPurpose = "external_ai" | "linkedin_scrape" | "analytics" | "mentor_discovery";

// Append-only: never UPDATE a row; the latest row per (user_id, purpose) wins.
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").$type<ConsentPurpose>().notNull(),
    granted: boolean("granted"),
    policyVersion: text("policy_version"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("consents_user_purpose_idx").on(t.userId, t.purpose, t.createdAt)],
);

// ─── ONBOARDING ─────────────────────────────────────────────────────────────

export const onboardingState = pgTable("onboarding_state", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // "role" until the persona is chosen (Step 0), then a step of that persona's flow.
  currentStep: text("current_step").$type<OnboardingStep>().notNull().default("role"),
  // Primary direction; this is what the intelligence layer keys off.
  careerRole: text("career_role"),
  // Free-text direction when the user's role is not in the catalogue.
  careerRoleOther: text("career_role_other"),
  // Every role the user selected, primary first. Not in the original plan
  // schema: Step 1 allows multiple selections and career_role holds only one.
  careerRoles: jsonb("career_roles").$type<string[]>().notNull().default([]),
  // Ordered, max 3. Index 0 is the primary priority (feeds the αI term).
  priorities: jsonb("priorities").$type<string[]>().notNull().default([]),
  resumeUploaded: boolean("resume_uploaded").notNull().default(false),
  connectorsStatus: jsonb("connectors_status").$type<Record<string, string>>().notNull().default({}),
  consentsCompleted: boolean("consents_completed").notNull().default(false),
  // Faculty: free-text research interests, and the career directions (CAREER_ROLES
  // ids) they can mentor in, used to match students.
  researchInterests: jsonb("research_interests").$type<string[]>().notNull().default([]),
  expertiseAreas: jsonb("expertise_areas").$type<string[]>().notNull().default([]),
  mentorship: jsonb("mentorship")
    .$type<{ capacity?: number; canVerifyEris?: boolean; canReviewResumes?: boolean }>()
    .notNull()
    .default({}),
  // Alumni.
  giveBack: jsonb("give_back")
    .$type<{ mentor?: boolean; refer?: boolean; speak?: boolean }>()
    .notNull()
    .default({}),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── EVIDENCE LAYER ─────────────────────────────────────────────────────────

export type FactOrigin =
  | "resume"
  | "github"
  | "kaggle"
  | "stack_exchange"
  | "portfolio"
  | "linkedin_oidc"
  | "linkedin_dma"
  | "linkedin_export"
  | "linkedin_scrape"
  | "leetcode"
  | "hackerrank"
  | "orcid"
  | "user_entered";
export type FactValidationStatus = "validated" | "unresolved" | "conflicting";
export type FactConfirmation = "unconfirmed" | "confirmed" | "edited" | "rejected";

export const profileFacts = pgTable(
  "profile_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fieldGroup: text("field_group").notNull(),
    fieldName: text("field_name").notNull(),
    // Groups the fields of one education/experience/project entry.
    recordKey: text("record_key"),
    extractedValue: jsonb("extracted_value"),
    normalizedValue: jsonb("normalized_value"),
    sourceEvidence: text("source_evidence"),
    location: jsonb("location").$type<{ page: number; bbox: [number, number, number, number] }>(),
    extractionMethod: text("extraction_method"),
    origin: text("origin").$type<FactOrigin>().notNull(),
    confidence: real("confidence"),
    validationStatus: text("validation_status").$type<FactValidationStatus>(),
    confirmation: text("confirmation").$type<FactConfirmation>().notNull().default("unconfirmed"),
    // FK to raw_snapshots once that table lands with the connector pipelines.
    snapshotId: uuid("snapshot_id"),
    supersededBy: uuid("superseded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("profile_facts_current_idx")
      .on(t.userId, t.fieldGroup, t.fieldName)
      .where(sql`${t.supersededBy} IS NULL`),
    index("profile_facts_conflicting_idx")
      .on(t.userId)
      .where(sql`${t.validationStatus} = 'conflicting'`),
  ],
);

export type User = typeof users.$inferSelect;
export type OnboardingState = typeof onboardingState.$inferSelect;
export type ProfileFact = typeof profileFacts.$inferSelect;

// ─── FILES ──────────────────────────────────────────────────────────────────

export type FileKind = "resume" | "linkedin_zip" | "portfolio_screenshot";
export type ScanStatus = "pending" | "clean" | "infected";

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<FileKind>().notNull(),
    storageKey: text("storage_key").notNull(),
    // Hex digest. Enforced by R2 at upload (signed x-amz-checksum-sha256) and
    // re-verified by the worker's intake stage.
    sha256: text("sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    mime: text("mime").notNull(),
    scanStatus: text("scan_status").$type<ScanStatus>().notNull().default("pending"),
    deleteAfter: timestamp("delete_after", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Duplicate-upload cache: the same user uploading the same bytes reuses the row.
  (t) => [uniqueIndex("files_user_sha256_key").on(t.userId, t.sha256)],
);

// ─── JOB QUEUE ──────────────────────────────────────────────────────────────

export type JobType = "resume_extract" | "connector_sync" | "compute_intelligence" | "compute_matches";
export type JobStatus = "queued" | "running" | "done" | "failed" | "needs_review";

// Consumed by the Python worker (worker/worker.py) with FOR UPDATE SKIP LOCKED.
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").$type<JobType>().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    status: text("status").$type<JobStatus>().notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedBy: text("locked_by"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("jobs_queued_run_at_idx").on(t.runAt).where(sql`${t.status} = 'queued'`),
    index("jobs_running_locked_until_idx").on(t.lockedUntil).where(sql`${t.status} = 'running'`),
    index("jobs_user_type_idx").on(t.userId, t.type, t.createdAt),
  ],
);

export type FileRow = typeof files.$inferSelect;
export type Job = typeof jobs.$inferSelect;

// ─── CONNECTOR STATE ────────────────────────────────────────────────────────

export type SourceId =
  | "github"
  | "linkedin"
  | "kaggle"
  | "stack_exchange"
  | "portfolio"
  | "leetcode"
  | "hackerrank"
  | "orcid"
  | "google_scholar";
export type AccessMethod = "oauth" | "api_key" | "public_scrape" | "user_import";
export type ConnectionStatus = "connected" | "syncing" | "stale" | "failed" | "reauth_needed";

export const connections = pgTable(
  "connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: text("source_id").$type<SourceId>().notNull(),
    accessMethod: text("access_method").$type<AccessMethod>().notNull(),
    // AES-256-GCM sealed JSON credential (token, API key, profile URL...);
    // layout in src/lib/connectors/crypto.ts. Null when nothing is stored.
    tokenEnc: bytea("token_enc"),
    status: text("status").$type<ConnectionStatus>().notNull().default("connected"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    staleAfter: timestamp("stale_after", { withTimezone: true }),
  },
  // One connection per source per user; reconnecting replaces it.
  (t) => [uniqueIndex("connections_user_source_key").on(t.userId, t.sourceId)],
);

export type Connection = typeof connections.$inferSelect;

// ─── CODE REPOSITORIES (connector output) ───────────────────────────────────

export const codeRepositories = pgTable(
  "code_repositories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    source: text("source").$type<SourceId>().notNull(),
    // "owner/name" for GitHub.
    repoName: text("repo_name").notNull(),
    description: text("description"),
    url: text("url"),
    // { "Python": 12345, ... } bytes per language, as the source reports it.
    languages: jsonb("languages").$type<Record<string, number>>().notNull().default({}),
    topics: text("topics").array().notNull().default(sql`'{}'::text[]`),
    stars: integer("stars").notNull().default(0),
    forks: integer("forks").notNull().default(0),
    lastCommitAt: timestamp("last_commit_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Sync upserts by (user, source, repo) and deletes repos that disappeared.
  (t) => [uniqueIndex("code_repositories_user_source_repo_key").on(t.userId, t.source, t.repoName)],
);

// ─── SKILL GRAPH (written by compute_intelligence) ──────────────────────────

export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalName: text("canonical_name").notNull().unique(),
  category: text("category").notNull().default("other"),
});

// Lowercased, punctuation-normalized spelling → canonical skill ("py" → Python).
export const skillAliases = pgTable("skill_aliases", {
  alias: text("alias").primaryKey(),
  skillId: uuid("skill_id")
    .notNull()
    .references(() => skills.id, { onDelete: "cascade" }),
});

export const skillEvidence = pgTable(
  "skill_evidence",
  {
    // Not in the plan's column list; added so rows are addressable.
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    skillId: uuid("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
    // Null for evidence derived from code_repositories rather than a fact.
    factId: uuid("fact_id").references(() => profileFacts.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    evidenceStrength: real("evidence_strength").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("skill_evidence_user_skill_idx").on(t.userId, t.skillId)],
);

// ─── UNIFIED PROJECTS ───────────────────────────────────────────────────────

export const unifiedProjects = pgTable(
  "unified_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canonicalTitle: text("canonical_title").notNull(),
    // profile_facts ids (any field of the entry) and code_repositories ids.
    sourceFactIds: uuid("source_fact_ids").array().notNull().default(sql`'{}'::uuid[]`),
    matchConfidence: real("match_confidence").notNull().default(0),
    technologies: text("technologies").array().notNull().default(sql`'{}'::text[]`),
    status: text("status").notNull().default("standalone"), // 'standalone' | 'matched'
    timelineStart: date("timeline_start"),
    timelineEnd: date("timeline_end"),
    conflictPresent: boolean("conflict_present").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("unified_projects_user_idx").on(t.userId)],
);

// ─── ERIS ───────────────────────────────────────────────────────────────────

export const erisScores = pgTable(
  "eris_scores",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    score: real("score").notNull(),
    breakdownJson: jsonb("breakdown_json").$type<Record<string, unknown>>().notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

// ─── INTELLIGENCE ENGINE OUTPUT ─────────────────────────────────────────────

// One precomputed row per user; the dashboard reads this and computes nothing.
export const profileViews = pgTable("profile_views", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  view: jsonb("view").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CodeRepository = typeof codeRepositories.$inferSelect;
export type ProfileView = typeof profileViews.$inferSelect;

// ─── DASHBOARD PERSONALIZATION ──────────────────────────────────────────────

// Per-user widget overrides. Applied as the final pass over the scored list
// in profile_views.view (src/lib/dashboard/compose.ts), so a click takes
// effect immediately without waiting for a recompute.
export const widgetPrefs = pgTable(
  "widget_prefs",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    widgetId: text("widget_id").notNull(),
    dismissed: boolean("dismissed").notNull().default(false),
    pinned: boolean("pinned").notNull().default(false),
    orderOverride: integer("order_override"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.widgetId] })],
);

export type WidgetPref = typeof widgetPrefs.$inferSelect;

// ─── PLATFORM CONTROLS ──────────────────────────────────────────────────────

// Read on every request (no caching), so toggling needs no deploy.
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;

// ─── EXTERNAL INTEGRATIONS (Collaborate, Tathastu Meet) ─────────────────────
// AI Tathastu is the identity provider and profile source for apps on their
// own domains. Registry: src/lib/integrations/clients.ts.

export type IntegrationClientId = "collaborate" | "meet";
export type IntegrationScope =
  | "education"
  | "skills"
  | "eris"
  | "projects"
  | "experience"
  | "achievements"
  | "activity";

/**
 * What the user lets each app see, field group by field group. Identity
 * (name, email, role) is implied by signing in; everything else is opt-in.
 * linked_at is set the first time the user approves the app at
 * /integrations/authorize; revoked_at when they disconnect it.
 */
export const integrationConsents = pgTable(
  "integration_consents",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clientId: text("client_id").$type<IntegrationClientId>().notNull(),
    scopes: jsonb("scopes").$type<Partial<Record<IntegrationScope, boolean>>>().notNull().default({}),
    // Projects the user keeps private even when sharing projects (stable project keys).
    hiddenProjects: text("hidden_projects").array().notNull().default(sql`'{}'::text[]`),
    linkedAt: timestamp("linked_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.clientId] })],
);

export type IntegrationConsent = typeof integrationConsents.$inferSelect;

/** One-time authorization codes (OAuth code flow). Only the SHA-256 of the code is stored. */
export const integrationAuthCodes = pgTable("integration_auth_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id").$type<IntegrationClientId>().notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  // PKCE (S256), optional for confidential clients.
  codeChallenge: text("code_challenge"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WebhookStatus = "pending" | "sending" | "delivered" | "failed";
export type WebhookEvent = "profile.updated" | "integration.revoked";

/**
 * Transactional outbox for webhooks to the integrated apps. A row records
 * that an app must hear about a user; the payload (the consent-filtered
 * profile) is built when it's sent, so it is never stale and a pending row
 * per (app, user, event) is enough: later changes coalesce into it.
 */
export const webhookOutbox = pgTable(
  "webhook_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id").$type<IntegrationClientId>().notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    event: text("event").$type<WebhookEvent>().notNull(),
    reason: text("reason"),
    status: text("status").$type<WebhookStatus>().notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("webhook_outbox_pending_key")
      .on(t.clientId, t.userId, t.event)
      .where(sql`${t.status} = 'pending'`),
    index("webhook_outbox_due_idx").on(t.nextAttemptAt).where(sql`${t.status} IN ('pending', 'sending')`),
  ],
);

export type WebhookOutboxRow = typeof webhookOutbox.$inferSelect;

// ─── ACADEMIC CATALOGUE (Step 3) ────────────────────────────────────────────
// Seeded by migration 0010 from src/db/seeds/academic-catalog.ts; re-run
// `npm run db:seed:academic` after editing that file. Search/matching rules:
// src/lib/academic/match.ts.

export type InstitutionType =
  | "iit"
  | "nit"
  | "iiit"
  | "research_institute"
  | "central_university"
  | "state_university"
  | "deemed_university"
  | "private_university"
  | "foreign_university"
  | "other";
export type VerificationStatus = "verified" | "pending" | "rejected" | "merged";

export const institutions = pgTable(
  "institutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    canonicalName: text("canonical_name").notNull(),
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    institutionType: text("institution_type").$type<InstitutionType>().notNull().default("other"),
    city: text("city"),
    state: text("state"),
    // ISO 3166-1 alpha-2.
    countryCode: text("country_code"),
    website: text("website"),
    // verified: catalogue entry, searchable. pending: typed by a user under
    // "Other / Not listed", visible only to them until reviewed.
    verificationStatus: text("verification_status").$type<VerificationStatus>().notNull().default("pending"),
    source: text("source").$type<"seed" | "user" | "admin">().notNull().default("user"),
    createdBy: uuid("created_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Admin review (/admin/institutions).
    reviewedBy: uuid("reviewed_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    // status "merged": the verified institution its users were moved to.
    mergedInto: uuid("merged_into").references((): AnyPgColumn => institutions.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("institutions_verified_name_key")
      .on(sql`lower(${t.canonicalName})`)
      .where(sql`${t.verificationStatus} = 'verified'`),
    index("institutions_created_by_idx").on(t.createdBy),
  ],
);

export type Institution = typeof institutions.$inferSelect;

/** Campuses of multi-campus institutions (e.g. Amity Noida / Mumbai). Not populated yet. */
export const campuses = pgTable("campuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  institutionId: uuid("institution_id")
    .notNull()
    .references(() => institutions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  city: text("city"),
  state: text("state"),
  countryCode: text("country_code"),
});

export type DegreeLevel = "diploma" | "undergraduate" | "postgraduate" | "integrated" | "doctoral" | "other";

export const degrees = pgTable("degrees", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalName: text("canonical_name").notNull().unique(),
  aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
  level: text("level").$type<DegreeLevel>().notNull(),
  // Years of study; null when it varies (Ph.D., Other).
  durationYears: integer("duration_years"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Degree = typeof degrees.$inferSelect;

export const specializations = pgTable("specializations", {
  id: uuid("id").primaryKey().defaultRandom(),
  canonicalName: text("canonical_name").notNull().unique(),
  aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
  applicableDegreeIds: uuid("applicable_degree_ids").array().notNull().default(sql`'{}'::uuid[]`),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type Specialization = typeof specializations.$inferSelect;

// ─── PRODUCT ANALYTICS ──────────────────────────────────────────────────────
// Minimal event log. user_id is set only with the user's `analytics` consent;
// otherwise events are anonymous (no user, no IP).
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    event: text("event").notNull(),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("analytics_events_event_idx").on(t.event, t.createdAt)],
);

// ─── MATCHES (worker: compute_matches) ──────────────────────────────────────
// Student ↔ mentor pairs, scored by worker/intelligence/matching.py. Computed
// for everyone; a student is only *shown* to faculty/alumni with their
// `mentor_discovery` consent (src/lib/matches.ts).

export type MatchKind = "faculty" | "alumni";

export const matches = pgTable(
  "matches",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mentorId: uuid("mentor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").$type<MatchKind>().notNull(),
    score: real("score").notNull(),
    reasons: jsonb("reasons").$type<string[]>().notNull().default([]),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.mentorId] }),
    index("matches_mentor_idx").on(t.mentorId, t.score),
  ],
);

// ─── INDEPENDENT INTELLIGENCE ENGINES ───────────────────────────────────────

export type RoadmapMilestones = {
  title?: string;
  timeline?: string;
  milestones: string[];
  focus?: string;
};

export const roadmaps = pgTable(
  "roadmaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    currentStage: text("current_stage").notNull(),
    shortTerm: jsonb("short_term").$type<RoadmapMilestones>().notNull(),
    midTerm: jsonb("mid_term").$type<RoadmapMilestones>().notNull(),
    longTerm: jsonb("long_term").$type<RoadmapMilestones>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("roadmaps_user_idx").on(t.userId)],
);

export type Roadmap = typeof roadmaps.$inferSelect;

export const githubScores = pgTable(
  "github_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    repoId: text("repo_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    repoName: text("repo_name"),
    impactScore: integer("impact_score").notNull(),
    rationale: text("rationale").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("github_scores_user_idx").on(t.userId),
    uniqueIndex("github_scores_user_repo_idx").on(t.userId, t.repoId),
  ],
);

export type GithubScore = typeof githubScores.$inferSelect;

export const collaborationEmbeddings = pgTable(
  "collaboration_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    embedding: vector("embedding", { dimensions: 768 }),
    profileSummary: text("profile_summary"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("collaboration_embeddings_user_idx").on(t.userId)],
);

export type CollaborationEmbedding = typeof collaborationEmbeddings.$inferSelect;

export const learningResources = pgTable(
  "learning_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    provider: text("provider").notNull(),
    url: text("url"),
    description: text("description"),
    embedding: vector("embedding", { dimensions: 768 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export type LearningResource = typeof learningResources.$inferSelect;

export const opportunities = pgTable(
  "opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    organization: text("organization").notNull(),
    type: text("type").notNull(), // 'research', 'internship', 'job', 'grant'
    location: text("location"),
    deadline: text("deadline"),
    requiredSkills: text("required_skills").array().notNull().default(sql`'{}'::text[]`),
    description: text("description"),
    url: text("url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("opportunities_type_idx").on(t.type)],
);

export type Opportunity = typeof opportunities.$inferSelect;

// Fixed-window request counters shared by every serverless instance (an
// in-memory Map resets per instance). One row per limiter key.
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});



// ─── ADMIN OPERATING SYSTEM & PLATFORM MANAGEMENT ───────────────────────────
export * from "./schema-admin";
