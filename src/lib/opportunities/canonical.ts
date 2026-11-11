/**
 * Canonical opportunity URLs, used for deduplication across sources and refreshes.
 * Lower-cased host, no fragment, no tracking parameters, sorted query, no trailing slash.
 * Only absolute http(s) URLs qualify; anything else (relative placeholders such as
 * "/opportunities", javascript:, mailto:) returns null and can never be shown as a source link.
 */
const TRACKING = /^(utm_[a-z]+|gclid|fbclid|mc_cid|mc_eid|ref|ref_src|source)$/i;

export function canonicalUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  if (u.username || u.password) return null;
  u.hash = "";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  const params = [...u.searchParams.entries()].filter(([k]) => !TRACKING.test(k)).sort(([a], [b]) => a.localeCompare(b));
  u.search = "";
  for (const [k, v] of params) u.searchParams.append(k, v);
  if (u.pathname.length > 1 && u.pathname.endsWith("/")) u.pathname = u.pathname.replace(/\/+$/, "");
  const out = u.toString();
  return u.pathname === "/" && !u.search ? out.replace(/\/$/, "") : out;
}

export const isExternalHttpUrl = (raw: string | null | undefined) => canonicalUrl(raw) !== null;
