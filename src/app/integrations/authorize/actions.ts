"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { SCOPE_IDS } from "@/lib/integrations/clients";
import { callbackUrl, issueCode, parseAuthorizeRequest } from "@/lib/integrations/authorize";
import { AUTO_PROVISION_CLIENTS, autoProvision, type AutoProvisionClient } from "@/lib/integrations/auto-provision";
import { saveConsent, type ScopeMap } from "@/lib/integrations/consent";

const scopesSchema = z.record(z.string(), z.boolean());

/**
 * Both actions re-validate the original query string on the server: nothing
 * the browser sends besides the scope choices is trusted.
 */
export async function approveIntegration(query: string, choices: Record<string, boolean>) {
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/integrations/authorize?${query}`)}`);
  const parsed = await parseAuthorizeRequest(Object.fromEntries(new URLSearchParams(query)));
  if (!parsed.ok) redirect(parsed.redirect ?? "/dashboard");
  const clientId = parsed.req.client.id;
  if ((AUTO_PROVISION_CLIENTS as readonly string[]).includes(clientId)) {
    // Consent policy v4: Collaborate and Avsar always receive the whole profile; the screen only lists it.
    await autoProvision(session.user.id, clientId as AutoProvisionClient);
  } else {
    const picked = scopesSchema.parse(choices);
    const scopes = Object.fromEntries(SCOPE_IDS.map((s) => [s, picked[s] === true])) as ScopeMap;
    await saveConsent(session.user.id, clientId, { scopes, link: true });
  }
  redirect(await issueCode(session.user.id, parsed.req));
}

export async function denyIntegration(query: string) {
  const parsed = await parseAuthorizeRequest(Object.fromEntries(new URLSearchParams(query)));
  if (!parsed.ok) redirect(parsed.redirect ?? "/dashboard");
  redirect(callbackUrl(parsed.req.redirectUri, { error: "access_denied", state: parsed.req.state }));
}
