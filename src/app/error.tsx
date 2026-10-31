"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

/** A page failed to render (usually a database or service outage). The rest of the app is unaffected. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    // The digest matches the server log; the message itself isn't sent to the browser in production.
    console.error("page render failed", error.digest ?? error.name);
  }, [error]);

  // A failed Server Component only re-runs if the route is refreshed as well.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  return (
    <main className="flex flex-1 items-center px-6 py-16 sm:px-10">
      <div role="alert" className="max-w-md">
        <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Something went wrong</p>
        <h1 className="mt-3 font-heading text-5xl leading-tight">We couldn&apos;t load this page.</h1>
        <p className="mt-3 text-muted-foreground">
          This is on our side, and your saved information is safe. Try again in a moment.
        </p>
        <div className="mt-6 flex items-center gap-5">
          <button
            type="button"
            onClick={retry}
            className="rounded-sm text-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-sm text-sm text-muted-foreground underline underline-offset-4 hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Go to the home page
          </Link>
        </div>
      </div>
    </main>
  );
}
