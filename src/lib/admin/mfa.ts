import "server-only";

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { adminMfa, adminMfaRecoveryCodes, type User } from "@/db/schema";
import { adminEmails } from "@/lib/admin-emails";
import { sendEmail } from "@/lib/email";
import { adminSecurityNoticeEmail } from "@/lib/email/templates";
import { hashRecoveryCode, isMfaProofValid, matchTotp, newRecoveryCode, newTotpSecret, normalizeRecoveryCode, signMfaProof } from "@/lib/admin/totp";
import { open, seal } from "@/lib/connectors/crypto";

const COOKIE = "ait_admin_mfa";
const PROOF_TTL_SECONDS = 12 * 3600;
const RECOVERY_CODE_COUNT = 10;
const RECENT_AUTH_SECONDS = 15 * 60;
const ADMIN_SESSION_SECONDS = 24 * 3600;
const UNCONFIRMED_ENROLLMENT_SECONDS = 15 * 60;
const MIN_KEY_LENGTH = 32;
const aad = (userId: string) => `${userId}:admin_mfa`;

// Its own key: a leaked AUTH_SECRET can forge sessions, but must not also pass this check.
const usableKey = (raw: string | undefined) => (raw && raw.length >= MIN_KEY_LENGTH && raw !== process.env.AUTH_SECRET ? raw : null);
const signingKey = () => usableKey(process.env.ADMIN_MFA_SECRET);
/** The current key, then the one being rotated out, so a rotation doesn't sign every operator out at once. */
const verifyingKeys = () => [signingKey(), usableKey(process.env.ADMIN_MFA_SECRET_PREVIOUS)].filter((k): k is string => k !== null);

export const isMfaKeyConfigured = () => signingKey() !== null;

/** Off until ADMIN_MFA_REQUIRED=1, so operators can enroll before it can lock them out. */
export const isAdminMfaRequired = () => process.env.ADMIN_MFA_REQUIRED === "1";

/** Second check on every admin page and action. With no usable key, no proof is valid: it fails closed. */
export async function requireAdminMfa(user: Pick<User, "id" | "sessionVersion">) {
  if (!isAdminMfaRequired()) return;
  const proof = (await cookies()).get(COOKIE)?.value;
  if (!verifyingKeys().some((key) => isMfaProofValid(key, proof, user.id, user.sessionVersion))) redirect("/admin-mfa");
}

/**
 * Whether this session signed in moments ago. Claiming a second factor needs it, so a
 * stolen long-lived session can't enroll its own authenticator on an operator who hasn't.
 * Tokens from before this claim existed count as old.
 */
export function isRecentAuth(authTimeS: number | undefined, nowMs = Date.now()) {
  return typeof authTimeS === "number" && nowMs / 1000 - authTimeS <= RECENT_AUTH_SECONDS;
}

/** Operators sign in again daily: the rest of the platform's 30-day session is too long a life for a stolen admin cookie. */
export function isAdminSessionFresh(authTimeS: number | undefined, nowMs = Date.now()) {
  return typeof authTimeS === "number" && nowMs / 1000 - authTimeS <= ADMIN_SESSION_SECONDS;
}

export async function getMfaEnrollment(userId: string) {
  const [row] = await db.select().from(adminMfa).where(eq(adminMfa.userId, userId));
  if (!row) return null;
  return { confirmed: row.confirmedAt !== null, secret: readSecret(row.userId, row.secretEnc) };
}

function readSecret(userId: string, secretEnc: string) {
  return open<{ secret: string }>(Buffer.from(secretEnc, "base64"), aad(userId)).secret;
}

/** A confirmed enrollment is never replaced here, and an abandoned one gets a fresh secret. */
export async function beginMfaEnrollment(userId: string) {
  const secretEnc = seal({ secret: newTotpSecret() }, aad(userId)).toString("base64");
  await db
    .insert(adminMfa)
    .values({ userId, secretEnc })
    .onConflictDoUpdate({
      target: adminMfa.userId,
      set: { secretEnc, createdAt: new Date(), lastCounter: null },
      where: sql`${adminMfa.confirmedAt} IS NULL AND ${adminMfa.createdAt} < now() - make_interval(secs => ${UNCONFIRMED_ENROLLMENT_SECONDS})`,
    });
}

/**
 * True when the code is right and unused. The update is the replay check: a code's
 * time-step must be newer than the last one accepted, atomically across instances.
 * The first success also confirms an enrollment.
 */
