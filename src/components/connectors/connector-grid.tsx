"use client";

import { ArrowRight, Check, CircleAlert, LoaderCircle, RefreshCw, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";

import { continueFromStep } from "@/app/onboarding/actions";
import {
  allowLinkedInImport,
  connectLinkedIn,
  connectWithForm,
  disconnect,
  type FormSource,
} from "@/app/(dashboard)/connections/actions";
import { PlatformIcon } from "@/components/icons/platform-icons";
import { StepFooter } from "@/components/onboarding/continue-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceId } from "@/db/schema";
import { CONSENT_ITEMS } from "@/lib/consent/catalog";
import { sourceById, type ConnectorContext } from "@/lib/connectors/sources";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CardStatus = "not_connected" | "connected" | "syncing" | "waiting_consent" | "error";
export type CardView = {
  sourceId: SourceId;
  status: CardStatus;
  detail: string | null;
  lastSyncAt: string | null;
  needsReauth: boolean;
};
export type Flash = { sourceId: string; error: string | null };

/** ?error= from an OAuth round trip (GitHub, ORCID). */
function flashMessage(sourceName: string, error: string) {
  switch (error) {
    case "denied":
      return `You cancelled on ${sourceName}. Connect again whenever you're ready.`;
    case "state":
      return "That connection attempt expired. Try again.";
    case "not_configured":
      return `${sourceName} connect isn't set up on this server yet.`;
    default:
      return `${sourceName} didn't respond as expected. Try again.`;
  }
}

const FORM_FIELDS: Record<
  FormSource,
  { title: string; description: React.ReactNode; fields: FieldDef[] }
> = {
  kaggle: {
    title: "Connect Kaggle",
    description: (
      <>
        On Kaggle, open <span className="font-semibold text-slate-900">Settings → API → Create New Token</span>. It
        downloads <span className="font-mono text-xs bg-slate-100 px-1 py-0.5 rounded text-slate-800">kaggle.json</span>, which holds both values below. Your key is
        encrypted before it&apos;s stored.
      </>
    ),
    fields: [
      { name: "username", label: "Kaggle username", autoComplete: "username", placeholder: "your-username" },
      { name: "key", label: "API key", type: "password", autoComplete: "off", placeholder: "From kaggle.json" },
    ],
  },
  stack_exchange: {
    title: "Connect Stack Exchange",
    description:
      "Stack Exchange's API reads public profiles, so you don't need a personal key. Paste the link to your profile on Stack Overflow or any network site.",
    fields: [
      {
        name: "profileUrl",
        label: "Profile URL",
        type: "url",
        placeholder: "https://stackoverflow.com/users/12345/your-name",
      },
    ],
  },
  leetcode: {
    title: "Connect LeetCode",
    description: "We read your public LeetCode profile: problems solved, contest rating and languages.",
    fields: [{ name: "username", label: "Username or profile link", placeholder: "your-username" }],
  },
  hackerrank: {
    title: "Connect HackerRank",
    description: "We read your public HackerRank profile and skill badges.",
    fields: [{ name: "username", label: "Username or profile link", placeholder: "your-username" }],
  },
  portfolio: {
    title: "Connect your site",
    description: "We read the public pages of your site to find projects and write-ups. Nothing behind a login is read.",
    fields: [{ name: "url", label: "Website", type: "url", placeholder: "https://yourname.dev", autoComplete: "url" }],
  },
};

type FieldDef = { name: string; label: string; type?: string; placeholder?: string; autoComplete?: string };

/** Onboarding Step 5: the cards plus the Skip / Continue footer. */
export function ConnectorGrid({ cards, flash, context }: { cards: CardView[]; flash: Flash | null; context: ConnectorContext }) {
  const [state, formAction, advancing] = useActionState(continueFromStep, null);
  const anyConnected = cards.some((c) => c.status !== "not_connected");

  return (
    <>
      <ConnectorCards cards={cards} flash={flash} context={context} />
      <StepFooter backStep="resume" error={state?.error}>
        <form action={formAction} className="flex items-center gap-3">
          <input type="hidden" name="step" value="connectors" />
          <Button
            type="submit"
            variant="ghost"
            className="h-11 px-5 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium"
            disabled={advancing}
          >
            Skip for now
          </Button>
          <Button
            type="submit"
            className={cn(
              "h-11 px-6 rounded-full font-semibold transition-all duration-200 flex items-center gap-2",
              anyConnected
                ? "bg-gradient-to-r from-[#FF5A5F] via-[#F43F5E] to-[#EA580C] text-white shadow-md shadow-rose-500/20 hover:opacity-95 hover:scale-[1.01] active:scale-[0.99]"
                : "bg-slate-200 text-slate-400 cursor-not-allowed",
            )}
            disabled={!anyConnected || advancing}
          >
            {advancing ? <LoaderCircle data-icon="inline-start" aria-hidden className="size-4 animate-spin" /> : null}
            Continue
            {!advancing && <ArrowRight data-icon="inline-end" aria-hidden className="size-4" />}
          </Button>
        </form>
      </StepFooter>
    </>
  );
}

/** Source cards with their connect / retry / disconnect flows. Used by Step 5 and /connections. */
export function ConnectorCards({ cards, flash, context }: { cards: CardView[]; flash: Flash | null; context: ConnectorContext }) {
  const router = useRouter();
  const [openForm, setOpenForm] = useState<FormSource | null>(null);
  const importing = cards.some((c) => c.status === "syncing");

  // Imports run on the worker; re-read the cards until they settle (about 3 minutes at most).
  useEffect(() => {
    if (!importing) return;
    let polls = 0;
    const timer = setInterval(() => {
      if (++polls > REFRESH_MAX_POLLS) return clearInterval(timer);
      router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [importing, router]);

  return (
    <>
      <ul className="mt-6 sm:mt-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))] gap-5 items-stretch">
        {cards.map((card) => (
          <li key={card.sourceId} className="h-full">
            <SourceCard
              card={card}
              flashError={
                flash?.sourceId === card.sourceId && flash.error ? flashMessage(sourceById(card.sourceId)!.name, flash.error) : null
              }
              context={context}
              onOpenForm={() => setOpenForm(card.sourceId as FormSource)}
              onChanged={() => router.refresh()}
            />
          </li>
        ))}
      </ul>
      <p className="mt-6 max-w-2xl text-sm text-muted-foreground">
        Imports run in the background, so you can continue right away.
      </p>

      {openForm && (
        <CredentialDialog
          source={openForm}
          onClose={() => setOpenForm(null)}
          onConnected={() => {
            setOpenForm(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

const LINKEDIN_CONSENT = CONSENT_ITEMS.find((c) => c.purpose === "linkedin_scrape");

const REFRESH_MS = 4_000;
const REFRESH_MAX_POLLS = 45;

// ─── Card ───────────────────────────────────────────────────────────────────

const STATUS_TEXT: Record<CardStatus | "connecting", string> = {
  not_connected: "Not connected",
  connecting: "Connecting…",
  connected: "Connected",
  syncing: "Importing",
  waiting_consent: "Needs permission",
  error: "Needs attention",
};

function SourceCard({
  card,
  flashError,
  context,
  onOpenForm,
  onChanged,
}: {
  card: CardView;
  flashError: string | null;
  context: ConnectorContext;
  onOpenForm: () => void;
  onChanged: () => void;
}) {
  const source = sourceById(card.sourceId)!;
  const [connecting, setConnecting] = useState(false);
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  // LinkedIn: the first Connect reveals the linkedin_scrape checkbox; the second goes to LinkedIn.
  const [askingConsent, setAskingConsent] = useState(false);
  const [readPublicProfile, setReadPublicProfile] = useState(false);

  const status: CardStatus | "connecting" = connecting ? "connecting" : flashError ? "error" : card.status;
  const error = actionError ?? flashError ?? (card.status === "error" ? errorText(card) : null);
  const isLinked = card.status !== "not_connected";

  function connect() {
    setActionError(null);
    if (source.connect === "github_oauth" || source.connect === "orcid_oauth") {
      setConnecting(true);
      // Full navigation, not router.push: the route handler redirects off-site to GitHub / ORCID.
      const provider = source.connect === "github_oauth" ? "github" : "orcid";
      window.location.assign(new URL(`/api/connectors/${provider}/start?from=${context}`, window.location.origin).href);
    } else if (source.connect === "linkedin_signin") {
      if (!askingConsent) return setAskingConsent(true);
      setConnecting(true);
      startTransition(() => connectLinkedIn(context, readPublicProfile));
    } else {
      onOpenForm();
    }
  }

  function allow() {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await allowLinkedInImport();
        if (!result.ok) setActionError(result.error);
        else onChanged();
      } catch {
        setActionError("Couldn't save that. Check your connection and try again.");
      }
    });
  }

  function remove() {
    setActionError(null);
    startTransition(async () => {
      try {
        const result = await disconnect(card.sourceId);
        if (!result.ok) setActionError(result.error);
        else onChanged();
      } catch {
        setActionError("Couldn't disconnect. Check your connection and try again.");
      }
    });
  }

  const headingId = `source-${card.sourceId}`;
  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "group relative flex h-full flex-col justify-between rounded-2xl border bg-white p-5 sm:p-6 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-200 hover:shadow-md hover:border-slate-300",
        isLinked && status !== "error" && "border-slate-900/80 ring-1 ring-slate-900/10",
        !isLinked && status !== "error" && "border-slate-200/90",
        status === "error" && "border-rose-300 bg-rose-50/20",
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-2.5 shadow-xs group-hover:bg-slate-100/80 transition-colors">
            <PlatformIcon sourceId={card.sourceId} className="size-5.5" />
          </div>
          {source.connect !== "soon" && <StatusPill status={status} />}
        </div>

        <div className="mt-4">
          <h2
            id={headingId}
            className="font-sans text-base sm:text-lg font-bold text-[#0F172A] leading-snug tracking-tight"
          >
            {source.name}
          </h2>
          {card.detail ? (
            <p className="mt-1 truncate font-mono text-xs text-slate-500 max-w-full">{card.detail}</p>
          ) : null}
        </div>

        <p className="mt-2 text-sm text-slate-500 leading-relaxed">{source.blurb}</p>

        {card.status === "syncing" && !connecting && (
          <p className="mt-3 text-xs text-amber-600 flex items-center gap-1.5 font-medium">
            <LoaderCircle className="size-3.5 animate-spin" />
            Queued for import. Running in the background.
          </p>
        )}
        {card.status === "waiting_consent" && (
          <p className="mt-3 text-xs text-blue-600 font-medium">
            Waiting for permission to read public profile. Nothing is imported until allowed.
          </p>
        )}
        {card.status === "connected" && card.lastSyncAt && (
          <p className="mt-3 text-xs text-slate-400" suppressHydrationWarning>
            Last imported {timeAgo(card.lastSyncAt, new Date())}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
            <CircleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {error}
          </p>
        )}

        {askingConsent && LINKEDIN_CONSENT && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-1">
            <label htmlFor={`${headingId}-consent`} className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
              <Checkbox
                id={`${headingId}-consent`}
                checked={readPublicProfile}
                onCheckedChange={(v) => setReadPublicProfile(v === true)}
                disabled={connecting || pending}
                aria-describedby={`${headingId}-consent-body`}
                className="mt-0.5 size-5 shrink-0"
              />
              <span className="text-base font-semibold leading-snug text-[#0F172A]">{LINKEDIN_CONSENT.title}</span>
            </label>
            <p id={`${headingId}-consent-body`} className="pb-2.5 pl-8 text-sm leading-relaxed text-slate-600">
              {LINKEDIN_CONSENT.body}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 pt-4 border-t border-slate-100/80">
        {source.connect === "soon" ? (
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-xl">Coming soon</span>
        ) : !isLinked || status === "error" ? (
          <Button
            type="button"
            onClick={connect}
            disabled={connecting || pending}
            className={cn(
              "w-full sm:w-auto min-h-[38px] h-9 pointer-coarse:min-h-11 px-4 rounded-xl text-xs font-semibold shadow-xs transition-all touch-manipulation",
              status === "error"
                ? "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100"
                : "bg-slate-900 hover:bg-slate-800 text-white hover:shadow"
            )}
          >
            {connecting || pending ? (
              <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin size-3 mr-1" />
            ) : status === "error" ? (
              <RefreshCw data-icon="inline-start" aria-hidden className="size-3 mr-1" />
            ) : null}
            {status === "error" ? "Retry" : "Connect"}
            <span className="sr-only"> {source.name}</span>
          </Button>
        ) : null}
        {askingConsent && !connecting && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setAskingConsent(false);
              setReadPublicProfile(false);
            }}
            disabled={pending}
            className="w-full sm:w-auto min-h-[38px] h-9 pointer-coarse:min-h-11 px-4 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 touch-manipulation"
          >
            Cancel
          </Button>
        )}
        {card.status === "waiting_consent" && (
          <Button
            type="button"
            onClick={allow}
            disabled={pending}
            className="w-full sm:w-auto min-h-[38px] h-9 pointer-coarse:min-h-11 px-4 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#FF5A5F] via-[#F43F5E] to-[#EA580C] text-white shadow-xs hover:opacity-95 touch-manipulation"
          >
            {pending && <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin size-3 mr-1" />}
            Allow and import
          </Button>
        )}
        {isLinked && (
          <Button
            type="button"
            variant="ghost"
            onClick={remove}
            disabled={pending}
            className="min-h-[36px] h-9 pointer-coarse:min-h-11 px-3 rounded-xl text-xs text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors font-medium ml-auto touch-manipulation"
          >
            {pending ? (
              <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin size-3 mr-1" />
            ) : (
              <Unplug data-icon="inline-start" aria-hidden className="size-3.5 mr-1" />
            )}
            Disconnect
            <span className="sr-only"> {source.name} and delete its imported data</span>
          </Button>
        )}
      </div>
    </article>
  );
}

function errorText(card: CardView) {
  return card.needsReauth ? "Access expired. Reconnect to keep importing." : "The last import failed. Try again.";
}

function StatusPill({ status }: { status: CardStatus | "connecting" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors",
        status === "not_connected" && "border-slate-200 bg-slate-50 text-slate-500",
        (status === "connecting" || status === "syncing") && "border-amber-200 bg-amber-50 text-amber-700",
        status === "connected" && "border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold",
        status === "waiting_consent" && "border-blue-200 bg-blue-50 text-blue-700",
        status === "error" && "border-rose-200 bg-rose-50 text-rose-700",
      )}
    >
      {status === "connected" && <Check aria-hidden className="size-3 stroke-[2.5]" />}
      {(status === "connecting" || status === "syncing") && <LoaderCircle aria-hidden className="size-3 animate-spin" />}
      {STATUS_TEXT[status]}
    </span>
  );
}

// ─── Credential dialog ──────────────────────────────────────────────────────

function CredentialDialog({
  source,
  onClose,
  onConnected,
}: {
  source: FormSource;
  onClose: () => void;
  onConnected: () => void;
}) {
  const config = FORM_FIELDS[source];
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    const values = Object.fromEntries(config.fields.map((f) => [f.name, String(formData.get(f.name) ?? "")]));
    startTransition(async () => {
      try {
        const result = await connectWithForm(source, values);
        if (result.ok) onConnected();
        else setError(result.error);
      } catch {
        setError("Couldn't connect. Check your connection and try again.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl">
        <form action={submit}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex size-10 items-center justify-center rounded-xl border border-slate-100 bg-slate-50 p-2 shadow-xs">
                <PlatformIcon sourceId={source} className="size-5" />
              </div>
              <DialogTitle className="font-heading text-2xl font-normal text-slate-900">{config.title}</DialogTitle>
            </div>
            <DialogDescription className="text-sm text-slate-500 leading-relaxed">{config.description}</DialogDescription>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            {config.fields.map((f, i) => (
              <div key={f.name}>
                <Label htmlFor={`cred-${f.name}`} className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                  {f.label}
                </Label>
                <Input
                  id={`cred-${f.name}`}
                  name={f.name}
                  type={f.type === "url" ? "text" : (f.type ?? "text")}
                  inputMode={f.type === "url" ? "url" : undefined}
                  spellCheck={f.type === "url" ? false : undefined}
                  placeholder={f.placeholder}
                  autoComplete={f.autoComplete}
                  required
                  autoFocus={i === 0}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "cred-error" : undefined}
                  className="mt-1.5 h-11 rounded-xl border-slate-200 bg-white px-3.5 text-sm text-[#0F172A] shadow-xs transition-all placeholder:text-slate-400 focus-visible:border-[#FF5A5F] focus-visible:ring-2 focus-visible:ring-[#FF5A5F]/20"
                />
              </div>
            ))}
            {error && (
              <p id="cred-error" role="alert" className="text-xs font-medium text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="mt-6 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={pending}
              className="h-10 px-4 rounded-full text-slate-600 hover:text-slate-900 font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending}
              className="h-10 px-6 rounded-full font-semibold bg-gradient-to-r from-[#FF5A5F] via-[#F43F5E] to-[#EA580C] text-white shadow-sm hover:opacity-95"
            >
              {pending && <LoaderCircle data-icon="inline-start" aria-hidden className="size-3.5 animate-spin mr-1.5" />}
              {pending ? "Connecting…" : "Connect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
