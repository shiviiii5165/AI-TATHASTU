// "People you may know" on the dashboard: a short, honest reason for each suggestion. Client-safe, pure.
//
// Discoverable people agreed to share their name, university, target role and top skills (mentor_discovery), so
// a reason may only use those. Skills come from each person's stored collaboration summary, written by the worker
// (worker/intelligence/collaboration.py build_collaboration_embedding: "<role> at <university>. Skills: a, b. ...").
// Project titles are in that summary too, but aren't covered by the consent, so they're never read here.

/** The skills listed in a collaboration summary, as written; empty when there are none or no summary. */
export function summarySkills(summary: string | null | undefined): string[] {
  const m = summary?.match(/Skills:\s*([^.]*(?:\.(?!\s|$)[^.]*)*)\./);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/**
 * One genuine reason, best first: skills you both list, then the same university, then the plain fact that the
 * matcher found your profiles close. Never a percentage or anything the person didn't agree to share.
 */
export function relevanceReason(viewer: { skills: string[]; institution: string | null }, person: { skills: string[]; institution: string | null }): string {
  const mine = new Map(viewer.skills.map((s) => [s.toLowerCase(), s]));
  const shared = person.skills.filter((s) => mine.has(s.toLowerCase())).slice(0, 3);
  if (shared.length) return `You both work with ${list(shared)}`;
  if (viewer.institution && person.institution && viewer.institution.trim().toLowerCase() === person.institution.trim().toLowerCase()) return `Also at ${person.institution}`;
  return "Similar skills and goals to yours";
}
