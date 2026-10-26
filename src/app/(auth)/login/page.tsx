import { eq } from "drizzle-orm";
import { ArrowLeft, CircleAlert, Mail, ShieldCheck, Users, Zap } from "lucide-react";
import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { signInWithProvider } from "@/app/(auth)/login/actions";
import { auth } from "@/auth";
import { EmailSignInButton, GoogleSignInButton, LinkedInSignInButton } from "@/components/auth/auth-buttons";
import { BrandLogo } from "@/components/brand-logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/db";
import { users } from "@/db/schema";
import { configuredProviders } from "@/lib/auth-providers";
import { toLocalPath } from "@/lib/safe-redirect";

const scriptFont = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Welcome to AI Tathastu · Sign in",
  description: "Turn effort into opportunities. Sign in or create your verified AI Tathastu profile.",
};

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That email already uses a different sign-in method. Sign in the way you did the first time.",
  Verification: "That sign-in link has expired or was already used. Request a new one below.",
  Configuration: "Sign-in isn't available right now. Try again in a few minutes.",
  AccessDenied: "Sign-in was cancelled or denied.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-[#FAFAFD] text-[#0F172A] lg:grid lg:grid-cols-[56%_44%]">
      {/* ============================================================
          LEFT PANEL: RICH EDITORIAL WORKSPACE COMPOSITION (~56%)
      ============================================================ */}
      <section className="relative flex flex-col justify-start overflow-hidden px-5 py-6 sm:px-10 sm:py-8 lg:px-12 lg:py-10 xl:px-16 xl:py-12 min-h-auto lg:min-h-dvh">
        {/* Workspace Photographic Background */}
        <div
          className="absolute inset-0 bg-cover bg-[center_top] sm:bg-[center_bottom] pointer-events-none select-none transition-transform duration-700 ease-out"
          style={{
            backgroundImage: "url('/brand/login-workspace-clean.jpg')",
          }}
          aria-hidden="true"
        />

        {/* Mobile Readability Overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#FAFAFD]/95 via-[#FAFAFD]/85 to-[#FAFAFD]/40 lg:hidden pointer-events-none"
          aria-hidden="true"
        />

        {/* Brand Logo in Upper-Left Corner */}
        <div className="relative z-10 flex items-center justify-between">
          <BrandLogo href="/" withTagline size="md" />
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[#0F172A] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200/90 shadow-2xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back</span>
          </Link>
        </div>

        {/* Storytelling Hero: Headline, Tathastu Signature & Subtitle */}
        {/* Positioned in the upper right sunlit area, above the laptop */}
        <div className="relative z-10 mt-3 sm:mt-6 lg:mt-8 xl:mt-10 ml-auto max-w-[420px] lg:mr-2 xl:mr-6 text-left">
          <h1 className="font-sans text-xl sm:text-2xl lg:text-[40px] xl:text-[44px] font-extrabold leading-[1.15] lg:leading-[1.1] tracking-tight text-[#0F172A]">
            Turn effort<br className="hidden sm:inline" />{" "}
            into{" "}
            <span className="bg-gradient-to-r from-[#FF2A85] via-[#FF4542] to-[#FF6B4A] bg-clip-text text-transparent">
              opportunities.
            </span>
          </h1>

          {/* Tathastu Brand Signature with light-yellow curved underline */}
          <div className="mt-0.5 sm:mt-1 flex justify-start sm:justify-end pr-1 sm:pr-4">
            <div className="relative inline-block -rotate-2 select-none">
              <span
                className={`${scriptFont.className} text-xl sm:text-2xl lg:text-[38px] xl:text-[42px] font-bold text-[#FF2A85] tracking-tight inline-block drop-shadow-[0_1px_2px_rgba(255,42,133,0.15)]`}
              >
                Tathastu.
              </span>
              <svg
                className="absolute -bottom-1 left-0 w-full h-2.5 sm:h-3.5 overflow-visible pointer-events-none"
                viewBox="0 0 140 16"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M 4 11 C 45 3, 95 3, 136 8"
                  stroke="#FDE047"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Supporting Description */}
          <p className="mt-2 sm:mt-3 lg:mt-4 text-[11px] sm:text-xs lg:text-[14.5px] font-medium leading-relaxed text-[#334155] max-w-[340px] sm:ml-auto">
            Showcase your work, get discovered and grow with the right people.
          </p>
        </div>

        {/* Illustrative Demo Badge for Laptop Preview */}
        <div className="relative z-10 hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-slate-200/70 text-[11px] font-medium text-slate-500 shadow-2xs mt-auto self-start select-none">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Illustrative demo profile · Sample dashboard preview</span>
        </div>
      </section>

      {/* ============================================================
          RIGHT PANEL: CLEAN FOCUSED AUTHENTICATION CARD (~44%)
      ============================================================ */}
      <section className="relative z-10 flex flex-col justify-between p-4 sm:p-8 lg:p-12 xl:p-16 bg-[#FAFAFD] border-t border-slate-100 lg:border-t-0 lg:border-l lg:border-slate-200/60 min-h-[480px] lg:min-h-dvh">
        {/* Ambient flowing pastel wave decoration in bottom-right corner */}
        <div className="pointer-events-none absolute bottom-0 right-0 size-[440px] overflow-hidden" aria-hidden="true">
          <div className="absolute -bottom-24 -right-24 size-[400px] rounded-full bg-gradient-to-tl from-[#FF2A85]/14 via-[#8B5CF6]/10 to-transparent blur-3xl" />
          <svg className="absolute bottom-0 right-0 w-80 h-80 opacity-30" viewBox="0 0 320 320" fill="none">
            <path
              d="M 30 320 C 130 230, 220 280, 320 170 L 320 320 Z"
              fill="url(#loginCornerGrad)"
            />
            <defs>
              <linearGradient id="loginCornerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FF2A85" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#8B5CF6" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Top-Right "Back to website" Link */}
        <div className="hidden lg:flex items-center justify-end w-full">
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-[#0F172A] transition-colors py-1.5 px-3 rounded-lg hover:bg-slate-100/70"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to website</span>
          </Link>
        </div>

        {/* Center Authentication Card */}
        <div className="my-auto w-full max-w-[430px] mx-auto py-2 sm:py-6">
          <div className="rounded-3xl border border-slate-200/85 bg-white p-5 sm:p-9 shadow-xl shadow-slate-200/50">
            <div className="mb-5 sm:mb-7">
              <h2 className="font-sans text-xl sm:text-[27px] font-bold tracking-tight text-[#0F172A] leading-tight">
                Welcome to AI Tathastu
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Sign in or create your profile to continue.
              </p>
            </div>

            <Suspense fallback={<SignInOptions redirectTo="/onboarding" />}>
              <SignInWithParams searchParams={searchParams} />
            </Suspense>

            <p className="mt-6 text-center text-[11px] sm:text-xs leading-relaxed text-slate-400">
              By continuing, you agree to AI Tathastu&apos;s{" "}
              <Link href="/terms" className="font-medium text-slate-600 underline underline-offset-2 hover:text-[#0F172A] transition-colors">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-slate-600 underline underline-offset-2 hover:text-[#0F172A] transition-colors">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Compact Reassurance Row */}
          <div className="mt-6 sm:mt-7 flex flex-wrap sm:flex-nowrap items-center justify-center sm:justify-between gap-x-4 gap-y-2 text-[11px] sm:text-xs font-medium text-slate-600 px-1">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <ShieldCheck className="size-3.5 sm:size-4 text-[#10B981] shrink-0" />
              <span>Your data stays private.</span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Users className="size-3.5 sm:size-4 text-[#3B82F6] shrink-0" />
              <span>A trusted student community.</span>
            </div>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <Zap className="size-3.5 sm:size-4 text-[#F59E0B] shrink-0" />
              <span>Real opportunities.</span>
            </div>
          </div>
        </div>

        {/* Bottom space balance */}
        <div className="hidden lg:block h-6 pointer-events-none" aria-hidden="true" />
      </section>
    </main>
  );
}

