"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setExternalAiConsent } from "@/app/onboarding/resume/actions";
import { RESUME_AI_CONSENT } from "@/lib/consent/catalog";

/**
 * The one-time updated-consent request for people who allowed AI-assisted resume reading before the consent text
 * disclosed its full scope. Shown only while needsExternalAiScopeUpdate() is true; either answer records a consent
 * row under the current policy version, after which it never appears again. Until then the worker keeps using
 * the earlier grant for resume reading only.
 */
export function ConsentScopeNotice() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const covers = RESUME_AI_CONSENT.details.find((d) => d.term === "What else this covers")!.text;

  const answer = (granted: boolean) =>
    start(async () => {
      setError(null);
      const res = await setExternalAiConsent(granted);
      if (res.ok) router.refresh();
      else setError(res.error);
    });

  return (
    <section aria-labelledby="consent-scope-title" data-testid="consent-scope-notice" className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 text-sm dark:border-violet-400/30 dark:bg-violet-500/10 sm:p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-violet-600 dark:text-violet-300" />
        <div className="min-w-0 flex-1">
          <h2 id="consent-scope-title" className="font-bold text-foreground">
            Please review your AI permission
          </h2>
          <p className="mt-1 text-muted-foreground">
            You allowed outside AI services (Groq, Google Gemini or OpenRouter) to help read your resume. The same permission also covers more, which our earlier description
            didn&apos;t say: {covers.replace(/^The same permission lets these services /, "it lets them ")}
          </p>
          <p className="mt-1 text-muted-foreground">
            Until you choose, we use it for your resume only. Turning it off stops all outside AI processing, including for your resume. You can change this any time in Privacy settings.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" disabled={pending} onClick={() => answer(true)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
              Allow all of these
            </button>
            <button type="button" disabled={pending} onClick={() => answer(false)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60">
              Turn off AI processing
            </button>
            <Link href={RESUME_AI_CONSENT.manageHref} className="text-xs font-semibold text-primary hover:underline">
              Privacy settings
            </Link>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
