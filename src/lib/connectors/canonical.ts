import { createHmac } from "node:crypto";

/**
 * Canonical identities for what students submit as profile links, so the same resource submitted
 * twice (different case, a trailing slash, tracking parameters) is recognised as the same thing and
 * doesn't queue another paid sync. Comparisons are always within one student's own connection:
 * two students submitting the same public URL never affect each other.
 */

// Query parameters that only track a click; they never change which page is served.
const TRACKING_PARAM = /^(utm_[a-z0-9_]+|fbclid|gclid|dclid|gbraid|wbraid|msclkid|mc_cid|mc_eid|igshid|yclid|_hsenc|_hsmi|mkt_tok|ref_src)$/i;

/**
 * Lower-cased scheme and host, no default port, no fragment, no tracking parameters, no trailing
 * slash. The path (and its case) and every other query parameter are kept: they can select a page.
 */
export function canonicalPublicUrl(raw: string): string {
  const u = new URL(raw);
  u.hash = "";
  for (const key of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(key)) u.searchParams.delete(key);
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  // URL already lower-cases the scheme and host and drops default ports.
  return u.toString().replace(/\?$/, "");
}

type Credential = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** What makes two submissions "the same" for a source, or null when a source has no comparable identity. */
export function credentialIdentity(sourceId: string, credential: Credential | null | undefined): string | null {
  if (!credential) return null;
  switch (sourceId) {
    case "portfolio":
      try {
        return credential.url ? canonicalPublicUrl(str(credential.url)) : null;
      } catch {
        return null;
      }
    case "stack_exchange":
      return credential.site && credential.userId ? `${str(credential.site).toLowerCase()}:${Number(credential.userId)}` : null;
    case "leetcode":
    case "hackerrank":
      return credential.username ? str(credential.username).toLowerCase() : null;
    case "kaggle":
      // A new API key for the same username is a real update, so the key is part of the identity.
      return credential.username ? `${str(credential.username).toLowerCase()}:${str(credential.key)}` : null;
    default:
      return null;
  }
}

/**
 * Keyed fingerprint (HMAC-SHA-256) of an identity, for idempotency keys. Keyed, never a bare hash:
 * usernames and URLs are low-entropy, and a plain SHA-256 of one could be reversed by guessing.
 * Not a credential and never shown to anyone.
 */
export function identityFingerprint(identity: string): string {
  const key = process.env.AUTH_SECRET || process.env.CONNECTOR_TOKEN_KEY;
  if (!key) throw new Error("AUTH_SECRET is required to fingerprint connector identities");
  return createHmac("sha256", key).update(`connector-identity:${identity}`).digest("hex").slice(0, 32);
}
