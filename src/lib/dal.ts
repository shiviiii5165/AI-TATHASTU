import "server-only";

import { and, count, desc, eq, lt } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import { auth } from "@/auth";
import { db } from "@/db";
import { jobs, onboardingState, users, type Job, type OnboardingState, type User } from "@/db/schema";
import type { JobView } from "@/lib/jobs";
import { stepHref, stepIndex, type WizardStep } from "@/lib/onboarding/steps";

// Every read of the signed-in user goes through here (Data Access Layer).
// Server Actions call these too, so they authorize themselves rather than
// trusting that the page that rendered them was guarded.

/**
 * The session's user row and onboarding row, read in parallel (one round trip
 * instead of two: the JWT already carries the user id). Cached per request.
 */
const loadSessionRows = cache(async () => {
  // auth() touches crypto before reading the request; mark it request-time
  // first so Cache Components doesn't treat it as prerenderable.
  await connection();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const [[user], [state]] = await Promise.all([
    db.select().from(users).where(eq(users.id, userId)),
    db.select().from(onboardingState).where(eq(onboardingState.userId, userId)),
  ]);
  return { user: user as User | undefined, state: state as OnboardingState | undefined };
});

export const getCurrentUser = cache(async (): Promise<User> => {
  const rows = await loadSessionRows();
  if (!rows) redirect("/login");
  // A valid JWT for a deleted user: send them to sign in again. /login does
  // not auto-redirect on a bare JWT, so this cannot loop.
  if (!rows.user || rows.user.deletedAt) redirect("/login?reason=session");
  return rows.user;
});

/** The signed-in user and their onboarding row (backfilled if missing). */
async function getUserAndState(): Promise<{ user: User; state: OnboardingState }> {
  const user = await getCurrentUser();
  const rows = await loadSessionRows();
  return { user, state: rows?.state ?? (await getOnboardingState(user.id)) };
}

export const getOnboardingState = cache(async (userId: string): Promise<OnboardingState> => {
  // Already read alongside the user for this request's session.
  const rows = await loadSessionRows();
  if (rows?.user?.id === userId && rows.state) return rows.state;

  const [existing] = await db.select().from(onboardingState).where(eq(onboardingState.userId, userId));
  if (existing) return existing;

  // events.createUser normally seeds this row; backfill if it was missed.
  const [created] = await db
    .insert(onboardingState)
    .values({ userId, currentStep: "role" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  const [raced] = await db.select().from(onboardingState).where(eq(onboardingState.userId, userId));
  return raced;
});

/**
 * Where finished users go from /onboarding/*. Goes through a route that
 * refreshes the JWT `onboarded` claim first: if the claim were stale, the
 * proxy would bounce /dashboard back to /onboarding forever.
 */
export const FINISHED_REDIRECT = "/api/session/refresh";

/**
 * Guard for /onboarding/* pages and their actions. Users may revisit any step
 * of their own persona's flow up to their current one, but never jump ahead,
 * open another persona's step, or start before choosing a persona; finished
 * users go to the dashboard.
 */
export async function requireOnboardingStep(step: WizardStep) {
  const { user, state } = await getUserAndState();

  if (state.currentStep === "done") redirect(FINISHED_REDIRECT);
  const target = stepIndex(step, user.role);
  if (target < 0 || target > stepIndex(state.currentStep, user.role)) redirect(stepHref(state.currentStep));

  return { user, state };
}

/** Guard for Step 0 (/onboarding/role): anyone who hasn't finished onboarding. */
export async function requireRoleChoice() {
  const { user, state } = await getUserAndState();
  if (state.currentStep === "done") redirect(FINISHED_REDIRECT);
  return { user, state };
}

/**
 * Guard for connector pages and actions, shared by onboarding Step 5 and
 * /connections: the user must have reached the connectors step; finished
 * users are allowed.
 */
export async function requireConnectorUser() {
  const { user, state } = await getUserAndState();
  if (state.currentStep !== "done" && stepIndex(state.currentStep, user.role) < stepIndex("connectors", user.role)) {
    redirect(stepHref(state.currentStep));
  }
  return { user, state };
}

/** Guard for the app (dashboard and module pages): onboarding must be finished. */
export async function requireOnboardedUser() {
  const { user, state } = await getUserAndState();
  if (state.currentStep !== "done") redirect(stepHref(state.currentStep));
  return { user, state };
}

// ─── API routes ─────────────────────────────────────────────────────────────
// Route handlers answer with status codes instead of redirects.

export type ApiAuth =
  | { ok: true; user: User; state: OnboardingState }
  | { ok: false; status: 401 | 403; error: string };

/**
 * Signed-in user who has reached `step` of onboarding. Finished users are
 * rejected unless `allowDone` (connector routes serve /connections too).
 */
/** Session user + onboarding row for route handlers (parallel reads, no redirects). */
async function apiSessionRows(): Promise<{ user: User; state: OnboardingState } | null> {
  const rows = await loadSessionRows();
  if (!rows?.user || rows.user.deletedAt) return null;
  return { user: rows.user, state: rows.state ?? (await getOnboardingState(rows.user.id)) };
}

export async function getApiUserAtStep(step: WizardStep, { allowDone = false } = {}): Promise<ApiAuth> {
  const rows = await apiSessionRows();
  if (!rows) return { ok: false, status: 401, error: "Sign in to continue." };
  const { user, state } = rows;
  const needed = stepIndex(step, user.role);
  if (state.currentStep === "done" ? !allowDone : needed < 0 || stepIndex(state.currentStep, user.role) < needed) {
    return { ok: false, status: 403, error: "This step isn't available yet." };
  }
  return { ok: true, user, state };
}


/** Signed-in user who has finished onboarding (dashboard APIs). */
export async function getApiOnboardedUser(): Promise<ApiAuth> {
  const rows = await apiSessionRows();
  if (!rows) return { ok: false, status: 401, error: "Sign in to continue." };
  const { user, state } = rows;
  if (state.currentStep !== "done") return { ok: false, status: 403, error: "Finish onboarding first." };
  return { ok: true, user, state };
}

/** Always scoped to the owner: another user's job id reads as not found. */
export async function getJobForUser(userId: string, jobId: string): Promise<JobView | null> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)));
  if (!job) return null;
  return toJobView(job);
}

export async function getLatestResumeJob(userId: string): Promise<JobView | null> {
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.userId, userId), eq(jobs.type, "resume_extract")))
    .orderBy(desc(jobs.createdAt))
    .limit(1);
  return job ? toJobView(job) : null;
}

async function toJobView(job: Job): Promise<JobView> {
  let queuePosition: number | null = null;
  if (job.status === "queued") {
    const [ahead] = await db
      .select({ n: count() })
      .from(jobs)
      .where(and(eq(jobs.type, job.type), eq(jobs.status, "queued"), lt(jobs.runAt, job.runAt)));
    queuePosition = ahead.n;
  }
  return {
    id: job.id,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    queuePosition,
    // Worker errors are internal; the client gets a generic message only.
    error: job.status === "failed" || job.status === "needs_review" ? "We couldn't read this file." : null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
    fileName: typeof job.payload.fileName === "string" ? job.payload.fileName : null,
  };
}
