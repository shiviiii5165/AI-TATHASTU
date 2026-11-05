"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import dynamic from "next/dynamic";
import { DashboardHero } from "@/components/dashboard/mockup-sections/dashboard-hero";
import { MetricCards } from "@/components/dashboard/mockup-sections/metric-cards";
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
  children,
}: DashboardViewProps) {
  const [yoraOpen, setYoraOpen] = useState(false);

  return (
    <div className="space-y-6 sm:space-y-7 pb-12">
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

      {/* E. Main Overview Row: 2 Panels. The Yora Quick Actions panel was removed from the dashboard
          (its actions had no working behaviour); Yora itself stays available from the hero and next actions. */}
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
      <GrowthDevelopmentRow intelligence={intelligence} roadmapSubmissions={roadmapSubmissions} />

      {/* H. Ecosystem and Opportunities Row: 4 Panels */}
      <EcosystemOpportunitiesRow
        opportunities={researchOpportunities}
        internships={internships}
      />

      {/* I. Next Actions and Yora Assistant */}
      <NextActionsRow actions={nextActions} onOpenYora={() => setYoraOpen(true)} />

      {/* Real Intelligence Engine & Verified Evidence Widgets */}
      {children && (
        <section aria-label="Intelligence Engine & Verified Evidence" className="mt-8 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E7EAF3] pb-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-[#F4F1FD] text-[#8554FF]">
                <Activity className="size-4" />
              </div>
              <div>
                <h2 className="font-sans text-sm font-bold text-[#11182B]">
                  Intelligence Engine & Scored Evidence
                </h2>
                <p className="text-xs text-[#64748B]">
                  Dynamic scoring, interview readiness breakdown & real-time connector feeds
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[#E8FAF4] px-2.5 py-0.5 text-[11px] font-bold text-[#19C58A]">
              Live Engine Active
            </span>
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
