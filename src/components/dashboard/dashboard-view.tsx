"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import dynamic from "next/dynamic";
import { DashboardHero } from "@/components/dashboard/mockup-sections/dashboard-hero";
import { MetricCards } from "@/components/dashboard/mockup-sections/metric-cards";
import { JourneyTimeline } from "@/components/dashboard/mockup-sections/journey-timeline";
import { QuickActionsPanel } from "@/components/dashboard/mockup-sections/quick-actions-panel";
import { EvidenceAchievementRow } from "@/components/dashboard/mockup-sections/evidence-achievement-row";
import { GrowthDevelopmentRow } from "@/components/dashboard/mockup-sections/growth-development-row";
import { EcosystemOpportunitiesRow } from "@/components/dashboard/mockup-sections/ecosystem-opportunities-row";
import { NextActionsRow } from "@/components/dashboard/mockup-sections/next-actions-row";

const SkillBubbleChart = dynamic(
  () =>
    import("@/components/dashboard/mockup-sections/skill-bubble-chart").then(
      (m) => m.SkillBubbleChart
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[300px] items-center justify-center rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-xs animate-pulse">
        <div className="text-center text-xs text-[#8A9BB5]">
          Loading skill visualization…
        </div>
      </div>
    ),
  }
);

const YoraModal = dynamic(
  () => import("@/components/dashboard/yora-modal").then((m) => m.YoraModal),
  { ssr: false }
);

import type {
  CareerRoadmapData,
  LearningPathItem,
  SkillGapItem,
} from "@/components/dashboard/mockup-sections/growth-development-row";
import type {
  AchievementItem,
  GitHubActivityData,
  OpportunityItem,
  PublicationItem,
  QuickActionItem,
  RecentProjectItem,
} from "@/lib/dashboard/stats";
import type { SkillGraphData } from "@/lib/dashboard/types";

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
  inferredSkills?: Array<{ name: string; strength: number; isDirect?: boolean }>;
  skillGraph?: SkillGraphData;
  skillGaps?: SkillGapItem[];
  learningPaths?: LearningPathItem[];
  roadmap?: CareerRoadmapData;
  nextActions?: Array<{ num: number; title: string; desc: string; btnText: string; btnHref: string; category?: string }>;
  journeyMilestones?: Array<{ title: string; year: string; field: string; active?: boolean }>;
  recentProjects?: RecentProjectItem[];
  githubActivity?: GitHubActivityData | null;
  recentPublications?: PublicationItem[];
  recentAchievements?: AchievementItem[];
  proficiencySkills?: Array<{ name: string; pct: number }>;
  researchOpportunities?: OpportunityItem[];
  internships?: OpportunityItem[];
  quickActions?: QuickActionItem[];
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
  inferredSkills,
  skillGraph,
  skillGaps,
  learningPaths,
  roadmap,
  nextActions,
  journeyMilestones,
  recentProjects,
  githubActivity,
  recentPublications,
  recentAchievements,
  proficiencySkills,
  researchOpportunities,
  internships,
  quickActions,
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

      {/* E. Main Overview Row: 3 Panels */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 h-full">
          <JourneyTimeline milestones={journeyMilestones} />
        </div>
        <div className="lg:col-span-4 h-full">
          <SkillBubbleChart skills={inferredSkills} skillGraph={skillGraph} />
        </div>
        <div className="lg:col-span-4 h-full">
          <QuickActionsPanel actions={quickActions} />
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
      <GrowthDevelopmentRow
        proficiencySkills={proficiencySkills}
        gaps={skillGaps}
        learningPaths={learningPaths}
        roadmap={roadmap}
      />

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
