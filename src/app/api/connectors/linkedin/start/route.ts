import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getApiUserAtStep } from "@/lib/dal";
import { isConnectorCryptoConfigured } from "@/lib/connectors/crypto";
import { linkedinConfig } from "@/lib/connectors/linkedin";
import { LINKEDIN_SCOPE, LINKEDIN_STATE_COOKIE, linkedinConnectCallbackUrl } from "@/lib/connectors/linkedin-oauth";
import { connectorReturnPath, type ConnectorContext } from "@/lib/connectors/sources";

/**
 * Starts connecting LinkedIn from onboarding Step 5 or /connections (`?from=connections`).
 * State, user and origin are bound to this browser via an httpOnly cookie (same as GitHub).
 */
export async function GET(request: NextRequest) {
  const authz = await getApiUserAtStep("connectors", { allowDone: true });
  if (!authz.ok) return NextResponse.redirect(new URL(authz.status === 401 ? "/login" : "/onboarding", request.url));

  const from: ConnectorContext = request.nextUrl.searchParams.get("from") === "connections" ? "connections" : "onboarding";
  const config = linkedinConfig();
  if (!config || !isConnectorCryptoConfigured()) {
    return NextResponse.redirect(new URL(`${connectorReturnPath(from)}?source=linkedin&error=not_configured`, request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const authorize = new URL("https://www.linkedin.com/oauth/v2/authorization");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("redirect_uri", linkedinConnectCallbackUrl(request.nextUrl.origin));
  authorize.searchParams.set("scope", LINKEDIN_SCOPE);
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize);
  res.cookies.set(LINKEDIN_STATE_COOKIE, `${authz.user.id}.${state}.${from}`, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/connectors/linkedin",
    maxAge: 10 * 60,
  });
  return res;
}
