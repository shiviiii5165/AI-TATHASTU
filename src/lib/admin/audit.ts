import "server-only";

import { and, desc, eq, gte, ilike, lt, type SQL, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { type AdminAuditLog, adminAuditLogs } from "@/db/schema";
import { resolveClientIdentity } from "@/lib/rate-limit";

export interface RecordAuditInput {
  actorId?: string;
  actorEmail: string;
  action: string;
  resource: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

/**
 * Records an immutable administrative audit log entry.
 * Captures actor, action, resource, target, contextual details, IP, and user-agent.
 */
export async function recordAdminAudit(input: RecordAuditInput): Promise<void> {
  try {
    const headersList = await headers();
    // Only an address the platform vouches for; none is better than a spoofed or invented one.
    const identity = resolveClientIdentity(new Request("https://internal.invalid", { headers: headersList }));
    const ipAddress = identity.ok ? identity.ip : null;
    const userAgent = headersList.get("user-agent") || "unknown";

    await db.insert(adminAuditLogs).values({
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail,
      action: input.action,
      resource: input.resource,
      targetId: input.targetId ?? null,
      details: input.details ?? {},
      ipAddress,
      userAgent,
    });
  } catch (err) {
    // Audit logging should fail-safe without crashing the user's primary mutation,
    // but report to server logs for monitoring.
    console.error("Failed to persist admin audit log:", err);
  }
}

export interface ListAuditsOptions {
  resource?: string;
  actorEmail?: string;
  /** Matches the action name, e.g. "ticket." for every ticket action. */
  action?: string;
  /** Inclusive day range, YYYY-MM-DD (UTC). */
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const likeEsc = (v: string) => `%${v.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

/** Audit entries, newest first, with the real count of every matching entry (not just this page). */
export async function listAdminAudits(
  options: ListAuditsOptions = {}
): Promise<{ logs: AdminAuditLog[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const where: SQL[] = [];
  if (options.resource) where.push(eq(adminAuditLogs.resource, options.resource));
  if (options.actorEmail) where.push(ilike(adminAuditLogs.actorEmail, likeEsc(options.actorEmail)));
  if (options.action) where.push(ilike(adminAuditLogs.action, likeEsc(options.action)));
  if (options.from && DAY.test(options.from)) where.push(gte(adminAuditLogs.createdAt, new Date(`${options.from}T00:00:00Z`)));
  if (options.to && DAY.test(options.to)) where.push(lt(adminAuditLogs.createdAt, new Date(new Date(`${options.to}T00:00:00Z`).getTime() + 86_400_000)));
  const clause = where.length ? and(...where) : undefined;

  const [logs, [counted]] = await Promise.all([
    db.select().from(adminAuditLogs).where(clause).orderBy(desc(adminAuditLogs.createdAt)).limit(limit).offset(offset),
    db.select({ n: sql<number>`count(*)::int` }).from(adminAuditLogs).where(clause),
  ]);
  return { logs, total: Number(counted?.n ?? 0) };
}

/** Resource names that actually occur in the log, for the filter. */
export async function listAuditResources(): Promise<string[]> {
  const rows = await db.selectDistinct({ r: adminAuditLogs.resource }).from(adminAuditLogs).orderBy(adminAuditLogs.resource).limit(100);
  return rows.map((r) => r.r);
}

