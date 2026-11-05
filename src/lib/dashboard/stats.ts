import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  codeRepositories,
  githubScores,
  opportunities,
  profileFacts,
  skillEvidence,
  skills,
} from "@/db/schema";
import type { Viewer } from "@/lib/discovery";
import { discoverableCount } from "@/lib/dashboard/network-count";
import { buildJourney, type JourneyMilestone } from "@/lib/dashboard/journey";
import { usableFactsOf } from "@/lib/profile/unified";

// Every number here comes from stored data. Where a value isn't known it is
// null and the UI shows it as unavailable rather than inventing one.

export interface RecentProjectItem {
  id: string;
  title: string;
  description: string | null;
  tags: string[];
  stars: number;
  forks: number;
  /** github_scores.impact_score; null until the repo has been scored. */
  impact: number | null;
  url: string | null;
}

export interface GitHubActivityData {
  repositories: number;
  languages: number;
  stars: number;
  forks: number;
  hasRepos: boolean;
  /** Repositories whose last push falls in each of the last 7 months, oldest first. */
  pushesByMonth: Array<{ label: string; count: number }>;
}

export interface PublicationItem {
  title: string;
  year: string | null;
  source: string | null;
  recordKey: string;
}

export interface AchievementItem {
  title: string;
  subtitle: string | null;
  category: "patent" | "certification" | "award" | "achievement";
  year?: string;
}

export interface OpportunityItem {
  id: string;
  title: string;
  org: string;
  match: string;
  /** Share of the role's required skills found on the profile; null when it can't be computed. */
  matchPercentage: number | null;
  type: string;
  location?: string;
  deadline?: string;
  url: string;
}

export interface QuickActionItem {
  id: string;
  title: string;
  iconName: "Compass" | "Plus" | "BookOpen" | "Users" | "FileUp" | "Github" | "Sparkles";
  iconBg: string;
  href: string;
}

export interface LiveDashboardStats {
  profilePercent: number;
  skillsCount: number;
  githubReposCount: number;
  achievementsCount: number;
  opportunitiesCount: number;
  networkCount: number;
  milestones: JourneyMilestone[];
  recentProjects: RecentProjectItem[];
  githubActivity: GitHubActivityData | null;
  recentPublications: PublicationItem[];
  recentAchievements: AchievementItem[];
  researchOpportunities: OpportunityItem[];
  internships: OpportunityItem[];
  quickActions: QuickActionItem[];
  /** The user's repositories, newest push first (shared with the GitHub widget). */
  repositories: (typeof codeRepositories.$inferSelect)[];
}

import { isCodingActivityRecord } from "@/lib/profile/coding-activity";

