"use server";

import { after } from "next/server";
import { z } from "zod";

import type { SaveResult } from "@/app/onboarding/actions";
import type { IntegrationClientId } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { clientById, SCOPE_IDS } from "@/lib/integrations/clients";
import { getConsent, isLinked, revokeLink, saveConsent, type ScopeMap } from "@/lib/integrations/consent";
import { dispatchWebhooks, enqueueProfileUpdated, enqueueRevoked } from "@/lib/integrations/webhooks";
import { allowPaidWork } from "@/lib/paid-work";

const consentSchema = z.object({
  clientId: z.enum(["collaborate", "meet"]),
  scopes: z.record(z.string(), z.boolean()),
  hiddenProjects: z.array(z.string().regex(/^p_[0-9a-f]{16}$/)).max(500),
});

const dispatchLater = () => after(() => dispatchWebhooks().catch((e) => console.error("webhook dispatch failed", e)));

/** Autosaved toggles. A linked app hears about the change right away (and drops what it may no longer see). */
export async function saveIntegrationConsent(input: z.infer<typeof consentSchema>): Promise<SaveResult> {
  const { user } = await requireOnboardedUser();
  const parsed = consentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That choice wasn't valid. Refresh and try again." };
  const { clientId, hiddenProjects } = parsed.data;
  const scopes = Object.fromEntries(SCOPE_IDS.map((s) => [s, parsed.data.scopes[s] === true])) as ScopeMap;

  await saveConsent(user.id, clientId, { scopes, hiddenProjects: [...new Set(hiddenProjects)] });
  if ((await enqueueProfileUpdated(user.id, "consent_changed", clientId)).length) dispatchLater();
  return { ok: true };
}

export type SyncResult = { ok: true; message: string } | { ok: false; error: string };

/** "Sync profile": send the current profile to the app now. */
export async function syncIntegration(clientId: IntegrationClientId): Promise<SyncResult> {
  const { user } = await requireOnboardedUser();
  const client = clientById(clientId);
  if (!client) return { ok: false, error: "Unknown app." };
  if (!isLinked(await getConsent(user.id, client.id))) {
    return { ok: false, error: `Sign in to ${client.name} with AI Tathastu first, then sync.` };
  }
  if (!client.webhookUrl || !client.webhookSecret) {
    return { ok: false, error: `${client.name} hasn't turned on profile sync yet. It reads your profile each time you sign in.` };
  }
  // It runs a dispatch inline, over everyone's due rows.
  if (!(await allowPaidWork(user.id, "integration_sync")).ok) return { ok: false, error: "Synced recently. Try again later." };
  await enqueueProfileUpdated(user.id, "manual_sync", client.id);
  const result = await dispatchWebhooks();
  if (result.delivered > 0) return { ok: true, message: `Sent to ${client.name}.` };
  if (result.retrying > 0) return { ok: false, error: `${client.name} didn't answer. We'll keep retrying in the background.` };
  return { ok: true, message: `Queued for ${client.name}.` };
}

/** Disconnect: tokens stop working at once, and the app is told to delete what it stored. */
export async function disconnectIntegration(clientId: IntegrationClientId): Promise<SaveResult> {
  const { user } = await requireOnboardedUser();
  const client = clientById(clientId);
  if (!client) return { ok: false, error: "Unknown app." };
  await revokeLink(user.id, client.id);
  if (await enqueueRevoked(user.id, client.id)) dispatchLater();
  return { ok: true };
}
