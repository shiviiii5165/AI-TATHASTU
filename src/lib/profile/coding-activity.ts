/**
 * Coding activity (LeetCode / HackerRank) is problem-solving practice, not a patent, honour, award or
 * publication. The connectors store it under the "achievements" field group with record keys
 * "leetcode:stats" / "hackerrank:stats" (ERIS reads it from there, so the stored rows stay as they are);
 * every reader that lists achievements must route these records here instead.
 */

const CODING_SOURCES = { leetcode: "LeetCode", hackerrank: "HackerRank" } as const;
export type CodingSource = keyof typeof CODING_SOURCES;

export function codingActivitySource(recordKey: string | null | undefined): CodingSource | null {
  if (!recordKey) return null;
  const prefix = recordKey.split(":")[0]?.toLowerCase();
  return prefix === "leetcode" || prefix === "hackerrank" ? prefix : null;
}

export const isCodingActivityRecord = (recordKey: string | null | undefined) => codingActivitySource(recordKey) !== null;

export type CodingActivity = {
  source: CodingSource;
  sourceLabel: string;
  /** Counts the platform did not return stay null: never shown as 0. */
  total: number | null;
  easy: number | null;
  medium: number | null;
  hard: number | null;
  badges: { name: string; stars: number }[];
  /** LeetCode contest results, kept apart from solved counts; null when the platform returned none. */
  contest: { rating: number; attended: number | null; topPercentage: number | null } | null;
  summary: string;
  /**
   * Fetched from the platform's public profile API for the username the user entered. That proves the
   * numbers come from the platform, not that the account belongs to the user.
   */
  verification: "public_profile_import";
  profileRef: string | null;
};

type FactRow = { fieldName: string; recordKey: string | null; normalizedValue: unknown; extractedValue: unknown; sourceEvidence?: string | null };

const count = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);

/** Builds one entry per coding-activity record from its facts. Other records are ignored. */
export function codingActivitiesFrom(rows: FactRow[]): CodingActivity[] {
  const byKey = new Map<string, FactRow[]>();
  for (const r of rows) {
    if (!isCodingActivityRecord(r.recordKey)) continue;
    byKey.set(r.recordKey!, [...(byKey.get(r.recordKey!) ?? []), r]);
  }
  const out: CodingActivity[] = [];
  for (const [key, facts] of byKey) {
    const source = codingActivitySource(key)!;
    const title = facts.find((f) => f.fieldName === "title");
    const stats = (title?.extractedValue && typeof title.extractedValue === "object" ? title.extractedValue : {}) as Record<string, unknown>;
    const badges = stats.badges && typeof stats.badges === "object" ? Object.entries(stats.badges as Record<string, unknown>).flatMap(([name, stars]) => (count(stars) !== null ? [{ name, stars: stars as number }] : [])) : [];
    out.push({
      source,
      sourceLabel: CODING_SOURCES[source],
      total: count(stats.total),
      easy: count(stats.easy),
      medium: count(stats.medium),
      hard: count(stats.hard),
      badges,
      contest:
        count(stats.contest_rating) !== null
          ? { rating: stats.contest_rating as number, attended: count(stats.contests), topPercentage: count(stats.top_percentage) }
          : null,
      summary: String(title?.normalizedValue ?? (typeof title?.extractedValue === "string" ? title.extractedValue : "") ?? ""),
      verification: "public_profile_import",
      profileRef: title?.sourceEvidence ?? null,
    });
  }
  return out;
}
