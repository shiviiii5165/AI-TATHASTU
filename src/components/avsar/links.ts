import { isExternalHttpUrl } from "@/lib/opportunities/canonical";

/**
 * The "Official page" href for an AVSAR card: the stored URL unchanged when it is an absolute http(s) URL,
 * otherwise null so no link is rendered. Rejects javascript:, data:, file:, protocol-relative ("//host"),
 * relative and malformed values, and URLs carrying credentials.
 */
export function officialPageHref(raw: string | null | undefined): string | null {
  return typeof raw === "string" && isExternalHttpUrl(raw) ? raw : null;
}
