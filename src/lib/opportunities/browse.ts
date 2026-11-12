/**
 * The authoritative research-opportunity service: the dashboard card, the /opportunities pages and YORA
 * all read through here (built on recommendableWhere), so every surface shows the same verified listings.
 *
 * Student signals come from the Intelligence Engine's existing output for the signed-in student only;
 * nothing about the student is sent anywhere. Interactions record only what the student did in AI Tathastu
 * (viewed, opened the official destination, told us they applied); an external submission is never
 * claimed as verified.
 */
import { and, desc, eq, gt, ilike, inArray, isNotNull, lte, ne, or, sql, type SQL } from "drizzle-orm";

import { opportunities, opportunityInteractions, opportunitySaves, opportunitySources, profileViews, users, type OpportunityDetails } from "@/db/schema";

import { explainFit, type FitExplanation, type FitState, type StudentSignals } from "./fit";
import type { OppDb } from "./ingest";
import { buildStudentSignals, recommendableWhere } from "./recommend";

export const SECTIONS = {
  recommended: "Recommended for you",
  internships: "Research internships & programmes",
  assistant: "Research / Project Assistant",
  jrf_srf: "JRF / SRF",
  fellowships: "Research fellowships",
  phd: "PhD opportunities",
  postdoc: "Postdoctoral positions",
  government: "Government research",
  international: "International",
  saved: "Saved",
  all: "All opportunities",
} as const;
export type Section = keyof typeof SECTIONS;

export interface BrowseFilters {
  section?: Section;
  q?: string;
  organization?: string;
  country?: string;
  workMode?: string;
  closingWithinDays?: number;
  stipendPublished?: boolean;
  /** "bachelor's degree" | "master's degree" | "PhD", as read from the announcement's qualifications. */
  educationLevel?: string;
}

export type ApplyMode =
  | { kind: "portal"; url: string; announcementUrl: string }
  | { kind: "email"; email: string; announcementUrl: string }
  | { kind: "announcement"; url: string }
  | { kind: "unavailable" };

export interface OpportunityView {
  id: string;
  title: string;
  organization: string;
  researchGroup: string | null;
  principalInvestigator: string | null;
  kind: string | null;
  country: string | null;
  location: string | null;
  workMode: string | null;
  deadline: string | null;
  deadlineAt: string | null;
  description: string | null;
  eligibility: string | null;
  requiredSkills: string[];
  details: OpportunityDetails;
  extractionStatus: string;
  url: string;
  sourceName: string;
  sourceUrl: string | null;
  lastVerifiedAt: string;
  publishedAt: string | null;
  apply: ApplyMode;
  fit: FitExplanation;
  saved: boolean;
  remind: boolean;
  /** What the student did here; never an externally verified submission. */
  interactions: { opened: boolean; confirmedApplied: boolean };
}

// Government programmes and funders as named by the source (title, organisation or extracted details).
// PostgreSQL regex: \y is a word boundary (\b would mean backspace there).
/** JRF / SRF positions (PostgreSQL \m and \M are word start and end). */
const JRF_SRF_PG = "\\m(jrf|srf)\\M|junior research fellow|senior research fellow";
const GOVERNMENT_PG = "\\y(csir|dst|anrf|serb|isro|drdo|icmr|icar|dbt|barc|meity|nqm|national quantum mission|government|ministry)\\y";
const ORDER: Record<FitState, number> = { strong_fit: 0, potential_fit: 1, insufficient_information: 2, not_eligible: 3 };

/** Where Apply may go, strictly from what the source published. No URL or address is ever constructed. */
export function applyModeOf(o: { applicationMethod: string; applicationUrl: string | null; applicationEmail: string | null; url: string | null }): ApplyMode {
  if (!o.url) return { kind: "unavailable" };
  if (o.applicationMethod === "portal" && o.applicationUrl) return { kind: "portal", url: o.applicationUrl, announcementUrl: o.url };
  if (o.applicationMethod === "email" && o.applicationEmail) return { kind: "email", email: o.applicationEmail, announcementUrl: o.url };
  if (o.applicationMethod === "unavailable") return { kind: "unavailable" };
  return { kind: "announcement", url: o.url };
}

