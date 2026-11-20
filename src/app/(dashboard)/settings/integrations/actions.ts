"use server";

import type { IntegrationClientId } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { AUTO_PROVISION_CLIENTS, autoProvision, type AutoProvisionClient } from "@/lib/integrations/auto-provision";
import { clientById } from "@/lib/integrations/clients";
import { getConsent, isLinked } from "@/lib/integrations/consent";
import { dispatchWebhooks, enqueueProfileUpdated } from "@/lib/integrations/webhooks";
import { allowPaidWork } from "@/lib/paid-work";

// Consent policy v4 (src/lib/integrations/consent.ts): every account is linked to Collaborate and Avsar and shares its
// whole profile, so there are no actions to change sharing or disconnect. Only "Sync profile" remains.

export type SyncResult = { ok: true; message: string } | { ok: false; error: string };

/** "Sync profile": send the current profile to the app now (re-linking it first if it ever drifted off the policy). */
export async function syncIntegration(clientId: IntegrationClientId): Promise<SyncResult> {
  const { user } = await requireOnboardedUser();
  const client = clientById(clientId);
  if (!client) return { ok: false, error: "Unknown app." };
  if ((AUTO_PROVISION_CLIENTS as readonly string[]).includes(client.id)) await autoProvision(user.id, client.id as AutoProvisionClient);
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
