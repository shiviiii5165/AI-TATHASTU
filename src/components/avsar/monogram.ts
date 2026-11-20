const STOP = new Set(["of", "the", "and", "for", "&", "at", "de", "der", "und", "für"]);

/**
 * Organisation initials for AVSAR cards: no source publishes logos, so none is invented.
 * Skips connecting words, so "Indian Institute of Technology Kharagpur" reads "IIT", not "II".
 */
export const monogram = (org: string) =>
  org
    .replace(/\(.*?\)/g, " ")
    .split(/[\s,·-]+/)
    .filter((w) => w && !STOP.has(w.toLowerCase()) && /^[A-Za-z0-9]/.test(w))
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "·";

/** Avsar's existing authorised launch route (src/app/integrations/launch/[client]). */
export const AVSAR_LAUNCH_URL = "/integrations/launch/avasar";

/** Keeps order (best first) but alternates organisations, so one institution can't fill every preview slot. */
export function diversifyByOrg<T extends { organization: string }>(items: T[]): T[] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const k = it.organization.split(" · ")[0]!;
    (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(it);
  }
  const lists = [...buckets.values()];
  const out: T[] = [];
  for (let i = 0; out.length < items.length; i++) for (const l of lists) if (l[i]) out.push(l[i]!);
  return out;
}
