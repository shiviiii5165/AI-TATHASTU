import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { integrationAuthCodes, users } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { clientById, isAllowedRedirect, type IntegrationClient } from "@/lib/integrations/clients";
import { getConsent, isLinked } from "@/lib/integrations/consent";
import { CODE_TTL_SECONDS, hashCode, isIntegrationKeyConfigured, newAuthCode } from "@/lib/integrations/tokens";

export type AuthorizeRequest = {
  client: IntegrationClient;
  redirectUri: string;
  state: string | null;
  codeChallenge: string | null;
  forceConsent: boolean;
  /** prompt=none: never show UI; answer with a code or login_required / consent_required. */
  silent: boolean;
};

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

/**
 * Validates /integrations/authorize?client_id&redirect_uri&state
 * [&code_challenge&code_challenge_method=S256][&prompt=consent|none].
 * `redirect` is set only once redirect_uri is known to be safe: errors before
 * that are shown on our page, never sent to an unverified URL.
 */
export async function parseAuthorizeRequest(
  params: Params,
): Promise<{ ok: true; req: AuthorizeRequest } | { ok: false; message: string; redirect?: string }> {
  const client = clientById(one(params.client_id));
  if (!client) return { ok: false, message: "This app isn't registered with AI Tathastu." };
  const redirectUri = one(params.redirect_uri);
  if (!redirectUri || !isAllowedRedirect(client, redirectUri)) {
    return { ok: false, message: `The return address for ${client.name} isn't registered.` };
  }
  const state = one(params.state);
  const fail = (error: string, description: string) => ({
    ok: false as const,
    message: description,
    redirect: callbackUrl(redirectUri, { error, error_description: description, state }),
  });

  if (state && state.length > 500) return fail("invalid_request", "state is too long");
  const codeChallenge = one(params.code_challenge);
  if (codeChallenge && (one(params.code_challenge_method) !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge))) {
    return fail("invalid_request", "code_challenge must be S256");
  }
  if (!codeChallenge && client.pkceRequired) return fail("invalid_request", "code_challenge is required (S256)");
  if (!client.secret || !isIntegrationKeyConfigured() || !(await isFeatureEnabled(client.flag))) {
    return fail("temporarily_unavailable", `Signing in to ${client.name} with AI Tathastu isn't enabled yet.`);
  }
  const prompt = one(params.prompt); // other values are ignored, as before
  return { ok: true, req: { client, redirectUri, state, codeChallenge, forceConsent: prompt === "consent", silent: prompt === "none" } };
}

/**
 * prompt=none (OIDC Core §3.1.2.1 semantics): the app checks for an existing
 * AI Tathastu session without any screen. Only called after the request was
 * validated, so errors go to a registered redirect URI. Consent is never
 * granted silently: an app the user hasn't approved gets consent_required.
 */
export async function silentAuthorize(userId: string | null, req: AuthorizeRequest) {
  if (!userId) {
    return callbackUrl(req.redirectUri, { error: "login_required", error_description: "Sign in to AI Tathastu first.", state: req.state });
  }
  if (!isLinked(await getConsent(userId, req.client.id))) {
    return callbackUrl(req.redirectUri, { error: "consent_required", error_description: `Approve ${req.client.name} on AI Tathastu first.`, state: req.state });
  }
  return issueCode(userId, req);
}

export function callbackUrl(redirectUri: string, params: Record<string, string | null>) {
  const url = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== null) url.searchParams.set(k, v);
  return url.toString();
}

/** A one-time code, valid for 60 seconds, bound to the app, user, redirect URI and PKCE challenge. */
export async function issueCode(userId: string, req: AuthorizeRequest) {
  const code = newAuthCode();
  const [user] = await db.select({ sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, userId));
  await db.insert(integrationAuthCodes).values({
    sessionVersion: user?.sessionVersion ?? 0,
    codeHash: hashCode(code),
    clientId: req.client.id,
    userId,
    redirectUri: req.redirectUri,
    codeChallenge: req.codeChallenge,
    expiresAt: new Date(Date.now() + CODE_TTL_SECONDS * 1000),
  });
  return callbackUrl(req.redirectUri, { code, state: req.state });
}
