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

export type ScopeMap = Record<IntegrationScope, boolean>;

/**
 * Sharing policy for the connected apps, version 2 (2026-11-21):
 *  - Basic identity and professional profile (education, skills, projects, experience, achievements) is ON by default,
 *    so the app can hold a private profile. The user can switch any of it off.
 *  - Career Intelligence (eris: readiness, target role, gaps; activity: GitHub and connected sources) is OFF by default
 *    and only ever turned on by the user. Nothing here enables it on their behalf, including to fix a failed sync.
 * Phone numbers, resume text and credentials are never part of any section (projection.ts).
 */
export const CONSENT_POLICY_VERSION = 2;
export const CAREER_INTELLIGENCE_SCOPES: IntegrationScope[] = ["eris", "activity"];
export const DEFAULT_SHARED_SCOPES = Object.fromEntries(
  SCOPE_IDS.map((s) => [s, !CAREER_INTELLIGENCE_SCOPES.includes(s)]),
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
