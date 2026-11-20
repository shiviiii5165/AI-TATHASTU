import "../../intelligence/intelligence.css";

import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { BarList, Card, Columns, SLOT } from "@/components/admin/intelligence/charts";
import { requireAdmin } from "@/lib/admin";
import { getAiBudgetStatus } from "@/lib/admin/ai-ops";
import { dailySpend, isWindow, projectMonthEnd, spendByPurpose, WINDOWS, type Window } from "@/lib/admin/ai-telemetry";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { updateBudgetPolicyAction } from "../actions";

export const metadata = {
  title: "AI Costs & Budgets · Admin Control Center",
  robots: { index: false },
};

const usd = (value: number) => `$${value.toFixed(2)}`;
const INPUT = "w-full bg-muted/40 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary font-mono";

export default async function AdminAiCostsPage({ searchParams }: { searchParams?: Promise<{ w?: string; saved?: string; error?: string }> } = {}) {
  await requireAdmin();
  await requireAdminPermission("ai.budgets.manage");
  const sp = (await searchParams) ?? {};
  const w: Window = isWindow(sp.w) ? sp.w : "month";

  const [budget, daily, byPurpose] = await Promise.all([getAiBudgetStatus(), dailySpend(w), spendByPurpose(w)]);
  const limit = Number(budget.budgetUsd);
  const settled = budget.meteredUsd + budget.estimatedUsd;
  // Remaining = limit − (settled spend + money held for calls in flight). Reservations are held, not yet spent.
  const remaining = Math.max(0, limit - budget.usedUsd);
  const usedPct = limit > 0 ? Math.round((budget.usedUsd / limit) * 100) : null;
  const projection = projectMonthEnd(settled);

  // The form posts to the existing action, then reports its result in the URL (no silent failures).
  async function save(formData: FormData) {
    "use server";
    const res = await updateBudgetPolicyAction(formData);
    redirect(res.ok ? "/admin/ai-ops/costs?saved=1" : `/admin/ai-ops/costs?error=${encodeURIComponent(res.error ?? "Couldn't save.")}`);
  }

  return (
    <div className="si-root max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 className="size-6 text-primary" />
          <span>AI Costs &amp; Budgets</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          This UTC month, all users. Our own calculation from usage records, not provider invoices.
        </p>
      </div>

      {sp.saved && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">Limits saved and recorded in the audit log.</p>}
      {sp.error && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-xs text-rose-800 dark:text-rose-300">{sp.error}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3" data-testid="budget-cards">
        {[
          { label: "Monthly limit", value: usd(limit), note: usedPct === null ? "No limit set" : `${usedPct}% used or held` },
          { label: "Remaining", value: usd(remaining), note: "Limit minus spent and held" },
          { label: "Measured", value: usd(budget.meteredUsd), note: "Tokens the provider reported × our rates" },
          { label: "Estimated", value: usd(budget.estimatedUsd), note: "No usage reported: charged at the reserved maximum" },
          { label: "Held for calls in progress", value: usd(budget.reservedUsd), note: "Released or settled when each call ends" },
        ].map((c) => (
          <div key={c.label} className="p-4 rounded-2xl border border-border bg-card shadow-2xs">
            <span className="text-[11px] font-semibold text-muted-foreground">{c.label}</span>
            <div className="text-xl font-bold text-foreground mt-1 tabular-nums">{c.value}</div>
            <p className="text-[10px] text-muted-foreground mt-1">{c.note}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {projection === null
          ? "A month-end projection needs at least one full day of this month."
          : <>Projection: about <strong className="text-foreground">{usd(projection)}</strong> by month end if the rest of the month matches the days so far. A rough guide, not a forecast.</>}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground">Spending in {WINDOWS[w].toLowerCase()}</h2>
        <nav aria-label="Time window" className="flex flex-wrap gap-1 text-xs">
          {(Object.keys(WINDOWS) as Window[]).map((k) => (
            <Link key={k} href={`/admin/ai-ops/costs?w=${k}`} aria-current={k === w ? "page" : undefined} className={`px-3 py-1.5 rounded-lg font-medium ${k === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}>{WINDOWS[k]}</Link>
          ))}
        </nav>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Cost per day" subtitle="Measured plus estimated, by UTC day." source="ai_usage_ledger (settled calls)" className="lg:col-span-2">
          <Columns items={daily.map((d) => ({ label: d.day.slice(5), value: Math.round((d.meteredUsd + d.estimatedUsd) * 100) / 100 }))} color={SLOT(6)} unit=" USD" />
        </Card>
        <Card title="Cost by use" subtitle="What the AI calls were for." source="ai_usage_ledger.purpose">
          <BarList colorBy="slot" items={byPurpose.map((p) => ({ label: p.purpose.replaceAll("_", " "), value: p.costUsd, display: `${usd(p.costUsd)} · ${p.calls} calls` }))} />
        </Card>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <h2 className="text-sm font-bold text-foreground">Spending limits</h2>
        <p className="text-xs text-muted-foreground">
          Every AI, embedding, Firecrawl and Apify call reserves its worst-case cost first. Past a limit, or if the budget database can&apos;t be reached, the call
          isn&apos;t made and the job falls back to rule-based results. Amounts in US dollars.
        </p>

        <form action={save} className="space-y-4 max-w-xl">
          {[
            { name: "budgetUsd", label: "Monthly limit, all users (USD)", value: budget.budgetUsd },
            { name: "userDailyUsd", label: "Daily limit per user (USD)", value: budget.userDailyUsd },
            { name: "userMonthlyUsd", label: "Monthly limit per user (USD)", value: budget.userMonthlyUsd },
          ].map((field) => (
            <div key={field.name}>
              <label htmlFor={field.name} className="block text-xs font-semibold text-foreground mb-1">{field.label}</label>
              <input id={field.name} type="number" step="0.01" min={0} max={1000000} name={field.name} defaultValue={field.value} required className={INPUT} />
            </div>
          ))}
          <div>
            <label htmlFor="warningPercent" className="block text-xs font-semibold text-foreground mb-1">Warning threshold (%)</label>
            <input id="warningPercent" type="number" name="warningPercent" defaultValue={budget.warningThresholdPercent} min={50} max={100} step={1} required className={INPUT} />
            <span className="text-[11px] text-muted-foreground block mt-0.5">Past this share of the monthly limit, Operational Health and the uptime monitor show a warning.</span>
          </div>
          <div className="pt-2">
            <ConfirmSubmit message="Change the AI spending limits? New limits apply to the next AI call and are recorded in the audit log." className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 shadow-2xs">
              Update limits
            </ConfirmSubmit>
          </div>
        </form>
      </div>
    </div>
  );
}
