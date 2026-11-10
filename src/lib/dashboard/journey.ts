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
}

type RecordFields = { group: string; fields: Record<string, string> };

const first = (fields: Record<string, string>, ...keys: string[]) => keys.map((k) => fields[k]?.trim()).find(Boolean) ?? "";
const isOngoing = (end: string) => /present|current|ongoing|now/i.test(end);

function latestYear(text: string): number | null {
  const years = [...text.matchAll(/\b(19\d\d|20\d\d)\b/g)].map((m) => Number(m[1]));
  return years.length ? Math.max(...years) : null;
}

function toMilestone({ group, fields }: RecordFields): JourneyMilestone | null {
  const g = group.toLowerCase();
  if (g === "education") {
    const title = first(fields, "degree", "degree_name", "institution");
    if (!title) return null;
    const end = first(fields, "end_date", "end_year");
    return {
      kind: "education",
      title,
      detail: [first(fields, "field_of_study", "major"), title === first(fields, "institution") ? "" : first(fields, "institution")].filter(Boolean).join(", "),
      when: end || first(fields, "start_date", "start_year") || null,
      current: isOngoing(end),
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
    };
  }
  if (g.startsWith("publication")) {
    const title = first(fields, "title", "paper_title");
    return title ? { kind: "publication", title, detail: first(fields, "venue", "journal", "publisher"), when: first(fields, "date", "year") || null, current: false } : null;
  }
  if (g.startsWith("achievement") || g.startsWith("award") || g.startsWith("cert") || g.startsWith("patent")) {
    const title = first(fields, "title", "name", "award_name");
    return title ? { kind: "achievement", title, detail: first(fields, "issuer", "organization"), when: first(fields, "date", "year") || null, current: false } : null;
  }
  if (g === "projects") {
    const title = first(fields, "title");
    const when = first(fields, "end_date", "start_date", "date");
    // Only dated projects: an undated repository list isn't a timeline.
    return title && when ? { kind: "project", title, detail: "", when, current: false } : null;
  }
  return null;
}

export interface JourneyView {
  /** Oldest first, ending on the latest (current items last): the order the timeline animates in. */
  timeline: JourneyMilestone[];
  /** Records with no date: shown apart, never placed at a guessed point in time. */
  undated: JourneyMilestone[];
  /** Earlier dated records left off to keep the card compact. */
  earlier: number;
  hiddenUndated: number;
}

/** What the dashboard timeline shows from a `buildJourney` result: the most recent `max` dated items, then undated ones. */
export function journeyView(milestones: JourneyMilestone[], max = 6, maxUndated = 2): JourneyView {
  const dated = milestones.filter((m) => m.when || m.current);
  const undated = milestones.filter((m) => !m.when && !m.current);
  const timeline = dated.slice(Math.max(0, dated.length - max));
  const shownUndated = undated.slice(0, maxUndated);
  return { timeline, undated: shownUndated, earlier: dated.length - timeline.length, hiddenUndated: undated.length - shownUndated.length };
}

/** Oldest first; ongoing items last; undated items after everything, in stable order. */
export function buildJourney(records: Iterable<RecordFields>): JourneyMilestone[] {
  const rank = (m: JourneyMilestone) => (m.current ? 9998 : m.when ? (latestYear(m.when) ?? 9999) : 9999);
  return [...records]
    .map(toMilestone)
    .filter((m): m is JourneyMilestone => m !== null)
    .map((milestone, index) => ({ milestone, index }))
    .sort((a, b) => rank(a.milestone) - rank(b.milestone) || a.index - b.index)
    .map(({ milestone }) => milestone);
}
