/**
 * Internships from Avsar, the authoritative owner of internship publication and applications.
 *
 * Contract: Avsar GET /api/partner/v1/internships (PartnerInternshipV1, avasar docs/API_CONTRACT.md).
 * Authentication: an ES256 service assertion minted with AI Tathastu's integration key (tokens.ts
 * mintPartnerAssertion: sub "ai-tathastu", aud "avsar-partner-api", scope "opportunities:read"). No shared
 * secret, no shared database, no student data sent: the request carries no user identity at all.
 *
 * Server-side only. Bounded in-memory cache: fresh for CACHE_TTL_MS; when Avsar fails, the last good
 * result is served for at most STALE_MAX_MS and labelled stale with its fetch time. Every read re-checks
 * deadlines, so a cached internship whose deadline passed is never shown as open; a full refresh replaces
 * the cache, so an internship Avsar withdrew, closed or unpublished disappears on the next refresh.
 *
 * AI Tathastu never creates, stores or simulates an application: each card links to Avsar's own listing
 * and apply pages, where Avsar handles sign-in (AI Tathastu SSO), eligibility and submission.
 */
import { z } from "zod";

import { explainFit, type FitExplanation, type StudentSignals } from "./fit";

export const AVSAR_HANDOFF_URL = "/integrations/launch/avasar";
export const PARTNER_AUDIENCE = "avsar-partner-api";
export const PARTNER_SCOPE = "opportunities:read";

const CACHE_TTL_MS = 10 * 60_000;
const STALE_MAX_MS = 24 * 3600_000;
const TIMEOUT_MS = 8_000;
const PAGE_SIZE = 50;
const MAX_PAGES = 4; // at most 200 internships per refresh

const nullableStr = z.string().nullable();
const ItemSchema = z.object({
  id: z.string().min(1).max(100),
  slug: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  organization: z.string().min(1).max(200),
  summary: nullableStr,
  description: z.string(),
  requiredSkills: z.array(z.string()).max(50),
  preferredSkills: z.array(z.string()).max(50),
  eligibility: z
    .object({
      educationLevels: z.array(z.string()).nullable(),
      graduationYearMin: z.number().int().nullable(),
      graduationYearMax: z.number().int().nullable(),
      minExperienceYears: z.number().int().nullable(),
      requiredCertifications: z.array(z.string()).nullable(),
      allowedLocations: z.array(z.string()).nullable(),
      requiresWorkAuthorizationIndia: z.boolean(),
      notes: nullableStr,
    })
    .nullable(),
  locations: z.array(z.string()).max(20),
  country: z.string(),
  workMode: z.enum(["remote", "hybrid", "onsite"]),
  stipend: z.object({ min: z.number().nullable(), max: z.number().nullable(), currency: z.string(), period: nullableStr, note: nullableStr }).nullable(),
  unpaid: z.boolean(),
  durationWeeks: z.number().int().nullable(),
  startDate: nullableStr,
  publishedAt: nullableStr,
  deadline: nullableStr,
  updatedAt: z.string(),
  status: z.string(),
  verification: z.string(),
  applicationMethod: z.enum(["internal", "external"]),
  url: z.string(),
  applyUrl: z.string(),
});
const PageSchema = z.object({ schema: z.literal("PartnerInternshipV1"), page: z.number(), total: z.number(), hasMore: z.boolean(), items: z.array(z.unknown()) });

export type AvsarInternship = z.infer<typeof ItemSchema>;

export interface InternshipCard {
  id: string;
  title: string;
  organization: string;
  locations: string[];
  workMode: "remote" | "hybrid" | "onsite";
  /** Published deadline (ISO), or null when Avsar has none. Never invented. */
  deadline: string | null;
  /** Readable stipend exactly as Avsar states it; null when not stated. */
  stipend: string | null;
  unpaid: boolean;
  url: string;
  applyUrl: string;
  fit: FitExplanation;
  /** Hard requirements Avsar publishes that AI Tathastu cannot confirm; Avsar checks them on application. */
  checks: string[];
}

export type InternshipFeed =
  | { status: "ok"; items: InternshipCard[]; fetchedAt: string; stale: boolean; personalised: boolean; browseUrl: string }
  | { status: "not_configured"; handoffUrl: string }
  | { status: "unavailable"; reason: "timeout" | "auth" | "rate_limited" | "bad_response" | "http_error"; handoffUrl: string };