async function SignInWithParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const redirectTo = toLocalPath(first(params.callbackUrl));

  // Already signed in (and the account still exists)? Skip the form.
  await connection();
  const session = await auth();
  if (session?.user?.id) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, session.user.id));
    if (user) redirect(redirectTo);
  }

  const errorKey = first(params.error);
  const message =
    first(params.reason) === "session"
      ? "Your session ended. Sign in again to continue."
      : errorKey
        ? (ERRORS[errorKey] ?? "Something went wrong signing you in. Try again.")
        : null;

  return <SignInOptions redirectTo={redirectTo} message={message} />;
}

function SignInOptions({ redirectTo, message }: { redirectTo: string; message?: string | null }) {
  const enabled = configuredProviders();

  return (
    <>
      {message && (
        <div role="alert" className="mb-5 flex gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-sm text-red-700">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Google OAuth Button */}
      {enabled.google && (
        <div>
          <form action={signInWithProvider}>
            <input type="hidden" name="provider" value="google" />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <GoogleSignInButton />
          </form>
        </div>
      )}

      {/* LinkedIn OAuth fallback if configured in environment */}
      {enabled.linkedin && (
        <div className="mt-2.5">
          <form action={signInWithProvider}>
            <input type="hidden" name="provider" value="linkedin" />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <LinkedInSignInButton />
          </form>
        </div>
      )}

      {/* OR Divider */}
      {enabled.google && enabled.email && (
        <div className="my-5 flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-wider" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200/90" />
          OR
          <span className="h-px flex-1 bg-slate-200/90" />
        </div>
      )}

      {/* Email Magic Link Form */}
      {enabled.email && (
        <form action={signInWithProvider} className={enabled.google ? undefined : "mt-2"}>
          <input type="hidden" name="provider" value="email" />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div>
            <Label htmlFor="email" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              EMAIL ADDRESS
            </Label>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@university.edu"
                className="h-12 rounded-2xl border-slate-200 bg-white pl-10! text-base md:text-sm text-[#0F172A] shadow-2xs transition-colors placeholder:text-slate-400 focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20"
              />
            </div>
          </div>
          <EmailSignInButton />
          <p className="mt-2.5 text-center text-xs text-slate-400 font-normal">
            We&apos;ll send you a secure sign-in link.
          </p>
        </form>
      )}

      {!enabled.email && !enabled.google && (
        <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No sign-in method is currently configured. Please configure OAuth or SMTP in your environment.
        </div>
      )}
    </>
  );
}
