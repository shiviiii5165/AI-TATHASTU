import { eq } from "drizzle-orm";
import { ArrowRight, CheckCircle2, CircleAlert, Mail, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { signInWithProvider } from "@/app/(auth)/login/actions";
import { auth } from "@/auth";
import { GoogleIcon, LinkedInIcon } from "@/components/auth/provider-icons";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db } from "@/db";
import { users } from "@/db/schema";
import { configuredProviders } from "@/lib/auth-providers";
import { toLocalPath } from "@/lib/safe-redirect";

export const metadata: Metadata = {
  title: "Sign in · AI Tathastu",
  description: "Sign in or create your verified AI Tathastu profile.",
};

const ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "That email already uses a different sign-in method. Sign in the way you did the first time.",
  Verification: "That sign-in link has expired or was already used. Request a new one below.",
  Configuration: "Sign-in isn't available right now. Try again in a few minutes.",
  AccessDenied: "Sign-in was cancelled or denied.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-x-hidden bg-white text-[#0F172A] lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Background ambient gradient accents */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -left-32 size-[480px] rounded-full bg-gradient-to-br from-[#FFE4E6]/50 via-[#FFF1F2]/40 to-transparent blur-3xl" />
        <div className="absolute top-1/2 -right-32 size-[420px] rounded-full bg-gradient-to-bl from-[#F3E8FF]/40 via-[#FEF9C3]/30 to-transparent blur-3xl" />
      </div>

      {/* Left panel: Brand storytelling & value proof (compact header on mobile, rich showcase on desktop) */}
      <section className="relative z-10 flex flex-col justify-between border-b border-slate-100 bg-gradient-to-b from-white via-slate-50/50 to-white px-4 py-5 sm:px-8 sm:py-8 lg:border-r lg:border-b-0 lg:p-14">
        <div>
          <BrandLogo href="/" withTagline size="md" />
          <p className="mt-2 text-xs font-medium text-slate-500 lg:hidden">
            Verified academic & career intelligence for AI creators
          </p>
        </div>

        {/* Extended value proof shown on desktop/laptop */}
        <div className="hidden lg:block my-10 max-w-lg lg:my-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200/60 bg-rose-50/80 px-3 py-1 font-mono text-[0.6875rem] font-semibold tracking-wider text-rose-700 uppercase">
            <Sparkles className="size-3 text-[#FF2A85]" />
            Career intelligence for AI students
          </div>

          <h1 className="mt-5 font-heading text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl text-[#0F172A]">
            Know exactly what to do{" "}
            <span className="font-serif font-normal italic text-[#FF2A85]">
              next.
            </span>
          </h1>

          <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
            Bring together your projects, research, GitHub commits, and digital footprint into one verified profile. We show you the shortest path to roles that fit you.
          </p>

          <div className="mt-8 space-y-3.5">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-700 motion-fade-in motion-stagger-1">
              <CheckCircle2 className="size-4 shrink-0 text-[#10B981]" />
              <span>Verifiable skill graph generated directly from your code & papers</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-700 motion-fade-in motion-stagger-2">
              <CheckCircle2 className="size-4 shrink-0 text-[#10B981]" />
              <span>Seamless connectors for GitHub, Kaggle, LeetCode & ORCID</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-medium text-slate-700 motion-fade-in motion-stagger-3">
              <CheckCircle2 className="size-4 shrink-0 text-[#10B981]" />
              <span>Tailored opportunities for placements, research, and learning</span>
            </div>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs font-medium text-slate-500">
          <ShieldCheck className="size-4 text-emerald-600" />
          <span>Takes about 3 minutes · Privacy-first · You control your data</span>
        </div>
      </section>

      {/* Right panel: Focused mobile-first authentication card */}
      <section className="relative z-10 flex items-center justify-center px-4 py-8 sm:px-8 sm:py-12 lg:p-14">
        <div className="w-full max-w-md rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-10 shadow-lg sm:shadow-xl shadow-slate-200/50 motion-slide-up">
          <div className="mb-6 sm:mb-7">
            <h2 className="font-heading text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-[#0F172A]">
              Sign in or create account
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
              New here? Signing in will automatically create your profile.
            </p>
          </div>

          <Suspense fallback={<SignInOptions redirectTo="/onboarding" />}>
            <SignInWithParams searchParams={searchParams} />
          </Suspense>

          <p className="mt-6 text-center text-[11px] sm:text-xs leading-relaxed text-slate-400">
            By continuing, you agree to AI Tathastu&apos;s{" "}
            <Link href="/about" className="font-medium text-slate-600 underline underline-offset-2 hover:text-[#0F172A]">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/contact" className="font-medium text-slate-600 underline underline-offset-2 hover:text-[#0F172A]">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
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
  const oauth = (
    [
      ["google", "Continue with Google", GoogleIcon],
      ["linkedin", "Continue with LinkedIn", LinkedInIcon],
    ] as const
  ).filter(([provider]) => enabled[provider]);

  return (
    <>
      {message && (
        <div role="alert" className="mb-5 flex gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-sm text-red-700">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600" />
          <span>{message}</span>
        </div>
      )}

      {oauth.length > 0 && (
        <div className="grid gap-3">
          {oauth.map(([provider, label, Icon]) => (
            <form key={provider} action={signInWithProvider}>
              <input type="hidden" name="provider" value={provider} />
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <Button
                type="submit"
                variant="outline"
                className="h-11 w-full gap-3 rounded-xl border-slate-200 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99]"
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Button>
            </form>
          ))}
        </div>
      )}

      {oauth.length > 0 && enabled.email && (
        <div className="my-6 flex items-center gap-3 text-xs font-semibold text-slate-400 uppercase tracking-wider" aria-hidden="true">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>
      )}

      {enabled.email && (
        <form action={signInWithProvider} className={oauth.length ? undefined : "mt-2"}>
          <input type="hidden" name="provider" value="email" />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <div>
            <Label htmlFor="email" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Email address
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
                className="h-11 rounded-xl border-slate-200 bg-white pl-10! text-base sm:text-sm text-[#0F172A] shadow-xs transition-colors placeholder:text-slate-400 focus-visible:border-[#FF2A85] focus-visible:ring-2 focus-visible:ring-[#FF2A85]/20"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn-brand-gradient mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-md shadow-rose-500/25 transition-all duration-150 hover:opacity-95 hover:shadow-lg hover:shadow-rose-500/35 active:scale-[0.99] select-none cursor-pointer"
          >
            Email me a sign-in link
            <ArrowRight className="size-4" />
          </button>
        </form>
      )}

      {!enabled.email && oauth.length === 0 && (
        <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          No sign-in method is currently configured. Please configure OAuth or SMTP in your environment.
        </div>
      )}

      {enabled.linkedin && (
        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
          LinkedIn sign-in securely shares only your name, email and avatar.
        </p>
      )}
    </>
  );
}
