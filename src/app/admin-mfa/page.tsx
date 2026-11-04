import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { MfaCodeForm } from "@/components/admin/mfa-code-form";
import { getMfaEnrollment, isAdminSessionFresh, isMfaKeyConfigured, isRecentAuth } from "@/lib/admin/mfa";
import { getAdminContext } from "@/lib/admin/rbac";
import { otpauthUri } from "@/lib/admin/totp";
import { getCurrentUser } from "@/lib/dal";

import { reauthenticate, startEnrollment } from "./actions";

export const metadata: Metadata = { title: "Admin verification", robots: { index: false } };

const BUTTON = "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function AdminMfaPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Admin verification</h1>
      <Suspense fallback={<div role="status" aria-label="Loading" className="h-48 animate-pulse rounded-lg border bg-muted" />}>
        <Content />
      </Suspense>
    </main>
  );
}

async function Content() {
  await connection();
  const user = await getCurrentUser();
  if (!(await getAdminContext(user))) notFound();
  if (!isMfaKeyConfigured()) {
    return <p role="alert" className="text-sm text-destructive">Admin verification isn&apos;t configured on this server. Set ADMIN_MFA_SECRET.</p>;
  }
  const enrollment = await getMfaEnrollment(user.id);
  const session = await auth();

  if (enrollment?.confirmed && isAdminSessionFresh(session?.authTime)) return <MfaCodeForm confirmed />;

  // Admin sessions are daily, and setting up claims the account's second factor,
  // so that secret only appears after a sign-in this fresh.
  if (!isRecentAuth(session?.authTime)) {
    return (
      <form action={reauthenticate} className="space-y-4">
        <p className="text-sm text-muted-foreground">For admin access, sign in again first.</p>
        <button type="submit" className={BUTTON}>
          Sign in again
        </button>
      </form>
    );
  }

  if (!enrollment) {
    return (
      <form action={startEnrollment} className="space-y-4">
        <p className="text-sm text-muted-foreground">Set up an authenticator app to protect admin access.</p>
        <button type="submit" className={BUTTON}>
          Start setup
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Add this key to your authenticator app. It won&apos;t be shown again after you confirm.</p>
        <code className="block break-all rounded-md border bg-muted p-3 text-foreground">{enrollment.secret}</code>
        <a className="underline text-foreground" href={otpauthUri(enrollment.secret, user.email ?? user.id)}>
          Open in authenticator app
        </a>
      </div>
      <MfaCodeForm confirmed={false} />
    </div>
  );
}
