// GitHub contribution calendar: from the stored snapshot (github_contributions, migration 0027)
// to what the dashboard draws. Pure: no database, no clock except where passed in.
// Everything shown comes from GitHub's own response; nothing is estimated or filled in.

import type { GitHubContributionsData } from "@/lib/dashboard/stats";

type ContributionRow = {
  totalContributions: number | null;
  days: { date: string; count: number; level: number }[] | null;
  categoryTotals: {
    commits: number;
    pullRequests: number;
    issues: number;
    reviews: number;
    restricted: number;
  } | null;
  hasRestrictedContributions: boolean | null;
  syncedAt: Date | null;
  lastError: string | null;
  lastErrorAt: Date | null;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function toContributionsData(row: ContributionRow | null): GitHubContributionsData | null {
  if (!row) return null;
  const available = row.syncedAt !== null && row.totalContributions !== null && Array.isArray(row.days);
  return {
    available,
    total: available ? row.totalContributions : null,
    days: available ? row.days! : [],
    totals: available && row.categoryTotals
      ? {
          commits: row.categoryTotals.commits,
          pullRequests: row.categoryTotals.pullRequests,
          issues: row.categoryTotals.issues,
          reviews: row.categoryTotals.reviews,
          restricted: row.categoryTotals.restricted ?? 0,
        }
      : null,
    hasRestricted: available && Boolean(row.hasRestrictedContributions),
    syncedAt: iso(row.syncedAt),
    lastError: row.lastError,
    lastErrorAt: iso(row.lastErrorAt),
  };
}

export type CalendarCell = { date: string; count: number; level: number } | null;

/** "YYYY-MM-DD" read as a calendar date (UTC), never shifted by the viewer's time zone. */
const parseDay = (s: string) => new Date(`${s}T00:00:00Z`);

/**
 * Columns of 7 cells (Sunday first), as GitHub lays them out. Cells before the first day or
 * after the last are null (drawn as gaps, not as zero days). Month labels sit on the first
 * column that contains the 1st of that month, or the first column overall.
 */
export function layoutCalendar(days: { date: string; count: number; level: number }[]) {
  if (days.length === 0) return { weeks: [] as CalendarCell[][], months: [] as { column: number; label: string }[] };
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = new Map(sorted.map((d) => [d.date, d]));
  const first = parseDay(sorted[0].date);
  const last = parseDay(sorted[sorted.length - 1].date);
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const weeks: CalendarCell[][] = [];
  const months: { column: number; label: string }[] = [];
  for (let cursor = new Date(start); cursor <= last; ) {
    const column: CalendarCell[] = [];
    for (let i = 0; i < 7; i++) {
      const key = cursor.toISOString().slice(0, 10);
      const inRange = cursor >= first && cursor <= last;
      column.push(inRange ? byDate.get(key) ?? { date: key, count: 0, level: 0 } : null);
      if (inRange && (cursor.getUTCDate() === 1 || (weeks.length === 0 && months.length === 0))) {
        const label = cursor.toLocaleString("en", { month: "short", timeZone: "UTC" });
        if (!months.some((m) => m.column === weeks.length)) months.push({ column: weeks.length, label });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(column);
  }
  // A label squeezed in right before the next one would overlap it; GitHub drops it too.
  const spaced = months.filter((m, i) => i === months.length - 1 || months[i + 1].column - m.column >= 3);
  return { weeks, months: spaced };
}

export function describeDay(cell: { date: string; count: number }) {
  const label = parseDay(cell.date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const n = cell.count === 0 ? "No contributions" : `${cell.count} ${cell.count === 1 ? "contribution" : "contributions"}`;
  return `${n} on ${label}`;
}
