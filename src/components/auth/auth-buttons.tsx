"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { LinkedInIcon } from "@/components/auth/provider-icons";
import { Button } from "@/components/ui/button";

export function GoogleColorIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden {...props}>
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
      />
    </svg>
  );
}

export function GoogleSignInButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="h-12 w-full gap-3 rounded-2xl border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-2xs transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/80 hover:text-slate-900 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin text-slate-500" />
          <span>Connecting to Google...</span>
        </>
      ) : (
        <>
          <GoogleColorIcon className="size-4 shrink-0" />
          <span>Continue with Google</span>
        </>
      )}
    </Button>
  );
}

export function EmailSignInButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white shadow-md shadow-[#FF2A85]/25 transition-all duration-150 hover:opacity-95 hover:shadow-lg hover:shadow-[#FF2A85]/35 active:scale-[0.99] disabled:opacity-75 disabled:cursor-not-allowed select-none cursor-pointer bg-gradient-to-r from-[#FF2A85] via-[#FF5A36] to-[#FF6B4A]"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>Sending sign-in link...</span>
        </>
      ) : (
        <>
          <span>Email me a sign-in link</span>
          <ArrowRight className="size-4" />
        </>
      )}
    </button>
  );
}

export function LinkedInSignInButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
      className="h-11 w-full gap-2.5 rounded-xl border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" />
          <span>Connecting to LinkedIn...</span>
        </>
      ) : (
        <>
          <LinkedInIcon className="size-4 shrink-0" />
          <span>Continue with LinkedIn</span>
        </>
      )}
    </Button>
  );
}
