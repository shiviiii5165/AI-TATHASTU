import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getApiUserAtStep } from "@/lib/dal";
import { connectSource } from "@/lib/connectors/connections";
import { exchangeGithubCode, fetchGithubUser, GITHUB_STATE_COOKIE, githubCallbackUrl } from "@/lib/connectors/github";
import { connectorReturnPath } from "@/lib/connectors/sources";

function finish(request: NextRequest, query: string, from: string | undefined) {
  const path = connectorReturnPath(from === "connections" ? "connections" : "onboarding");
  const res = NextResponse.redirect(new URL(`${path}?source=github&${query}`, request.url));
  res.cookies.delete({ name: GITHUB_STATE_COOKIE, path: "/api/connectors/github" });
  return res;
}

const sameString = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * GitHub redirects here after consent. Verifies state (CSRF), exchanges the
 * code, seals the token into `connections`, and queues `connector_sync`.
 */
export async function GET(request: NextRequest) {
  const authz = await getApiUserAtStep("connectors", { allowDone: true });
  if (!authz.ok) return NextResponse.redirect(new URL(authz.status === 401 ? "/login" : "/onboarding", request.url));

  const params = request.nextUrl.searchParams;
  const cookie = request.cookies.get(GITHUB_STATE_COOKIE)?.value ?? "";
  const [cookieUser, cookieState, from] = cookie.split(".");
  const state = params.get("state") ?? "";

  // The cookie must exist, belong to this user, and match the returned state.
  if (!cookieState || cookieUser !== authz.user.id || !sameString(cookieState, state)) {
    return finish(request, "error=state", from);
  }
  if (params.get("error")) {
    return finish(request, params.get("error") === "access_denied" ? "error=denied" : "error=github", from);
  }

  const code = params.get("code");
  if (!code) return finish(request, "error=github", from);

  try {
    const { accessToken, scope } = await exchangeGithubCode(code, githubCallbackUrl(request.nextUrl.origin));
    const githubUser = await fetchGithubUser(accessToken);
    await connectSource({
      userId: authz.user.id,
      sourceId: "github",
      accessMethod: "oauth",
      credential: { access_token: accessToken, scope, login: githubUser.login, github_id: githubUser.id },
      syncKey: state,
    });
    // No recompute here: the queued connector_sync enqueues compute_intelligence
    // once the repos are in, which also regenerates the roadmap and matches.
  } catch (error) {
    console.error("GitHub connect failed", error);
    return finish(request, "error=github", from);
  }

  return finish(request, "connected=1", from);
}
