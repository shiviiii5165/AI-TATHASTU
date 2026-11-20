"use client";

import { ArrowUpRight, Check, CircleAlert, LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { syncIntegration } from "@/app/(dashboard)/settings/integrations/actions";
import { Button } from "@/components/ui/button";
import type { IntegrationClientId, IntegrationScope, SyncStatus } from "@/db/schema";
import { timeAgo } from "@/lib/format";
import { scopesForApp } from "@/lib/integrations/scopes";
import { cn } from "@/lib/utils";

export type IntegrationCardView = {
  id: IntegrationClientId;
  name: string;
  description: string;
  url: string;
  available: boolean;
  syncAvailable: boolean;
  linkedAt: string | null;
  revoked: boolean;
  scopes: Record<IntegrationScope, boolean>;
  requested: IntegrationScope[];
  hiddenProjects: string[];
  /** Confirmed by the app (integration_sync_state), never inferred from a delivery alone. */
  sync: { status: SyncStatus; lastSuccessAt: string | null } | null;
};

/** Short status after "Connected". Only "synced" says synced, and only because the app confirmed it. */
const SYNC_TEXT: Partial<Record<SyncStatus, string>> = {
  synced: "Synced",
  pending: "Sync pending",
  missing: "Setting up your profile there",
  conflict: "Action needed",
  review: "Being reviewed",
  failed: "Sync failed",
};

/** What the user can do about a state that needs them. No internal codes or errors are shown. */
function syncGuidance(status: SyncStatus | undefined, name: string): string | null {
  switch (status) {
    case "conflict":
      return `You already have a ${name} account with this email. To link it, open ${name}, choose "Continue with AI Tathastu" and confirm with your ${name} password. Nothing is merged until you do.`;
    case "review":
      return `A ${name} account with this email already exists and we couldn't confirm it's yours automatically. Our team is reviewing it.`;
    case "failed":
      return `We couldn't update your ${name} profile. Try "Sync profile"; if it keeps failing, contact support.`;
    case "missing":
      return `Your ${name} profile is being created. This usually takes a few minutes.`;
    default:
      return null;
  }
}

/**
 * One connected app (consent policy v4): every AI Tathastu account is linked to it and shares its whole profile, so
 * there are no sharing toggles or disconnect here. Deleting the AI Tathastu account removes it from every app.
 */
export function IntegrationCard({ card }: { card: IntegrationCardView; projects?: { key: string; title: string }[] }) {
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const linked = Boolean(card.linkedAt);
  const headingId = `integration-${card.id}`;
  const shared = scopesForApp(card.id).filter((s) => s.id !== "discovery");

  function sync() {
    setNotice(null);
    startSync(async () => {
      const result = await syncIntegration(card.id).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      setNotice(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
      router.refresh();
    });
  }

  const guidance = linked ? syncGuidance(card.sync?.status, card.name) : null;

  return (
    <article aria-labelledby={headingId} className={cn("rounded-lg border bg-card p-6", linked && "border-foreground")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className="font-heading text-xl font-bold leading-tight text-[#0F172A]">
            {card.name}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{card.description}</p>
          <p className="mt-3 text-sm" suppressHydrationWarning>
            {linked ? (
              <span className="inline-flex items-center gap-1.5">
                <Check aria-hidden className="size-4" /> Connected {timeAgo(card.linkedAt!, new Date())}
              </span>
            ) : (
              <span className="text-muted-foreground">Your {card.name} account is being set up.</span>
            )}
            {linked && card.sync && SYNC_TEXT[card.sync.status] && (
              <span className={cn("ml-3 text-muted-foreground", (card.sync.status === "failed" || card.sync.status === "conflict") && "text-destructive")}>
                · {SYNC_TEXT[card.sync.status]}
                {card.sync.status === "synced" && card.sync.lastSuccessAt ? ` ${timeAgo(card.sync.lastSuccessAt, new Date())}` : ""}
              </span>
            )}
          </p>
          {card.id === "collaborate" && (
            <p className="mt-1 text-xs text-muted-foreground">Your Collaborate profile is public, so other members can find you and connect.</p>
          )}
          {guidance && (
            <p role="status" className="mt-3 flex items-start gap-1.5 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {guidance}
            </p>
          )}
        </div>
        <a
          // Available: start the app's OAuth sign-in so the user arrives signed in. Otherwise just its home page.
          href={card.available ? `/integrations/launch/${card.id}` : card.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          Open {card.name}
          <ArrowUpRight aria-hidden className="size-4" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>

      <section aria-labelledby={`${headingId}-share`} className="mt-6">
        <h3 id={`${headingId}-share`} className="text-sm font-medium">
          What {card.name} receives
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your name, email (never shown publicly), target role, university and location, plus:
        </p>
        <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {shared.map((s) => (
            <li key={s.id} className="flex items-start gap-2 text-sm">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {s.label.replace(/^Share /, "")}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Never shared: your phone number, resume file, passwords or sign-in tokens. Deleting your AI Tathastu account removes you from {card.name} too.
        </p>
      </section>

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={cn("mt-4 flex items-start gap-1.5 text-sm", !notice.ok && "text-destructive")}>
          {notice.ok ? <Check aria-hidden className="mt-0.5 size-4 shrink-0" /> : <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
          {notice.text}
        </p>
      )}

      {linked && (
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-5">
          <Button type="button" onClick={sync} disabled={syncing} className="h-9 px-4">
            {syncing ? <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin" /> : <RefreshCw data-icon="inline-start" aria-hidden />}
            {syncing ? "Syncing" : "Sync profile"}
          </Button>
          {!card.syncAvailable && (
            <span className="text-sm text-muted-foreground">{card.name} reads your profile when you sign in; push sync isn&apos;t set up on its side yet.</span>
          )}
        </div>
      )}
    </article>
  );
}