export async function verifyAdminMfaCode(userId: string, code: string) {
  const [row] = await db.select().from(adminMfa).where(eq(adminMfa.userId, userId));
  if (!row) return false;
  const counter = matchTotp(readSecret(userId, row.secretEnc), code);
  if (counter === null) return false;
  const accepted = await db
    .update(adminMfa)
    .set({ lastCounter: counter, confirmedAt: sql`coalesce(${adminMfa.confirmedAt}, now())` })
    .where(and(eq(adminMfa.userId, userId), or(isNull(adminMfa.lastCounter), lt(adminMfa.lastCounter, counter))))
    .returning({ userId: adminMfa.userId });
  return accepted.length === 1;
}

/**
 * The account's recovery codes, the one time they exist in the clear; [] if already issued.
 * One statement, so racing confirmations can't both issue a set.
 */
export async function issueRecoveryCodes(userId: string) {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
  const hashes = sql.join(codes.map((code) => sql`(${hashRecoveryCode(normalizeRecoveryCode(code)!)})`), sql`, `);
  const { rows } = await db.execute(sql`
    WITH once AS (
      UPDATE admin_mfa SET recovery_issued_at = now()
       WHERE user_id = ${userId} AND confirmed_at IS NOT NULL AND recovery_issued_at IS NULL
      RETURNING user_id
    )
    INSERT INTO admin_mfa_recovery_codes (user_id, code_hash)
    SELECT once.user_id, v.code_hash FROM once CROSS JOIN (VALUES ${hashes}) AS v(code_hash)
    RETURNING id`);
  return rows.length ? codes : [];
}

export const looksLikeRecoveryCode = (input: string) => normalizeRecoveryCode(input) !== null;

/**
 * Spends a recovery code, atomically and once. Removes the lost authenticator and the
 * remaining codes, and ends every session including any held by whoever took the device,
 * so the operator signs in fresh and enrolls again. The audit entry commits with it.
 */
export async function redeemRecoveryCode(user: Pick<User, "id" | "email">, input: string) {
  const code = normalizeRecoveryCode(input);
  if (!code) return false;
  const hash = hashRecoveryCode(code);
  const { rows } = await db.execute(sql`
    WITH used AS (
      UPDATE admin_mfa_recovery_codes SET used_at = now()
       WHERE user_id = ${user.id} AND code_hash = ${hash} AND used_at IS NULL
      RETURNING user_id
    ), others AS (
      DELETE FROM admin_mfa_recovery_codes
       WHERE user_id = ${user.id} AND code_hash <> ${hash} AND EXISTS (SELECT 1 FROM used)
      RETURNING 1
    ), device AS (
      DELETE FROM admin_mfa WHERE user_id = ${user.id} AND EXISTS (SELECT 1 FROM used)
      RETURNING 1
    ), sessions_ended AS (
      UPDATE users SET session_version = session_version + 1 WHERE id = ${user.id} AND EXISTS (SELECT 1 FROM used)
      RETURNING 1
    ), audit AS (
      INSERT INTO admin_audit_logs (actor_id, actor_email, action, resource, target_id)
      SELECT ${user.id}, ${user.email ?? "unknown"}, 'admin.mfa_recovery_used', 'admin_mfa', ${user.id} FROM used
      RETURNING 1
    )
    SELECT user_id FROM used`);
  return rows.length === 1;
}

export async function hasUnusedRecoveryCodes(userId: string) {
  const [row] = await db
    .select({ id: adminMfaRecoveryCodes.id })
    .from(adminMfaRecoveryCodes)
    .where(and(eq(adminMfaRecoveryCodes.userId, userId), isNull(adminMfaRecoveryCodes.usedAt)))
    .limit(1);
  return Boolean(row);
}

/**
 * Tells the operator and every other root operator. A stolen mailbox can hide this from its
 * owner, and enrolling in the 15-minute window needs exactly that mailbox, so the others are
 * the real detection. A failure is logged and never blocks the change.
 */
export async function notifyMfaChange(user: Pick<User, "email">, event: string) {
  const account = user.email ?? "unknown";
  const recipients = [...new Set([...(user.email ? [user.email.toLowerCase()] : []), ...adminEmails()])];
  await Promise.all(
    recipients.map((to) =>
      sendEmail({ profile: "system", to, email: adminSecurityNoticeEmail({ account, event }) }).catch((error) =>
        console.error(JSON.stringify({ event: "admin_security_notice_failed", kind: error instanceof Error ? error.name : "unknown" })),
      ),
    ),
  );
}

export async function setMfaProofCookie(user: Pick<User, "id" | "sessionVersion">) {
  const key = signingKey();
  if (!key) throw new Error("ADMIN_MFA_SECRET must be at least 32 characters and differ from AUTH_SECRET");
  const expiresAtS = Math.floor(Date.now() / 1000) + PROOF_TTL_SECONDS;
  (await cookies()).set(COOKIE, signMfaProof(key, user.id, user.sessionVersion, expiresAtS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: PROOF_TTL_SECONDS,
  });
}
