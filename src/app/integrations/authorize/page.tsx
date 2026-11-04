import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { BrandLogo } from "@/components/brand-logo";
import { AuthorizeForm } from "@/components/integrations/authorize-form";
import { issueCode, parseAuthorizeRequest, silentAuthorize } from "@/lib/integrations/authorize";
import { effectiveScopes, getConsent, isLinked } from "@/lib/integrations/consent";

export const metadata: Metadata = { title: "Sign in with AI Tathastu" };

/**
 * OAuth authorization endpoint for integrated apps (Collaborate, Meet).
 * First visit: the user picks what the app may see and approves; we redirect
 * back with a one-time code the app exchanges at /api/integrations/sso/token.
 * Later visits skip the screen (prompt=consent shows it again; prompt=none
 * never shows any screen and returns login_required / consent_required).
 */
export default function AuthorizePage({ searchParams }: PageProps<"/integrations/authorize">) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-lg">
        <BrandLogo />
        <Suspense fallback={<p className="mt-10 text-muted-foreground">Loading…</p>}>
          <Authorize searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function Authorize({ searchParams }: Pick<PageProps<"/integrations/authorize">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const query = new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  ).toString();

  const session = await auth();
  const parsed = await parseAuthorizeRequest(params);
  // prompt=none never shows our login or consent screens: answer the app directly.
  if (parsed.ok && parsed.req.silent) redirect(await silentAuthorize(session?.user?.id ?? null, parsed.req));
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/integrations/authorize?${query}`)}`);

  if (!parsed.ok) {
    if (parsed.redirect) redirect(parsed.redirect);
    return (
      <div className="mt-10">
        <h1 className="font-heading text-3xl">Can&apos;t sign in here.</h1>
        <p role="alert" className="mt-2 text-muted-foreground">
          {parsed.message}
        </p>
      </div>
    );
  }

  const { client, forceConsent } = parsed.req;
  const consent = await getConsent(session.user.id, client.id);
  // Already approved and still linked: straight back to the app.
  if (isLinked(consent) && !forceConsent) redirect(await issueCode(session.user.id, parsed.req));

  return (
    <AuthorizeForm
      query={query}
      client={{ id: client.id, name: client.name, description: client.description, host: new URL(client.origin).host }}
      initialScopes={effectiveScopes(consent)}
      requested={client.requested}
      email={session.user.email ?? null}
    />
  );
}
