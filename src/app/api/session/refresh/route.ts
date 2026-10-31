import { connection, NextResponse, type NextRequest } from "next/server";

import { auth, unstable_update } from "@/auth";
import { resolvePostAuthDestination } from "@/lib/auth/destination";

/**
 * Re-derives the JWT `onboarded` claim from the database, then continues to
 * the authoritative post-auth destination.
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

  // unstable_update() wrote the refreshed session cookie, with its HttpOnly,
  // Secure and SameSite attributes, through next/headers; Next merges that into
  // this response. Don't copy cookies here: name and value alone would strip
  // those attributes from the session token.
  return NextResponse.redirect(new URL(finalTarget, request.url));
}
