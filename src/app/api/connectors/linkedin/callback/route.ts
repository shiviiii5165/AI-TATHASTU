import { NextResponse, type NextRequest } from "next/server";

import { getApiUserAtStep } from "@/lib/dal";
import { connectSource } from "@/lib/connectors/connections";
import { importLinkedInProfileFacts, linkedinConfig } from "@/lib/connectors/linkedin";
import { exchangeLinkedInCode, fetchLinkedInUserInfo, LINKEDIN_STATE_COOKIE, linkedinConnectCallbackUrl } from "@/lib/connectors/linkedin-oauth";
import { connectorReturnPath } from "@/lib/connectors/sources";
import { safeEqual } from "@/lib/internal-auth";
import { enqueueComputeIntelligence } from "@/lib/jobs-queue";

function finish(request: NextRequest, query: string, from: string | undefined) {
  const path = connectorReturnPath(from === "connections" ? "connections" : "onboarding");
  const res = NextResponse.redirect(new URL(`${path}?source=linkedin&${query}`, request.url));
  res.cookies.delete({ name: LINKEDIN_STATE_COOKIE, path: "/api/connectors/linkedin" });
  return res;
}

/**
 * LinkedIn redirects here after consent. Verifies state (CSRF, bound to this user), exchanges the
 * code, reads the verified OIDC profile, and records the connection on the SIGNED-IN user.
 * It never creates users, signs anyone in, or links login accounts.
 */
export async function GET(request: NextRequest) {
  const authz = await getApiUserAtStep("connectors", { allowDone: true });
  if (!authz.ok) return NextResponse.redirect(new URL(authz.status === 401 ? "/login" : "/onboarding", request.url));

  const params = request.nextUrl.searchParams;
  const cookie = request.cookies.get(LINKEDIN_STATE_COOKIE)?.value ?? "";
  const [cookieUser, cookieState, from] = cookie.split(".");
  const state = params.get("state") ?? "";

  if (!cookieState || cookieUser !== authz.user.id || !safeEqual(cookieState, state)) {
    return finish(request, "error=state", from);
  }
  if (params.get("error")) {
    const e = params.get("error");
    return finish(request, e === "user_cancelled_authorize" || e === "user_cancelled_login" || e === "access_denied" ? "error=denied" : "error=linkedin", from);
  }
  const code = params.get("code");
  const config = linkedinConfig();
  if (!code || !config) return finish(request, "error=linkedin", from);

  try {
    const accessToken = await exchangeLinkedInCode(code, linkedinConnectCallbackUrl(request.nextUrl.origin), config);
    const info = await fetchLinkedInUserInfo(accessToken);
    // Unverified LinkedIn emails are not imported as facts (same rule as sign-in).
    const email = info.emailVerified ? info.email : null;
    await connectSource({
      userId: authz.user.id,
      sourceId: "linkedin",
      accessMethod: "oauth",
      credential: { providerAccountId: info.sub, name: info.name, email, picture: info.picture },
      syncKey: info.sub,
      queueSync: false,
      keepExisting: false,
    });
    await importLinkedInProfileFacts({ userId: authz.user.id, providerAccountId: info.sub, name: info.name, email, picture: info.picture });
    await enqueueComputeIntelligence(authz.user.id, "oauth:linkedin").catch((error) =>
      console.error("Failed to enqueue intelligence compute after connecting LinkedIn", error),
    );
  } catch (error) {
    console.error("LinkedIn connect failed", error instanceof Error ? error.message : error);
    return finish(request, "error=linkedin", from);
  }
  return finish(request, "connected=1", from);
}
