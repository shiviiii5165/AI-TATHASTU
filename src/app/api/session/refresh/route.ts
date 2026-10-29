import { cookies } from "next/headers";
import { connection, NextResponse, type NextRequest } from "next/server";

import { auth, unstable_update } from "@/auth";
import { resolvePostAuthDestination } from "@/lib/auth/destination";

/**
 * Re-derives the JWT `onboarded` claim from the database and ensures updated
 * session cookies are attached to the HTTP redirect response, then continues
 * to the authoritative post-auth destination.
 *
 * Prevents redirect loops when a user finishes onboarding or signs in with
 * stale claims (see FINISHED_REDIRECT in src/lib/dal.ts).
 */
export async function GET(request: NextRequest) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Refresh JWT claims in the session token (re-runs Node jwt callback with trigger "update")
  await unstable_update({});

  const requestedRedirect = request.nextUrl.searchParams.get("redirect") ?? request.nextUrl.searchParams.get("callbackUrl");
  const { destination, isDeleted } = await resolvePostAuthDestination(session.user.id, requestedRedirect);

  if (isDeleted) {
    return NextResponse.redirect(new URL("/login?reason=session", request.url));
  }

  // Guarantee that /onboarding is never the target of session/refresh for an onboarded user
  const finalTarget = destination === "/onboarding" || destination.startsWith("/onboarding/")
    ? "/dashboard"
    : destination;

  const response = NextResponse.redirect(new URL(finalTarget, request.url));

  // Explicitly transfer refreshed cookies to the NextResponse so the browser
  // receives the updated __Secure-authjs.session-token / authjs.session-token
  const cookieJar = await cookies();
  for (const cookie of cookieJar.getAll()) {
    response.cookies.set(cookie.name, cookie.value);
  }

  return response;
}
