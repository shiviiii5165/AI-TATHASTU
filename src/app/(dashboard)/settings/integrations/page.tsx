import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { IntegrationCard, type IntegrationCardView } from "@/components/integrations/integration-card";
import { db } from "@/db";
import { unifiedProjects, webhookOutbox } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { clientById, INTEGRATION_CLIENTS } from "@/lib/integrations/clients";
import { effectiveScopes, getConsent, isLinked } from "@/lib/integrations/consent";
import { projectKey } from "@/lib/integrations/projection";
import { isIntegrationKeyConfigured } from "@/lib/integrations/tokens";

import { ArrowLeft, Plug } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Integrations" };

export default function IntegrationsPage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <header className="pb-6 border-b border-[#E7EAF3]">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Settings</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">Apps You Sign In To</h1>
            <p className="mt-1 text-sm text-[#64748B] max-w-2xl">
              Collaborate and Tathastu Meet use your AI Tathastu account. Manage permissions, data scopes, and active OAuth connections.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EDF5FF] text-[#2878F0] border border-[#2878F0]/20">
              <Plug className="size-4" />
              SSO Active
            </span>
          </div>
        </div>
      </header>
      <Suspense fallback={<div role="status" aria-label="Loading integrations" className="mt-10 h-96 animate-pulse rounded-lg border bg-muted" />}>
        <Cards />
      </Suspense>
    </div>
  );
}

async function Cards() {
  const { user } = await requireOnboardedUser();
  // Projects and the per-app reads are independent: one wave.
  const [projects, cards] = await Promise.all([
    db.select({ title: unifiedProjects.canonicalTitle }).from(unifiedProjects).where(eq(unifiedProjects.userId, user.id)),
    loadCards(user.id),
  ]);
  const projectList = [...new Map(projects.map((p) => [projectKey(p.title), p.title])).entries()].map(([key, title]) => ({ key, title }));

  return (
    <div className="mt-10 space-y-6">
      {cards.map((card) => (
        <IntegrationCard key={card.id} card={card} projects={projectList} />
      ))}
    </div>
  );
}

function loadCards(userId: string): Promise<IntegrationCardView[]> {
  return Promise.all(
    INTEGRATION_CLIENTS.map(async (def) => {
      const client = clientById(def.id)!;
      const [consent, enabled, [lastDelivery]] = await Promise.all([
        getConsent(userId, client.id),
        isFeatureEnabled(client.flag),
        db
          .select({ status: webhookOutbox.status, deliveredAt: webhookOutbox.deliveredAt, createdAt: webhookOutbox.createdAt })
          .from(webhookOutbox)
          .where(and(eq(webhookOutbox.userId, userId), eq(webhookOutbox.clientId, client.id)))
          .orderBy(desc(webhookOutbox.createdAt))
          .limit(1),
      ]);
      return {
        id: client.id,
        name: client.name,
        description: client.description,
        url: client.origin,
        available: enabled && Boolean(client.secret) && isIntegrationKeyConfigured(),
        syncAvailable: Boolean(client.webhookUrl && client.webhookSecret),
        linkedAt: isLinked(consent) ? consent!.linkedAt!.toISOString() : null,
        revoked: Boolean(consent?.revokedAt),
        scopes: effectiveScopes(consent),
        requested: client.requested,
        hiddenProjects: consent?.hiddenProjects ?? [],
        lastSync: lastDelivery
          ? { status: lastDelivery.status, at: (lastDelivery.deliveredAt ?? lastDelivery.createdAt).toISOString() }
          : null,
      };
    }),
  );
}