const ACHIEVEMENT_GROUPS =["achievement", "publication", "certification", "patent", "award"];
const isAchievementGroup = (g: string) => ACHIEVEMENT_GROUPS.some((a) => g.toLowerCase().startsWith(a));
const OPPORTUNITY_LIMIT = 50;

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export async function getLiveDashboardData(viewer: Viewer): Promise<LiveDashboardStats> {
  const userId = viewer.id;
  // One wave: every read is independent.
  const [reposRows, scoresRows, networkRes, factsRows, evidenceSkills, oppsRows] = await Promise.all([
    db
      .select()
      .from(codeRepositories)
      .where(eq(codeRepositories.userId, userId))
      .orderBy(sql`${codeRepositories.lastCommitAt} desc nulls last`),
    db
      .select({ repoId: githubScores.repoId, repoName: githubScores.repoName, impactScore: githubScores.impactScore })
      .from(githubScores)
      .where(eq(githubScores.userId, userId)),
    // People this user can actually discover (mentor_discovery consent).
    discoverableCount(viewer),
    db
      .select({
        fieldGroup: profileFacts.fieldGroup,
        fieldName: profileFacts.fieldName,
        recordKey: profileFacts.recordKey,
        normalizedValue: profileFacts.normalizedValue,
        extractedValue: profileFacts.extractedValue,
      })
      .from(profileFacts)
      .where(usableFactsOf(userId)),
    db
      .select({ skillName: skills.canonicalName })
      .from(skillEvidence)
      .innerJoin(skills, eq(skillEvidence.skillId, skills.id))
      .where(eq(skillEvidence.userId, userId)),
    db
      .select({
        id: opportunities.id,
        title: opportunities.title,
        organization: opportunities.organization,
        type: opportunities.type,
        location: opportunities.location,
        deadline: opportunities.deadline,
        requiredSkills: opportunities.requiredSkills,
        url: opportunities.url,
      })
      .from(opportunities)
      .orderBy(desc(opportunities.createdAt))
      .limit(OPPORTUNITY_LIMIT),
  ]);

  // Skill names, for counting and opportunity matching: evidenced where the intelligence
  // engine has run, from confirmed skill facts otherwise. Scores live in the engine's output.
  const userSkillNames = new Set<string>();
  for (const s of evidenceSkills) userSkillNames.add(s.skillName.toLowerCase());
  if (userSkillNames.size === 0) {
    for (const f of factsRows) {
      const val = text(f.normalizedValue || f.extractedValue).trim();
      if (f.fieldGroup === "skills" && val) userSkillNames.add(val.toLowerCase());
    }
  }
  const skillsCount = userSkillNames.size;

  const scoreMap = new Map<string, number>();
  for (const s of scoresRows) {
    scoreMap.set(s.repoId, s.impactScore);
    if (s.repoName) scoreMap.set(s.repoName.toLowerCase(), s.impactScore);
  }

  // Most-starred first, then most recently pushed (reposRows is already in push order).
  const byStars = [...reposRows].sort((a, b) => b.stars - a.stars);
  const recentProjects: RecentProjectItem[] = byStars.slice(0, 3).map((r) => {
    const tags = [...Object.keys(r.languages ?? {}).slice(0, 2), ...(r.topics ?? []).slice(0, 2)];
    return {
      id: r.id,
      title: r.repoName,
      description: r.description,
      tags,
      stars: r.stars,
      forks: r.forks,
      impact: scoreMap.get(r.id) ?? scoreMap.get(r.repoName.toLowerCase()) ?? null,
      url: r.url,
    };
  });

  const allLanguages = new Set<string>();
  for (const r of reposRows) Object.keys(r.languages ?? {}).forEach((l) => allLanguages.add(l.toLowerCase()));

  const now = new Date();
  const pushesByMonth = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
    return { year: d.getFullYear(), month: d.getMonth(), label: d.toLocaleString("en", { month: "short" }), count: 0 };
  });
  for (const r of reposRows) {
    if (!r.lastCommitAt) continue;
    const bucket = pushesByMonth.find((b) => b.year === r.lastCommitAt!.getFullYear() && b.month === r.lastCommitAt!.getMonth());
    if (bucket) bucket.count++;
  }

  const githubActivity: GitHubActivityData | null =
    reposRows.length > 0
      ? {
          repositories: reposRows.length,
          languages: allLanguages.size,
          stars: reposRows.reduce((s, r) => s + r.stars, 0),
          forks: reposRows.reduce((s, r) => s + r.forks, 0),
          hasRepos: true,
          pushesByMonth: pushesByMonth.map(({ label, count }) => ({ label, count })),
        }
      : null;

  // Group facts by record.
  const factsMap = new Map<string, { group: string; fields: Record<string, string> }>();
  for (const row of factsRows) {
    // LeetCode/HackerRank stats are coding activity, not honours: kept out of achievements and the journey.
    if (!row.recordKey || isCodingActivityRecord(row.recordKey)) continue;
    const entry = factsMap.get(row.recordKey) ?? { group: row.fieldGroup, fields: {} };
    entry.fields[row.fieldName.toLowerCase()] = text(row.normalizedValue || row.extractedValue);
    factsMap.set(row.recordKey, entry);
  }

  const recentPublications: PublicationItem[] = [];
  const recentAchievements: AchievementItem[] = [];
  let achievementsCount = 0;

  for (const [recKey, rec] of factsMap) {
    const f = rec.fields;
    const g = rec.group.toLowerCase();

    if (isAchievementGroup(g)) achievementsCount++;

    if (g.startsWith("publication")) {
      recentPublications.push({
        title: f["title"] || f["paper_title"] || "Untitled publication",
        year: f["year"] || f["date"] || null,
        source: f["venue"] || f["journal"] || f["publisher"] || null,
        recordKey: recKey,
      });
    } else if (isAchievementGroup(g)) {
      const category = g.startsWith("patent") ? "patent" : g.startsWith("cert") ? "certification" : g.startsWith("award") ? "award" : "achievement";
      recentAchievements.push({
        title: f["title"] || f["name"] || f["award_name"] || "Untitled",
        subtitle: f["issuer"] || f["organization"] || f["description"] || null,
        category,
        year: f["year"] || f["date"],
      });
    }
  }

  const milestones = buildJourney(factsMap.values());

  // Opportunity match = share of its required skills found on the profile. No floors or defaults.
  const scoredOpps: OpportunityItem[] = oppsRows.map((opp) => {
    const required = (opp.requiredSkills || []).map((s) => s.toLowerCase());
    const matchPct =
      required.length > 0 && userSkillNames.size > 0
        ? Math.round((required.filter((s) => userSkillNames.has(s)).length / required.length) * 100)
        : null;
    return {
      id: opp.id,
      title: opp.title,
      org: opp.organization,
      match: matchPct === null ? (userSkillNames.size === 0 ? "Add skills to match" : "No skills listed") : `${matchPct}% skills match`,
      matchPercentage: matchPct,
      type: opp.type,
      location: opp.location || undefined,
      deadline: opp.deadline || undefined,
      url: opp.url || "/opportunities",
    };
  });

  const researchOpportunities = scoredOpps.filter((o) => o.type === "research" || o.type === "grant");
  const internships = scoredOpps.filter((o) => o.type === "internship");

  const quickActions: QuickActionItem[] = [];
  const hasResume = factsRows.some((f) => f.fieldGroup === "education" || f.fieldGroup === "experience");
  if (!hasResume) {
    quickActions.push({ id: "resume", title: "Upload your resume or CV", iconName: "FileUp", iconBg: "bg-[#EDF5FF] text-[#2878F0]", href: "/onboarding/resume" });
  }
  if (reposRows.length === 0) {
    quickActions.push({ id: "github", title: "Connect your GitHub account", iconName: "Github", iconBg: "bg-[#F3EFFF] text-[#8554FF]", href: "/settings/integrations" });
  }
  if (skillsCount < 3) {
    quickActions.push({ id: "skills", title: "Confirm your core competencies", iconName: "Sparkles", iconBg: "bg-[#FFF0F4] text-[#FF496D]", href: "/skills" });
  }
  quickActions.push({ id: "learning", title: "Improve skills with a learning path", iconName: "BookOpen", iconBg: "bg-[#E8FAF4] text-[#19C58A]", href: "/learning" });
  quickActions.push({ id: "collaborators", title: "Find potential collaborators", iconName: "Users", iconBg: "bg-[#E6F8FB] text-[#00AEC7]", href: "/people" });
  if (quickActions.length < 4) {
    quickActions.push({ id: "project", title: "Add your latest engineering project", iconName: "Plus", iconBg: "bg-[#EDF5FF] text-[#2878F0]", href: "/projects" });
  }

  const networkCount = networkRes;

  // Fallback completeness (the worker's profile_completeness widget wins when present).
  let profilePercent = 0;
  if (hasResume) profilePercent += 35;
  if (reposRows.length > 0) profilePercent += 25;
  if (skillsCount >= 3) profilePercent += 20;
  if (achievementsCount > 0) profilePercent += 10;
  if (networkCount > 0) profilePercent += 10;

  return {
    profilePercent,
    skillsCount,
    githubReposCount: reposRows.length,
    achievementsCount,
    opportunitiesCount: oppsRows.length,
    networkCount,
    milestones,
    recentProjects,
    githubActivity,
    recentPublications,
    recentAchievements,
    researchOpportunities,
    internships,
    quickActions: quickActions.slice(0, 4),
    repositories: reposRows,
  };
}
