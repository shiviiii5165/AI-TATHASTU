"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import dynamic from "next/dynamic";
import { DashboardHero } from "@/components/dashboard/mockup-sections/dashboard-hero";
import { MetricCards } from "@/components/dashboard/mockup-sections/metric-cards";
import { CareerRoadmap } from "@/components/dashboard/mockup-sections/career-roadmap";
import { JourneyTimeline } from "@/components/dashboard/mockup-sections/journey-timeline";
import { EvidenceAchievementRow } from "@/components/dashboard/mockup-sections/evidence-achievement-row";
import { GrowthDevelopmentRow } from "@/components/dashboard/mockup-sections/growth-development-row";
import { EcosystemOpportunitiesRow } from "@/components/dashboard/mockup-sections/ecosystem-opportunities-row";
import { NextActionsRow } from "@/components/dashboard/mockup-sections/next-actions-row";

// Compact Skills Intelligence; the full interactive skill graph is on /skills.
import { SkillsOverview } from "@/components/dashboard/mockup-sections/skills-overview";

const YoraModal = dynamic(
  () => import("@/components/dashboard/yora-modal").then((m) => m.YoraModal),
  { ssr: false }
);

import type { JourneyMilestone } from "@/lib/dashboard/journey";
import type {
  AchievementItem,
  GitHubActivityData,
  OpportunityItem,
  PublicationItem,
  QuickActionItem,
  RecentProjectItem,
} from "@/lib/dashboard/stats";
import type { IntelligenceDoc } from "@/lib/dashboard/types";
import type { MilestoneSubmission } from "@/lib/roadmap/progress";

interface DashboardViewProps {
  name: string;
  line?: string;
  updated?: string;
  profilePercent?: number;
  skillsCount?: number;
  githubReposCount?: number;
  achievementsCount?: number;
  opportunitiesCount?: number;
  networkCount?: number;
  intelligence?: IntelligenceDoc;
  nextActions?: Array<{ num: number; title: string; desc: string; btnText: string; btnHref: string; category?: string }>;
  journeyMilestones?: JourneyMilestone[];
  recentProjects?: RecentProjectItem[];
  githubActivity?: GitHubActivityData | null;
  recentPublications?: PublicationItem[];
  recentAchievements?: AchievementItem[];
  researchOpportunities?: OpportunityItem[];
  internships?: OpportunityItem[];
  /** Still accepted from callers; no longer rendered (the Quick Actions panel was removed). */
  quickActions?: QuickActionItem[];
  roadmapSubmissions?: MilestoneSubmission[];
  /** A one-time notice shown above everything else (the updated AI-consent request). */
  notice?: React.ReactNode;
  children?: React.ReactNode;
}

export function DashboardView({
  name,
  line,
  updated,
  profilePercent = 0,
  skillsCount = 0,
  githubReposCount = 0,
  achievementsCount = 0,
  opportunitiesCount = 0,
  networkCount = 0,
  intelligence,
  nextActions,
  journeyMilestones,
  recentProjects,
  githubActivity,
  recentPublications,
  recentAchievements,
  researchOpportunities,
  internships,
  roadmapSubmissions,
  notice,
  children,
}: DashboardViewProps) {
  const [yoraOpen, setYoraOpen] = useState(false);

  return (
    <div className="space-y-6 sm:space-y-7 pb-12">
      {notice}
      {/* C. Personalized Hero Banner */}
      <DashboardHero
        name={name}
        line={line}
        updated={updated}
        onOpenYora={() => setYoraOpen(true)}
      />

      {/* D. Six Metric Cards */}
      <MetricCards
        profilePercent={profilePercent}
        skillsCount={skillsCount}
        githubReposCount={githubReposCount}
        achievementsCount={achievementsCount}
        opportunitiesCount={opportunitiesCount}
        networkCount={networkCount}
      />

      {/* Next steps first: the most actionable thing on the page. */}
      <NextActionsRow actions={nextActions} />

      {/* E. Journey and skills. Yora is available from the hero. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Fits its content: not stretched to the row height (which left a tall empty card). */}
        <div className="lg:col-span-6 lg:self-start">
          <JourneyTimeline milestones={journeyMilestones} />
        </div>
        <div className="lg:col-span-6 lg:self-start">
          <SkillsOverview skillGraph={intelligence?.graph} />
        </div>
      </div>

      {/* F. Evidence and Achievement Row: 4 Panels */}
      <EvidenceAchievementRow
        projects={recentProjects}
        githubActivity={githubActivity}
        publications={recentPublications}
        achievements={recentAchievements}
      />

      {/* G. Growth and Development Row: 4 Panels */}
      <GrowthDevelopmentRow intelligence={intelligence} />

      {/* G2. Career Roadmap: where you are, your chosen goal, what's missing and what to do next. */}
      <CareerRoadmap intelligence={intelligence} submissions={roadmapSubmissions} />

      {/* H. Ecosystem and Opportunities Row: 4 Panels */}
      <EcosystemOpportunitiesRow
        opportunities={researchOpportunities}
        internships={internships}
      />

      {/* Your widgets: readiness, GitHub activity, profile completeness and the like, which the user can pin or hide. */}
      {children && (
        <section aria-labelledby="your-widgets-title" className="mt-8 space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[#F4F1FD] text-[#8554FF] dark:bg-violet-500/15 dark:text-violet-300">
              <Activity aria-hidden className="size-4" />
            </div>
            <div>
              <h2 id="your-widgets-title" className="font-sans text-sm font-bold text-foreground">
                Your widgets
              </h2>
              <p className="text-xs text-muted-foreground">Readiness, activity and profile details. Pin or hide them to suit you.</p>
            </div>
          </div>

          <div>{children}</div>
        </section>
      )}

      {/* Interactive Yora Assistant Modal */}
      {yoraOpen && (
        <YoraModal open={yoraOpen} onOpenChange={setYoraOpen} userName={name} />
      )}
    </div>
  );
}
