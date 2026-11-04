import "server-only";

import { and, eq, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  accountDeletions,
  emailDeliveries,
  files,
  newsletterSubscribers,
  supportMessages,
  supportTickets,
  users,
  verificationTokens,
  webhookOutbox,
  type AccountDeletion,
} from "@/db/schema";
import { adminEmails } from "@/lib/admin-emails";
import { openCredential } from "@/lib/connectors/connections";
import { revokeGithubGrant } from "@/lib/connectors/github";
import { enqueueRevokedForDeletion } from "@/lib/integrations/webhooks";
import { deleteObject, isR2Configured, listObjectKeys, UPLOAD_URL_TTL_SECONDS } from "@/lib/r2";

/** Stands in for a deleted person's address on support records, whose column is required. */
const REMOVED_EMAIL = "deleted-account@removed.invalid";

const LEASE_SECONDS = 5 * 60;
const BASE_BACKOFF_SECONDS = 5 * 60;
const MAX_BACKOFF_SECONDS = 6 * 3600;
const GITHUB_MAX_ATTEMPTS = 5;
export const ALERT_AFTER_ATTEMPTS = 3;
// An upload URL issued just before the lock can still finish after it; wait those out.
const SWEEP_DELAY_SECONDS = UPLOAD_URL_TTL_SECONDS + 60;

export class ProtectedAccountError extends Error {
  constructor() {
    super("This is an administrator account and can't be deleted here.");
    this.name = "ProtectedAccountError";
  }
}

export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found");
    this.name = "AccountNotFoundError";
  }
}

type Request = {
  requestedBy: "self" | "admin";
  actorEmail: string;
  action: string;
  details?: Record<string, unknown>;
};

/**
 * Locks the account and records the deletion, in one statement so none of it can happen
 * alone: the operator check, tombstone, session revocation, job cancellation, the sealed
 * GitHub token moving out of `connections`, and the audit entry. Conflicts leave a retry
 * as a no-op for the record and audit, so a repeat can't add a second entry.
 *
 * Operators are refused by what the database and ADMIN_EMAILS say at that moment, so a
 * concurrent promotion can't slip through, and no operator can ever be removed this way.
 * Cancelling a running job clears locked_by, which fences the worker's writes.
 */
export async function requestAccountDeletion(userId: string, request: Request) {
  const emails = adminEmails();
  const notConfiguredOperator = emails.length
    ? sql`AND lower(coalesce(email, '')) NOT IN (${sql.join(emails.map((e) => sql`${e}`), sql`, `)})`
    : sql``;
  const details = JSON.stringify(request.details ?? {});

  const { rows } = await db.execute(sql`
    WITH locked AS (
      UPDATE users
         SET deleted_at = coalesce(deleted_at, now()), updated_at = now(), session_version = session_version + 1
       WHERE id = ${userId} AND is_admin = false ${notConfiguredOperator}
         AND NOT EXISTS (SELECT 1 FROM admin_team_members m WHERE m.user_id = users.id AND m.is_active)
      RETURNING id
    ), github AS (
      SELECT token_enc FROM connections WHERE user_id = ${userId} AND source_id = 'github'
    ), started AS (
      INSERT INTO account_deletions (user_id, requested_by, github_token_enc, sweep_after)
      SELECT id, ${request.requestedBy}, (SELECT token_enc FROM github), now() + make_interval(secs => ${SWEEP_DELAY_SECONDS})
        FROM locked
      ON CONFLICT (user_id) DO NOTHING
      RETURNING user_id
    ), audit AS (
      INSERT INTO admin_audit_logs (actor_email, action, resource, target_id, details)
      SELECT ${request.actorEmail}, ${request.action}, 'users', user_id::text, ${details}::jsonb FROM started
      RETURNING 1
    ), cancelled AS (
      UPDATE jobs SET status = 'failed', finished_at = now(), last_error = 'Account deleted', locked_by = NULL, locked_until = NULL
       WHERE user_id = ${userId} AND status IN ('queued', 'running') AND EXISTS (SELECT 1 FROM locked)
      RETURNING 1
    ), ended_sessions AS (
      DELETE FROM auth_sessions WHERE user_id = ${userId} AND EXISTS (SELECT 1 FROM locked) RETURNING 1
    ), removed_connections AS (
      DELETE FROM connections WHERE user_id = ${userId} AND EXISTS (SELECT 1 FROM locked) RETURNING 1
    )
    SELECT (SELECT count(*) FROM locked)::int AS locked, EXISTS (SELECT 1 FROM users WHERE id = ${userId}) AS present`);
  const row = rows[0] as { locked: number; present: boolean };
  if (row.locked === 1) return;
  throw row.present ? new ProtectedAccountError() : new AccountNotFoundError();
}

