import { and, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ResearchForm, type OrcidCard } from "@/components/onboarding/research-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { db } from "@/db";
import { connections, jobs } from "@/db/schema";
import { openCredential } from "@/lib/connectors/connections";
import { orcidConfig } from "@/lib/connectors/orcid";
import { requireOnboardingStep } from "@/lib/dal";

export const metadata: Metadata = { title: "Research & expertise" };

const ORCID_ERRORS: Record<string, string> = {
  denied: "You cancelled on ORCID. Connect again whenever you're ready.",
  state: "That connection attempt expired. Try again.",
  not_configured: "ORCID sign-in isn't set up on this server yet.",
};

export default function ResearchPage({ searchParams }: PageProps<"/onboarding/research-expertise">) {
  return (
    <>
      <StepHeader
        step="research_expertise" frame="form"
        title="Your research and expertise"
      >
        What you work on and which students you can help. Students see your interests when they look for a mentor.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <ResearchStep searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ResearchStep({ searchParams }: Pick<PageProps<"/onboarding/research-expertise">, "searchParams">) {
  const { user, state } = await requireOnboardingStep("research_expertise");
  const params = await searchParams;
  const [row] = await db
    .select({ id: connections.id, tokenEnc: connections.tokenEnc, status: connections.status })
    .from(connections)
    .where(and(eq(connections.userId, user.id), eq(connections.sourceId, "orcid")));
  const pending = row
    ? await db
        .select({ id: jobs.id })
        .from(jobs)
        .where(and(eq(jobs.userId, user.id), eq(jobs.type, "connector_sync"), inArray(jobs.status, ["queued", "running"])))
    : [];

  const error = params.source === "orcid" && typeof params.error === "string" ? (ORCID_ERRORS[params.error] ?? "ORCID didn't respond as expected. Try again.") : null;
  const orcid: OrcidCard = row
    ? {
        state: "connected",
        orcid: openCredential<{ orcid?: string }>(user.id, "orcid", row.tokenEnc)?.orcid ?? "ORCID",
        importing: row.status === "syncing" || pending.length > 0,
      }
    : orcidConfig()
      ? { state: "not_connected", error }
      : { state: "unavailable" };

  return <ResearchForm initialInterests={state.researchInterests} initialAreas={state.expertiseAreas} orcid={orcid} />;
}
