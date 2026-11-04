import { BarChart3 } from "lucide-react";

import { requireAdmin } from "@/lib/admin";
import { getAiBudgetStatus } from "@/lib/admin/ai-ops";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { updateBudgetPolicyAction } from "../actions";

export const metadata = {
  title: "AI Costs & Budgets · Admin Control Center",
  robots: { index: false },
};

const usd = (value: number) => `$${value.toFixed(2)}`;
const INPUT = "w-full bg-muted/40 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary font-mono";

export default async function AdminAiCostsPage() {
  await requireAdmin();
  await requireAdminPermission("ai.budgets.manage");

  const budget = await getAiBudgetStatus();
  const limit = Number(budget.budgetUsd);
  const utilization = limit > 0 ? Math.round((budget.usedUsd / limit) * 100) : 100;

  const cards = [
    { label: "Monthly limit", value: usd(limit), note: `${utilization}% used, including reservations. Enforced.` },
    { label: "Metered", value: usd(budget.meteredUsd), note: "Tokens the provider reported, at our configured rates" },
    { label: "Estimated", value: usd(budget.estimatedUsd), note: "Charged in full: no usage reported, a timeout, or a flat call price" },
    { label: "Reserved", value: usd(budget.reservedUsd), note: "Set aside for calls in flight" },
  ];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 className="size-6 text-primary" />
          <span>AI Cost Accounting & Budget Controls</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          This UTC month, all users. These are our own calculations, not provider invoices: compare them with each provider&apos;s billing page.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="p-5 rounded-2xl border border-border bg-card shadow-2xs">
            <span className="text-xs font-semibold text-muted-foreground">{card.label}</span>
            <div className="text-2xl font-bold text-foreground mt-1">{card.value}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{card.note}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-foreground">Spending limits</h2>
        <p className="text-xs text-muted-foreground">
          Every AI, embedding, Firecrawl and Apify call reserves its worst-case cost first. Past a limit, or if the budget database can&apos;t be reached, the call
          isn&apos;t made and the job falls back to rule-based results.
        </p>

        <form
          action={async (formData: FormData) => {
            "use server";
            await updateBudgetPolicyAction(formData);
          }}
          className="space-y-4 max-w-xl"
        >
          {[
            { name: "budgetUsd", label: "Monthly limit, all users (USD)", value: budget.budgetUsd },
            { name: "userDailyUsd", label: "Daily limit per user (USD)", value: budget.userDailyUsd },
            { name: "userMonthlyUsd", label: "Monthly limit per user (USD)", value: budget.userMonthlyUsd },
          ].map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-xs font-semibold text-foreground mb-1">
                {field.label}
              </label>
              <input id={field.name} type="number" step="0.01" min={0} name={field.name} defaultValue={field.value} required className={INPUT} />
            </div>
          ))}

          <div>
            <label htmlFor="warningPercent" className="block text-xs font-semibold text-foreground mb-1">
              Warning threshold (%)
            </label>
            <input id="warningPercent" type="number" name="warningPercent" defaultValue={budget.warningThresholdPercent} min={50} max={100} required className={INPUT} />
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Past this, /api/internal/queue-health raises <code>ai_budget</code> for your uptime monitor.
            </span>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
            >
              Update limits
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
