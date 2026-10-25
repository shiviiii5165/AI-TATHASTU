"use client";

import { Check, LoaderCircle } from "lucide-react";
import { useState, useTransition } from "react";

import { approveIntegration, denyIntegration } from "@/app/integrations/authorize/actions";
import { ScopeToggles } from "@/components/integrations/scope-toggles";
import { Button } from "@/components/ui/button";
import type { IntegrationScope } from "@/db/schema";

export function AuthorizeForm({
  query,
  client,
  initialScopes,
  requested,
  email,
}: {
  query: string;
  client: { id: string; name: string; description: string; host: string };
  initialScopes: Record<IntegrationScope, boolean>;
  requested: IntegrationScope[];
  email: string | null;
}) {
  const [scopes, setScopes] = useState(initialScopes);
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"allow" | "deny" | null>(null);

  const act = (which: "allow" | "deny") => {
    setChoice(which);
    startTransition(() => (which === "allow" ? approveIntegration(query, scopes) : denyIntegration(query)));
  };

  return (
    <div className="mt-10">
      <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">{client.host}</p>
      <h1 className="mt-2 font-heading text-2xl sm:text-3xl md:text-4xl leading-tight">Sign in to {client.name}</h1>
      <p className="mt-2 text-muted-foreground">{client.description}</p>

      <div className="mt-8 rounded-lg border bg-card p-5">
        <p className="text-sm font-medium">{client.name} will always see</p>
        <ul className="mt-2 space-y-1.5 text-sm">
          {["Your name and email" + (email ? ` (${email})` : ""), "Your target role, university and location"].map((t) => (
            <li key={t} className="flex items-start gap-2">
              <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-5 text-sm font-medium">Choose what else to share</p>
        <p className="text-sm text-muted-foreground">Everything below is off until you turn it on.</p>
        <ScopeToggles
          scopes={scopes}
          requested={requested}
          appName={client.name}
          onChange={(id, on) => setScopes((s) => ({ ...s, [id]: on }))}
          disabled={pending}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          You can change this or disconnect at any time in Settings → Integrations. Your phone number and resume file are never shared.
        </p>
      </div>

      <div className="mt-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-3">
        <Button type="button" variant="ghost" className="h-10 px-4" disabled={pending} onClick={() => act("deny")}>
          {pending && choice === "deny" && <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin" />}
          Cancel
        </Button>
        <Button type="button" className="h-10 px-5" disabled={pending} onClick={() => act("allow")}>
          {pending && choice === "allow" && <LoaderCircle data-icon="inline-start" aria-hidden className="animate-spin" />}
          Allow and continue
        </Button>
      </div>
    </div>
  );
}
