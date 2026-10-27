"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { db } from "@/db";
import { onboardingState, profileFacts, type OnboardingState } from "@/db/schema";
import { requireOnboardingStep } from "@/lib/dal";
import { advanceStepQuery } from "@/lib/onboarding/advance";
import { refreshOnboardingShell } from "@/lib/onboarding/refresh";
import { CAREER_ROLE_IDS, MAX_PRIORITIES, PRIORITY_IDS } from "@/lib/onboarding/catalog";
import { nextStep, stepHref, type WizardStep } from "@/lib/onboarding/steps";
import { factDisplayValue } from "@/lib/profile/display";
import { FIELD_GROUPS } from "@/lib/profile/field-groups";
import { dispatchWebhooks, enqueueProfileUpdated } from "@/lib/integrations/webhooks";
import { enqueueComputeIntelligence } from "@/lib/jobs-queue";

export type SaveResult = { ok: true } | { ok: false; error: string };

const INVALID: SaveResult = { ok: false, error: "That selection wasn't valid. Refresh and try again." };

// ─── Step 1: career direction ───────────────────────────────────────────────

const careerDirectionSchema = z.object({
  roles: z.array(z.enum(CAREER_ROLE_IDS)).max(CAREER_ROLE_IDS.length),
  other: z.string().trim().max(120),
});

export async function saveCareerDirection(input: { roles: string[]; other: string }): Promise<SaveResult> {
  const { user } = await requireOnboardingStep("career_direction");
  const parsed = careerDirectionSchema.safeParse(input);
  if (!parsed.success) return INVALID;

  const roles = [...new Set(parsed.data.roles)];
  await db
    .update(onboardingState)
    .set({
      careerRoles: roles,
      careerRole: roles[0] ?? null,
      careerRoleOther: parsed.data.other || null,
      updatedAt: new Date(),
    })
    .where(eq(onboardingState.userId, user.id));
  return { ok: true };
}

// ─── Step 2: priorities ─────────────────────────────────────────────────────

const prioritiesSchema = z.array(z.enum(PRIORITY_IDS)).max(MAX_PRIORITIES);

export async function savePriorities(input: string[]): Promise<SaveResult> {
  const { user } = await requireOnboardingStep("priorities");
  const parsed = prioritiesSchema.safeParse(input);
  if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return INVALID;

  await db
    .update(onboardingState)
    .set({ priorities: parsed.data, updatedAt: new Date() })
    .where(eq(onboardingState.userId, user.id));
  return { ok: true };
}

// ─── Step 4b: resume review ─────────────────────────────────────────────────

const reviewSchema = z.object({
  decisions: z
    .array(
      z.object({
        id: z.uuid(),
        action: z.enum(["confirm", "reject"]),
        value: z.string().trim().max(2000),
      }),
    )
    .max(2000),
  additions: z
    .array(
      z.object({
        fieldGroup: z.string(),
        recordKey: z.uuid(),
        fieldName: z.string(),
        value: z.string().trim().min(1).max(2000),
      }),
    )
    .max(500),
});

export type ResumeReviewInput = z.infer<typeof reviewSchema>;

/**
 * Applies the user's review: approved facts become `confirmed` (or `edited`
 * when the value was changed, keeping extracted_value as the original),
 * rejected ones `rejected`, and hand-added entries are inserted as
 * user_entered + confirmed. Facts left undecided stay `unconfirmed`.
 */
