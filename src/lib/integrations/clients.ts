import "server-only";

import type { IntegrationClientId, IntegrationScope } from "@/db/schema";
import type { FlagKey } from "@/lib/feature-flags";

/**
 * Apps on their own domains that sign users in with AI Tathastu and read
 * their profile. Per-app settings come from the environment:
 *
 *   INTEGRATION_<ID>_CLIENT_SECRET   token exchange (required to enable the app)
 *   INTEGRATION_<ID>_REDIRECT_URIS   exact callback URLs, comma-separated
 *                                    (unset: any https path on the app's origin)
 *   INTEGRATION_<ID>_ORIGIN          override the origin (local development)
 *   INTEGRATION_<ID>_WEBHOOK_URL     where profile.updated events are POSTed
 *   INTEGRATION_<ID>_WEBHOOK_SECRET  HMAC key for those events
 *
 * Each app is also gated by its feature flag, so it can be switched off
 * without a deploy (403 from every integration endpoint).
 */

type ClientDef = {
  id: IntegrationClientId;
  name: string;
  description: string;
  origin: string;
  flag: FlagKey;
  // Shown as "Requested by <app>" on the approval screen. Never pre-enabled:
  // every optional scope starts off until the user turns it on.
  requested: IntegrationScope[];
};

export const INTEGRATION_CLIENTS: ClientDef[] = [
  {
    id: "collaborate",
    name: "Collaborate",
    description: "Find teammates, mentors and projects that match your skills.",
    origin: "https://collaborate.aitathastu.com",
    flag: "collaborate_profile_api",
    requested: ["skills", "projects", "experience", "education", "achievements"],
  },
  {
    id: "meet",
    name: "Tathastu Meet",
    description: "Video rooms for research, projects and mentoring.",
    origin: "https://connect.aitathastu.com",
    flag: "meet_profile_api",
    requested: ["skills"],
  },
];

export { SCOPE_IDS } from "@/lib/integrations/scopes";

const env = (id: string, key: string) => process.env[`INTEGRATION_${id.toUpperCase()}_${key}`]?.trim() || null;

export function clientById(id: string | null | undefined) {
  const def = INTEGRATION_CLIENTS.find((c) => c.id === id);
  if (!def) return null;
  return {
    ...def,
    origin: (env(def.id, "ORIGIN") ?? def.origin).replace(/\/$/, ""),
    secret: env(def.id, "CLIENT_SECRET"),
    redirectUris: env(def.id, "REDIRECT_URIS")?.split(",").map((u) => u.trim()).filter(Boolean) ?? null,
    webhookUrl: env(def.id, "WEBHOOK_URL"),
    webhookSecret: env(def.id, "WEBHOOK_SECRET"),
  };
}

export type IntegrationClient = NonNullable<ReturnType<typeof clientById>>;

/** Exact match against the registered list, else same origin over https (http only for localhost). */
export function isAllowedRedirect(client: IntegrationClient, redirectUri: string) {
  let url: URL;
  try {
    url = new URL(redirectUri);
  } catch {
    return false;
  }
  if (url.hash || url.username || url.password) return false;
  if (client.redirectUris && client.redirectUris.length > 0) {
    return client.redirectUris.includes(redirectUri);
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const isAllowedOrigin = url.origin === client.origin && (url.protocol === "https:" || local);
  return isAllowedOrigin && url.pathname === "/api/auth/tathastu/callback";
}
