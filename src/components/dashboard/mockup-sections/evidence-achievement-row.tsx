"use client";

import {
  ArrowRight,
  Award,
  BookOpen,
  ExternalLink,
  FileText,
  FileUp,
  FolderGit2,
  GitBranch,
  Medal,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import type {
  AchievementItem,
  GitHubActivityData,
  PublicationItem,
  RecentProjectItem,
} from "@/lib/dashboard/stats";

function GithubIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

interface EvidenceAchievementRowProps {
  projects?: RecentProjectItem[];
  githubActivity?: GitHubActivityData | null;
  publications?: PublicationItem[];
  achievements?: AchievementItem[];
}

export function EvidenceAchievementRow({
  projects,
  githubActivity,
  publications,
  achievements,
}: EvidenceAchievementRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <RecentProjectsCard projects={projects} />
      <GitHubActivityCard activity={githubActivity} />
      <RecentPublicationsCard publications={publications} />
      <AchievementsCard achievements={achievements} />
    </div>
  );
}

function RecentProjectsCard({ projects = [] }: { projects?: RecentProjectItem[] }) {
  const hasProjects = projects.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#EDF5FF] text-[#2878F0]">
            <FolderGit2 className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Recent Projects</h2>
        </div>
        <Link
          href="/projects"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View All</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {hasProjects ? (
        <div className="my-2 space-y-3">
          {projects.slice(0, 3).map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-[#F0F3F8] bg-[#FAFBFC] p-3 transition-colors hover:border-[#8554FF]/30 hover:bg-white"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <GithubIcon className="size-3.5 text-slate-700 shrink-0" />
                  <span className="font-sans text-xs font-bold text-[#11182B] truncate" title={p.title}>
                    {p.title}
                  </span>
                </div>
                {p.impact !== null && (
                  <span className="rounded-full bg-[#E8FAF4] px-1.5 py-0.5 text-[10px] font-bold text-[#19C58A] shrink-0">
                    Impact {p.impact}
                  </span>
                )}
              </div>
              {p.description && <p className="mt-1 line-clamp-1 text-[11px] text-[#617493]">{p.description}</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {p.tags.slice(0, 3).map((t, tidx) => (
                  <span
                    key={tidx}
                    className="rounded-md bg-white border border-[#E7EAF3] px-1.5 py-0.5 text-[9px] font-medium text-[#4A5568]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-[#8C9AA8]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" /> {p.stars}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <GitBranch className="h-3 w-3" /> {p.forks}
                  </span>
                </div>
                <a
                  href={p.url ?? `https://github.com/${p.title}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#2878F0] hover:underline"
                >
                  Repo →
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-2.5">
            <GithubIcon className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No repositories synced yet</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Connect GitHub to see your repositories and compute your AI Impact Score.
          </p>
          <Link
            href="/settings/integrations"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            <Plus className="size-3" />
            <span>Connect GitHub</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>{hasProjects ? `${projects.length} repositories` : "GitHub sync"}</span>
        <span className="font-medium text-[#2878F0]">
          {hasProjects ? "Auto-synced" : "Pending"}
        </span>
      </div>
    </div>
  );
}

function GitHubActivityCard({ activity }: { activity?: GitHubActivityData | null }) {
  const hasActivity = Boolean(activity && activity.hasRepos);

  // Real data only: how many repositories were last pushed in each month.
  const buckets = activity?.pushesByMonth ?? [];
  const peak = Math.max(1, ...buckets.map((b) => b.count));
  const levelOf = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / peak) * 4)));

  const getColor = (level: number) => {
    switch (level) {
      case 0:
        return "bg-[#F1F5F9]";
      case 1:
        return "bg-[#D1FAE5]";
      case 2:
        return "bg-[#6EE7B7]";
      case 3:
        return "bg-[#10B981]";
      case 4:
        return "bg-[#047857]";
      default:
        return "bg-[#F1F5F9]";
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#F3EFFF] text-[#8554FF]">
            <GithubIcon className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">GitHub Activity</h2>
        </div>
        <Link
          href="/settings/integrations"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>Manage</span>
          <ExternalLink className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {hasActivity ? (
        <>
          <div className="my-auto py-2 overflow-x-auto no-scrollbar">
            <div className="min-w-[220px]">
              <p className="text-[10px] font-medium text-[#617493]">Repositories by month of last push</p>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {buckets.map((b) => (
                  <div key={b.label} className="flex flex-col items-center gap-1">
                    <div
                      className={`h-8 w-full rounded-xs ${getColor(levelOf(b.count))}`}
                      title={`${b.count} ${b.count === 1 ? "repository" : "repositories"} last pushed in ${b.label}`}
                    />
                    <span className="text-[9px] font-medium text-[#8C9AA8]">{b.label}</span>
                    <span className="text-[9px] tabular-nums text-[#4A5568]">{b.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Summary stats (all from synced repository data) */}
          <div className="grid grid-cols-4 gap-1 border-t border-[#F8FAFC] pt-3 text-center">
            <div>
              <p className="font-sans text-xs font-bold tabular-nums text-[#11182B]">{activity?.stars ?? 0}</p>
              <p className="text-[9px] text-[#64748B]">Stars</p>
            </div>
            <div>
              <p className="font-sans text-xs font-bold tabular-nums text-[#11182B]">{activity?.repositories || 0}</p>
              <p className="text-[9px] text-[#64748B]">Repositories</p>
            </div>
            <div>
              <p className="font-sans text-xs font-bold tabular-nums text-[#11182B]">{activity?.languages || 0}</p>
              <p className="text-[9px] text-[#64748B]">Languages</p>
            </div>
            <div>
              <p className="font-sans text-xs font-bold tabular-nums text-[#11182B]">{activity?.forks ?? 0}</p>
              <p className="text-[9px] text-[#64748B]">Forks</p>
            </div>
          </div>
        </>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mb-2.5">
            <GithubIcon className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No GitHub Activity Recorded</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Connect your GitHub account to activate commit analytics and repository heatmaps.
          </p>
          <Link
            href="/settings/integrations"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8554FF] text-white text-xs font-semibold hover:bg-[#703DE5] transition-colors"
          >
            <span>Connect GitHub</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function RecentPublicationsCard({ publications = [] }: { publications?: PublicationItem[] }) {
  const hasPubs = publications.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#F4F1FD] text-[#8554FF]">
            <FileText className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Recent Publications</h2>
        </div>
        <Link
          href="/achievements"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View All</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {hasPubs ? (
        <div className="my-auto divide-y divide-[#F4F6F9] py-1">
          {publications.slice(0, 4).map((pub, i) => (
            <div key={i} className="group py-2.5 transition-colors hover:text-[#8554FF]">
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#F3EFFF] text-[#8554FF]">
                  <FileText className="h-3 w-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-semibold text-[#11182B] group-hover:text-[#8554FF] transition-colors leading-snug">
                    {pub.title}
                  </p>
                  {(pub.year || pub.source) && (
                    <p className="mt-1 text-[10px] text-[#617493]">
                      {[pub.year, pub.source].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-indigo-50 text-[#8554FF] flex items-center justify-center mb-2.5">
            <BookOpen className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No Publications Found</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Upload your resume or CV to extract and verify your scholarly papers and preprints.
          </p>
          <Link
            href="/onboarding/resume"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8554FF] text-white text-xs font-semibold hover:bg-[#703DE5] transition-colors"
          >
            <FileUp className="size-3" />
            <span>Upload Resume</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>{hasPubs ? `${publications.length} ${publications.length === 1 ? "paper" : "papers"}` : "Research"}</span>
        <span className="font-medium text-[#19C58A]">
          {hasPubs ? "From your profile" : "None yet"}
        </span>
      </div>
    </div>
  );
}

function AchievementsCard({ achievements = [] }: { achievements?: AchievementItem[] }) {
  const hasAchievements = achievements.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#FFF6E9] text-[#FFB547]">
            <Trophy className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Achievements & Certs</h2>
        </div>
        <Link
          href="/achievements"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View All</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {hasAchievements ? (
        <div className="my-auto divide-y divide-[#F4F6F9] py-1">
          {achievements.slice(0, 4).map((item, i) => {
            const Icon =
              item.category === "patent"
                ? Trophy
                : item.category === "award"
                ? Medal
                : item.category === "certification"
                ? ShieldCheck
                : Award;
            const iconColor =
              item.category === "patent"
                ? "text-amber-500 bg-amber-50"
                : item.category === "award"
                ? "text-blue-500 bg-blue-50"
                : item.category === "certification"
                ? "text-emerald-500 bg-emerald-50"
                : "text-purple-500 bg-purple-50";

            return (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-[#11182B]">{item.title}</p>
                  {item.subtitle && <p className="text-[10px] text-[#617493] truncate">{item.subtitle}</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-2.5">
            <Trophy className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No Achievements Yet</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Upload your resume or add honors, patents, and certifications to showcase credentials.
          </p>
          <Link
            href="/achievements"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
          >
            <Sparkles className="size-3" />
            <span>Add Credentials</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>Honors & certifications</span>
        <span className="font-semibold text-[#FFB547]">
          {hasAchievements ? `${achievements.length} Honors Total` : "0 Honors"}
        </span>
      </div>
    </div>
  );
}
