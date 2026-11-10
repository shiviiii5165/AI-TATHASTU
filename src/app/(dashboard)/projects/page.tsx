import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ExternalLink, FolderGit2, GitFork, Star } from "lucide-react";

import { db } from "@/db";
import { codeRepositories } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";

function GithubIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "Projects & Repositories | AI Tathastu",
};

const MAX_TECH = 4;

export default function ProjectsPage() {
  return (
    <Suspense fallback={<ProjectsSkeleton />}>
      <ProjectsContent />
    </Suspense>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-5 animate-pulse" aria-busy="true" aria-label="Loading repositories">
      <div className="h-8 w-72 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

/** Languages ordered by bytes (largest first), as GitHub reports them. */
function languagesBySize(languages: unknown): string[] {
  const entries = Object.entries((languages as Record<string, number>) || {});
  return entries.sort((a, b) => (b[1] || 0) - (a[1] || 0)).map(([name]) => name);
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

async function ProjectsContent() {
  const { user } = await requireOnboardedUser();

  const repos = await db
    .select()
    .from(codeRepositories)
    .where(eq(codeRepositories.userId, user.id))
    .catch((err) => {
      console.error("[ProjectsContent] codeRepositories query failed:", err);
      return [];
    });

  // Most recently updated first; repositories without a known date go last.
  const sorted = [...repos].sort(
    (a, b) => (b.lastCommitAt?.getTime() ?? 0) - (a.lastCommitAt?.getTime() ?? 0),
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <header>
        <Link
          href="/dashboard"
          className="mb-2 inline-flex items-center gap-1.5 rounded text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to Dashboard
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="editorial-title !text-2xl tracking-tight text-slate-900 sm:!text-[28px] sm:leading-tight">
              Projects & Engineering Repositories
            </h1>
            {sorted.length > 0 && (
              <p className="mt-1 text-sm text-slate-600">
                {sorted.length} {sorted.length === 1 ? "repository" : "repositories"} synced from GitHub.
              </p>
            )}
          </div>
          <Link
            href="/settings/integrations"
            className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[13px] font-medium text-slate-700 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:self-auto"
          >
            <GithubIcon className="size-3.5" />
            Sync GitHub
          </Link>
        </div>
      </header>

      {sorted.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((repo) => {
            const langs = languagesBySize(repo.languages);
            const topics = (repo.topics as string[]) || [];
            const tech = [...langs, ...topics.filter((t) => !langs.some((l) => l.toLowerCase() === t.toLowerCase()))];
            const shown = tech.slice(0, MAX_TECH);
            const hidden = tech.length - shown.length;
            const [owner, name] = repo.repoName.includes("/")
              ? [repo.repoName.split("/")[0], repo.repoName.split("/").slice(1).join("/")]
              : [null, repo.repoName];

            return (
              <li
                key={repo.id}
                className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <GithubIcon className="size-4 shrink-0 text-slate-700" />
                  <h2 className="min-w-0 truncate text-[15px] font-semibold text-slate-900" title={repo.repoName}>
                    {owner && <span className="font-normal text-slate-500">{owner}/</span>}
                    {name}
                  </h2>
                </div>

                {repo.description ? (
                  <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-slate-600">
                    {repo.description}
                  </p>
                ) : (
                  <p className="mt-2 text-[13px] leading-5 text-slate-500">No description provided.</p>
                )}

                {shown.length > 0 && (
                  <div className="mt-3">
                    <span className="sr-only">Technologies: </span>
                    <ul className="flex flex-wrap gap-1.5" aria-label="Technologies">
                      {shown.map((t) => (
                        <li key={t} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700">
                          {t}
                        </li>
                      ))}
                      {hidden > 0 && (
                        <li className="px-1 py-0.5 text-xs text-slate-500" title={tech.slice(MAX_TECH).join(", ")}>
                          +{hidden} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="min-h-4 flex-1" aria-hidden="true" />
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1" title="Stars">
                      <Star className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Stars: </span>
                      {repo.stars || 0}
                    </span>
                    <span className="inline-flex items-center gap-1" title="Forks">
                      <GitFork className="size-3.5" aria-hidden="true" />
                      <span className="sr-only">Forks: </span>
                      {repo.forks || 0}
                    </span>
                    {repo.lastCommitAt && (
                      <span className="whitespace-nowrap">Updated {dateFormat.format(repo.lastCommitAt)}</span>
                    )}
                  </div>
                  {repo.url && (
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded font-medium text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    >
                      View on GitHub
                      <ExternalLink className="size-3" aria-hidden="true" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mx-auto max-w-md rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <FolderGit2 className="mx-auto mb-3 size-6 text-slate-400" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold text-slate-900">No repositories synced yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-[13px] text-slate-600">
            Connect your GitHub account to bring your public repositories into AI Tathastu.
          </p>
          <Link
            href="/settings/integrations"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            <GithubIcon className="size-4" />
            Connect GitHub
          </Link>
        </div>
      )}
    </div>
  );
}
