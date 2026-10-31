import "server-only";

import { createHash } from "node:crypto";

import { AuthError } from "next-auth";

import { clientIp, hitRateLimit, type RateLimit } from "@/lib/rate-limit";

// Sign-in sends mail to any address a stranger types, so without this one script can
// flood someone's inbox and burn the SMTP quota real sign-ins depend on. It sits in the
// provider's send step because /api/auth/signin/* can be posted to without our login form.
// Denied when the database is down: sign-in needs it to store the token anyway.
const PER_ADDRESS: RateLimit = { limit: 5, windowSeconds: 900, onDbError: "deny" };
// High enough for a campus sharing one address; it stops a sweep across many addresses.
const PER_IP: RateLimit = { limit: 60, windowSeconds: 900, onDbError: "deny" };

const hash = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

// An AuthError reaches the login action's handler with this type, which picks the message.
class MagicLinkLimited extends AuthError {
  static type = "EmailSignInError";
}

/** Throws when this send isn't allowed. */
export async function assertMagicLinkAllowed(email: string, request: Request) {
  // Keys hold hashes, never the address or IP.
  const address = await hitRateLimit(`magic_email:${hash(email.toLowerCase().trim())}`, PER_ADDRESS);
  const ip = await hitRateLimit(`magic_ip:${hash(clientIp(request))}`, PER_IP);
  if (!address.ok || !ip.ok) throw new MagicLinkLimited("Too many sign-in emails requested.");
}
