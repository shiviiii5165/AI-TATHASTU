import { Sliders } from "lucide-react";

import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
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
          <span>Feature Flags & Runtime Kill-Switches</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Safely enable or toggle experimental platform features, maintenance mode, and feature rollouts.
        </p>
      </div>

      {/* Flags List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Active Feature Flags ({flags.length})
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
                  <button
                    type="submit"
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      flag.enabled
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <span className="size-2 rounded-full bg-current" />
                    <span>{flag.enabled ? "Enabled" : "Disabled"}</span>
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

