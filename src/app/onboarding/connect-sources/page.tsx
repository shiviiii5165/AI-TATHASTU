import type { Metadata } from "next";
import { Suspense } from "react";

import { ConnectorGrid } from "@/components/connectors/connector-grid";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { flashFrom, loadSourceCards } from "@/lib/connectors/cards";
import { requireOnboardingStep } from "@/lib/dal";

export const metadata: Metadata = { title: "Connect your work · AI Tathastu" };

export default function ConnectSourcesPage({ searchParams }: PageProps<"/onboarding/connect-sources">) {
  return (
    <>
      <StepHeader
        step="connectors"
        title="Connect your work"
      >
        Link your accounts to showcase your code, projects, and achievements. You can skip any of these.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <ConnectSourcesStep searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ConnectSourcesStep({ searchParams }: Pick<PageProps<"/onboarding/connect-sources">, "searchParams">) {
  const { user } = await requireOnboardingStep("connectors");
  const [cards, params] = await Promise.all([loadSourceCards(user), searchParams]);
  return <ConnectorGrid cards={cards} flash={flashFrom(params)} context="onboarding" />;
}
