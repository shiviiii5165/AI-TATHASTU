import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  integrationConsentLog,
  integrationConsents,
  type ConsentSource,
  type IntegrationClientId,
  type IntegrationConsent,
  type IntegrationScope,
} from "@/db/schema";
import { SCOPE_IDS } from "@/lib/integrations/clients";
import { scopesForApp } from "@/lib/integrations/scopes";

export type ScopeMap = Record<IntegrationScope, boolean>;

/**
 * Sharing policy for the connected apps.
 *  v2 (2026-11-21): basic identity and professional profile (education, skills, projects, experience, achievements)
 *    ON by default, so the app can hold a profile; the user can switch any of it off. Career Intelligence (eris:
 *    readiness, target role, gaps; activity: GitHub and connected sources) OFF by default and only ever turned on by
 *    the user. Nothing here enables it on their behalf, including to fix a failed sync.
 *  v3 (2026-11-21, owner decision): new signups are also shown in Collaborate discovery by default ("discovery", which
 *    applies to Collaborate only). Existing users keep their choice (absent = off) until they turn it on.
 *  v4 (2026-11-21, owner decision, supersedes v2/v3): one connected network. Every AI Tathastu account is always
 *    linked to Collaborate and Avsar with every section shared, Career Intelligence included, and every Collaborate
 *    profile is public. There are no per-app sharing toggles and no disconnect; account deletion removes the person
 *    from all three apps. Applied to existing accounts by scripts/integration-sync.ts enforce-policy.
 * Never shared, under any policy: phone numbers, resume files and text, passwords and tokens (projection.ts), and the
 * email address is never shown publicly by Collaborate (contact visibility).
 */
export const CONSENT_POLICY_VERSION = 4;
export const CAREER_INTELLIGENCE_SCOPES: IntegrationScope[] = ["eris", "activity"];

/** A choice that doesn't apply to this app (e.g. discovery for Avsar) is always stored as off. */
const appliesTo = (scope: IntegrationScope, clientId: IntegrationClientId) => scopesForApp(clientId).some((s) => s.id === scope);

/** What policy v4 shares with an app: every section that applies to it. */
export function defaultScopesFor(clientId: IntegrationClientId): ScopeMap {
  return Object.fromEntries(SCOPE_IDS.map((s) => [s, appliesTo(s, clientId)])) as ScopeMap;
}

/** True when a consent row already matches policy v4 (linked, not revoked, every applicable section on). */
export function matchesPolicy(row: IntegrationConsent | null, clientId: IntegrationClientId): boolean {
  if (!row?.linkedAt || row.revokedAt || row.policyVersion !== CONSENT_POLICY_VERSION) return false;
  const want = defaultScopesFor(clientId);
  return SCOPE_IDS.every((s) => (row.scopes[s] === true) === want[s]);
}
/** @deprecated policy v2 defaults without discovery; use defaultScopesFor(clientId). */
export const DEFAULT_SHARED_SCOPES = Object.fromEntries(
  SCOPE_IDS.map((s) => [s, !CAREER_INTELLIGENCE_SCOPES.includes(s) && s !== "discovery"]),
) as ScopeMap;

/** The user's saved choices; null if they've never chosen for this app. */
export async function getConsent(userId: string, clientId: IntegrationClientId) {
  const [row] = await db
    .select()
    .from(integrationConsents)
    .where(and(eq(integrationConsents.userId, userId), eq(integrationConsents.clientId, clientId)));
  return row ?? null;
}

/** What is switched on. A section never saved as true is off. */
export function effectiveScopes(row: Pick<IntegrationConsent, "scopes"> | null): ScopeMap {
  return Object.fromEntries(SCOPE_IDS.map((s) => [s, row?.scopes[s] === true])) as ScopeMap;
}

/** Linked and not revoked: the app may read the profile and receive webhooks. */
export const isLinked = (row: IntegrationConsent | null) => Boolean(row?.linkedAt && !row.revokedAt);

/**
 * Saves the user's choices for an app and records them in the insert-only consent log, atomically.
 * `source` says who made this choice: the user (default), the signup default, or an operator backfill.
 */
export async function saveConsent(
  userId: string,
  clientId: IntegrationClientId,
  input: { scopes: ScopeMap; hiddenProjects?: string[]; link?: boolean; source?: ConsentSource },
) {
  const now = new Date();
  const source = input.source ?? "user";
  const scopes = Object.fromEntries(
    Object.entries(input.scopes).map(([s, on]) => [s, on === true && appliesTo(s as IntegrationScope, clientId)]),
  ) as ScopeMap;
  input = { ...input, scopes };
  const values = {
    scopes: input.scopes,
    ...(input.hiddenProjects ? { hiddenProjects: input.hiddenProjects } : {}),
    ...(input.link ? { linkedAt: now, revokedAt: null } : {}),
    source,
    policyVersion: CONSENT_POLICY_VERSION,
    updatedAt: now,
  };
  const current = input.link ? null : await getConsent(userId, clientId);
  await db.batch([
    db
      .insert(integrationConsents)
      .values({ userId, clientId, hiddenProjects: [], ...values })
      .onConflictDoUpdate({ target: [integrationConsents.userId, integrationConsents.clientId], set: values }),
    db.insert(integrationConsentLog).values({
      userId,
      clientId,
      scopes: input.scopes,
      linked: input.link ? true : isLinked(current),
      source,
      policyVersion: CONSENT_POLICY_VERSION,
    }),
  ]);
}

export async function revokeLink(userId: string, clientId: IntegrationClientId) {
  const current = await getConsent(userId, clientId);
  await db.batch([
    db
      .update(integrationConsents)
      .set({ revokedAt: new Date(), updatedAt: new Date(), source: "user" })
      .where(and(eq(integrationConsents.userId, userId), eq(integrationConsents.clientId, clientId))),
    db.insert(integrationConsentLog).values({
      userId,
      clientId,
      scopes: current?.scopes ?? {},
      linked: false,
      source: "user_revoked",
      policyVersion: CONSENT_POLICY_VERSION,
    }),
  ]);
}
