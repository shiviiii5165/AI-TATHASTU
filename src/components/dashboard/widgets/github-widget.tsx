import { ExternalLink, Star } from "lucide-react";

import type { CodeRepository, Connection } from "@/db/schema";
import { openCredential } from "@/lib/connectors/connections";
import { timeAgo } from "@/lib/format";

export type GithubWidgetData = {
  userId: string;
  connection: Pick<Connection, "tokenEnc" | "lastSyncAt"> | null;
  /** All the user's repositories, newest push first (already loaded by the dashboard). */
  repositories: CodeRepository[];
};

/** Renders code_repositories (the sync's output), newest first. No queries of its own. */
export function GithubWidget({ data, now }: { data: GithubWidgetData; now: Date }) {
  const { connection } = data;
  const githubRepos = data.repositories.filter((r) => r.source === "github");
  const total = { n: githubRepos.length };
  const recent = githubRepos.filter((r) => r.lastCommitAt).slice(0, 3);
  const login = connection ? openCredential<{ login?: string }>(data.userId, "github", connection.tokenEnc)?.login : null;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {login ? (
          <a
            href={`https://github.com/${login}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-sm font-mono text-sm underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            @{login}
          </a>
        ) : (
          <span className="text-sm text-muted-foreground">GitHub</span>
        )}
        <p className="text-sm text-muted-foreground">
          <span className="font-mono text-foreground">{total.n}</span> {total.n === 1 ? "repository" : "repositories"}
        </p>
      </div>

      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {connection?.lastSyncAt ? "No repositories with commits yet." : "Your first import is still running."}
        </p>
      ) : (
        <ul className="mt-4 divide-y">
          {recent.map((repo) => {
            const langs = Object.entries(repo.languages).sort((a, b) => b[1] - a[1]).slice(0, 3);
            return (
              <li key={repo.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <a
                    href={repo.url ?? `https://github.com/${repo.repoName}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1.5 rounded-sm text-sm font-medium hover:text-brand focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span className="truncate">{repo.repoName.split("/")[1]}</span>
                    <ExternalLink aria-hidden className="size-3 shrink-0" />
                    <span className="sr-only">(opens GitHub)</span>
                  </a>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {repo.lastCommitAt ? timeAgo(repo.lastCommitAt, now) : ""}
                  </span>
                </div>
                {repo.description && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{repo.description}</p>}
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {langs.map(([lang]) => (
                    <span key={lang}>{lang}</span>
                  ))}
                  {repo.stars > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <Star aria-hidden className="size-3" />
                      {repo.stars}
                      <span className="sr-only">stars</span>
                    </span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
