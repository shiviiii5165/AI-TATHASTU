"use server";

import type { SaveResult } from "@/app/onboarding/actions";
import { appendConsent } from "@/lib/consent/store";
import { getCurrentUser, getOnboardingState } from "@/lib/dal";
import { stepIndex } from "@/lib/onboarding/steps";

/**
 * The AI-reading toggle on the resume step. Same `external_ai` consent as
 * Step 6 (append-only); granting it re-queues extraction of the latest upload.
 */
export async function setExternalAiConsent(granted: boolean): Promise<SaveResult> {
  const user = await getCurrentUser();
  const state = await getOnboardingState(user.id);
  if (state.currentStep !== "done" && stepIndex(state.currentStep, user.role) < stepIndex("resume", user.role)) {
    return { ok: false, error: "This step isn't available yet." };
  }
  if (!(await appendConsent(user.id, "external_ai", granted === true))) {
    return { ok: false, error: "That's changed too many times. Try again later." };
  }
  return { ok: true };
}
