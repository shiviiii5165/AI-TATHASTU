import { Sliders } from "lucide-react";

import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { ConfirmSubmit } from "@/components/admin/confirm-submit";

import { toggleFlagAction } from "./actions";

export const metadata = {
  title: "Feature Flags · Admin Control Center",
  robots: { index: false },
};

export default async function AdminFlagsPage() {
  await requireAdmin();
  await requireAdminPermission("flags.manage");

  const flags = await db.select().from(featureFlags).orderBy(featureFlags.key);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Sliders className="size-6 text-primary" />
          <span>Feature Flags</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Switch platform features on or off for everyone. Each change asks for confirmation and is recorded in the audit log.
        </p>
      </div>

      {/* Flags List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Feature flags ({flags.length}) · {flags.filter((f) => f.enabled).length} on
          </h2>
        </div>

        {flags.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No feature flags registered in database.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {flags.map((flag) => (
              <div key={flag.key} className="p-4 sm:p-5 flex items-center justify-between gap-4 text-xs">
                <div>
                  <div className="font-mono font-bold text-sm text-foreground">{flag.key}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Last modified by <span className="text-foreground">{flag.updatedBy || "System Seed"}</span> on{" "}
                    {new Date(flag.updatedAt).toLocaleDateString("en-IN")}
                  </div>
                </div>

                <form action={toggleFlagAction}>
                  <input type="hidden" name="key" value={flag.key} />
                  <input type="hidden" name="enabled" value={String(flag.enabled)} />
                  <ConfirmSubmit
                    message={`${flag.enabled ? "Turn OFF" : "Turn ON"} "${flag.key}"? This takes effect for everyone immediately and is recorded in the audit log.`}
                    ariaLabel={`${flag.key} is ${flag.enabled ? "on" : "off"}. ${flag.enabled ? "Turn off" : "Turn on"}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      flag.enabled
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <span aria-hidden className="size-2 rounded-full bg-current" />
                    <span>{flag.enabled ? "On" : "Off"}</span>
                    <span className="text-[10px] font-normal opacity-80">· click to turn {flag.enabled ? "off" : "on"}</span>
                  </ConfirmSubmit>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

