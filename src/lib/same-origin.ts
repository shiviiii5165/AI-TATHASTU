/**
 * CSRF defence for cookie-authenticated, state-changing route handlers. Server Actions get Next's own
 * origin check; plain route handlers don't.
 *
 * The session cookie is SameSite=Lax, which stops other websites but NOT sibling subdomains:
 * collaborate.aitathastu.com and avsar.aitathastu.com are the "same site" as www.aitathastu.com, so a
 * script there could POST here with the user's cookie. So:
 *  - Sec-Fetch-Site (sent by every current browser): only "same-origin" and "none" (typed URL /
 *    bookmark) pass; "same-site" and "cross-site" are refused.
 *  - Older browsers without it: the Origin header, when present, must equal this request's own origin.
 *  - No browser headers at all (server-to-server, CLI): allowed. Those callers authenticate on their own,
 *    and a forged cross-site browser request always carries at least one of the two headers.
 */
const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function crossSiteRefusal(request: Request): string | null {
  if (!UNSAFE.has(request.method.toUpperCase())) return null;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin" || fetchSite === "none" ? null : `sec-fetch-site:${fetchSite}`;
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (origin === "null") return "origin:null";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return "origin:malformed";
  }
  return originHost.toLowerCase() === host.toLowerCase() ? null : "origin:mismatch";
}
