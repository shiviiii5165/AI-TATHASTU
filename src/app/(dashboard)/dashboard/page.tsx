import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";

import { HiddenWidgets, RefreshUntilReady } from "@/components/dashboard/dashboard-client";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { WidgetErrorBoundary } from "@/components/dashboard/widget-error-boundary";
import { WidgetEmpty, WidgetSkeleton } from "@/components/dashboard/widget-states";
import { WidgetWrapper } from "@/components/dashboard/widget-wrapper";
import { ErisWidget } from "@/components/dashboard/widgets/eris-widget";
import { GithubWidget, type GithubWidgetData } from "@/components/dashboard/widgets/github-widget";
import { priorityLabel, roleLabel } from "@/components/dashboard/widgets/labels";
import { CompletenessWidget, JobMatchesWidget } from "@/components/dashboard/widgets/simple-widgets";
import { MatchesWidget } from "@/components/dashboard/widgets/matches-widget";
import { PreviewWidget } from "@/components/dashboard/widgets/preview-widget";
import { SkillGapsWidget } from "@/components/dashboard/widgets/skill-gaps-widget";
import { db } from "@/db";
import { connections, erisScores, profileViews, roadmaps } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { compose, type ComposedWidget } from "@/lib/dashboard/compose";
import { getWidgetPrefs } from "@/lib/dashboard/prefs";
import type { CompletenessData, ErisData, ProfileViewDoc, SkillGapsData } from "@/lib/dashboard/types";
import { timeAgo } from "@/lib/format";
import { matchesForMentor, type MatchCard } from "@/lib/matches";

import { getLiveDashboardData } from "@/lib/dashboard/stats";

export const metadata: Metadata = { title: "Dashboard" };

