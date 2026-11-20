"use client";

import { useActionState } from "react";

import { repairProfilesAction, type RepairActionResult } from "@/app/admin/intelligence/integrations/actions";
import { Button } from "@/components/ui/button";

/** Dry run first, then repair. Both are audited; repair is limited to 50 linked users per click. */
export function RepairProfilesForm({ clientId, name, disabled }: { clientId: "collaborate" | "avasar"; name: string; disabled: boolean }) {
  const [state, action, pending] = useActionState<RepairActionResult | null, FormData>(repairProfilesAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <Button type="submit" name="apply" value="0" variant="outline" className="h-8 px-3 text-xs" disabled={pending || disabled}>
        Check {name}
      </Button>
      <Button type="submit" name="apply" value="1" className="h-8 px-3 text-xs" disabled={pending || disabled}>
        Repair {name}
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {pending
          ? "Working…"
          : state?.ok
            ? state.dryRun
              ? `${state.candidates} linked user(s) need repair${state.candidates ? ` (${Object.entries(state.byCause).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}.`
              : `Queued ${state.queued} of ${state.candidates}. Results appear here as ${name} answers.`
            : state && !state.ok
              ? state.error
              : disabled
                ? "Profile sync isn't configured for this app."
                : ""}
      </span>
    </form>
  );
}
