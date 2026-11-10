// Your Journey: what the user's own confirmed records say, in order. Client-safe.
// Nothing is filled in: no placeholder titles, no assumed dates, and "now" only where a record says so.

export interface JourneyMilestone {
  kind: "education" | "experience" | "project" | "achievement" | "publication";
  title: string;
  detail: string;
  /** As written on the record; null when it gives none. */
  when: string | null;
  /** Only when the record itself says it's ongoing. */
  current: boolean;
  /** The record's start date as written, when it gives one (used to order ongoing records). */
  start?: string | null;
}

type RecordFields = { group: string; fields: Record<string, string> };

const first = (fields: Record<string, string>, ...keys: string[]) => keys.map((k) => fields[k]?.trim()).find(Boolean) ?? "";
const isOngoing = (end: string) => /present|current|ongoing|now/i.test(end);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * Sortable keys (year * 12 + month) for every date written in the text. A month is used only when the text
 * names one next to the year ("Oct. 2025", "July 2026"); a bare year sorts as its January. Exported for tests.
 */
export function dateKeys(text: string | null | undefined): number[] {
  if (!text) return [];
  const keys: number[] = [];
  const re = /\b(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?((?:19|20)\d\d)\b/gi;
  for (const m of text.matchAll(re)) {
    const month = m[1] ? MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) : 0;
    keys.push(Number(m[2]) * 12 + Math.max(0, month));
  }
  return keys;
}
const latestKey = (text: string | null | undefined) => (dateKeys(text).length ? Math.max(...dateKeys(text)) : null);
const earliestKey = (text: string | null | undefined) => (dateKeys(text).length ? Math.min(...dateKeys(text)) : null);

function toMilestone({ group, fields }: RecordFields): JourneyMilestone | null {
  const g = group.toLowerCase();
  if (g === "education") {
    const title = first(fields, "degree", "degree_name", "institution");
    if (!title) return null;
    const start = first(fields, "start_date", "start_year");
    const end = first(fields, "end_date", "end_year");
    const current = isOngoing(end);
    return {
      kind: "education",
      title,
      detail: [first(fields, "field_of_study", "major"), title === first(fields, "institution") ? "" : first(fields, "institution")].filter(Boolean).join(", "),
      // An ongoing degree shows its span when the record has a start; otherwise the date as written.
      when: (current && start ? `${start} to ${end}` : end || start) || null,
      current,
      start: start || null,
    };
  }
  if (g === "experience") {
    const title = first(fields, "role", "job_title", "organization", "company");
    if (!title) return null;
    const organization = first(fields, "organization", "company");
    const start = first(fields, "start_date");
    const end = first(fields, "end_date");
    return {
      kind: "experience",
      title,
      detail: organization === title ? "" : organization,
      when: [start, end].filter(Boolean).join(" to ") || null,
      current: isOngoing(end), // A blank end date is unknown, not ongoing.
      start: start || null,
    };
  }
  if (g.startsWith("publication")) {
    const title = first(fields, "title", "paper_title");
    return title ? { kind: "publication", title, detail: first(fields, "venue", "journal", "publisher"), when: first(fields, "date", "year") || null, current: false } : null;
  }
  if (g.startsWith("achievement") || g.startsWith("award") || g.startsWith("cert") || g.startsWith("patent")) {
    const title = first(fields, "title", "name", "award_name");
    return title ? { kind: "achievement", title, detail: first(fields, "issuer", "organization", "description"), when: first(fields, "date", "year") || null, current: false } : null;
  }
  if (g === "projects") {
    const title = first(fields, "title");
    const when = first(fields, "end_date", "start_date", "date");
    // Only dated projects: an undated repository list isn't a timeline.
    return title && when ? { kind: "project", title, detail: "", when, current: false } : null;
  }
  return null;
}

/**
 * The one record that is "where you are now": among ongoing records, a job before a degree or anything else,
 * then the most recently started (a record without a start date counts as earliest). Null when nothing is
 * ongoing. Exported for tests.
 */
export function primaryCurrentIndex(timeline: JourneyMilestone[]): number | null {
  let best: { i: number; kindRank: number; start: number } | null = null;
  timeline.forEach((m, i) => {
    if (!m.current) return;
    const kindRank = m.kind === "experience" ? 2 : m.kind === "education" ? 1 : 0;
    const start = earliestKey(m.start ?? m.when) ?? -1;
    if (!best || kindRank > best.kindRank || (kindRank === best.kindRank && start > best.start)) best = { i, kindRank, start };
  });
  return best ? (best as { i: number }).i : null;
}

export interface JourneyView {
  /** Oldest first, ending on the latest (ongoing items last, by start date): the order the timeline animates in. */
  timeline: JourneyMilestone[];
  /** Index in `timeline` of the single "where you are now" record, or null. */
  primaryIndex: number | null;
  /** Achievements with no date: grouped apart, never placed at a guessed point in time. */
  undatedAchievements: JourneyMilestone[];
  /** Other records with no date (education, experience, publications). */
  undatedOther: JourneyMilestone[];
  /** Earlier dated records left off to keep the card compact. */
  earlier: number;
  hiddenUndated: number;
}

/** What the dashboard timeline shows from a `buildJourney` result: the most recent `max` dated items, then undated ones. */
export function journeyView(milestones: JourneyMilestone[], max = 8, maxUndated = 8): JourneyView {
  const dated = milestones.filter((m) => m.when || m.current);
  const undated = milestones.filter((m) => !m.when && !m.current);
  const timeline = dated.slice(Math.max(0, dated.length - max));
  const shown = undated.slice(0, maxUndated);
  return {
    timeline,
    primaryIndex: primaryCurrentIndex(timeline),
    undatedAchievements: shown.filter((m) => m.kind === "achievement"),
    undatedOther: shown.filter((m) => m.kind !== "achievement"),
    earlier: dated.length - timeline.length,
    hiddenUndated: undated.length - shown.length,
  };
}

/**
 * Oldest first by the latest date each record gives; ongoing records after all finished ones, ordered by when
 * they started; undated records last, in stable order.
 */
export function buildJourney(records: Iterable<RecordFields>): JourneyMilestone[] {
  const UNDATED = Number.MAX_SAFE_INTEGER;
  const rank = (m: JourneyMilestone): [number, number] =>
    m.current ? [UNDATED - 1, earliestKey(m.start ?? m.when) ?? -1] : [m.when ? (latestKey(m.when) ?? UNDATED) : UNDATED, 0];
  return [...records]
    .map(toMilestone)
    .filter((m): m is JourneyMilestone => m !== null)
    .map((milestone, index) => ({ milestone, index, rank: rank(milestone) }))
    .sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1] || a.index - b.index)
    .map(({ milestone }) => milestone);
}
