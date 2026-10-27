// Client-safe catalogue of Step 5 sources.

import type { AccessMethod, FactOrigin, Persona, SourceId } from "@/db/schema";

export type SourceDef = {
  id: SourceId;
  name: string;
  blurb: string;
  accessMethod: AccessMethod;
  // How the card connects. "soon": listed, not connectable yet.
  connect: "github_oauth" | "orcid_oauth" | "linkedin_signin" | "form" | "soon";
  // profile_facts.origin values that "Disconnect and delete" removes.
  origins: FactOrigin[];
};

export const SOURCES: SourceDef[] = [
  {
    id: "orcid",
    name: "ORCID",
    blurb: "Publications, positions and education from your ORCID record. You sign in to ORCID to prove it's yours.",
    accessMethod: "oauth",
    connect: "orcid_oauth",
    origins: ["orcid"],
  },
  {
    id: "google_scholar",
    name: "Google Scholar",
    blurb: "Citations and h-index. Google Scholar has no public API; we'll add it once there's a reliable way to read it.",
    accessMethod: "public_scrape",
    connect: "soon",
    origins: [],
  },
  {
    id: "github",
    name: "GitHub",
    blurb: "Repositories, languages and recent commits.",
    accessMethod: "oauth",
    connect: "github_oauth",
    origins: ["github"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    blurb: "Verified identity, name, avatar and email via official LinkedIn authentication.",
    accessMethod: "oauth",
    connect: "linkedin_signin",
    origins: ["linkedin_oidc", "linkedin_scrape"],
  },
  {
    id: "kaggle",
    name: "Kaggle",
    blurb: "Competitions, notebooks and datasets.",
    accessMethod: "api_key",
    connect: "form",
    origins: ["kaggle"],
  },
  {
    id: "stack_exchange",
    name: "Stack Exchange",
    blurb: "Top tags, answers and reputation on Stack Overflow and sister sites.",
    accessMethod: "api_key",
    connect: "form",
    origins: ["stack_exchange"],
  },
  {
    id: "portfolio",
    name: "Portfolio or personal site",
    blurb: "Projects and write-ups from your own website.",
    accessMethod: "public_scrape",
    connect: "form",
    origins: ["portfolio"],
  },
  {
    id: "leetcode",
    name: "LeetCode",
    blurb: "Problems solved, contest rating and languages. Counts toward interview readiness.",
    accessMethod: "public_scrape",
    connect: "form",
    origins: ["leetcode"],
  },
  {
    id: "hackerrank",
    name: "HackerRank",
    blurb: "Skill badges and stars. Counts toward interview readiness.",
    accessMethod: "public_scrape",
    connect: "form",
    origins: ["hackerrank"],
  },
];

/** Username from a profile URL or a bare username, for LeetCode/HackerRank. */
export function parseCodingHandle(input: string, host: "leetcode.com" | "hackerrank.com"): string | null {
  const raw = input.trim();
  let handle = raw;
  if (/[/.]/.test(raw)) {
    try {
      const u = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
      if (!u.hostname.replace(/^www\./, "").endsWith(host)) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      handle = (host === "leetcode.com" ? (parts[0] === "u" ? parts[1] : parts[0]) : parts[parts.length - 1]) ?? "";
    } catch {
      return null;
    }
  }
  return /^[A-Za-z0-9_-]{1,40}$/.test(handle) ? handle : null;
}

/** Canonical public profile URL, or null if it isn't a linkedin.com/in/ link. */
export function parseLinkedInUrl(input: string): string | null {
  try {
    const raw = input.trim();
    const u = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`);
    const m = u.pathname.match(/^\/in\/([^/?#]+)/);
    if (!/(^|\.)linkedin\.com$/.test(u.hostname) || !m) return null;
    return `https://www.linkedin.com/in/${decodeURIComponent(m[1])}`;
  } catch {
    return null;
  }
}

export const sourceById = (id: string) => SOURCES.find((s) => s.id === id);

/** Which sources each persona sees on Step 5 and /connections, most useful first. */
const PERSONA_SOURCES: Record<Persona, SourceId[]> = {
  student: ["github", "linkedin", "kaggle", "stack_exchange", "portfolio", "leetcode", "hackerrank"],
  faculty: ["orcid", "google_scholar", "linkedin", "github", "portfolio"],
  alumni: ["linkedin", "github", "portfolio", "kaggle", "stack_exchange"],
};

export const sourcesFor = (persona: Persona) => PERSONA_SOURCES[persona].map((id) => sourceById(id)!);

/** Where a connector flow started, so OAuth round trips return there. */
export type ConnectorContext = "onboarding" | "connections" | "research";
export const connectorReturnPath = (from: ConnectorContext) =>
  from === "connections" ? "/connections" : from === "research" ? "/onboarding/research-expertise" : "/onboarding/connect-sources";
export const parseConnectorContext = (v: string | null | undefined): ConnectorContext =>
  v === "connections" || v === "research" ? v : "onboarding";

/** Stack Exchange network profile URL → site + numeric user id. */
export function parseStackExchangeUrl(url: string): { site: string; userId: number } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const known = ["stackoverflow.com", "superuser.com", "serverfault.com", "askubuntu.com", "mathoverflow.net"];
  const site = known.includes(host)
    ? host.split(".")[0]
    : host.endsWith(".stackexchange.com")
      ? host.replace(/\.stackexchange\.com$/, "")
      : null;
  const match = u.pathname.match(/^\/users\/(\d+)/);
  if (!site || !match || u.protocol !== "https:") return null;
  return { site, userId: Number(match[1]) };
}
