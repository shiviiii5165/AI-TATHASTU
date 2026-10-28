"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import type { SaveResult } from "@/app/onboarding/actions";
import { unstable_update } from "@/auth";
import { db } from "@/db";
import { jobs, onboardingState } from "@/db/schema";
import type { ConsentChoices } from "@/lib/consent/catalog";
import { appendConsents, consentChoicesSchema } from "@/lib/consent/store";
import { requireOnboardingStep } from "@/lib/dal";
import { wakeWorker } from "@/lib/worker-ping";

/**
 * "Generate my profile": records the final consent choices, finishes
 * onboarding, queues compute_intelligence, refreshes the session's
 * `onboarded` claim, and lands on the dashboard.
 */
export async function generateProfile(choices: ConsentChoices): Promise<SaveResult> {
  const { user } = await requireOnboardingStep("review");
  const parsed = consentChoicesSchema.safeParse(choices);
  if (!parsed.success) return { ok: false, error: "Invalid consent choices. Refresh and try again." };

  try {
    // Records every purpose under the current policy version: purposes the
    // user never answered (mentor discovery and analytics are only in
    // Settings now) are saved as false, an explicit opt-out.
    await appendConsents(user.id, parsed.data);
    await db.batch([
      db
        .update(onboardingState)
        .set({ currentStep: "done", consentsCompleted: true, completedAt: new Date(), updatedAt: new Date() })
        .where(eq(onboardingState.userId, user.id)),
      db
        .insert(jobs)
        .values({
          type: "compute_intelligence",
          userId: user.id,
          idempotencyKey: `compute_intelligence:${user.id}:onboarding`,
          payload: { trigger: "onboarding_complete" },
        })
        .onConflictDoNothing({ target: jobs.idempotencyKey }),
    ]);
  } catch (error) {
    console.error("generateProfile failed", error);
    return { ok: false, error: "We couldn't finish setting up. Check your connection and try again." };
  }

  wakeWorker("compute_intelligence:onboarding");

  // Re-runs the jwt callback (trigger "update") so the proxy lets /dashboard through.
  await unstable_update({});
  redirect("/dashboard");
}
