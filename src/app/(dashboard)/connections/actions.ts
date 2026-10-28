"use server";

// Connector actions shared by onboarding Step 5 and /connections. The guard
// admits anyone who has reached the connectors step, finished users included.

import { randomUUID } from "node:crypto";
import { isIP } from "node:net";

import { z } from "zod";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import type { SaveResult } from "@/app/onboarding/actions";
import { signIn } from "@/auth";
import { configuredProviders } from "@/lib/auth-providers";
import { appendConsent } from "@/lib/consent/store";
import { connectSource, disconnectSource, openCredential } from "@/lib/connectors/connections";
import { isConnectorCryptoConfigured } from "@/lib/connectors/crypto";
import { revokeGithubGrant } from "@/lib/connectors/github";
import {
  connectorReturnPath,
  parseCodingHandle,
  parseStackExchangeUrl,
  sourceById,
  type ConnectorContext,
} from "@/lib/connectors/sources";
import { requireConnectorUser } from "@/lib/dal";
import { enqueueComputeIntelligence } from "@/lib/jobs-queue";

const NOT_CONFIGURED: SaveResult = { ok: false, error: "Connectors aren't set up on this server yet." };

/** Public http(s) URL only: no localhost, private suffixes or raw IPs (the worker will fetch it). */
function publicUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  if (!["http:", "https:"].includes(u.protocol) || !host.includes(".")) return null;
  if (isIP(host.replace(/^\[|\]$/g, "")) || host === "localhost" || /\.(local|internal|localhost)$/.test(host)) return null;
  return u.toString();
}

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
    const url = publicUrl((parsed.data as z.infer<typeof forms.portfolio>).url);
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
  await appendConsent(user.id, "linkedin_scrape", true);
  return { ok: true };
}

/**
 * Links LinkedIn to the signed-in user via Auth.js; events.linkAccount records the connection.
 * `readPublicProfile` is the card's inline linkedin_scrape checkbox, recorded either way
 * (unticked is an explicit opt-out) before leaving for LinkedIn.
 */
export async function connectLinkedIn(from: ConnectorContext, readPublicProfile: boolean) {
  const { user } = await requireConnectorUser();
  await appendConsent(user.id, "linkedin_scrape", readPublicProfile === true);
  if (!configuredProviders().linkedin) {
    redirect(`${connectorReturnPath(from)}?source=linkedin&error=not_configured`);
  }
  try {
    await signIn("linkedin", { redirectTo: `${connectorReturnPath(from)}?source=linkedin&connected=1` });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`${connectorReturnPath(from)}?source=linkedin&error=${error.type}`);
    }
    throw error;
  }
}
