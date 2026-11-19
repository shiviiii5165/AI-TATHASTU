/** Organisation initials for AVSAR cards: no source publishes logos, so none is invented. */
export const monogram = (org: string) =>
  org
    .split(/\s+/)
    .filter((w) => /^[A-Za-z0-9]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("") || "·";

/** Avsar's existing authorised launch route (src/app/integrations/launch/[client]). */
export const AVSAR_LAUNCH_URL = "/integrations/launch/avasar";
