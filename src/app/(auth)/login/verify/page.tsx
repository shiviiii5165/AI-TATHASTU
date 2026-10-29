import { ArrowLeft, CheckCircle2, CircleAlert, Loader2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { BrandLogo } from "@/components/brand-logo";
import { resolvePostAuthDestination } from "@/lib/auth/destination";
import { toLocalPath } from "@/lib/safe-redirect";
import { VerifyRedirect } from "./verify-redirect";

export const metadata: Metadata = {
  title: "Verifying Email · AI Tathastu",
};

export default function VerifyEmailPage({ searchParams }: PageProps<"/login/verify">) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-4 py-8 sm:px-6 sm:py-16 text-[#0F172A]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 size-[450px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-[#ECFDF5]/60 via-[#FDF2F8]/40 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        <div className="mb-6 sm:mb-8 flex justify-center">
          <BrandLogo href="/" withTagline size="md" />
        </div>

        <Suspense fallback={<VerifyEmailFallback />}>
          <VerifyEmailContent searchParams={searchParams} />
        </Suspense>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          <span>Secure authentication confirmed</span>
        </div>
      </div>
    </main>
  );
}

function VerifyEmailFallback() {
  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl sm:p-10 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner">
        <Loader2 className="size-7 animate-spin text-emerald-600" />
      </div>

      <h1 className="mt-5 font-heading text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
        Email verified. Signing you in…
      </h1>

      <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600">
        Establishing your secure session and preparing your workspace…
      </p>
    </div>
  );
}

async function VerifyEmailContent({ searchParams }: Pick<PageProps<"/login/verify">, "searchParams">) {
  await connection();
  const session = await auth();
  const params = await searchParams;

  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const rawCallback = first(params.callbackUrl);
  const safeCallback = toLocalPath(rawCallback, "/dashboard");

  if (!session?.user?.id) {
    return (
      <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl sm:p-10 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-inner">
          <CircleAlert className="size-7" />
        </div>

        <h1 className="mt-5 font-heading text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
          Session Not Detected
        </h1>

        <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600">
          We couldn&apos;t verify your active session in this browser window.
        </p>

        <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-[11px] sm:text-xs text-amber-800 text-left">
          <strong>Same-Browser Notice:</strong> If you opened the sign-in link from an external app, private window, or another device, your authenticated session was established there. Please return to the original window or sign in directly.
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 w-full"
          >
            <ArrowLeft className="size-4" />
            Return to sign in
          </Link>
        </div>
      </div>
    );
  }

  const { destination } = await resolvePostAuthDestination(session.user.id, safeCallback);

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl sm:p-10">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-inner animate-in zoom-in-90 duration-300">
        <CheckCircle2 className="size-7 text-emerald-600" />
      </div>

      <h1 className="mt-5 font-heading text-xl sm:text-2xl font-bold tracking-tight text-[#0F172A]">
        Email verified. Signing you in…
      </h1>

      <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600">
        Your identity has been verified. Establishing your session and preparing your workspace…
      </p>

      <VerifyRedirect destination={destination} />

      <div className="mt-6 border-t border-slate-100 pt-5">
        <Link
          href={destination}
          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
        >
          Click here if you aren&apos;t automatically redirected
        </Link>
      </div>
    </div>
  );
}
