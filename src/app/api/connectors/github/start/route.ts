import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getApiUserAtStep } from "@/lib/dal";
import { isConnectorCryptoConfigured } from "@/lib/connectors/crypto";
import { GITHUB_SCOPE, GITHUB_STATE_COOKIE, githubCallbackUrl, githubConfig } from "@/lib/connectors/github";
import { connectorReturnPath, type ConnectorContext } from "@/lib/connectors/sources";
import { allowPaidWork } from "@/lib/paid-work";

/**
 * Starts the GitHub OAuth flow from onboarding Step 5 or /connections
 * (`?from=connections`). State, user and origin are bound to this browser
 * via an httpOnly cookie.
 */
export async function GET(request: NextRequest) {
  const authz = await getApiUserAtStep("connectors", { allowDone: true });
  if (!authz.ok) return NextResponse.redirect(new URL(authz.status === 401 ? "/login" : "/onboarding", request.url));

  const from: ConnectorContext = request.nextUrl.searchParams.get("from") === "connections" ? "connections" : "onboarding";
  const config = githubConfig();
  if (!config || !isConnectorCryptoConfigured()) {
    return NextResponse.redirect(new URL(`${connectorReturnPath(from)}?source=github&error=not_configured`, request.url));
  }

  // Each completed connect queues a sync.
  if (!(await allowPaidWork(authz.user.id, "connector_sync")).ok) {
    return NextResponse.redirect(new URL(`${connectorReturnPath(from)}?source=github&error=limited`, request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", githubCallbackUrl(request.nextUrl.origin));
  authorize.searchParams.set("scope", GITHUB_SCOPE);
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("allow_signup", "false");

  const res = NextResponse.redirect(authorize);
  res.cookies.set(GITHUB_STATE_COOKIE, `${authz.user.id}.${state}.${from}`, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/connectors/github",
    maxAge: 10 * 60,
  });
  return res;
}
