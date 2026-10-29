import "server-only";

import { desc, eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { type AdminAuditLog, adminAuditLogs } from "@/db/schema";

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
    const forwardedFor = headersList.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0].trim() : "127.0.0.1";
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
  limit?: number;
  offset?: number;
}

export async function listAdminAudits(
  options: ListAuditsOptions = {}
): Promise<{ logs: AdminAuditLog[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 100);
  const offset = options.offset ?? 0;

  const query = db
    .select()
    .from(adminAuditLogs)
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const logs = await query;
  return { logs, total: logs.length };
}

