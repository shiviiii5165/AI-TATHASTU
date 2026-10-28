import "server-only";

// GitHub as a data connector (separate from sign-in, so its token and scope
// are independent of Auth.js). Uses a GitHub OAuth App.

export const GITHUB_STATE_COOKIE = "ait_gh_oauth";
// Public profile + public repos. Private repos would need the full `repo`
// scope (read *and write*), which is too broad to ask for at onboarding.
export const GITHUB_SCOPE = "read:user";

export function githubConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export const githubCallbackUrl = (origin: string) => `${origin}/api/connectors/github/callback`;

// A hung GitHub call must fail the callback, not hold it until the platform limit.
const GITHUB_TIMEOUT_MS = 10_000;

export async function exchangeGithubCode(code: string, redirectUri: string) {
  const config = githubConfig()!;
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; scope?: string; error?: string };
  if (!res.ok || !data.access_token) throw new Error(`GitHub token exchange failed: ${data.error ?? res.status}`);
  return { accessToken: data.access_token, scope: data.scope ?? "" };
}

export async function fetchGithubUser(accessToken: string) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GitHub /user failed: ${res.status}`);
  const user = (await res.json()) as { id: number; login: string };
  return { id: user.id, login: user.login };
}

/** Best effort: revokes the app's grant so the token stops working on GitHub's side too. */
export async function revokeGithubGrant(accessToken: string) {
  const config = githubConfig();
  if (!config) return;
  await fetch(`https://api.github.com/applications/${config.clientId}/grant`, {
    method: "DELETE",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ access_token: accessToken }),
    signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
  }).catch(() => undefined);
}
