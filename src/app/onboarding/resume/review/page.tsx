import { and, eq, isNull } from "drizzle-orm";
import { LoaderCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { ReviewForm, type ReviewGroup } from "@/components/resume/review-form";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { profileFacts, type ProfileFact } from "@/db/schema";
import { getLatestResumeJob, requireOnboardingStep } from "@/lib/dal";
import { factDisplayValue } from "@/lib/profile/display";
import { FIELD_GROUPS, confidenceLevel, fieldLabel, type FieldGroupDef } from "@/lib/profile/field-groups";

export const metadata: Metadata = { title: "Review extracted details · AI Tathastu" };

export default function ResumeReviewPage() {
  return (
    <>
      <StepHeader
        step="resume"
        title="Review extracted details"
      >
        Verify the information extracted from your resume. You can edit, approve, or discard any detail before saving.
      </StepHeader>
      <Suspense fallback={<StepSkeleton label="Loading extracted fields…" />}>
        <ReviewStep />
      </Suspense>
    </>
  );
}

async function ReviewStep() {
  const { user } = await requireOnboardingStep("resume");

  const facts = await db
    .select()
    .from(profileFacts)
    .where(
      and(
        eq(profileFacts.userId, user.id),
        eq(profileFacts.origin, "resume"),
        eq(profileFacts.confirmation, "unconfirmed"),
        isNull(profileFacts.supersededBy),
      ),
    );

  if (facts.length === 0) {
    const job = await getLatestResumeJob(user.id);
    if (job && (job.status === "queued" || job.status === "running")) {
      return (
        <Notice title="We're still reading your resume." icon>
          This page fills in as soon as extraction finishes.
          <Button asChild variant="outline" className="mt-5 flex h-10 w-fit px-5 rounded-full border-slate-200 font-medium text-slate-700 hover:bg-slate-50">
            <Link href="/onboarding/resume">See progress</Link>
          </Button>
        </Notice>
      );
    }
    if (!job) {
      return (
        <Notice title="You haven't uploaded a resume yet.">
          Upload one first, or skip this step.
          <Button asChild variant="outline" className="mt-5 flex h-10 w-fit px-5 rounded-full border-slate-200 font-medium text-slate-700 hover:bg-slate-50">
            <Link href="/onboarding/resume">Upload a resume</Link>
          </Button>
        </Notice>
      );
    }
    // Finished but found nothing: still let the user add entries by hand.
    return <ReviewForm groups={toGroups([])} nothingFound />;
  }

  return <ReviewForm groups={toGroups(facts)} />;
}

const conf = (f: ProfileFact) => f.confidence ?? 0;

/** Groups in catalogue order; within a group, least-confident entries and fields first. */
function toGroups(facts: ProfileFact[]): ReviewGroup[] {
  const known = new Set<string>(FIELD_GROUPS.map((g) => g.id));
  // Groups the worker emitted that the catalogue doesn't know yet: still reviewable.
  const extraGroups = [...new Set(facts.map((f) => f.fieldGroup).filter((g) => !known.has(g)))].map(
    (id): Omit<FieldGroupDef, "id"> & { id: string } => ({ id, label: fieldLabel("", id), repeatable: false, fields: [] }),
  );

  return [...FIELD_GROUPS, ...extraGroups].flatMap((def) => {
    const inGroup = facts.filter((f) => f.fieldGroup === def.id);
    if (inGroup.length === 0 && !def.repeatable) return [];

    const byRecord = new Map<string, ProfileFact[]>();
    for (const f of inGroup) {
      const key = f.recordKey ?? `field:${f.id}`;
      byRecord.set(key, [...(byRecord.get(key) ?? []), f]);
    }

    const entries = [...byRecord.entries()]
      .map(([recordKey, rows]) => ({ recordKey, facts: rows.sort((a, b) => conf(a) - conf(b)) }))
      .sort((a, b) => Math.min(...a.facts.map(conf)) - Math.min(...b.facts.map(conf)));

    return [
      {
        id: def.id,
        label: def.label,
        repeatable: def.repeatable,
        addLabel: def.addLabel,
        template: def.fields,
        entries: entries.map((e) => ({
          recordKey: e.recordKey,
          facts: e.facts.map((f) => ({
            id: f.id,
            fieldName: f.fieldName,
            label: fieldLabel(def.id, f.fieldName),
            value: factDisplayValue(f.normalizedValue ?? f.extractedValue),
            evidence: f.sourceEvidence,
            page: f.location?.page ?? null,
            confidence: f.confidence,
            level: confidenceLevel(f.confidence),
            validationStatus: f.validationStatus,
          })),
        })),
      },
    ];
  });
}

function Notice({ title, icon, children }: { title: string; icon?: boolean; children: React.ReactNode }) {
  return (
    <div role="status" className="mt-10 max-w-2xl rounded-lg border border-dashed p-8">
      <p className="flex items-center gap-2 font-medium">
        {icon && <LoaderCircle aria-hidden className="size-4 animate-spin text-muted-foreground" />}
        {title}
      </p>
      <div className="mt-1 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}
