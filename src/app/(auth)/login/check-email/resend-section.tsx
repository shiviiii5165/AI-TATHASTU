"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { signInWithProvider } from "@/app/(auth)/login/actions";

export function ResendSection({ email }: { email?: string }) {
  const [cooldown, setCooldown] = useState(60);
  const [isPending, startTransition] = useTransition();
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const handleResend = () => {
    if (cooldown > 0 || isPending || !email) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.set("provider", "email");
      formData.set("email", email);
      formData.set("redirectTo", "/dashboard");

      try {
        await signInWithProvider(formData);
        setResent(true);
        setCooldown(60);
      } catch {
        // Redirection or handled error
      }
    });
  };

  if (!email) return null;

  return (
    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col items-center">
      {resent && (
        <p className="text-xs text-emerald-600 font-medium mb-2.5">
          A fresh sign-in link has been sent to your inbox.
        </p>
      )}

      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || isPending}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FF2A85] hover:text-[#e01e74] disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
      >
        {isPending ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            <span>Sending fresh link...</span>
          </>
        ) : cooldown > 0 ? (
          <>
            <RefreshCw className="size-3.5 text-slate-300" />
            <span>Resend available in {cooldown}s</span>
          </>
        ) : (
          <>
            <RefreshCw className="size-3.5" />
            <span>Resend sign-in link</span>
          </>
        )}
      </button>
    </div>
  );
}

