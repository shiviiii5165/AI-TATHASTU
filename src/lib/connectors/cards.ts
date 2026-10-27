import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { CardView, Flash } from "@/components/connectors/connector-grid";
import { db } from "@/db";
import { connections, jobs, type Connection, type User } from "@/db/schema";
import { getCurrentConsents } from "@/lib/consent/store";
import { openCredential } from "@/lib/connectors/connections";
import { sourcesFor } from "@/lib/connectors/sources";

/** Card state for every source, for onboarding Step 5 and /connections. */
export async function loadSourceCards(user: Pick<User, "id" | "email" | "role">): Promise<CardView[]> {
  const rows = await db.select().from(connections).where(eq(connections.userId, user.id));
  const pending = rows.length
    ? await db
        .select({ connectionId: sql<string>`${jobs.payload}->>'connection_id'` })
        .from(jobs)
        .where(and(eq(jobs.userId, user.id), eq(jobs.type, "connector_sync"), inArray(jobs.status, ["queued", "running"])))
    : [];
  const syncing = new Set(pending.map((p) => p.connectionId));
  // The worker parks a LinkedIn scrape until linkedin_scrape is granted (older
  // connections were made before the dialog asked for it).
  const linkedinWaiting =
    rows.some((r) => r.sourceId === "linkedin" && r.tokenEnc && r.accessMethod === "public_scrape") &&
    (await getCurrentConsents(user.id)).linkedin_scrape?.granted !== true;

  return sourcesFor(user.role).map((source) => {
    const row = rows.find((r) => r.sourceId === source.id);
    return {
      sourceId: source.id,
      status: !row
        ? "not_connected"
        : row.status === "failed" || row.status === "reauth_needed"
          ? "error"
          : source.id === "linkedin" && linkedinWaiting && !syncing.has(row.id)
            ? "waiting_consent"
          : row.status === "syncing" || syncing.has(row.id)
            ? "syncing"
            : "connected",
      detail: row ? describe(user.id, row, user.email) : null,
      lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
      needsReauth: row?.status === "reauth_needed",
    };
  });
}

/** ?source=github&error=denied from an OAuth round trip. */
export function flashFrom(params: Record<string, string | string[] | undefined>): Flash | null {
  const source = typeof params.source === "string" ? params.source : null;
  return source ? { sourceId: source, error: typeof params.error === "string" ? params.error : null } : null;
}

/** One-line "connected as" text. Decrypts server-side; only the label reaches the client. */
function describe(userId: string, row: Connection, email: string | null): string | null {
  switch (row.sourceId) {
    case "github":
      return at(openCredential<{ login?: string }>(userId, "github", row.tokenEnc)?.login);
    case "kaggle":
      return at(openCredential<{ username?: string }>(userId, "kaggle", row.tokenEnc)?.username);
    case "stack_exchange": {
      const c = openCredential<{ site: string; userId: number }>(userId, "stack_exchange", row.tokenEnc);
      return c ? `${c.site} · user ${c.userId}` : null;
    }
    case "portfolio":
      return openCredential<{ url: string }>(userId, "portfolio", row.tokenEnc)?.url.replace(/^https?:\/\//, "") ?? null;
    case "linkedin": {
      const c = openCredential<{ name?: string; email?: string; url?: string }>(userId, "linkedin", row.tokenEnc);
      return c?.name ? `${c.name}${c.email ? ` (${c.email})` : ""}` : c?.url?.replace(/^https:\/\/www\./, "") ?? email;
    }
    case "orcid":
      return openCredential<{ orcid?: string }>(userId, "orcid", row.tokenEnc)?.orcid ?? null;
    case "google_scholar":
      return null;
    case "leetcode":
    case "hackerrank":
      return at(openCredential<{ username?: string }>(userId, row.sourceId, row.tokenEnc)?.username);
  }
}

const at = (v?: string) => (v ? `@${v}` : null);
