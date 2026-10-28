import "server-only";

// ORCID sign-in with the `/authenticate` scope, used only to prove the user
// owns an ORCID iD. The worker then reads the public record
// (worker/connectors/orcid.py); no ORCID token is stored.
//
// ORCID_CLIENT_ID / ORCID_CLIENT_SECRET: a Public API client from
// https://orcid.org/developer-tools, with redirect URI
// https://www.aitathastu.com/api/connectors/orcid/callback.
// ORCID_BASE_URL: https://sandbox.orcid.org for testing (default https://orcid.org).

export const ORCID_STATE_COOKIE = "ait_orcid_oauth";
export const ORCID_SCOPE = "/authenticate";

export function orcidConfig() {
  const clientId = process.env.ORCID_CLIENT_ID;
  const clientSecret = process.env.ORCID_CLIENT_SECRET;
  const base = (process.env.ORCID_BASE_URL || "https://orcid.org").replace(/\/$/, "");
  return clientId && clientSecret ? { clientId, clientSecret, base } : null;
}

export const orcidCallbackUrl = (origin: string) => `${origin}/api/connectors/orcid/callback`;

const ORCID_ID = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

export async function exchangeOrcidCode(code: string, redirectUri: string) {
  const config = orcidConfig()!;
  const res = await fetch(`${config.base}/oauth/token`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(10_000), // a hung ORCID call fails the callback instead of holding it
  });
  const data = (await res.json().catch(() => ({}))) as { orcid?: string; name?: string; error?: string };
  if (!res.ok || !data.orcid || !ORCID_ID.test(data.orcid)) throw new Error(`ORCID token exchange failed: ${data.error ?? res.status}`);
  return { orcid: data.orcid, name: data.name ?? null };
}
