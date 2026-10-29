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
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resolvePostAuthDestination } from "@/lib/auth/destination";
import { configuredProviders } from "@/lib/auth-providers";
import { toLocalPath } from "@/lib/safe-redirect";

const scriptFont = Caveat({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sign In · AI Tathastu",
  description: "You imagine. AI Tathastu makes it happen.",
};

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked:
    "An account with this email already exists using a different sign-in method. Please sign in the way you did the first time (such as Google or Email Magic Link).",
  Verification:
    "That sign-in link has expired or has already been used. Please request a fresh link below.",
  Configuration:
    "Sign-in is temporarily unavailable. Please try again in a few moments.",
  AccessDenied:
    "Sign-in was cancelled or denied. Please try again.",
  InvalidEmail:
    "Please enter a valid email address.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-background text-foreground lg:grid lg:grid-cols-[57%_43%]">
      {/* ============================================================
          LEFT PANEL: RICH EDITORIAL WORKSPACE COMPOSITION (~57%)
      ============================================================ */}
      <section className="relative flex flex-col overflow-hidden min-h-[260px] sm:min-h-[290px] lg:min-h-dvh">
        {/* Workspace Photographic Background — anchored at top on mobile, desk/books at bottom-left on desktop */}
        <div
          className="absolute inset-0 bg-cover pointer-events-none select-none bg-[center_top] lg:bg-[left_bottom] bg-[url('/img/login-workspace-clean-640.webp')] lg:bg-[url('/img/login-workspace-clean-1024.webp')]"
          aria-hidden="true"
        />

        {/* Subtle dark overlay for rich contrast */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/10 pointer-events-none"
          aria-hidden="true"
        />

        {/* Mobile Readability Overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#FAFAFD]/98 via-[#FAFAFD]/92 to-[#FAFAFD]/60 lg:hidden pointer-events-none"
          aria-hidden="true"
        />

        {/* Soft, localized light treatment behind logo — desktop only */}
        <div
          className="absolute top-0 left-0 w-96 h-32 bg-gradient-to-br from-white/70 via-white/30 to-transparent pointer-events-none hidden lg:block"
          aria-hidden="true"
        />

        {/* Brand Logo in Upper-Left Corner */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-6 sm:px-10 sm:pt-8 lg:px-0 lg:pl-[24%] xl:pl-[27%] lg:pt-6 xl:pt-8">
          <BrandLogo href="/" withTagline size="md" taglineClassName="text-slate-600 font-semibold" />
          <Link
            href="/"
            className="lg:hidden inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-[#0F172A] bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200/90 shadow-2xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back</span>
          </Link>
        </div>

        {/* ── Desktop Hero Layout ── */}
        <div className="hidden lg:block relative z-10 ml-[42%] xl:ml-[44%] pr-4 xl:pr-8 mt-5 xl:mt-8 2xl:mt-12 max-w-[480px]">
          <h1
            className="font-sans text-[32px] lg:text-[34px] xl:text-[42px] 2xl:text-[46px] font-extrabold leading-[1.08] tracking-[-0.03em] text-[#0F172A]"
            style={{ textShadow: "0 1px 12px rgba(255,255,255,0.7), 0 0 20px rgba(255,255,255,0.4)" }}
          >
            <span className="block">Start building</span>
            <span className="block whitespace-nowrap">
              your{" "}
              <span className="profile-shimmer-highlight">
                profile.
              </span>
            </span>
          </h1>

          {/* Tathastu signature */}
          <div className="mt-1 flex justify-end pr-3 xl:pr-6">
            <div className="relative inline-block -rotate-2 select-none">
              <span
                className={`${scriptFont.className} text-[32px] lg:text-[34px] xl:text-[40px] font-bold text-[#FF2A85] tracking-tight inline-block`}
              >
                Tathastu.
              </span>
              <svg
                className="absolute -bottom-1 left-0 w-full overflow-visible pointer-events-none"
                style={{ height: "14px" }}
                viewBox="0 0 160 16"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M 3 13 C 45 15, 110 9, 157 4"
                  stroke="#FDE047"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Mobile Hero Layout ── */}
        <div className="lg:hidden relative z-10 px-6 pt-4 pb-5 sm:px-8 sm:pt-6">
          <h1 className="font-sans text-2xl sm:text-3xl font-extrabold leading-[1.12] tracking-[-0.02em] text-[#0F172A]">
            Start building your{" "}
            <span className="profile-shimmer-highlight">
              profile.
            </span>
          </h1>

          <div className="mt-1 flex justify-start">
            <div className="relative inline-block -rotate-2 select-none">
              <span
                className={`${scriptFont.className} text-2xl sm:text-[26px] font-bold text-[#FF2A85] tracking-tight inline-block`}
              >
                Tathastu.
              </span>
              <svg
                className="absolute -bottom-0.5 left-0 w-full overflow-visible pointer-events-none"
                style={{ height: "10px" }}
                viewBox="0 0 140 12"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M 3 9 C 35 11, 85 6, 137 3"
                  stroke="#FDE047"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="hidden lg:block flex-1" aria-hidden="true" />
      </section>

      {/* ============================================================
          RIGHT PANEL: CLEAN FOCUSED AUTHENTICATION CARD (~43%)
      ============================================================ */}
      <section className="relative z-10 flex flex-col justify-between p-4 sm:p-8 lg:p-8 xl:p-14 bg-background border-t border-border lg:border-t-0 lg:border-l lg:border-border min-h-[480px] lg:min-h-dvh">
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

        {/* Top-Right Navigation & Theme Controls */}
        <div className="flex items-center justify-between w-full">
          <ThemeToggleButton size="sm" />
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors py-1 px-2.5 rounded-lg hover:bg-accent"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            <span>Back to website</span>
          </Link>
        </div>

        {/* Center Authentication Card */}
        <div className="my-auto w-full max-w-[440px] mx-auto py-1 sm:py-3 lg:py-2 xl:py-6">
          <div className="rounded-3xl border border-border bg-card p-5 sm:p-7 lg:p-6 xl:p-8 shadow-xl shadow-black/5 dark:shadow-black/40 text-card-foreground">
            <div className="mb-5 sm:mb-6">
              <h2 className="font-sans text-xl sm:text-[24px] xl:text-[27px] font-bold tracking-tight text-foreground leading-tight">
                Start building your{" "}
                <span className="profile-shimmer-highlight inline-block">
                  profile.
                </span>
              </h2>
            </div>

            <Suspense fallback={<SignInOptions redirectTo="/dashboard" />}>
              <SignInWithParams searchParams={searchParams} />
            </Suspense>

            <p className="mt-5 xl:mt-6 text-center text-[11px] sm:text-[11.5px] leading-relaxed text-muted-foreground whitespace-nowrap">
              By continuing, you agree to AI Tathastu&apos;s{" "}
              <Link href="/terms" className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2 hover:text-primary transition-colors">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Compact Reassurance Row */}
          <div className="mt-6 sm:mt-7 flex flex-wrap sm:flex-nowrap items-center justify-center sm:justify-between gap-x-4 gap-y-2 text-[11px] sm:text-xs font-medium text-muted-foreground px-1">
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

        <div className="hidden lg:block h-6 pointer-events-none" aria-hidden="true" />
      </section>
    </main>
  );
}

async function SignInWithParams({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const redirectTo = toLocalPath(first(params.callbackUrl), "/dashboard");

  // Already signed in? Route to authoritative destination (dashboard if completed, pending step if incomplete).
  await connection();
  const session = await auth();
  if (session?.user?.id) {
    const { destination, isDeleted } = await resolvePostAuthDestination(session.user.id, first(params.callbackUrl));
    if (!isDeleted) {
      redirect(destination);
    }
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