/** The signed-in student's signals from the Intelligence Engine's stored output (same inputs as the dashboard). */
export async function loadStudentSignals(db: OppDb, userId: string): Promise<StudentSignals> {
  const [row] = await db
    .select({ view: profileViews.view, degree: users.degree })
    .from(users)
    .leftJoin(profileViews, eq(profileViews.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  const view = row?.view as { intelligence?: { skills?: { name: string; proficiency: number | null; level: string | null }[] }; skills?: { name: string }[] } | null;
  const intelligenceSkills = (view?.intelligence?.skills ?? []).filter((s) => s && typeof s.name === "string");
  const skills = (view?.skills ?? []).filter((s) => s && typeof s.name === "string").map((s) => ({ name: s.name }));
  return buildStudentSignals({ skills, intelligenceSkills, degree: row?.degree ?? null });
}

function filterWhere(f: BrowseFilters, now: Date): SQL {
  const where: (SQL | undefined)[] = [recommendableWhere(now), eq(opportunities.type, "research")];
  if (f.q) {
    const term = `%${f.q.replace(/[%_\\]/g, (m) => `\\${m}`).slice(0, 80)}%`;
    where.push(or(ilike(opportunities.title, term), ilike(opportunities.organization, term), ilike(opportunities.researchGroup, term), ilike(opportunities.description, term)));
  }
  if (f.organization) where.push(eq(opportunities.organization, f.organization));
  if (f.country) where.push(eq(opportunities.country, f.country));
  if (f.workMode) where.push(eq(opportunities.workMode, f.workMode));
  if (f.closingWithinDays) where.push(and(isNotNull(opportunities.deadlineAt), lte(opportunities.deadlineAt, new Date(now.getTime() + f.closingWithinDays * 86_400_000))));
  if (f.stipendPublished) where.push(sql`${opportunities.details} ? 'stipend'`);
  if (f.educationLevel) where.push(sql`${opportunities.details}->'educationLevels'->'value' ? ${f.educationLevel}`);
  switch (f.section) {
    case "internships":
      where.push(or(eq(opportunities.kind, "research_internship"), sql`${opportunities.title} ~* '(summer|winter) (research|school|programme|program|internship)|visiting student|internship'`));
      break;
    case "assistant":
      where.push(and(eq(opportunities.kind, "research_assistant"), sql`${opportunities.title} !~* ${JRF_SRF_PG}`));
      break;
    case "jrf_srf":
      where.push(sql`${opportunities.title} ~* ${JRF_SRF_PG}`);
      break;
    case "fellowships":
      where.push(and(eq(opportunities.kind, "fellowship"), sql`${opportunities.title} !~* 'post-?doc'`));
      break;
    case "phd":
      where.push(eq(opportunities.kind, "phd_position"));
      break;
    case "postdoc":
      where.push(sql`${opportunities.title} ~* 'post-?doc'`);
      break;
    case "government":
      where.push(or(sql`${opportunities.organization} ~* ${GOVERNMENT_PG}`, sql`${opportunities.title} ~* ${GOVERNMENT_PG}`, sql`${opportunities.description} ~* ${GOVERNMENT_PG}`, sql`${opportunities.details}::text ~* ${GOVERNMENT_PG}`));
      break;
    case "international":
      where.push(and(isNotNull(opportunities.country), ne(opportunities.country, "India")));
      break;
  }
  return and(...where)!;
}

type Row = typeof opportunities.$inferSelect;

function toView(o: Row, sourceName: string, sourceUrl: string | null, student: StudentSignals, extra: { saved?: boolean; remind?: boolean; opened?: boolean; confirmed?: boolean } = {}): OpportunityView {
  return {
    id: o.id,
    title: o.title,
    organization: o.organization,
    researchGroup: o.researchGroup,
    principalInvestigator: o.details?.principalInvestigator?.value ?? null,
    kind: o.kind,
    country: o.country,
    location: o.location,
    workMode: o.workMode,
    deadline: o.deadline,
    deadlineAt: o.deadlineAt ? o.deadlineAt.toISOString() : null,
    description: o.description,
    eligibility: o.eligibility ?? o.details?.qualifications?.value ?? null,
    requiredSkills: o.requiredSkills,
    details: o.details ?? {},
    extractionStatus: o.extractionStatus,
    url: o.url!,
    sourceName,
    sourceUrl,
    lastVerifiedAt: o.lastVerifiedAt!.toISOString(),
    publishedAt: o.publishedAt ? o.publishedAt.toISOString() : null,
    apply: applyModeOf(o),
    fit: explainFit({ requiredSkills: o.requiredSkills, eligibleLevels: o.eligibleLevels, eligibility: o.eligibility ?? o.details?.qualifications?.value ?? null, topicText: [o.title, o.details?.researchArea?.value, o.details?.qualifications?.value, o.description].filter(Boolean).join(" ") }, student),
    saved: Boolean(extra.saved),
    remind: Boolean(extra.remind),
    interactions: { opened: Boolean(extra.opened), confirmedApplied: Boolean(extra.confirmed) },
  };
}

export async function browseOpportunities(db: OppDb, userId: string | null, student: StudentSignals, f: BrowseFilters = {}, now = new Date()) {
  let where = filterWhere(f, now);
  let saves: { opportunityId: string; remind: boolean }[] = [];
  if (userId) saves = await db.select({ opportunityId: opportunitySaves.opportunityId, remind: opportunitySaves.remind }).from(opportunitySaves).where(eq(opportunitySaves.userId, userId));
  if (f.section === "saved") {
    if (!saves.length) return { items: [] as OpportunityView[], facets: { organizations: [] as string[], countries: [] as string[], workModes: [] as string[] } };
    where = and(where, inArray(opportunities.id, saves.map((s) => s.opportunityId)))!;
  }
  const rows = await db
    .select({ o: opportunities, sourceName: opportunitySources.name, sourceUrl: opportunitySources.url })
    .from(opportunities)
    .innerJoin(opportunitySources, eq(opportunities.sourceId, opportunitySources.id))
    .where(where)
    .orderBy(sql`${opportunities.deadlineAt} asc nulls last`, desc(opportunities.lastVerifiedAt))
    .limit(200);
  const saveMap = new Map(saves.map((s) => [s.opportunityId, s.remind]));
  let items = rows.map(({ o, sourceName, sourceUrl }) => toView(o, sourceName, sourceUrl, student, { saved: saveMap.has(o.id), remind: saveMap.get(o.id) ?? false }));
  if (f.section === "recommended") items = items.filter((i) => i.fit.state === "strong_fit" || i.fit.state === "potential_fit");
  items.sort((a, b) => ORDER[a.fit.state] - ORDER[b.fit.state]);
  // Facets from the verified catalogue itself (never a fixed list).
  const facetRows = await db.selectDistinct({ organization: opportunities.organization, country: opportunities.country, workMode: opportunities.workMode }).from(opportunities).where(and(recommendableWhere(now), eq(opportunities.type, "research")));
  return {
    items,
    facets: {
      organizations: [...new Set(facetRows.map((r) => r.organization))].sort(),
      countries: [...new Set(facetRows.map((r) => r.country).filter((c): c is string => Boolean(c)))].sort(),
      workModes: [...new Set(facetRows.map((r) => r.workMode).filter((c): c is string => Boolean(c)))].sort(),
    },
  };
}

/** One opportunity for its detail page; null unless it is currently verified and active. */
export async function getOpportunity(db: OppDb, id: string, userId: string | null, student: StudentSignals, now = new Date()): Promise<OpportunityView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db
    .select({ o: opportunities, sourceName: opportunitySources.name, sourceUrl: opportunitySources.url })
    .from(opportunities)
    .innerJoin(opportunitySources, eq(opportunities.sourceId, opportunitySources.id))
    .where(and(eq(opportunities.id, id), recommendableWhere(now)))
    .limit(1);
  if (!row) return null;
  let saved = false;
  let remind = false;
  let opened = false;
  let confirmed = false;
  if (userId) {
    const [s] = await db.select().from(opportunitySaves).where(and(eq(opportunitySaves.userId, userId), eq(opportunitySaves.opportunityId, id))).limit(1);
    saved = Boolean(s);
    remind = Boolean(s?.remind);
    const kinds = await db.selectDistinct({ kind: opportunityInteractions.kind }).from(opportunityInteractions).where(and(eq(opportunityInteractions.userId, userId), eq(opportunityInteractions.opportunityId, id)));
    opened = kinds.some((k) => k.kind === "opened_application");
    confirmed = kinds.some((k) => k.kind === "confirmed_applied");
  }
  return toView(row.o, row.sourceName, row.sourceUrl, student, { saved, remind, opened, confirmed });
}

/** Records the first time a student opens an opportunity's detail page (one row per student and listing). */
export async function recordViewOnce(db: OppDb, userId: string, opportunityId: string) {
  const [seen] = await db
    .select({ id: opportunityInteractions.id })
    .from(opportunityInteractions)
    .where(and(eq(opportunityInteractions.userId, userId), eq(opportunityInteractions.opportunityId, opportunityId), eq(opportunityInteractions.kind, "viewed")))
    .limit(1);
  if (!seen) await db.insert(opportunityInteractions).values({ userId, opportunityId, kind: "viewed" });
}

export async function recordInteraction(db: OppDb, userId: string, opportunityId: string, kind: "viewed" | "opened_application" | "confirmed_applied") {
  await db.insert(opportunityInteractions).values({ userId, opportunityId, kind });
}

export async function setSaved(db: OppDb, userId: string, opportunityId: string, saved: boolean, remind = false) {
  if (!saved) {
    await db.delete(opportunitySaves).where(and(eq(opportunitySaves.userId, userId), eq(opportunitySaves.opportunityId, opportunityId)));
    return;
  }
  await db
    .insert(opportunitySaves)
    .values({ userId, opportunityId, remind })
    .onConflictDoUpdate({ target: [opportunitySaves.userId, opportunitySaves.opportunityId], set: { remind, remindedAt: null } });
}

/** Upcoming deadlines among the student's saved, still-active opportunities. */
export async function upcomingSavedDeadlines(db: OppDb, userId: string, now = new Date(), limit = 5) {
  return db
    .select({ id: opportunities.id, title: opportunities.title, organization: opportunities.organization, deadline: opportunities.deadline, deadlineAt: opportunities.deadlineAt })
    .from(opportunitySaves)
    .innerJoin(opportunities, eq(opportunities.id, opportunitySaves.opportunityId))
    .where(and(eq(opportunitySaves.userId, userId), recommendableWhere(now), gt(opportunities.deadlineAt, now)))
    .orderBy(opportunities.deadlineAt)
    .limit(limit);
}
