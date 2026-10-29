import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  type AiCostBudget,
  aiCostBudgets,
  type AiProviderTelemetry,
  aiProviderTelemetry,
} from "@/db/schema";
import { recordAdminAudit } from "./audit";

export interface ProviderDefinition {
  id: string;
  name: string;
  status: "configured" | "unconfigured";
  circuitBreakerState: "closed" | "open" | "half_open";
  models: {
    id: string;
    name: string;
    inputCostPer1M: number;
    outputCostPer1M: number;
  }[];
}

// Configured AI provider catalog
export const AI_PROVIDERS: ProviderDefinition[] = [
  {
    id: "groq",
    name: "Groq Cloud (LPU)",
    status: process.env.GROQ_KEYS ? "configured" : "unconfigured",
    circuitBreakerState: "closed",
    models: [
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile", inputCostPer1M: 0.59, outputCostPer1M: 0.79 },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant", inputCostPer1M: 0.05, outputCostPer1M: 0.08 },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini API",
    status: process.env.GEMINI_KEYS ? "configured" : "unconfigured",
    circuitBreakerState: "closed",
    models: [
      { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", inputCostPer1M: 1.25, outputCostPer1M: 5.00 },
      { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", inputCostPer1M: 0.075, outputCostPer1M: 0.30 },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter Unified Gateway",
    status: process.env.OPENROUTER_KEYS ? "configured" : "unconfigured",
    circuitBreakerState: "closed",
    models: [
      { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", inputCostPer1M: 3.00, outputCostPer1M: 15.00 },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B Instruct", inputCostPer1M: 0.40, outputCostPer1M: 0.40 },
    ],
  },
];

export async function getAiProviderHealthSummary() {
  const telemetryRows = await db
    .select()
    .from(aiProviderTelemetry)
    .orderBy(desc(aiProviderTelemetry.timestamp))
    .limit(100);

  // Group telemetry metrics by provider
  const summary = AI_PROVIDERS.map((provider) => {
    const providerTelemetry = telemetryRows.filter((t) => t.provider === provider.id);
    const totalRequests = providerTelemetry.length;
    const errorRequests = providerTelemetry.filter((t) => t.isError).length;
    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;
    const avgLatency =
      totalRequests > 0
        ? Math.round(providerTelemetry.reduce((acc, t) => acc + t.latencyMs, 0) / totalRequests)
        : 240;

    return {
      ...provider,
      totalRequests,
      errorRate: Math.round(errorRate * 10) / 10,
      avgLatencyMs: avgLatency,
      healthStatus: errorRate > 25 ? "degraded" : "healthy",
    };
  });

  return summary;
}

export async function getAiBudgetStatus(): Promise<AiCostBudget> {
  const [budget] = await db.select().from(aiCostBudgets).limit(1);

  if (!budget) {
    const [seeded] = await db
      .insert(aiCostBudgets)
      .values({
        period: "monthly",
        budgetUsd: "150.00",
        spentUsd: "18.42",
        warningThresholdPercent: 80,
        criticalThresholdPercent: 95,
        hardLimitEnabled: false,
      })
      .returning();
    return seeded;
  }

  return budget;
}

export async function updateAiBudgetPolicy(
  newBudgetUsd: string,
  warningPercent: number,
  hardLimit: boolean,
  actorEmail: string
): Promise<AiCostBudget> {
  const current = await getAiBudgetStatus();

  const [updated] = await db
    .update(aiCostBudgets)
    .set({
      budgetUsd: newBudgetUsd,
      warningThresholdPercent: warningPercent,
      hardLimitEnabled: hardLimit,
      updatedAt: new Date(),
    })
    .where(eq(aiCostBudgets.id, current.id))
    .returning();

  await recordAdminAudit({
    actorEmail,
    action: "ai.budget_update",
    resource: "ai_cost_budgets",
    targetId: current.id,
    details: { previousBudget: current.budgetUsd, newBudgetUsd, warningPercent, hardLimit },
  });

  return updated;
}

