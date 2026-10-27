import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { featureFlags } from "@/db/schema";

export const FLAG_KEYS = [
  "avasar_profile_api",
  "collaborate_profile_api",
  "learn_profile_api",
  "meet_profile_api",
  "iris_profile_api",
  "pilot_site_embed",
] as const;

export type FlagKey = (typeof FLAG_KEYS)[number];

/**
 * Read on every call (plan §4.4: toggling needs no deploy). A flag that is
 * missing from the table counts as off, so new integrations stay dark until
 * someone switches them on.
 */
export async function isFeatureEnabled(key: FlagKey): Promise<boolean> {
  const [row] = await db.select({ enabled: featureFlags.enabled }).from(featureFlags).where(eq(featureFlags.key, key));
  return row?.enabled === true;
}
// Flags are toggled with `npm run flags` (scripts/flags.mjs), which writes the table directly.

/** Module name a caller declares (X-AIT-Module / ?module=) → the flag gating it. */
export const MODULE_FLAGS: Record<string, FlagKey> = {
  avasar: "avasar_profile_api",
  collaborate: "collaborate_profile_api",
  learn: "learn_profile_api",
  meet: "meet_profile_api",
  iris: "iris_profile_api",
};