export async function saveResumeReview(input: ResumeReviewInput): Promise<SaveResult> {
  const { user, state } = await requireOnboardingStep("resume");
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const { decisions, additions } = parsed.data;

  for (const a of additions) {
    const group = FIELD_GROUPS.find((g) => g.id === a.fieldGroup);
    if (!group?.repeatable || !group.fields.some((f) => f.name === a.fieldName)) return INVALID;
  }

  // Only the caller's own, still-reviewable resume facts can be decided.
  const ids = decisions.map((d) => d.id);
  const reviewable = ids.length
    ? await db
        .select({ id: profileFacts.id, normalized: profileFacts.normalizedValue, extracted: profileFacts.extractedValue })
        .from(profileFacts)
        .where(
          and(
            eq(profileFacts.userId, user.id),
            eq(profileFacts.origin, "resume"),
            eq(profileFacts.confirmation, "unconfirmed"),
            isNull(profileFacts.supersededBy),
            inArray(profileFacts.id, ids),
          ),
        )
    : [];
  if (reviewable.length !== new Set(ids).size) {
    return { ok: false, error: "Some fields changed since you opened this page. Refresh and review again." };
  }
  const byId = new Map(reviewable.map((f) => [f.id, f]));

  const writes: BatchItem<"pg">[] = decisions.map((d) => {
    const fact = byId.get(d.id)!;
    const where = eq(profileFacts.id, d.id);
    if (d.action === "reject") return db.update(profileFacts).set({ confirmation: "rejected" }).where(where);
    const original = factDisplayValue(fact.normalized ?? fact.extracted);
    return d.value === original
      ? db.update(profileFacts).set({ confirmation: "confirmed" }).where(where)
      : db.update(profileFacts).set({ confirmation: "edited", normalizedValue: d.value }).where(where);
  });

  if (additions.length) {
    writes.push(
      db.insert(profileFacts).values(
        additions.map((a) => ({
          userId: user.id,
          fieldGroup: a.fieldGroup,
          fieldName: a.fieldName,
          recordKey: a.recordKey,
          extractedValue: a.value,
          normalizedValue: a.value,
          extractionMethod: "user_entered",
          origin: "user_entered" as const,
          confidence: 1,
          validationStatus: "validated" as const,
          confirmation: "confirmed" as const,
        })),
      ),
    );
  }

  try {
    await db.batch([advanceStepQuery(user, state, "resume"), ...writes]);
  } catch (error) {
    console.error("saveResumeReview failed", error);
    return { ok: false, error: "We couldn't save your review. Check your connection and try again." };
  }
  // Newly confirmed facts: tell linked apps (no-op for users who haven't linked one).
  if ((await enqueueProfileUpdated(user.id, "facts_confirmed")).length) {
    after(() => dispatchWebhooks().catch((e) => console.error("webhook dispatch failed", e)));
  }
  // Gated on finished onboarding (a no-op mid-wizard; "Generate my profile" queues the first run).
  after(() => enqueueComputeIntelligence(user.id, "resume_facts_confirmed"));
  refreshOnboardingShell();
  redirect(stepHref(nextStep("resume", user.role)));
}

// ─── Advancing ──────────────────────────────────────────────────────────────

function stepError(step: WizardStep, state: OnboardingState): string | null {
  switch (step) {
    case "career_direction":
      return state.careerRole || state.careerRoleOther ? null : "Choose a direction, or describe your own, to continue.";
    case "priorities":
      return state.priorities.length > 0 ? null : "Pick at least one priority to continue.";
    case "research_expertise":
      return state.researchInterests.length > 0 ? null : "Add at least one research interest to continue.";
    default:
      return null;
  }
}

export type ContinueState = { error?: string } | null;

// Steps whose data is autosaved, so "Continue" only needs to validate and advance.
// "resume" and "connectors" can be skipped; their data is optional.
const CONTINUABLE = ["career_direction", "priorities", "research_expertise", "resume", "connectors"] as const;
export type ContinuableStep = (typeof CONTINUABLE)[number];

/** Validates the saved state for `step` (read fresh from the DB) and advances. */
export async function continueFromStep(_prev: ContinueState, formData: FormData): Promise<ContinueState> {
  const step = CONTINUABLE.find((s) => s === formData.get("step"));
  if (!step) return { error: "Unknown step." };

  const { user, state } = await requireOnboardingStep(step);
  const error = stepError(step, state);
  if (error) return { error };

  await advanceStepQuery(user, state, step);
  refreshOnboardingShell();
  redirect(stepHref(nextStep(step, user.role)));
}
