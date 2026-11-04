import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getApiUserAtStep } from "@/lib/dal";
import { isConnectorCryptoConfigured } from "@/lib/connectors/crypto";
import { ORCID_SCOPE, ORCID_STATE_COOKIE, orcidCallbackUrl, orcidConfig } from "@/lib/connectors/orcid";
import { connectorReturnPath, parseConnectorContext } from "@/lib/connectors/sources";
import { allowPaidWork } from "@/lib/paid-work";

/**
 * Starts ORCID sign-in from faculty Step 2 (`?from=research`), Step 5 or
 * /connections. State, user and origin are bound to this browser via an
 * httpOnly cookie, as for GitHub.
 */
export async function GET(request: NextRequest) {
  const from = parseConnectorContext(request.nextUrl.searchParams.get("from"));
  const authz = await getApiUserAtStep(from === "research" ? "research_expertise" : "connectors", { allowDone: true });
  if (!authz.ok) return NextResponse.redirect(new URL(authz.status === 401 ? "/login" : "/onboarding", request.url));

  const config = orcidConfig();
  if (!config || !isConnectorCryptoConfigured()) {
    return NextResponse.redirect(new URL(`${connectorReturnPath(from)}?source=orcid&error=not_configured`, request.url));
  }

  // Each completed connect queues a sync.
  if (!(await allowPaidWork(authz.user.id, "connector_sync")).ok) {
    return NextResponse.redirect(new URL(`${connectorReturnPath(from)}?source=orcid&error=limited`, request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const authorize = new URL(`${config.base}/oauth/authorize`);
  authorize.searchParams.set("client_id", config.clientId);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", ORCID_SCOPE);
  authorize.searchParams.set("redirect_uri", orcidCallbackUrl(request.nextUrl.origin));
  authorize.searchParams.set("state", state);

  const res = NextResponse.redirect(authorize);
  res.cookies.set(ORCID_STATE_COOKIE, `${authz.user.id}.${state}.${from}`, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/connectors/orcid",
    maxAge: 10 * 60,
  });
  return res;
}
