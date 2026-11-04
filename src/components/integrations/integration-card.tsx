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
import type { IntegrationClientId, IntegrationScope, WebhookStatus } from "@/db/schema";
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
  lastSync: { status: WebhookStatus; at: string } | null;
};

const SYNC_TEXT: Record<WebhookStatus, string> = {
  delivered: "Last synced",
  pending: "Sync queued",
  sending: "Syncing since",
  failed: "Last sync failed",
};

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
            {linked && card.lastSync && (
              <span className={cn("ml-3 text-muted-foreground", card.lastSync.status === "failed" && "text-destructive")}>
                · {SYNC_TEXT[card.lastSync.status]} {timeAgo(card.lastSync.at, new Date())}
              </span>
            )}
          </p>
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
