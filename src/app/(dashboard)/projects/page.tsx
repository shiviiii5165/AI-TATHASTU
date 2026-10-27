import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FolderGit2, GitFork, Sparkles, Star } from "lucide-react";

import { db } from "@/db";
import { codeRepositories, githubScores } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";

function GithubIcon({ className = "size-4" }: { className?: string }) {
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

import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Projects & Repositories | AI Tathastu",
};

export default function ProjectsPage() {
  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      <ProjectsContent />
    </Suspense>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-10 w-64 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-56 bg-slate-100 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

async function ProjectsContent() {
  const { user } = await requireOnboardedUser();

  const [repos, scores] = await Promise.all([
    db
      .select()
      .from(codeRepositories)
      .where(eq(codeRepositories.userId, user.id))
      .catch((err) => {
        console.error("[ProjectsContent] codeRepositories query failed:", err);
        return [];
      }),
    db
      .select()
      .from(githubScores)
      .where(eq(githubScores.userId, user.id))
      .catch((err) => {
        console.error("[ProjectsContent] githubScores query failed:", err);
        return [];
      }),
  ]);

  const scoresMap = new Map<string, { impactScore: number; rationale: string }>();
  scores.forEach((s) => {
    scoresMap.set(s.repoId, { impactScore: s.impactScore, rationale: s.rationale });
    if (s.repoName) {
      scoresMap.set(s.repoName.toLowerCase(), { impactScore: s.impactScore, rationale: s.rationale });
    }
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header breadcrumb & title */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">
              Projects & Engineering Repositories
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Verified technical artifacts synced with GitHub and scored by our AI Impact Engine.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings/integrations"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <GithubIcon className="size-3.5" />
              <span>Sync GitHub</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {repos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {repos.map((repo) => {
            // Unscored repos show no score rather than an invented one.
            const scoreData = scoresMap.get(String(repo.id)) || scoresMap.get(repo.repoName.toLowerCase()) || null;

            const langs = Object.keys((repo.languages as Record<string, number>) || {});
            const topics = (repo.topics as string[]) || [];
            const tags = [...langs.slice(0, 2), ...topics.slice(0, 2)];

            return (
              <div
                key={repo.id}
                className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-4 sm:p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-slate-900 text-white shrink-0">
                        <GithubIcon className="size-4" />
                      </div>
                      <h2 className="font-sans text-sm font-bold text-[#11182B] truncate" title={repo.repoName}>
                        {repo.repoName}
                      </h2>
                    </div>

                    {scoreData && (
                      <span className="shrink-0 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                        Impact {scoreData.impactScore}
                      </span>
                    )}
                  </div>

                  {repo.description && (
                    <p className="mt-3 text-xs text-[#617493] line-clamp-2 leading-relaxed">{repo.description}</p>
                  )}

                  {/* Impact rationale (from the worker's scorer; absent until scored) */}
                  {scoreData && (
                    <div className="mt-3.5 rounded-xl bg-slate-50 p-2.5 border border-slate-100 text-[11px] text-slate-600">
                      <div className="flex items-center gap-1 font-semibold text-slate-900 mb-0.5">
                        <Sparkles className="size-3 text-[#FF496D]" />
                        <span>Impact Rationale</span>
                      </div>
                      <p className="line-clamp-2">{scoreData.rationale}</p>
                    </div>
                  )}

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      {tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer stats & external link */}
                <div className="mt-5 pt-3.5 border-t border-[#F0F2F7] flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Star className="size-3.5 text-amber-500 fill-amber-500" />
                      {repo.stars || 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <GitFork className="size-3.5 text-slate-400" />
                      {repo.forks || 0}
                    </span>
                  </div>

                  <a
                    href={repo.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-[#2878F0] hover:underline"
                  >
                    <span>View Repo</span>
                    <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#E7EAF3] bg-white p-12 text-center max-w-lg mx-auto">
          <div className="size-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <FolderGit2 className="size-6" />
          </div>
          <h2 className="font-sans text-base font-bold text-slate-900">No repositories synced yet</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Connect your GitHub account to automatically sync your repositories, score them with the AI Impact Engine, and verify your proof of work.
          </p>
          <div className="mt-5">
            <Link
              href="/settings/integrations"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
            >
              <GithubIcon className="size-4" />
              <span>Connect GitHub</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
