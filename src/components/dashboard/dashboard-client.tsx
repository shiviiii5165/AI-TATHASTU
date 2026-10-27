"use client";

import { Eye, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { updateWidgetPref } from "@/app/(dashboard)/dashboard/actions";
import type { WidgetId } from "@/lib/dashboard/widgets";

const DELAYS_MS = [3_000, 4_000, 6_000, 8_000, 10_000];
const GIVE_UP_AFTER_MS = 5 * 60_000;

type PollState = "waiting" | "ready" | "failed" | "timeout" | "signed_out";

/**
 * While profile_views hasn't been written yet, polls the small
 * /api/dashboard/status endpoint (not the whole page) with backoff, paused
 * while the tab is hidden. Refreshes the page once, when it's ready.
 */
export function RefreshUntilReady() {
  const router = useRouter();
  const [state, setState] = useState<PollState>("waiting");
  const [run, setRun] = useState(0); // bumped by "Check again"

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let etag: string | null = null;
    const deadline = Date.now() + GIVE_UP_AFTER_MS;

    const schedule = (ms = DELAYS_MS[Math.min(attempt++, DELAYS_MS.length - 1)]) => {
      clearTimeout(timer);
      if (!cancelled && !document.hidden) timer = setTimeout(check, ms);
    };

    async function check() {
      if (cancelled) return;
      if (Date.now() > deadline) return setState("timeout");
      try {
        const res = await fetch("/api/dashboard/status", { cache: "no-store", headers: etag ? { "If-None-Match": etag } : {} });
        if (cancelled) return;
        if (res.status === 401) return setState("signed_out");
        if (res.status === 200) {
          etag = res.headers.get("ETag");
          const status = (await res.json()) as { ready: boolean; job: string | null };
          if (status.ready) {
            setState("ready");
            router.refresh(); // the one full re-render, now that there's something to show
            return;
          }
          if (status.job === "failed" || status.job === "needs_review") return setState("failed");
        }
      } catch {
        // Offline or a blip: keep backing off until the deadline.
      }
      schedule();
    }

    // Pause while hidden (cancel the pending check); resume, checking at once, when visible.
    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer);
      else schedule(0);
    };
    document.addEventListener("visibilitychange", onVisibility);
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, run]);

  const retry = (
    <button
      type="button"
      onClick={() => {
        setState("waiting");
        setRun((n) => n + 1);
      }}
      className="ml-1 rounded-sm font-medium text-foreground underline underline-offset-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      Check again
    </button>
  );
  if (state === "timeout")
    return <p className="mt-3 text-sm text-muted-foreground">This is taking longer than usual.{retry}</p>;
  if (state === "failed")
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        We couldn&apos;t finish personalizing your dashboard. Your profile is saved; it will be retried when your data changes.{retry}
      </p>
    );
  if (state === "signed_out") return <p className="mt-3 text-sm text-muted-foreground">Your session ended. Sign in again to continue.</p>;
  return null;
}

/** Dismissed widgets, with one-click restore. */
export function HiddenWidgets({ items }: { items: { id: WidgetId; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [restoring, setRestoring] = useState<string | null>(null);

  return (
    <div className="mt-10 border-t pt-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="hidden-widgets"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-sm text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Eye aria-hidden className="size-4" />
        {items.length} hidden {items.length === 1 ? "widget" : "widgets"}
      </button>
      {open && (
        <ul id="hidden-widgets" className="mt-3 flex flex-wrap gap-2">
          {items.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setRestoring(w.id);
                  startTransition(async () => {
                    await updateWidgetPref({ widgetId: w.id, dismissed: false }).catch(() => null);
                    setRestoring(null);
                  });
                }}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-border-strong px-3 text-sm transition-colors duration-150 hover:border-foreground hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-60"
              >
                {restoring === w.id && <LoaderCircle aria-hidden className="size-3.5 animate-spin" />}
                Show {w.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