/** Deletes one user's objects, known or not. The prefix holds a validated id, so it can't reach anyone else's. */
async function deleteUserObjects(userId: string, known: string[]) {
  const id = z.uuid().parse(userId);
  const listed = isR2Configured() ? await listObjectKeys(`resumes/${id}/`) : [];
  const keys = [...new Set([...known, ...listed])];
  for (const key of keys) await deleteObject(key);
  return keys.length;
}

async function claim(userId: string) {
  const [row] = await db
    .update(accountDeletions)
    .set({
      status: "processing",
      attempts: sql`${accountDeletions.attempts} + 1`,
      lockedUntil: sql`now() + make_interval(secs => ${LEASE_SECONDS})`,
    })
    .where(
      and(
        eq(accountDeletions.userId, userId),
        ne(accountDeletions.status, "completed"),
        lte(accountDeletions.nextAttemptAt, sql`now()`),
        or(isNull(accountDeletions.lockedUntil), lt(accountDeletions.lockedUntil, sql`now()`)),
      ),
    )
    .returning();
  return row ?? null;
}

async function settleGithub(row: AccountDeletion) {
  if (!row.githubTokenEnc) return row.githubOutcome;
  const credential = openCredential<{ access_token?: string }>(row.userId, "github", row.githubTokenEnc);
  // Unreadable (key rotated) or empty: no retry can ever succeed, so don't keep it.
  const result = credential?.access_token ? await revokeGithubGrant(credential.access_token) : "abandoned";
  const attempts = row.githubAttempts + 1;
  const outcome = result === "failed" ? (attempts >= GITHUB_MAX_ATTEMPTS ? "abandoned" : null) : result;
  await db
    .update(accountDeletions)
    .set({ githubAttempts: attempts, ...(outcome ? { githubOutcome: outcome, githubTokenEnc: null } : {}) })
    .where(eq(accountDeletions.userId, row.userId));
  if (outcome === "abandoned") console.error(JSON.stringify({ event: "account_deletion_github_abandoned", userId: row.userId }));
  return outcome;
}

async function removeData(row: AccountDeletion) {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, row.userId));
  // Before the users row goes: consents cascade with it, and they name the linked apps.
  if (user) {
    const unreachable = await enqueueRevokedForDeletion(row.userId);
    if (unreachable.length) console.warn(JSON.stringify({ event: "account_deletion_no_webhook", userId: row.userId, apps: unreachable }));
  }
  const stored = await db.select({ key: files.storageKey }).from(files).where(eq(files.userId, row.userId));
  const filesDeleted = await deleteUserObjects(row.userId, stored.map((f) => f.key));

  const email = user?.email?.toLowerCase().trim();
  const addressed = email
    ? ([
        db.delete(verificationTokens).where(sql`lower(${verificationTokens.identifier}) = ${email}`),
        db.delete(emailDeliveries).where(sql`lower(${emailDeliveries.recipient}) = ${email}`),
        db.delete(newsletterSubscribers).where(sql`lower(${newsletterSubscribers.email}) = ${email}`),
        db.update(supportTickets).set({ requesterEmail: REMOVED_EMAIL }).where(sql`lower(${supportTickets.requesterEmail}) = ${email}`),
        db.update(supportMessages).set({ authorEmail: null }).where(sql`lower(${supportMessages.authorEmail}) = ${email}`),
      ] as const)
    : ([] as const);

  // The state change and its audit entry commit with the delete; the WHERE keeps a second run from repeating them.
  const finished = sql`
    WITH marked AS (
      UPDATE account_deletions SET data_deleted_at = now(), files_deleted = ${filesDeleted}
       WHERE user_id = ${row.userId} AND data_deleted_at IS NULL
      RETURNING user_id
    )
    INSERT INTO admin_audit_logs (actor_email, action, resource, target_id, details)
    SELECT 'system', 'account.deletion_data_removed', 'users', user_id::text, ${JSON.stringify({ filesDeleted })}::jsonb FROM marked`;
  await db.batch([
    ...addressed,
    db.delete(webhookOutbox).where(and(eq(webhookOutbox.userId, row.userId), ne(webhookOutbox.event, "integration.revoked"))),
    // Spend stays as an anonymous platform total. What ties it, or any counter, to this person goes.
    db.execute(sql`UPDATE ai_usage_ledger SET scoped_to_user = NULL, job_id = NULL WHERE scoped_to_user = ${row.userId}`),
    db.execute(sql`DELETE FROM ai_spend_counters WHERE scope = ${row.userId}`),
    db.execute(sql`DELETE FROM rate_limits WHERE key LIKE ${`%:${row.userId}`}`),
    db.delete(users).where(eq(users.id, row.userId)),
    db.execute(finished),
  ]);
}