// ── Fetching ────────────────────────────────────────────────────────────────

export interface AvsarClientOptions {
  baseUrl: string;
  mintAssertion: () => Promise<string>;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export class AvsarFetchError extends Error {
  constructor(public readonly reason: "timeout" | "auth" | "rate_limited" | "bad_response" | "http_error") {
    super(`AVSAR_${reason.toUpperCase()}`);
  }
}

/** Avsar's canonical origin, or null when unset/invalid (https only outside local development). */
export function avsarOrigin(raw: string | undefined, allowHttp = process.env.NODE_ENV !== "production"): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" && !(allowHttp && u.protocol === "http:")) return null;
    if (u.username || u.password) return null;
    return u.origin;
  } catch {
    return null;
  }
}

/** Links are used only when they point at Avsar's own origin (never an arbitrary host from a payload). */
const onOrigin = (url: string, origin: string) => {
  try {
    return new URL(url).origin === origin;
  } catch {
    return false;
  }
};

export async function fetchAvsarInternships(opts: AvsarClientOptions): Promise<AvsarInternship[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const origin = avsarOrigin(opts.baseUrl);
  if (!origin) throw new AvsarFetchError("bad_response");
  const byId = new Map<string, AvsarInternship>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const token = await opts.mintAssertion();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetchImpl(`${origin}/api/partner/v1/internships?page=${page}&pageSize=${PAGE_SIZE}`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        signal: ctrl.signal,
        redirect: "error", // a redirect would drop or leak the credential: configure the canonical host
        cache: "no-store",
      });
    } catch (e) {
      throw new AvsarFetchError(e instanceof Error && e.name === "AbortError" ? "timeout" : "http_error");
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) throw new AvsarFetchError("auth");
    if (res.status === 429) throw new AvsarFetchError("rate_limited");
    if (!res.ok) throw new AvsarFetchError("http_error");
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new AvsarFetchError("bad_response");
    }
    const parsed = PageSchema.safeParse(body);
    if (!parsed.success) throw new AvsarFetchError("bad_response");
    for (const raw of parsed.data.items) {
      const it = ItemSchema.safeParse(raw);
      // Malformed entries, anything not published, and links off Avsar's origin are dropped, not "fixed".
      if (!it.success || it.data.status !== "published" || !onOrigin(it.data.url, origin) || !onOrigin(it.data.applyUrl, origin)) continue;
      byId.set(it.data.id, it.data); // duplicates across pages collapse onto one id
    }
    if (!parsed.data.hasMore) break;
  }
  return [...byId.values()];
}

// ── Cache ───────────────────────────────────────────────────────────────────

type CacheEntry = { items: AvsarInternship[]; fetchedAt: number };
let cache: CacheEntry | null = null;
let inflight: Promise<CacheEntry> | null = null;
export const resetAvsarCache = () => {
  cache = null;
  inflight = null;
};

/** Fresh cache, or one refresh (shared by concurrent callers). On failure: stale data within limits, else the error. */
export async function loadAvsarInternships(opts: AvsarClientOptions): Promise<{ items: AvsarInternship[]; fetchedAt: number; stale: boolean }> {
  const now = (opts.now ?? Date.now)();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return { ...cache, stale: false };
  try {
    inflight ??= fetchAvsarInternships(opts)
      .then((items) => (cache = { items, fetchedAt: (opts.now ?? Date.now)() }))
      .finally(() => (inflight = null));
    const fresh = await inflight;
    return { ...fresh, stale: false };
  } catch (e) {
    if (cache && now - cache.fetchedAt < STALE_MAX_MS) return { ...cache, stale: true };
    throw e;
  }
}

// ── Recommendation (explanations from fit.ts; no score, no new engine) ─────

const LEVEL_MAP: Record<string, StudentSignals["level"]> = {
  secondary: "secondary",
  higher_secondary: "secondary",
  bachelors: "undergraduate",
  masters: "postgraduate",
  doctorate: "doctoral",
};

function stipendText(i: AvsarInternship): string | null {
  if (i.unpaid) return "Unpaid";
  const s = i.stipend;
  if (!s) return null;
  const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: s.currency || "INR", maximumFractionDigits: 0 }).format(n);
  const range = s.min !== null && s.max !== null && s.min !== s.max ? `${fmt(s.min)}–${fmt(s.max)}` : s.min !== null ? fmt(s.min) : s.max !== null ? `up to ${fmt(s.max)}` : null;
  const per = s.period ? ` / ${s.period}` : "";
  return [range ? `${range}${per}` : null, s.note].filter(Boolean).join(" · ") || null;
}

