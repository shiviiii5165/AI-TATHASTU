import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  codeRepositories,
  githubScores,
  profileFacts,
  profileViews,
  skillEvidence,
  skills,
  githubContributions,
  users,
} from "@/db/schema";
import { getAvsarInternships, type InternshipFeed } from "@/lib/opportunities/avsar";
import type { OppDb } from "@/lib/opportunities/ingest";
import { buildStudentSignals, researchForStudent, type ResearchCard } from "@/lib/opportunities/recommend";
import { toContributionsData } from "@/lib/dashboard/github-contributions";
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
  /** GitHub's contribution calendar (migration 0027). null: never fetched (table empty or missing). */
  contributions: GitHubContributionsData | null;
}

export interface GitHubContributionsData {
  /** False until a fetch has succeeded: the calendar is unavailable, which is not zero. */
  available: boolean;
  total: number | null;
  days: { date: string; count: number; level: number }[];
  totals: { commits: number; pullRequests: number; issues: number; reviews: number; restricted: number } | null;
  /** GitHub counted private contributions it would not name. */
  hasRestricted: boolean;
  syncedAt: string | null;
  /** Why the most recent fetch failed, when it did; the snapshot shown is the last good one. */
  lastError: string | null;
  lastErrorAt: string | null;
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

/**
 * Research opportunities: verified, active listings from the curated source registry only.
 * "unavailable" means the listings could not be read (never replaced by sample data).
 */
export type ResearchFeed =
  | { status: "ok"; items: ResearchCard[]; /** false when the profile has no skills to match on yet */ personalised: boolean }
  | { status: "unavailable" };

export type { InternshipFeed, ResearchCard };

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
  researchOpportunities: ResearchFeed;
  internships: InternshipFeed;
  quickActions: QuickActionItem[];
  /** The user's repositories, newest push first (shared with the GitHub widget). */
  repositories: (typeof codeRepositories.$inferSelect)[];
}

import { isCodingActivityRecord } from "@/lib/profile/coding-activity";

const ACHIEVEMENT_GROUPS =["achievement", "publication", "certification", "patent", "award"];
const isAchievementGroup = (g: string) => ACHIEVEMENT_GROUPS.some((a) => g.toLowerCase().startsWith(a));

const text = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export async function getLiveDashboardData(viewer: Viewer): Promise<LiveDashboardStats> {
  const userId = viewer.id;
  // One wave: every read is independent.
  const [reposRows, scoresRows, networkRes, factsRows, evidenceSkills, viewRow, contributionRow] = await Promise.all([
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
    // The Intelligence Engine's assessed skill levels and the student's degree, for opportunity fit.
    db
      .select({ view: profileViews.view, degree: users.degree })
      .from(users)
      .leftJoin(profileViews, eq(profileViews.userId, users.id))
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    // Only this user's snapshot. Before migration 0027 runs the table is missing: no calendar, no failure.
    db
      .select()
      .from(githubContributions)
      .where(eq(githubContributions.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
      .catch((err) => {
        console.error("[getLiveDashboardData] github_contributions query failed:", err);
        return null;
      }),
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

  const contributions = toContributionsData(contributionRow);
  const githubActivity: GitHubActivityData | null =
    reposRows.length > 0 || contributions
      ? {
          repositories: reposRows.length,
          languages: allLanguages.size,
          stars: reposRows.reduce((s, r) => s + r.stars, 0),
          forks: reposRows.reduce((s, r) => s + r.forks, 0),
          hasRepos: reposRows.length > 0,
          contributions,
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

  // Research: verified active listings with an explainable fit (lib/opportunities). No percentages.
  // Demonstrated skills = the engine's Proficient/Advanced assessments; everything else is "listed".
  const intelligenceSkills = ((viewRow?.view as { intelligence?: { skills?: { name: string; proficiency: number | null; level: string | null }[] } } | null)?.intelligence?.skills ?? []).filter((s) => s && typeof s.name === "string");
  const signals = buildStudentSignals({
    skills: [...userSkillNames].map((name) => ({ name })),
    intelligenceSkills,
    degree: viewRow?.degree ?? null,
  });
  let researchOpportunities: ResearchFeed;
  try {
    const items = await researchForStudent(db as unknown as OppDb, signals);
    researchOpportunities = { status: "ok", items, personalised: signals.demonstrated.size + signals.listed.size > 0 };
  } catch (err) {
    // e.g. migration 0028 not applied yet: say so, never show the old seeded rows.
    console.error("[getLiveDashboardData] research opportunities unavailable:", err instanceof Error ? err.message : err);
    researchOpportunities = { status: "unavailable" };
  }
  // Internships come only from Avsar's partner API (server-side, cached, never sample data), explained
  // against the same Intelligence Engine signals as research.
  const internships = await getAvsarInternships(signals);

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
    opportunitiesCount: researchOpportunities.status === "ok" ? researchOpportunities.items.length : 0,
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
