import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { onboardingState, users, type OnboardingState, type User } from "@/db/schema";
import { stepHref } from "@/lib/onboarding/steps";
import { toLocalPath } from "@/lib/safe-redirect";

export type PostAuthResult = {
  destination: string;
  isOnboarded: boolean;
  isDeleted: boolean;
  user: User | null;
  state: OnboardingState | null;
};

/**
 * Centralized post-authentication router that resolves the authoritative
 * destination for a user following login, magic link callback, or session refresh.
 *
 * Rules:
 * 1. Deleted/suspended users -> /login?reason=session (fail closed)
 * 2. Uninitialized users (missing onboarding row) -> seed Step 0 ("role") atomically -> /onboarding/role
 * 3. Completed users (state.currentStep === "done") ->
 *    If valid app path provided (e.g. /settings, /connections) -> that path
 *    Otherwise -> /dashboard
 * 4. Mid-onboarding users -> resume exact stored step (stepHref(state.currentStep))
 *
 * Prevents loops between /login, /onboarding, /api/session/refresh and /dashboard.
 */
export async function resolvePostAuthDestination(
  userId: string,
  requestedUrl?: string | null,
): Promise<PostAuthResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || user.deletedAt) {
    return {
      destination: "/login?reason=session",
      isOnboarded: false,
      isDeleted: true,
      user: null,
      state: null,
    };
  }

  let [state] = await db.select().from(onboardingState).where(eq(onboardingState.userId, userId));
  if (!state) {
    const [created] = await db
      .insert(onboardingState)
      .values({ userId, currentStep: "role" })
      .onConflictDoNothing()
      .returning();
    state = created ?? (await db.select().from(onboardingState).where(eq(onboardingState.userId, userId)))[0];
  }

  const isOnboarded = state?.currentStep === "done";

  if (isOnboarded) {
    if (requestedUrl) {
      const safe = toLocalPath(requestedUrl, "/dashboard");
      // Prevent routing back to login or onboarding if already onboarded
      const isAuthOrOnboarding =
        safe === "/login" ||
        safe.startsWith("/login/") ||
        safe.startsWith("/login?") ||
        safe === "/onboarding" ||
        safe.startsWith("/onboarding/") ||
        safe.startsWith("/onboarding?");

      if (!isAuthOrOnboarding) {
        return { destination: safe, isOnboarded: true, isDeleted: false, user, state };
      }
    }
    return { destination: "/dashboard", isOnboarded: true, isDeleted: false, user, state };
  }

  // Mid-onboarding: strictly route to the stored step
  const stepTarget = state ? stepHref(state.currentStep) : "/onboarding/role";
  return { destination: stepTarget, isOnboarded: false, isDeleted: false, user, state };
}

