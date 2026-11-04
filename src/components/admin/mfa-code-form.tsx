"use client";

import Link from "next/link";
import { useActionState } from "react";

import { submitCode, type MfaFormState } from "@/app/admin-mfa/actions";

const INITIAL: MfaFormState = {};
const BUTTON = "rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary/90 active:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function MfaCodeForm({ confirmed }: { confirmed: boolean }) {
  const [state, action, pending] = useActionState(submitCode, INITIAL);

  if (state.recoveryCodes) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Save your recovery codes</h2>
        <p className="text-sm text-muted-foreground">
          Each works once if you lose your authenticator. Using one removes the authenticator and signs you out everywhere, so
          you can set up a new one. They won&apos;t be shown again.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-md border bg-muted p-3 font-mono text-sm text-foreground">
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link href="/admin" className={`inline-block ${BUTTON}`}>
          I&apos;ve saved them
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="code" className="block text-sm font-medium text-foreground">
        {confirmed ? "6-digit code or recovery code" : "6-digit code"}
      </label>
      <input
        id="code"
        name="code"
        required
        autoComplete="one-time-code"
        maxLength={24}
        aria-describedby={state.error ? "code-error" : undefined}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {state.error && (
        <p id="code-error" role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={BUTTON}>
        {pending ? "Verifying..." : "Verify"}
      </button>
    </form>
  );
}
