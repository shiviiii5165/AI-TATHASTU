import { AlertTriangle, BarChart3, CheckCircle2, DollarSign, Sliders } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { getAiBudgetStatus } from "@/lib/admin/ai-ops";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { updateBudgetPolicyAction } from "../actions";

export const metadata = {
  title: "AI Costs & Budgets · Admin Control Center",
  robots: { index: false },
};

export default async function AdminAiCostsPage() {
  await requireAdmin();
  await requireAdminPermission("ai.budgets.manage");

  const budget = await getAiBudgetStatus();
  const utilization = Math.round((Number(budget.spentUsd) / Number(budget.budgetUsd)) * 100);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <BarChart3 className="size-6 text-primary" />
            <span>AI Cost Accounting & Budget Controls</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Monitor token consumption across providers and configure expenditure guardrails.
          </p>
        </div>
      </div>

      {/* Budget Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground">Monthly Budget</span>
          <div className="text-2xl font-bold text-foreground mt-1">${budget.budgetUsd}</div>
          <p className="text-[11px] text-muted-foreground mt-1">Configured spending cap</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground">Current Period Spend</span>
          <div className="text-2xl font-bold text-primary mt-1">${budget.spentUsd}</div>
          <p className="text-[11px] text-muted-foreground mt-1">{utilization}% utilization</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
          <span className="text-xs font-semibold text-muted-foreground">Hard Limit Enforcement</span>
          <div className="text-2xl font-bold text-foreground mt-1">
            {budget.hardLimitEnabled ? "Enabled" : "Advisory Only"}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Throttles on 100% breach</p>
        </div>
      </div>

      {/* Budget Policy Form */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-foreground">Configure Budget Thresholds & Guardrails</h2>

        <form
          action={async (formData: FormData) => {
            "use server";
            await updateBudgetPolicyAction(formData);
          }}
          className="space-y-4 max-w-xl"
        >
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Monthly Budget Limit (USD)
            </label>
            <input
              type="text"
              name="budgetUsd"
              defaultValue={budget.budgetUsd}
              required
              className="w-full bg-muted/40 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Warning Notification Threshold (%)
            </label>
            <input
              type="number"
              name="warningPercent"
              defaultValue={budget.warningThresholdPercent}
              min={50}
              max={100}
              required
              className="w-full bg-muted/40 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary font-mono"
            />
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Alerts administrators when monthly consumption crosses this mark.
            </span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="hardLimit"
              name="hardLimit"
              defaultChecked={budget.hardLimitEnabled}
              className="size-4 rounded border-border text-primary"
            />
            <label htmlFor="hardLimit" className="text-xs font-semibold text-foreground">
              Enable Hard Stop Throttling (Halts non-critical background jobs on limit breach)
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
            >
              Update Budget Guardrails
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
