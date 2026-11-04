import { connection, NextResponse } from "next/server";

import { auth } from "@/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { clientById, launchUrl } from "@/lib/integrations/clients";
import { isIntegrationKeyConfigured } from "@/lib/integrations/tokens";

/**
 * GET /integrations/launch/<client> — "Open Collaborate" from the dashboard.
 *
 * Sends the signed-in user to the app's own start URL, so the app creates its
 * state + PKCE and comes back through /integrations/authorize. There, an
 * existing session and consent mean no screen: the user lands in the app
 * signed in. Nothing here grants access by itself and no secret reaches the
 * browser. If the app isn't switched on, the user goes back to the
 * Integrations page with a notice instead of a broken round trip.
 */
export async function GET(request: Request, { params }: { params: Promise<{ client: string }> }) {
  await connection();
  const { client: id } = await params;
  const client = clientById(id);
  if (!client) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const session = await auth();
  if (!session?.user?.id) {
    const back = `/integrations/launch/${client.id}`;
    return NextResponse.redirect(new URL(`/login?callbackUrl=${encodeURIComponent(back)}`, request.url), 303);
  }

  const available = Boolean(client.secret) && isIntegrationKeyConfigured() && (await isFeatureEnabled(client.flag));
  if (!available) {
    return NextResponse.redirect(new URL(`/settings/integrations?unavailable=${client.id}`, request.url), 303);
  }
  return NextResponse.redirect(launchUrl(client), 303);
}