function hardChecks(i: AvsarInternship): string[] {
  const e = i.eligibility;
  if (!e) return [];
  const out: string[] = [];
  if (e.graduationYearMin !== null || e.graduationYearMax !== null) {
    out.push(e.graduationYearMin !== null && e.graduationYearMax !== null ? `Graduating ${e.graduationYearMin}–${e.graduationYearMax}` : e.graduationYearMin !== null ? `Graduating ${e.graduationYearMin} or later` : `Graduating by ${e.graduationYearMax}`);
  }
  if (e.minExperienceYears) out.push(`At least ${e.minExperienceYears} year${e.minExperienceYears > 1 ? "s" : ""} of experience`);
  if (e.requiredCertifications?.length) out.push(`Certification: ${e.requiredCertifications.join(", ")}`);
  if (e.allowedLocations?.length) out.push(`Location: ${e.allowedLocations.join(", ")}`);
  if (e.requiresWorkAuthorizationIndia) out.push("Authorised to work in India");
  if (e.notes) out.push(e.notes);
  return out;
}

export function toInternshipCards(items: AvsarInternship[], student: StudentSignals, now = Date.now()): InternshipCard[] {
  const ORDER = { strong_fit: 0, potential_fit: 1, insufficient_information: 2, not_eligible: 3 } as const;
  return items
    .filter((i) => !i.deadline || Date.parse(i.deadline) > now) // never shown as open after its deadline, even from cache
    .map((i) => {
      const levels = i.eligibility?.educationLevels ?? [];
      const mapped = levels.map((l) => LEVEL_MAP[l]);
      // A level AI Tathastu can't map (e.g. diploma) is left for Avsar to check, never judged here.
      const fitLevels = mapped.every(Boolean) ? (mapped as string[]) : [];
      const eligibilityText = levels.length && !fitLevels.length ? `Open to: ${levels.join(", ")}` : i.eligibility?.notes ?? null;
      const fit = explainFit({ requiredSkills: i.requiredSkills, eligibleLevels: fitLevels, eligibility: eligibilityText }, student);
      return {
        id: i.id,
        title: i.title,
        organization: i.organization,
        locations: i.locations,
        workMode: i.workMode,
        deadline: i.deadline,
        stipend: stipendText(i),
        unpaid: i.unpaid,
        url: i.url,
        applyUrl: i.applyUrl,
        fit,
        checks: hardChecks(i),
      };
    })
    .sort((a, b) => ORDER[a.fit.state] - ORDER[b.fit.state] || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
}

/** The dashboard's internship feed. Never substitutes sample or legacy listings. */
export async function getAvsarInternships(student: StudentSignals, opts: Partial<AvsarClientOptions> = {}): Promise<InternshipFeed> {
  const baseUrl = opts.baseUrl ?? process.env.AVSAR_API_BASE_URL;
  const origin = avsarOrigin(baseUrl);
  if (!origin || process.env.AVSAR_INTERNSHIPS_ENABLED === "0") return { status: "not_configured", handoffUrl: AVSAR_HANDOFF_URL };
  const mintAssertion =
    opts.mintAssertion ??
    (async () => {
      const { mintPartnerAssertion } = await import("@/lib/integrations/tokens");
      return mintPartnerAssertion({ audience: PARTNER_AUDIENCE, scope: PARTNER_SCOPE });
    });
  try {
    const r = await loadAvsarInternships({ baseUrl: origin, mintAssertion, fetchImpl: opts.fetchImpl, now: opts.now });
    return {
      status: "ok",
      items: toInternshipCards(r.items, student, (opts.now ?? Date.now)()),
      fetchedAt: new Date(r.fetchedAt).toISOString(),
      stale: r.stale,
      personalised: student.demonstrated.size + student.listed.size > 0,
      browseUrl: AVSAR_HANDOFF_URL,
    };
  } catch (e) {
    const reason = e instanceof AvsarFetchError ? e.reason : "http_error";
    // Short code only: never the token, response body or any profile data.
    console.error(`[avsar-internships] unavailable: ${reason}`);
    return { status: "unavailable", reason, handoffUrl: AVSAR_HANDOFF_URL };
  }
}
