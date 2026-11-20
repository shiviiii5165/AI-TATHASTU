"use client";

import { ArrowUpRight, Check, CircleAlert, LoaderCircle, RefreshCw, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  disconnectIntegration,
  saveIntegrationConsent,
  syncIntegration,
} from "@/app/(dashboard)/settings/integrations/actions";
import { SaveStatusText } from "@/components/onboarding/save-status";
import { ScopeToggles } from "@/components/integrations/scope-toggles";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { IntegrationClientId, IntegrationScope, SyncStatus } from "@/db/schema";
import { useAutosave } from "@/hooks/use-autosave";
import { timeAgo } from "@/lib/format";
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
  declined: "Not syncing",
};

/** What the user can do about a state that needs them. No internal codes or errors are shown. */
function syncGuidance(status: SyncStatus | undefined, name: string): string | null {
  switch (status) {
    case "conflict":
      return `You already have a ${name} account with this email. To link it, open ${name}, choose "Continue with AI Tathastu" and confirm with your ${name} password. Nothing is merged until you do.`;
    case "review":
      return `A ${name} account with this email already exists and we couldn't confirm it's yours automatically. Our team is reviewing it; nothing is shared with that account meanwhile.`;
    case "failed":
      return `We couldn't update your ${name} profile. Try "Sync profile"; if it keeps failing, contact support.`;
    case "declined":
      return `You deleted or disconnected your account on ${name}, so we won't recreate it. Sign in to ${name} with AI Tathastu if you want it back.`;
    case "missing":
      return `Your private ${name} profile is being created. This usually takes a few minutes.`;
    default:
      return null;
  }
}

export function IntegrationCard({ card, projects }: { card: IntegrationCardView; projects: { key: string; title: string }[] }) {
  const router = useRouter();
  const [scopes, setScopes] = useState(card.scopes);
  const [hidden, setHidden] = useState(new Set(card.hiddenProjects));
  const { status, error, save, retry } = useAutosave(saveIntegrationConsent);
  const [syncing, startSync] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const linked = Boolean(card.linkedAt);
  const headingId = `integration-${card.id}`;

  function persist(nextScopes = scopes, nextHidden = hidden) {
    void save({ clientId: card.id, scopes: nextScopes, hiddenProjects: [...nextHidden] });
  }

  function sync() {
    setNotice(null);
    startSync(async () => {
      const result = await syncIntegration(card.id).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      setNotice(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
      router.refresh();
    });
  }

  function disconnect() {
    setNotice(null);
    startDisconnect(async () => {
      const result = await disconnectIntegration(card.id).catch(() => ({ ok: false as const, error: "Couldn't disconnect. Try again." }));
      setNotice(result.ok ? { ok: true, text: `Disconnected. ${card.name} can no longer read your profile.` } : { ok: false, text: result.error });
      router.refresh();
    });
  }

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
            ) : card.revoked ? (
              "Disconnected. Sign in to it with AI Tathastu again to reconnect."
            ) : (
              <span className="text-muted-foreground">Not connected yet. Choose what to share, then sign in to it with AI Tathastu.</span>
            )}
            {linked && card.sync && SYNC_TEXT[card.sync.status] && (
              <span className={cn("ml-3 text-muted-foreground", (card.sync.status === "failed" || card.sync.status === "conflict") && "text-destructive")}>
                · {SYNC_TEXT[card.sync.status]}
                {card.sync.status === "synced" && card.sync.lastSuccessAt ? ` ${timeAgo(card.sync.lastSuccessAt, new Date())}` : ""}
              </span>
            )}
          </p>
          {linked && (
            <p className="mt-1 text-xs text-muted-foreground">
              Your {card.name} profile is private until you change its visibility in {card.name}.
              {card.sync?.status === "synced" || !card.sync?.lastSuccessAt ? "" : ` Last successful sync ${timeAgo(card.sync.lastSuccessAt, new Date())}.`}
            </p>
          )}
          {linked && syncGuidance(card.sync?.status, card.name) && (
            <p role="status" className="mt-3 flex items-start gap-1.5 rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              {syncGuidance(card.sync?.status, card.name)}
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

      {!card.available && (
        <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Signing in to {card.name} with AI Tathastu isn&apos;t switched on yet. Your choices below are saved for when it is.
        </p>
      )}

      <section aria-labelledby={`${headingId}-share`} className="mt-6">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id={`${headingId}-share`} className="text-sm font-medium">
            What {card.name} can see
          </h3>
          <SaveStatusText status={status} error={error} onRetry={retry} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Always: your name, email, target role, university and location.</p>
        <ScopeToggles
          idPrefix={card.id}
          scopes={scopes}
          requested={card.requested}
          appName={card.name}
          appId={card.id}
          disabled={disconnecting}
          onChange={(id, on) => {
            const next = { ...scopes, [id]: on };
            setScopes(next);
            persist(next);
          }}
        />
      </section>

      {scopes.projects && projects.length > 0 && (
        <section aria-labelledby={`${headingId}-projects`} className="mt-4 rounded-md border p-4">
          <h3 id={`${headingId}-projects`} className="text-sm font-medium">
            Projects {card.name} can see
          </h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {projects.map((p) => (
              <li key={p.key}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={!hidden.has(p.key)}
                    onCheckedChange={(checked) => {
                      const next = new Set(hidden);
                      if (checked) next.delete(p.key);
                      else next.add(p.key);
                      setHidden(next);
                      persist(scopes, next);
                    }}
                  />
                  <span className="truncate">{p.title}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notice && (
        <p role={notice.ok ? "status" : "alert"} className={cn("mt-4 flex items-start gap-1.5 text-sm", !notice.ok && "text-destructive")}>
          {notice.ok ? <Check aria-hidden className="mt-0.5 size-4 shrink-0" /> : <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
          {notice.text}
        </p>
      )}

      {linked && (
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-5">
          <Button type="button" onClick={sync} disabled={syncing || disconnecting} className="h-9 px-4">
            {syncing ? <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin" /> : <RefreshCw data-icon="inline-start" aria-hidden />}
            {syncing ? "Syncing" : "Sync profile"}
          </Button>
          <Button type="button" variant="ghost" onClick={disconnect} disabled={syncing || disconnecting} className="h-9 px-3">
            {disconnecting ? <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin" /> : <Unplug data-icon="inline-start" aria-hidden />}
            Disconnect
          </Button>
          {!card.syncAvailable && (
            <span className="text-sm text-muted-foreground">{card.name} reads your profile when you sign in; push sync isn&apos;t set up on its side yet.</span>
          )}
        </div>
      )}
    </article>
  );
}
