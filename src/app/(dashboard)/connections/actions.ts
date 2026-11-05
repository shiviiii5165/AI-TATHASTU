"use server";

// Connector actions shared by onboarding Step 5 and /connections. The guard
// admits anyone who has reached the connectors step, finished users included.

import { randomUUID } from "node:crypto";

import { z } from "zod";

import { redirect } from "next/navigation";

import type { SaveResult } from "@/app/onboarding/actions";
import { configuredProviders } from "@/lib/auth-providers";
import { appendConsent } from "@/lib/consent/store";
import { connectSource, disconnectSource, openCredential } from "@/lib/connectors/connections";
import { isConnectorCryptoConfigured } from "@/lib/connectors/crypto";
import { revokeGithubGrant } from "@/lib/connectors/github";
import { publicUrl } from "@/lib/connectors/public-url";
import {
  connectorReturnPath,
  parseCodingHandle,
  parseStackExchangeUrl,
  sourceById,
  type ConnectorContext,
} from "@/lib/connectors/sources";
import { requireConnectorUser } from "@/lib/dal";
import { enqueueComputeIntelligence } from "@/lib/jobs-queue";
import { allowPaidWork } from "@/lib/paid-work";
import { hitRateLimit } from "@/lib/rate-limit";

const NOT_CONFIGURED: SaveResult = { ok: false, error: "Connectors aren't set up on this server yet." };

const forms = {
  kaggle: z.object({
    username: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{1,64}$/, "Enter your Kaggle username, as it appears in your profile URL."),
    key: z
      .string()
      .trim()
      .regex(/^\S{20,200}$/, "Paste the key from the kaggle.json file you downloaded."),
  }),
  stack_exchange: z.object({
    profileUrl: z.string().trim().max(300),
  }),
  portfolio: z.object({
    url: z.string().trim().max(500),
  }),
  leetcode: z.object({ username: z.string().trim().max(200) }),
  hackerrank: z.object({ username: z.string().trim().max(200) }),
};

export type FormSource = keyof typeof forms;

export async function connectWithForm(sourceId: FormSource, values: Record<string, string>): Promise<SaveResult> {
  const { user } = await requireConnectorUser();
  if (!isConnectorCryptoConfigured()) return NOT_CONFIGURED;
  const schema = forms[sourceId];
  if (!schema) return { ok: false, error: "Unknown source." };

  // Each save queues a sync that spends third-party quota.
  const limited = await hitRateLimit(`connect_form:${user.id}`, { limit: 20, windowSeconds: 3600, onDbError: "deny" });
  if (!limited.ok || !(await allowPaidWork(user.id, "connector_sync")).ok) return { ok: false, error: "Too many attempts. Try again later." };

  const parsed = schema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };

  let credential: Record<string, unknown>;
  if (sourceId === "kaggle") {
    const { username, key } = parsed.data as z.infer<typeof forms.kaggle>;
    credential = { username, key };
  } else if (sourceId === "stack_exchange") {
    const profile = parseStackExchangeUrl((parsed.data as z.infer<typeof forms.stack_exchange>).profileUrl);
    if (!profile) {
      return { ok: false, error: "Paste your profile URL, like https://stackoverflow.com/users/12345/your-name." };
    }
    credential = profile;
  } else if (sourceId === "leetcode" || sourceId === "hackerrank") {
    const username = parseCodingHandle(
      (parsed.data as z.infer<typeof forms.leetcode>).username,
      sourceId === "leetcode" ? "leetcode.com" : "hackerrank.com",
    );
    if (!username) return { ok: false, error: "Enter your username or profile link." };
    credential = { username };
  } else {
    const url = await publicUrl((parsed.data as z.infer<typeof forms.portfolio>).url);
    if (!url) return { ok: false, error: "Enter a public web address, like https://yourname.dev." };
    credential = { url };
  }

  await connectSource({
    userId: user.id,
    sourceId,
    accessMethod: sourceById(sourceId)!.accessMethod,
    credential,
    syncKey: randomUUID(),
  });
  return { ok: true };
}

export async function disconnect(sourceId: string): Promise<SaveResult> {
  const { user, state } = await requireConnectorUser();
  const source = sourceById(sourceId);
  if (!source) return { ok: false, error: "Unknown source." };

  const removed = await disconnectSource(user.id, source.id);
  if (removed && source.id === "github") {
    const credential = openCredential<{ access_token?: string }>(user.id, "github", removed.tokenEnc);
    if (credential?.access_token) await revokeGithubGrant(credential.access_token);
  }
  // That source's facts are gone; rescore (no-op until onboarding is done).
  if (state.currentStep === "done") await enqueueComputeIntelligence(user.id, `disconnect:${source.id}`);
  return { ok: true };
}

/** Grants linkedin_scrape for a LinkedIn connection that is waiting on it; the sync is re-queued. */
export async function allowLinkedInImport(): Promise<SaveResult> {
  const { user } = await requireConnectorUser();
  if (!(await appendConsent(user.id, "linkedin_scrape", true))) return { ok: false, error: "Too many attempts. Try again later." };
  return { ok: true };
}

/**
 * Connects LinkedIn as a source through the dedicated connector flow (/api/connectors/linkedin/*),
 * bound to the signed-in user like GitHub. It does not use Auth.js sign-in/account linking, which
 * failed with OAuthAccountNotLinked whenever the LinkedIn email matched an existing account.
 * `readPublicProfile` is the card's inline linkedin_scrape checkbox, recorded either way
 * (unticked is an explicit opt-out) before leaving for LinkedIn.
 */
export async function connectLinkedIn(from: ConnectorContext, readPublicProfile: boolean) {
  const { user } = await requireConnectorUser();
  await appendConsent(user.id, "linkedin_scrape", readPublicProfile === true);
  if (!configuredProviders().linkedin) {
    redirect(`${connectorReturnPath(from)}?source=linkedin&error=not_configured`);
  }
  redirect(`/api/connectors/linkedin/start${from === "connections" ? "?from=connections" : ""}`);
}
