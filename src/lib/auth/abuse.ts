import "server-only";

import { createHash } from "node:crypto";

import { clientIp, hitRateLimit } from "@/lib/rate-limit";

// Starting sign-ins and completing callbacks, per address: high enough for a campus behind one
// IP. Refused if the count can't be made: sign-in needs the database anyway.
const LIMIT = { limit: 300, windowSeconds: 900, onDbError: "deny" as const };

/**
 * Where no client address can be trusted they share one bucket, so a misconfigured proxy
 * makes this stricter rather than absent. Only ever keyed on what resolveClientIdentity
 * trusts, so a spoofed forwarding header can't buy a fresh count.
 */
export async function allowAuthAttempt(request: Request) {
  const ip = clientIp(request);
  const key = ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : "unverified";
  return (await hitRateLimit(`auth_attempt:${key}`, LIMIT)).ok;
}
