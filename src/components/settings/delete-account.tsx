"use client";

import { useState, useTransition } from "react";

import { deleteMyAccount } from "@/app/(dashboard)/settings/privacy/actions";

export function DeleteAccount({ email }: { email: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const matches = confirmation.trim().toLowerCase() === email.toLowerCase();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await deleteMyAccount(confirmation);
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <section aria-labelledby="delete-account-title" className="rounded-lg border border-destructive/40 bg-card p-6 space-y-3">
      <h2 id="delete-account-title" className="text-lg font-semibold text-foreground">
        Delete your account
      </h2>
      <p className="text-sm text-muted-foreground max-w-2xl">
        This permanently removes your profile, uploaded resumes, connections, scores and matches. It can&apos;t be undone.
        Support conversations are kept without your email address.
      </p>
      <form onSubmit={submit} className="space-y-3 max-w-md">
        <div>
          <label htmlFor="delete-account-email" className="block text-sm font-medium text-foreground mb-1.5">
            Type {email} to confirm
          </label>
          <input
            id="delete-account-email"
            type="email"
            autoComplete="off"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            aria-describedby={error ? "delete-account-error" : undefined}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        {error && (
          <p id="delete-account-error" role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={!matches || isPending}
          className="rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-destructive/90 active:bg-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Deleting..." : "Permanently delete my account"}
        </button>
      </form>
    </section>
  );
}
