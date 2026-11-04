"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import type { SaveResult } from "@/app/onboarding/actions";
import { signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { processAccountDeletion, ProtectedAccountError, requestAccountDeletion } from "@/lib/account-deletion";
import { isAdmin } from "@/lib/admin";
import { appendConsents, consentChoicesSchema } from "@/lib/consent/store";
import { getCurrentUser, requireOnboardedUser } from "@/lib/dal";
import { hitRateLimit } from "@/lib/rate-limit";

/** Autosaved toggles after onboarding. Append-only, like the review step: unchanged answers add no rows. */
export async function savePrivacyConsents(input: unknown): Promise<SaveResult> {
  const { user } = await requireOnboardedUser();
  const parsed = consentChoicesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That choice wasn't valid. Refresh and try again." };
  // mentor_discovery applies to students only; faculty and alumni are always findable.
  const { refused } = await appendConsents(user.id, { ...parsed.data, mentor_discovery: user.role === "student" && parsed.data.mentor_discovery });
  if (refused.length) return { ok: false, error: "That's changed too many times. Try again later." };
  return { ok: true };
}

/** Ends every session on every device, this one too, along with embed and integration tokens. */
export async function signOutEverywhere() {
  const user = await getCurrentUser();
  await db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: new Date() }).where(eq(users.id, user.id));
  await signOut({ redirectTo: "/login" });
}

const PROTECTED_MESSAGE = "Administrator accounts can't be deleted here. Contact support.";

/**
 * The signed-in user deletes their own account, after typing their email address to confirm.
 * Once the request commits the account is locked for good and the rest retries without them,
 * so only a failure before that point is reported as one.
 */
export async function deleteMyAccount(confirmation: unknown): Promise<SaveResult> {
  const user = await getCurrentUser();
  // Operators must hand over first: removing the last one would lock everyone out of /admin.
  if (isAdmin(user)) return { ok: false, error: PROTECTED_MESSAGE };
  if (typeof confirmation !== "string" || confirmation.trim().toLowerCase() !== user.email?.toLowerCase()) {
    return { ok: false, error: "That doesn't match your email address." };
  }
  const limited = await hitRateLimit(`account_delete:${user.id}`, { limit: 5, windowSeconds: 900, onDbError: "deny" });
  if (!limited.ok) return { ok: false, error: "Too many attempts. Try again later." };

  try {
    await requestAccountDeletion(user.id, { requestedBy: "self", actorEmail: "self-service", action: "account.self_delete" });
  } catch (error) {
    if (error instanceof ProtectedAccountError) return { ok: false, error: PROTECTED_MESSAGE };
    console.error("account deletion failed to start", { kind: error instanceof Error ? error.name : "unknown" });
    return { ok: false, error: "We couldn't delete your account. Nothing was changed. Try again, or contact support." };
  }

  // The cron finishes whatever this doesn't, so a failure here isn't the user's to retry.
  const progress = await processAccountDeletion(user.id).catch(() => null);
  await signOut({ redirect: false });
  redirect(progress?.dataDeleted ? "/" : "/login?reason=deletion_pending");
}