const SUPPORTED_VIEW_VERSION = 1;
const STALE_AFTER_HOURS = 7 * 24;

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const { user } = await requireOnboardedUser();
  const isMentor = user.role === "faculty" || user.role === "alumni";
  // One wave: everything the page and its widgets read, in parallel.
  const [[row], [roadmapRow], prefs, liveStats, erisRows, [github], mentorMatches] = await Promise.all([
    db.select().from(profileViews).where(eq(profileViews.userId, user.id)),
    db.select().from(roadmaps).where(eq(roadmaps.userId, user.id)),
    getWidgetPrefs(user.id),
    getLiveDashboardData({ id: user.id, role: user.role }),
    db.select({ role: erisScores.role, breakdown: erisScores.breakdownJson }).from(erisScores).where(eq(erisScores.userId, user.id)),
    db
      .select({ tokenEnc: connections.tokenEnc, lastSyncAt: connections.lastSyncAt })
      .from(connections)
      .where(and(eq(connections.userId, user.id), eq(connections.sourceId, "github"))),
    // Faculty and alumni: matched students (compute_matches), shown only with the student's consent.
    isMentor ? matchesForMentor(user.id) : null,
  ]);
  const widgetData: WidgetData = {
    erisBreakdown: (role: string | null) => (role ? erisRows.find((e) => e.role === role)?.breakdown : undefined),
    github: { userId: user.id, connection: github ?? null, repositories: liveStats.repositories },
  };
  const firstName = user.name?.trim().split(/\s+/)[0] ?? "there";

  // compute_intelligence hasn't written a view yet (it's queued at the end of onboarding).
  if (!row || (row.view as ProfileViewDoc).version !== SUPPORTED_VIEW_VERSION) {
    return (
      <DashboardView
        name={firstName}
        profilePercent={liveStats.profilePercent}
        skillsCount={liveStats.skillsCount}
        githubReposCount={liveStats.githubReposCount}
        achievementsCount={liveStats.achievementsCount}
        opportunitiesCount={liveStats.opportunitiesCount}
        networkCount={liveStats.networkCount}
        journeyMilestones={liveStats.milestones}
        recentProjects={liveStats.recentProjects}
        githubActivity={liveStats.githubActivity}
        recentPublications={liveStats.recentPublications}
        recentAchievements={liveStats.recentAchievements}
        proficiencySkills={liveStats.skillProficiency}
        researchOpportunities={liveStats.researchOpportunities}
        internships={liveStats.internships}
        quickActions={liveStats.quickActions}
      >
        <div role="status" className="max-w-xl rounded-lg border border-dashed border-[#E7EAF3] bg-white p-6 shadow-2xs">
          <p className="font-semibold text-[#11182B]">Personalizing your dashboard…</p>
          <p className="mt-1 text-sm text-[#617493]">
            We&apos;re scoring your skills and projects against your goal. This usually takes under a minute.
          </p>
          <RefreshUntilReady />
        </div>
        <DashboardSkeleton grid />
      </DashboardView>
    );
  }

  const view = row.view as ProfileViewDoc;
  const now = new Date();
  const { visible, hidden } = compose(view, prefs);

  const line = [
    view.persona === "faculty" ? [user.academicTitle, user.department].filter(Boolean).join(", ") || "Faculty / mentor" : null,
    view.persona === "alumni" ? [user.jobTitle, user.company].filter(Boolean).join(" at ") || "Alumni" : null,
    view.goals.primaryRole ? `Built around ${roleLabel(view.goals.primaryRole)}` : null,
    view.persona !== "faculty" && view.persona !== "alumni" && view.goals.priorities[0] ? `${priorityLabel(view.goals.priorities[0])} first` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const updated = `Updated ${timeAgo(view.computedAt, now)}`;

  const completenessWidget = view.widgets.find((w) => w.id === "profile_completeness");
  const completenessPercent = (completenessWidget?.data as CompletenessData | undefined)?.percent ?? liveStats.profilePercent;
  const skillsCount = liveStats.skillsCount ?? view.skills?.length ?? 0;
  const reposCount = liveStats.githubReposCount ?? view.projects?.length ?? 0;
  const achievementsCount = liveStats.achievementsCount ?? 0;
  const opportunitiesCount = liveStats.opportunitiesCount ?? 0;
  const networkCount = liveStats.networkCount ?? 0;

  return (
    <DashboardView
      name={firstName}
      line={line}
      updated={updated}
      profilePercent={completenessPercent}
      skillsCount={skillsCount}
      githubReposCount={reposCount}
      achievementsCount={achievementsCount}
      opportunitiesCount={opportunitiesCount}
      networkCount={networkCount}
      journeyMilestones={liveStats.milestones}
      recentProjects={liveStats.recentProjects}
      githubActivity={liveStats.githubActivity}
      recentPublications={liveStats.recentPublications}
      recentAchievements={liveStats.recentAchievements}
      proficiencySkills={liveStats.skillProficiency}
      researchOpportunities={liveStats.researchOpportunities}
      internships={liveStats.internships}
      quickActions={liveStats.quickActions}
      inferredSkills={view.inferredSkills}
      skillGraph={view.skillGraph || view.skill_graph}
      skillGaps={view.skillGapsAndPaths?.gaps}
      learningPaths={
        view.skillGapsAndPaths?.learning_paths ||
        (view.skillGapsAndPaths as { recommendedPaths?: import("@/components/dashboard/mockup-sections/growth-development-row").LearningPathItem[] } | undefined)?.recommendedPaths
      }
      roadmap={roadmapRow || view.careerRoadmap}
      nextActions={view.nextActions}
    >
      {visible.length === 0 ? (
        <p className="text-[#617493]">You&apos;ve hidden every widget. Bring some back below.</p>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((w) => (
            <WidgetSlot key={w.def.id} widget={w} view={view} data={widgetData} now={now} matches={mentorMatches} />
          ))}
        </div>
      )}

      {hidden.length > 0 && <HiddenWidgets items={hidden.map((w) => ({ id: w.def.id, label: w.def.label }))} />}
    </DashboardView>
  );
}

