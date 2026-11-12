"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { profileFacts } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { enqueueComputeIntelligence } from "@/lib/jobs-queue";
import { cleanProjectIntent, PROJECT_INTENT_MAX } from "@/lib/dashboard/project-intent";

export type IntentResult = { ok: true; cleared: boolean } | { ok: false; error: string };

/**
 * Saves what the student wants to build as one confirmed `goals/project_intent` fact, replacing any earlier one, and
 * queues a recalculation so the engine reads it (worker/intelligence/project_intent.py). An empty description clears it.
 * The text stays in the student's own profile: it isn't part of the integrations projection.
 */
export async function saveProjectIntent(input: { text: string }): Promise<IntentResult> {
  const { user } = await requireOnboardedUser();
  if (typeof input?.text !== "string") return { ok: false, error: "That wasn't valid. Refresh and try again." };
  if (input.text.length > PROJECT_INTENT_MAX * 2) return { ok: false, error: `Keep it under ${PROJECT_INTENT_MAX} characters.` };
  const text = cleanProjectIntent(input.text);
  if (text.length > PROJECT_INTENT_MAX) return { ok: false, error: `Keep it under ${PROJECT_INTENT_MAX} characters.` };

  const existing = and(eq(profileFacts.userId, user.id), eq(profileFacts.fieldGroup, "goals"), eq(profileFacts.fieldName, "project_intent"));
  try {
    if (text) {
      await db.batch([
        db.delete(profileFacts).where(existing),
        db.insert(profileFacts).values({
          userId: user.id,
          fieldGroup: "goals",
          fieldName: "project_intent",
          extractedValue: text,
          normalizedValue: text,
          extractionMethod: "user_entered",
          origin: "user_entered",
          confidence: 1,
          validationStatus: "validated",
          confirmation: "confirmed",
        }),
      ]);
    } else {
      await db.delete(profileFacts).where(existing);
    }
    await enqueueComputeIntelligence(user.id, "project_intent");
    revalidatePath("/dashboard");
    return { ok: true, cleared: !text };
  } catch (error) {
    console.error("saveProjectIntent failed", error);
    return { ok: false, error: "We couldn't save that. Try again." };
  }
}
