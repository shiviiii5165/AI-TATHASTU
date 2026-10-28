import { and, count, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ReviewConsent, type ProgressSummary } from "@/components/consent/review-consent";
import { StepHeader } from "@/components/onboarding/step-header";
import { StepSkeleton } from "@/components/onboarding/step-skeleton";
import { db } from "@/db";
import { connections, profileFacts } from "@/db/schema";
import { CONSENT_PURPOSES, type ConsentChoices } from "@/lib/consent/catalog";
import { getCurrentConsents } from "@/lib/consent/store";
import { sourceById } from "@/lib/connectors/sources";
import { getLatestResumeJob, requireOnboardingStep } from "@/lib/dal";
import type { OnboardingState, User } from "@/db/schema";
import { CAREER_ROLES, PRIORITIES } from "@/lib/onboarding/catalog";
import { stepHref } from "@/lib/onboarding/steps";

export const metadata: Metadata = { title: "Review & consent · AI Tathastu" };

export default function ReviewConsentPage() {
  return (
    <>
      <StepHeader
        step="review"
        title="Review and confirm"
        className="mx-auto w-full max-w-[880px]"
      >
        Check your answers. You can edit anything before creating your profile.
      </StepHeader>
      <Suspense fallback={<StepSkeleton />}>
        <ReviewConsentStep />
      </Suspense>
    </>
  );
}

async function ReviewConsentStep() {
  const { user, state } = await requireOnboardingStep("review");

  const [job, [facts], linked, current] = await Promise.all([
    getLatestResumeJob(user.id),
    db
      .select({ n: count() })
      .from(profileFacts)
      .where(
        and(
          eq(profileFacts.userId, user.id),
          eq(profileFacts.origin, "resume"),
          inArray(profileFacts.confirmation, ["confirmed", "edited"]),
        ),
      ),
    db.select({ sourceId: connections.sourceId, status: connections.status }).from(connections).where(eq(connections.userId, user.id)),
    getCurrentConsents(user.id),
  ]);

  const summary: ProgressSummary = {
    ...personaAnswers(user, state),
    resume: !job
      ? { state: "none" }
      : job.status === "queued" || job.status === "running"
        ? { state: "processing" }
        : job.status === "done"
          ? { state: "extracted", confirmedFacts: facts.n }
          : { state: "failed" },
    sources: linked.map((c) => ({ name: sourceById(c.sourceId)?.name ?? c.sourceId, status: c.status })),
  };

  // Unset purposes start unticked; nothing is granted by default.
  const initialChoices = Object.fromEntries(
    CONSENT_PURPOSES.map((p) => [p, current[p]?.granted === true]),
  ) as ConsentChoices;

  return <ReviewConsent summary={summary} initialChoices={initialChoices} />;
}

const roleLabel = (id: string) => CAREER_ROLES.find((r) => r.id === id)?.label ?? id;
const joined = (...parts: (string | number | null | undefined)[]) => parts.filter(Boolean).join(" · ") || null;

/** Steps 1–3 differ per persona: their rows and completeness checks. */
function personaAnswers(user: User, state: OnboardingState): Pick<ProgressSummary, "answers" | "checks"> {
  switch (user.role) {
    case "faculty": {
      const m = state.mentorship;
      const helps = [m.canVerifyEris && "verifies ERIS scores", m.canReviewResumes && "reviews resumes"].filter(Boolean).join(", ");
      return {
        answers: [
          { term: "Faculty profile", href: stepHref("faculty_profile"), value: user.name, detail: joined(user.academicTitle, user.department, user.university), empty: "No name" },
          {
            term: "Research",
            href: stepHref("research_expertise"),
            value: state.researchInterests.join(", ") || null,
            detail: state.expertiseAreas.length ? `Mentors in: ${state.expertiseAreas.map(roleLabel).join(", ")}` : null,
            empty: "No interests added",
          },
          {
            term: "Mentorship",
            href: stepHref("mentorship"),
            value: m.capacity === undefined ? null : m.capacity === 0 ? "Not taking mentees right now" : `Up to ${m.capacity} ${m.capacity === 1 ? "student" : "students"}`,
            detail: helps ? `Also ${helps}` : null,
            empty: "Not set",
          },
        ],
        checks: [
          { label: "Faculty profile", done: Boolean(user.department && user.academicTitle) },
          { label: "Research interests", done: state.researchInterests.length > 0 },
          { label: "Mentorship set up", done: m.capacity !== undefined },
        ],
      };
    }
    case "alumni": {
      const g = state.giveBack;
      const offers = [g.mentor && "Mentoring", g.refer && "Job referrals", g.speak && "Guest speaking"].filter((x): x is string => Boolean(x));
      return {
        answers: [
          { term: "Alumni profile", href: stepHref("alumni_profile"), value: user.name, detail: joined(user.degree, user.university, user.graduationYear && `Class of ${user.graduationYear}`), empty: "No name" },
          { term: "Work", href: stepHref("professional_profile"), value: joined(user.jobTitle, user.company), detail: state.careerRole ? roleLabel(state.careerRole) : null, empty: "Not added" },
          { term: "Giving back", href: stepHref("give_back"), value: null, ordered: offers, empty: "Nothing chosen yet" },
        ],
        checks: [
          { label: "Alumni profile", done: Boolean(user.university && user.graduationYear) },
          { label: "Current role", done: Boolean(user.company && user.jobTitle) },
          { label: "Ways to give back", done: offers.length > 0 },
        ],
      };
    }
    default:
      return {
        answers: [
          {
            term: "Career direction",
            href: stepHref("career_direction"),
            value: state.careerRole ? roleLabel(state.careerRole) : (state.careerRoleOther ?? null),
            detail: (() => {
              const others = [...state.careerRoles.slice(1).map(roleLabel), ...(state.careerRole && state.careerRoleOther ? [state.careerRoleOther] : [])];
              return others.length ? `Also: ${others.join(", ")}` : null;
            })(),
            empty: "Not chosen",
          },
          { term: "Priorities", href: stepHref("priorities"), value: null, ordered: state.priorities.map((id) => PRIORITIES.find((p) => p.id === id)?.label ?? id), empty: "None picked" },
          { term: "Basic profile", href: stepHref("basic_profile"), value: user.name, detail: joined(user.degree, user.specialization, user.university), empty: "No name" },
        ],
        checks: [
          { label: "Career direction", done: Boolean(state.careerRole || state.careerRoleOther) },
          { label: "Priorities", done: state.priorities.length > 0 },
          { label: "Basic profile", done: Boolean(user.name && (user.degree || user.university)) },
        ],
      };
  }
}
