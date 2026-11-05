"use client";

import { ArrowRight, LoaderCircle, Pin, PinOff, RefreshCw, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";

import { refreshGithub, updateWidgetPref } from "@/app/(dashboard)/dashboard/actions";
import type { WidgetState } from "@/lib/dashboard/types";
import type { WidgetId } from "@/lib/dashboard/widgets";
import { cn } from "@/lib/utils";

export type WidgetWrapperProps = {
  id: WidgetId;
  label: string;
  module: string;
  size: "regular" | "wide";
  state: WidgetState;
  pinned: boolean;
  primaryAction: { label: string; href: string } | null;
  // e.g. "Synced 9 days ago" for a stale connector widget.
  staleNote?: string;
  refreshable?: "github";
  children: React.ReactNode;
};

/**
 * Frame shared by every widget: header (module eyebrow, title, pin/dismiss),
 * a stale/partial notice, the body, and the primary action. Pin and dismiss
 * update optimistically, then the server action re-renders the dashboard.
 */
export function WidgetWrapper(props: WidgetWrapperProps) {
  const { id, label, module, size, state, primaryAction, staleNote, refreshable, children } = props;
  const [optimistic, setOptimistic] = useOptimistic({ pinned: props.pinned, dismissed: false });
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const headingId = `widget-${id}`;

  function change(patch: { pinned?: boolean; dismissed?: boolean }) {
    setError(null);
    startTransition(async () => {
      setOptimistic((s) => ({ ...s, ...patch }));
      try {
        const result = await updateWidgetPref({ widgetId: id, ...patch });
        if (!result.ok) setError(result.error);
      } catch {
        // The optimistic change reverts when the transition ends.
        setError("Couldn't save that change. Try again.");
      }
    });
  }

  if (optimistic.dismissed) return null;

  return (
    <article
      aria-labelledby={headingId}
      aria-busy={pending || undefined}
      className={cn(
        "flex min-h-56 flex-col rounded-lg border bg-card transition-all duration-200 motion-slide-up",
        size === "wide" && "xl:col-span-2",
        optimistic.pinned && "border-foreground shadow-sm",
        pending && "opacity-75",
      )}
    >

      <header className="flex items-start gap-3 px-5 pt-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-mono text-[0.6875rem] tracking-wider text-muted-foreground uppercase">
            {module}
            {optimistic.pinned && (
              <span className="inline-flex items-center gap-1 text-brand">
                <Pin aria-hidden className="size-3" /> Pinned
              </span>
            )}
            {state === "preview" && <span className="rounded-full border px-1.5 normal-case tracking-normal">Preview</span>}
          </p>
          <h2 id={headingId} className="mt-1 font-heading text-2xl leading-tight">
            {label}
          </h2>
        </div>
        <div className="-mr-2 flex shrink-0 items-center">
          <IconButton
            label={optimistic.pinned ? `Unpin ${label}` : `Pin ${label} to the top`}
            pressed={optimistic.pinned}
            disabled={pending}
            onClick={() => change({ pinned: !optimistic.pinned })}
          >
            {optimistic.pinned ? <PinOff /> : <Pin />}
          </IconButton>
          <IconButton label={`Hide ${label}`} disabled={pending} onClick={() => change({ dismissed: true })}>
            <X />
          </IconButton>
        </div>
      </header>

      {(state === "stale" || state === "partial") && (
        <Notice state={state} staleNote={staleNote} refreshable={refreshable} />
      )}
      {error && (
        <p role="alert" className="mx-5 mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex-1 px-5 pt-4 pb-5">{children}</div>

      {primaryAction && state !== "empty" && (
        <footer className="border-t px-5 py-3">
          <Link
            href={primaryAction.href}
            className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium transition-colors duration-150 hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {primaryAction.label}
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </footer>
      )}
    </article>
  );
}

function IconButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className="flex size-8 pointer-coarse:size-10 items-center justify-center rounded-md text-muted-foreground transition-all duration-150 hover:bg-accent hover:text-foreground active:scale-95 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 [&_svg]:size-4"
    >

      {children}
    </button>
  );
}

function Notice({ state, staleNote, refreshable }: { state: "stale" | "partial"; staleNote?: string; refreshable?: "github" }) {
  const [pending, startTransition] = useTransition();
  const [queued, setQueued] = useState(false);
  return (
    <p className="mx-5 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-warning px-3 py-2 text-sm text-warning-foreground">
      <TriangleAlert aria-hidden className="size-4 shrink-0" />
      {state === "stale" ? (staleNote ?? "This data is out of date.") : "Based on partial data. Confirm more of your profile to sharpen it."}
      {state === "stale" && refreshable === "github" && (
        <button
          type="button"
          disabled={pending || queued}
          onClick={() =>
            startTransition(async () => {
              const r = await refreshGithub().catch(() => null);
              if (r?.ok) setQueued(true);
            })
          }
          className="inline-flex items-center gap-1 rounded-sm font-medium underline underline-offset-2 hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:no-underline disabled:opacity-70"
        >
          {pending ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : <RefreshCw aria-hidden className="size-3.5" />}
          {queued ? "Refresh queued" : "Refresh"}
        </button>
      )}
    </p>
  );
}
