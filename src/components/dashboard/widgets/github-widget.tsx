import { ExternalLink, FolderGit2, Star } from "lucide-react";
import Link from "next/link";

import type { CodeRepository, Connection } from "@/db/schema";
import { openCredential } from "@/lib/connectors/connections";
import { timeAgo } from "@/lib/format";

export type GithubWidgetData = {
  userId: string;
  connection: Pick<Connection, "tokenEnc" | "lastSyncAt"> | null;
  /** All the user's repositories, newest push first (already loaded by the dashboard). */
  repositories: CodeRepository[];
};

const MAX_REPOS = 4;
// Supporting-data colours (blue and teal families), one per language position, not per language meaning.
const LANG_DOT = ["bg-sky-500", "bg-teal-500", "bg-indigo-400"];

/** Only a real http(s) link is rendered; otherwise the GitHub URL from the owner/name the sync stored. */
export function repoUrl(repo: Pick<CodeRepository, "url" | "repoName">): string {
  return repo.url && /^https?:\/\//.test(repo.url) ? repo.url : `https://github.com/${repo.repoName}`;
}

/** Renders code_repositories (the sync's output), newest push first. No queries of its own, nothing invented. */
export function GithubWidget({ data, now }: { data: GithubWidgetData; now: Date }) {
  const { connection } = data;
  const githubRepos = data.repositories.filter((r) => r.source === "github");
  const recent = githubRepos.filter((r) => r.lastCommitAt).slice(0, MAX_REPOS);
  const login = connection ? openCredential<{ login?: string }>(data.userId, "github", connection.tokenEnc)?.login : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        {login ? (
          <a
            href={`https://github.com/${login}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm font-semibold text-sky-700 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:text-sky-300"
          >
            @{login}
          </a>
        ) : (
          <span className="text-muted-foreground">GitHub</span>
        )}
        <p className="text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{githubRepos.length}</span> {githubRepos.length === 1 ? "repository" : "repositories"}
          {connection?.lastSyncAt && <> · synced {timeAgo(connection.lastSyncAt, now)}</>}
        </p>
      </div>

      {recent.length === 0 ? (
        <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          <FolderGit2 aria-hidden className="mt-0.5 size-4 shrink-0 text-sky-500" />
          <p>
            {!connection ? (
              <>
                GitHub isn&apos;t connected.{" "}
                <Link href="/connections" className="font-semibold text-orange-600 hover:underline dark:text-orange-300">
                  Connect it
                </Link>{" "}
                to show your repositories and use them as evidence for your skills.
              </>
            ) : connection.lastSyncAt ? (
              "No repositories with pushes yet. Push a project to GitHub and it appears here after the next sync."
            ) : (
              "Your first import is still running. Repositories appear here once it finishes."
            )}
          </p>
        </div>
      ) : (
        <ul className="mt-3 grid gap-2" aria-label="Recent repositories">
          {recent.map((repo) => {
            const [owner, name] = repo.repoName.includes("/") ? repo.repoName.split("/", 2) : [null, repo.repoName];
            const langs = Object.entries(repo.languages ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 3);
            return (
              <li key={repo.id} className="min-w-0 rounded-xl border border-border px-3 py-2 transition-colors duration-150 hover:border-sky-200 hover:bg-sky-50/40 dark:hover:border-sky-400/30 dark:hover:bg-sky-500/5">
                <div className="flex items-start justify-between gap-3">
                  <a
                    href={repoUrl(repo)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 rounded-sm text-xs font-semibold text-foreground hover:text-sky-700 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:text-sky-300"
                  >
                    {owner && <span className="shrink-0 font-normal text-muted-foreground">{owner}/</span>}
                    <span className="truncate">{name}</span>
                    <ExternalLink aria-hidden className="size-3 shrink-0" />
                    <span className="sr-only">(opens GitHub)</span>
                  </a>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{repo.lastCommitAt ? `Updated ${timeAgo(repo.lastCommitAt, now)}` : ""}</span>
                </div>
                {repo.description && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{repo.description}</p>}
                {(langs.length > 0 || repo.stars > 0) && (
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {langs.map(([lang], i) => (
                      <span key={lang} className="inline-flex items-center gap-1">
                        <span aria-hidden className={`size-1.5 rounded-full ${LANG_DOT[i]}`} />
                        {lang}
                      </span>
                    ))}
                    {repo.stars > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Star aria-hidden className="size-3" />
                        {repo.stars}
                        <span className="sr-only">stars</span>
                      </span>
                    )}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {recent.length > 0 && <p className="mt-2 text-[10px] text-muted-foreground">Repository details as GitHub reports them. They show what a repository contains, not who wrote each part.</p>}
    </div>
  );
}
