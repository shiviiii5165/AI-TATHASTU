import "server-only";

import { and, asc, avg, eq, isNotNull, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import {
  type AiCostBudget,
  aiCostBudgets,
  aiSpendCounters,
  aiUsageLedger,
} from "@/db/schema";
import { recordAdminAudit } from "./audit";

/** This month's measured calls per provider, from the spend ledger. Only what was recorded: no catalogue, no health verdict. */
export async function getAiProviderUsage() {
  const rows = await db
    .select({
      provider: aiUsageLedger.provider,
      calls: sql<number>`count(*)::int`,
      failed: sql<number>`(count(*) FILTER (WHERE ${aiUsageLedger.errorKind} IS NOT NULL))::int`,
      latency: avg(aiUsageLedger.latencyMs),
      cost: sum(aiUsageLedger.costUsd),
    })
    .from(aiUsageLedger)
    .where(and(eq(aiUsageLedger.month, currentMonth()), isNotNull(aiUsageLedger.settledAt)))
    .groupBy(aiUsageLedger.provider)
    .orderBy(aiUsageLedger.provider);

  return rows.map((row) => ({
    id: row.provider,
    name: row.provider,
    callsThisMonth: row.calls,
    errorRate: Math.round((row.failed / row.calls) * 1000) / 10,
    avgLatencyMs: row.latency === null ? null : Math.round(Number(row.latency)),
    costThisMonth: Number(row.cost ?? 0),
  }));
}

// How long spend detail is kept: enough for a year-on-year billing dispute, no more.
const LEDGER_MONTHS = 13;
const USER_COUNTER_DAYS = 90;

/** Retention, from the daily cron. A settled ledger row is anonymous after this; an open reservation is never purged. */
export async function purgeOldAiUsage() {
  const now = Date.now();
  const months = new Date(now - LEDGER_MONTHS * 31 * 24 * 3600_000);
  const lastUserDay = new Date(now - USER_COUNTER_DAYS * 24 * 3600_000).toISOString().slice(0, 10);
  await db.batch([
    db.execute(sql`DELETE FROM ai_usage_ledger WHERE status <> 'reserved' AND created_at < ${months.toISOString()}::timestamptz`),
    // Day and month rows both sort correctly as text against a YYYY-MM-DD cutoff.
    db.execute(sql`DELETE FROM ai_spend_counters WHERE scope <> 'global' AND reserved_usd = 0 AND period < ${lastUserDay}`),
    db.execute(sql`DELETE FROM ai_spend_counters WHERE scope = 'global' AND reserved_usd = 0 AND period < ${months.toISOString().slice(0, 7)}`),
  ]);
}

export type AiBudgetStatus = AiCostBudget & {
  /** Provider-reported tokens at our configured rates. */
  meteredUsd: number;
  /** Charged at the reservation: no usage reported, a timeout, or a flat per-call price. */
  estimatedUsd: number;
  /** Set aside for calls in flight. */
  reservedUsd: number;
  usedUsd: number;
};

const currentMonth = () => new Date().toISOString().slice(0, 7);

/** The policy, and this UTC month's platform spend from the counters the worker enforces with. */
export async function getAiBudgetStatus(): Promise<AiBudgetStatus> {
  const [[budget], [counter]] = await Promise.all([
    db.select().from(aiCostBudgets).orderBy(asc(aiCostBudgets.id)).limit(1),
    db.select().from(aiSpendCounters).where(and(eq(aiSpendCounters.scope, "global"), eq(aiSpendCounters.period, currentMonth()))),
  ]);
  // Migration 0022 guarantees a row. Without one the worker refuses all spend, so say so rather than invent a policy.
  if (!budget) throw new Error("No AI budget policy: apply migration 0022");
  const meteredUsd = Number(counter?.meteredUsd ?? 0);
  const estimatedUsd = Number(counter?.estimatedUsd ?? 0);
  const reservedUsd = Number(counter?.reservedUsd ?? 0);
  return { ...budget, meteredUsd, estimatedUsd, reservedUsd, usedUsd: meteredUsd + estimatedUsd + reservedUsd };
}

export async function updateAiBudgetPolicy(
  input: { budgetUsd: number; userDailyUsd: number; userMonthlyUsd: number; warningPercent: number },
  actorEmail: string
): Promise<AiCostBudget> {
  const current = await getAiBudgetStatus();

  const [updated] = await db
    .update(aiCostBudgets)
    .set({
      budgetUsd: input.budgetUsd.toFixed(2),
      userDailyUsd: input.userDailyUsd.toFixed(2),
      userMonthlyUsd: input.userMonthlyUsd.toFixed(2),
      warningThresholdPercent: input.warningPercent,
      updatedAt: new Date(),
    })
    .where(eq(aiCostBudgets.id, current.id))
    .returning();

  await recordAdminAudit({
    actorEmail,
    action: "ai.budget_update",
    resource: "ai_cost_budgets",
    targetId: current.id,
    details: { previousBudget: current.budgetUsd, ...input },
  });

  return updated;
}