export type DeletionProgress = { dataDeleted: boolean; status: AccountDeletion["status"] };

/**
 * Runs what's left of a deletion. Every stage is idempotent and can fail alone, so an R2
 * outage doesn't stop GitHub revocation and a GitHub outage doesn't keep anyone's data.
 * Runs inline after the request and again from the daily cron, under a lease, so a crash
 * anywhere resumes on the next run.
 */
export async function processAccountDeletion(userId: string): Promise<DeletionProgress | null> {
  const row = await claim(userId);
  if (!row) return null;

  let failure: string | null = null;
  const stage = async (run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      // The type only: messages can hold storage keys, and keys hold a user id and file hash.
      failure ??= error instanceof Error ? error.name : "unknown";
    }
  };

  let githubOutcome = row.githubOutcome;
  await stage(async () => {
    githubOutcome = await settleGithub(row);
  });

  let dataDeleted = row.dataDeletedAt !== null;
  if (!dataDeleted) {
    await stage(async () => {
      await removeData(row);
      dataDeleted = true;
    });
  }

  // A late upload can't be registered once the users row is gone, so only a list finds it.
  let swept = row.sweptAt !== null;
  if (dataDeleted && !swept && row.sweepAfter.getTime() <= Date.now()) {
    await stage(async () => {
      await deleteUserObjects(userId, []);
      swept = true;
    });
  }

  const githubDone = !row.githubTokenEnc || githubOutcome !== null;
  const done = dataDeleted && swept && githubDone;
  const backoff = Math.min(BASE_BACKOFF_SECONDS * 2 ** Math.max(row.attempts - 1, 0), MAX_BACKOFF_SECONDS);
  const status: AccountDeletion["status"] = done ? "completed" : failure ? "partially_failed" : "pending";
  await db
    .update(accountDeletions)
    .set({
      status,
      lockedUntil: null,
      lastError: failure,
      completedAt: done ? new Date() : null,
      sweptAt: swept ? (row.sweptAt ?? new Date()) : null,
      // Only waiting for upload URLs to expire: come back then, not on a failure backoff.
      nextAttemptAt: failure || !githubDone ? sql`now() + make_interval(secs => ${backoff})` : row.sweepAfter,
    })
    .where(eq(accountDeletions.userId, userId));

  if (failure && row.attempts >= ALERT_AFTER_ATTEMPTS) {
    console.error(JSON.stringify({ event: "account_deletion_stuck", userId, attempts: row.attempts, kind: failure }));
  }
  return { dataDeleted, status };
}

/** The cron's pass over deletions that are due. */
export async function processDueDeletions(limit = 20) {
  const due = await db
    .select({ userId: accountDeletions.userId })
    .from(accountDeletions)
    .where(and(ne(accountDeletions.status, "completed"), lte(accountDeletions.nextAttemptAt, sql`now()`)))
    .orderBy(accountDeletions.nextAttemptAt)
    .limit(limit);
  let completed = 0;
  for (const { userId } of due) {
    if ((await processAccountDeletion(userId))?.status === "completed") completed += 1;
  }
  return { due: due.length, completed };
}

/** Lets an operator's retry run now instead of waiting out the backoff. */
export async function retryAccountDeletionNow(userId: string) {
  await db.update(accountDeletions).set({ nextAttemptAt: new Date() }).where(and(eq(accountDeletions.userId, userId), ne(accountDeletions.status, "completed")));
}
