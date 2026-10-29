import { ArrowLeft, MailCheck, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ResendSection } from "./resend-section";

export const metadata: Metadata = {
  title: "Check your inbox · AI Tathastu",
};

export default function CheckEmailPage({ searchParams }: PageProps<"/login/check-email">) {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center bg-white px-4 py-8 sm:px-6 sm:py-16 text-[#0F172A]">
      {/* Background ambient gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-1/4 left-1/2 size-[450px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-[#FFE4E6]/50 via-[#F3E8FF]/30 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        <div className="mb-6 sm:mb-8 flex justify-center">
          <BrandLogo href="/" withTagline size="md" />
        </div>

        <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl sm:p-10">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FFE4E6] to-[#FCE7F3] shadow-inner">
            <MailCheck aria-hidden="true" className="size-7 text-[#FF2A85]" />
          </div>

          <h1 className="mt-5 font-heading text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[#0F172A]">
            Check your inbox.
          </h1>

          <Suspense fallback={<CheckEmailFallback />}>
            <CheckEmailContent searchParams={searchParams} />
          </Suspense>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-[11px] sm:text-xs text-slate-500">
            Link expires in 24 hours. Can&apos;t find it? Check your spam or promotions folder.
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 w-full sm:w-auto"
            >
              <ArrowLeft className="size-4" />
              Use a different email or method
            </Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          <span>Secure passwordless authentication powered by AI Tathastu</span>
        </div>
      </div>
    </main>
  );
}

function CheckEmailFallback() {
  return (
    <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600">
      We sent you a sign-in link. Click the link in your email to sign in or finish creating your verified profile.
    </p>
  );
}

async function CheckEmailContent({ searchParams }: Pick<PageProps<"/login/check-email">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const cookieStore = await cookies();

  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const emailParam = first(params.email);
  const emailCookie = cookieStore.get("tat_auth_email")?.value;
  const targetEmail = emailParam || emailCookie;

  return (
    <>
      <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600">
        {targetEmail ? (
          <>
            We sent a secure sign-in link to <strong className="text-slate-800 font-semibold">{targetEmail}</strong>.
          </>
        ) : (
          "We sent you a sign-in link."
        )}{" "}
        Click the link in your email to sign in or finish creating your verified profile.
      </p>
      <ResendSection email={targetEmail} />
    </>
  );
}