type MentorMatches = { visible: MatchCard[]; hidden: number } | null;
const MATCH_WIDGETS = new Set(["student_matches", "top_talent"]);

/** Rows the widgets render, loaded once by the page (no per-widget queries). */
type WidgetData = {
  erisBreakdown: (role: string | null) => Record<string, unknown> | undefined;
  github: GithubWidgetData;
};

function WidgetSlot({
  widget, view, data, now, matches,
}: { widget: ComposedWidget; view: ProfileViewDoc; data: WidgetData; now: Date; matches: MentorMatches }) {
  const { def, scored } = widget;
  // A match widget stops being a preview once there are matches to show.
  const hasMatches = MATCH_WIDGETS.has(def.id) && Boolean(matches && (matches.visible.length || matches.hidden));
  const state = hasMatches ? "ready" : widget.state;
  const lastSync =
    def.id === "github_activity" ? (scored?.data as { lastSyncAt?: string | null } | null)?.lastSyncAt : null;
  const staleBySync = lastSync && now.getTime() - new Date(lastSync).getTime() > STALE_AFTER_HOURS * 3600_000;
  const effectiveState = state !== "empty" && staleBySync ? "stale" : state;

  return (
    <WidgetWrapper
      id={def.id}
      label={def.label}
      module={def.module}
      size={def.size}
      state={effectiveState}
      pinned={widget.pinned}
      primaryAction={def.primaryAction}
      staleNote={lastSync ? `Synced ${timeAgo(lastSync, now)}.` : undefined}
      refreshable={def.freshnessField === "github" ? "github" : undefined}
    >
      <WidgetErrorBoundary label={def.label}>
        <Suspense fallback={<WidgetSkeleton label={def.label} />}>
          {effectiveState === "empty" ? <WidgetEmpty def={def} /> : <WidgetBody widget={widget} view={view} data={data} now={now} matches={hasMatches ? matches : null} />}
        </Suspense>
      </WidgetErrorBoundary>
    </WidgetWrapper>
  );
}

/** Maps a registry id to its component. Unknown ids never get here (compose() only yields registry widgets). */
function WidgetBody({
  widget, view, data: rows, now, matches,
}: { widget: ComposedWidget; view: ProfileViewDoc; data: WidgetData; now: Date; matches: MentorMatches }) {
  const data = widget.scored?.data;
  switch (widget.def.id) {
    case "eris_readiness":
      return <ErisWidget data={data as ErisData} byRole={view.erisScore.byRole} breakdown={rows.erisBreakdown((data as ErisData).role)} />;
    case "skill_gaps":
      return <SkillGapsWidget data={data as SkillGapsData} breakdown={rows.erisBreakdown((data as SkillGapsData).role)} />;
    case "github_activity":
      return <GithubWidget data={rows.github} now={now} />;
    case "profile_completeness":
      return <CompletenessWidget data={data as CompletenessData} />;
    case "job_matches":
      return <JobMatchesWidget data={data as { matches?: [] }} />;
    case "student_matches":
    case "top_talent":
      return matches ? <MatchesWidget visible={matches.visible} hidden={matches.hidden} /> : <PreviewWidget def={widget.def} />;
    case "mentee_requests":
    case "research_feed":
    case "referral_requests":
    case "alumni_network":
      return <PreviewWidget def={widget.def} />;
  }
}


function DashboardSkeleton({ grid }: { grid?: boolean }) {
  return (
    <div role="status" aria-label="Loading your dashboard" className={grid ? "mt-6" : ""}>
      {!grid && <div aria-hidden className="h-14 w-2/3 max-w-lg animate-pulse rounded-md bg-muted" />}
      <div aria-hidden className="mt-10 grid animate-pulse grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <div className="h-56 rounded-lg border bg-muted xl:col-span-2" />
        <div className="h-56 rounded-lg border bg-muted" />
        <div className="h-56 rounded-lg border bg-muted" />
        <div className="h-56 rounded-lg border bg-muted" />
      </div>
    </div>
  );
}
