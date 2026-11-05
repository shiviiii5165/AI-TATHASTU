import "server-only";

/**
 * LinkedIn as a CONNECTOR (not a sign-in): OpenID Connect against LinkedIn, bound to the signed-in
 * AI Tathastu user by a state cookie, like the GitHub and ORCID connectors.
 *
 * Why not Auth.js signIn("linkedin")? That path asks Auth.js to "link while signed in". When Auth.js
 * does not see the session during its callback, it falls back to sign-in rules and, because an account
 * with the same email exists, fails with OAuthAccountNotLinked: the user is bounced to /login and back.
 * Connecting a source must never depend on sign-in or account linking.
 *
 * The LinkedIn app must list `${origin}/api/connectors/linkedin/callback` as an authorized redirect URL.
 */
export const LINKEDIN_STATE_COOKIE = "ait_li_oauth";
export const LINKEDIN_SCOPE = "openid profile email";
export const linkedinConnectCallbackUrl = (origin: string) => `${origin}/api/connectors/linkedin/callback`;

export type LinkedInUserInfo = {
  sub: string;
  name: string | null;
  email: string | null;
  emailVerified: boolean;
  picture: string | null;
};

export async function exchangeLinkedInCode(code: string, redirectUri: string, config: { clientId: string; clientSecret: string }) {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) throw new Error(`LinkedIn token exchange failed (HTTP ${res.status}${body.error ? `, ${body.error}` : ""})`);
  return body.access_token;
}

export async function fetchLinkedInUserInfo(accessToken: string): Promise<LinkedInUserInfo> {
  const res = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`LinkedIn userinfo failed (HTTP ${res.status})`);
  const u = (await res.json()) as { sub?: string; name?: string; email?: string; email_verified?: boolean | string; picture?: string };
  if (!u.sub) throw new Error("LinkedIn userinfo has no subject");
  return {
    sub: u.sub,
    name: u.name ?? null,
    email: u.email ?? null,
    emailVerified: u.email_verified === true || u.email_verified === "true",
    picture: u.picture ?? null,
  };
}
