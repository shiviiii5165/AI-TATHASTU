"use server";

import { notFound, redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { recordAdminAudit } from "@/lib/admin/audit";
import {
  beginMfaEnrollment,
  getMfaEnrollment,
  isMfaKeyConfigured,
  isRecentAuth,
  issueRecoveryCodes,
  looksLikeRecoveryCode,
  notifyMfaChange,
  redeemRecoveryCode,
  setMfaProofCookie,
  verifyAdminMfaCode,
} from "@/lib/admin/mfa";
import { getAdminContext } from "@/lib/admin/rbac";
import { getCurrentUser } from "@/lib/dal";
import { hitRateLimit } from "@/lib/rate-limit";

export type MfaFormState = { error?: string; recoveryCodes?: string[] };

const REAUTH_PATH = "/login?callbackUrl=%2Fadmin-mfa";

async function requireOperator() {
  const user = await getCurrentUser();
  if (!(await getAdminContext(user))) notFound();
  return user;
}

const hasRecentAuth = async () => isRecentAuth((await auth())?.authTime);

export async function startEnrollment() {
  const user = await requireOperator();
  if (!(await hasRecentAuth())) redirect("/admin-mfa");
  await beginMfaEnrollment(user.id);
  await recordAdminAudit({ actorId: user.id, actorEmail: user.email ?? "unknown", action: "admin.mfa_enrollment_started", resource: "admin_mfa", targetId: user.id });
  redirect("/admin-mfa");
}

/** For a session too old to enroll: sign in again and come straight back. */
export async function reauthenticate() {
  await signOut({ redirectTo: REAUTH_PATH });
}

export async function submitCode(_previous: MfaFormState, formData: FormData): Promise<MfaFormState> {
  const user = await requireOperator();
  // A million codes and three valid at a time: this keeps guessing hopeless. No database, no attempt.
  const limited = await hitRateLimit(`admin_mfa:${user.id}`, { limit: 5, windowSeconds: 900, onDbError: "deny" });
  if (!limited.ok) return { error: "Too many attempts. Try again in 15 minutes." };
  if (!isMfaKeyConfigured()) return { error: "Admin verification isn't configured on this server." };

  const input = String(formData.get("code") ?? "").trim();
  const enrollment = await getMfaEnrollment(user.id);

  if (looksLikeRecoveryCode(input)) {
    if (await redeemRecoveryCode(user, input)) {
      await notifyMfaChange(user, "A recovery code was used and the authenticator removed");
      // Every session just ended, this one included.
      await signOut({ redirectTo: REAUTH_PATH });
    }
    await recordAdminAudit({ actorId: user.id, actorEmail: user.email ?? "unknown", action: "admin.mfa_recovery_failed", resource: "admin_mfa", targetId: user.id });
    return { error: "That recovery code didn't work." };
  }

  // Confirming claims the second factor, so it needs the same fresh sign-in as starting.
  if (!enrollment?.confirmed && !(await hasRecentAuth())) {
    return { error: "Your sign-in is too old to set this up. Sign in again and retry." };
  }

  const ok = await verifyAdminMfaCode(user.id, input.replace(/\s/g, ""));
  await recordAdminAudit({
    actorId: user.id,
    actorEmail: user.email ?? "unknown",
    action: ok ? (enrollment?.confirmed ? "admin.mfa_passed" : "admin.mfa_enrolled") : "admin.mfa_failed",
    resource: "admin_mfa",
    targetId: user.id,
  });
  if (!ok) return { error: "That code didn't work. Wait for a new code and try again." };
  if (!enrollment?.confirmed) await notifyMfaChange(user, "A new authenticator was set up");

  await setMfaProofCookie(user);
  const recoveryCodes = await issueRecoveryCodes(user.id);
  if (recoveryCodes.length) {
    await recordAdminAudit({ actorId: user.id, actorEmail: user.email ?? "unknown", action: "admin.mfa_recovery_issued", resource: "admin_mfa", targetId: user.id });
    return { recoveryCodes };
  }
  redirect("/admin");
}
