/**
 * Research recommendations for the dashboard: verified, active listings only, each with an
 * explanation from fit.ts. Student signals come from the Intelligence Engine's existing output
 * (profile_views.view.intelligence) and the profile the engine already processes; nothing new is
 * collected, nothing leaves AI Tathastu, and no provider ever sees who viewed a listing.
 */
import { and, desc, eq, gte, isNull, or, gt, sql } from "drizzle-orm";

import { opportunities, opportunitySources } from "@/db/schema";

import { explainFit, studyLevel, type FitExplanation, type FitState, type StudentSignals } from "./fit";
import { VERIFICATION_TTL_DAYS, type OppDb } from "./ingest";
import { deriveInsight, studentDisciplines } from "./insight";

const STRONG = new Set(["proficient", "advanced"]);
/**
 * Upper bound on active research rows read per request, shared by the dashboard and /opportunities so both see the
 * same catalogue. Fit ranking happens after the read, so this cap must sit well above the active catalogue size:
 * a lower one (the old 50 newest-verified) silently hid strong matches and capped the dashboard's "N more" count.
 */
export const ACTIVE_RESEARCH_CAP = 500;

/** Minimal slice of ProfileData this needs (kept structural for tests). */
export interface ProfileSignalsInput {
  skills: { name: string }[];
  intelligenceSkills: { name: string; proficiency: number | null; level: string | null }[];
  degree: string | null;
  /** As entered on the profile, e.g. "Electrical Engineering". */
  specialization?: string | null;
}

export function buildStudentSignals(p: ProfileSignalsInput): StudentSignals {
  const demonstrated = new Map<string, string>();
  for (const s of p.intelligenceSkills) {
    if (s.proficiency !== null && s.level && STRONG.has(s.level.toLowerCase())) demonstrated.set(s.name.trim().toLowerCase(), s.name);
  }
  const listed = new Map<string, string>();
  for (const s of [...p.skills, ...p.intelligenceSkills]) {
    const k = s.name.trim().toLowerCase();
    if (k && !demonstrated.has(k)) listed.set(k, s.name);
  }
  // Fields from the degree and specialisation, and from the skills themselves (Machine Learning points to Computer Science & AI).
  const disciplines = studentDisciplines(p.degree, p.specialization, [...demonstrated.values(), ...listed.values()].join(" "));
  return { demonstrated, listed, level: studyLevel(p.degree), disciplines };
}

export interface ResearchCard {
  id: string;
  title: string;
  organization: string;
  kind: string | null;
  /** Department / lab / PI exactly as the source states it. */
  researchGroup: string | null;
  location: string | null;
  workMode: string | null;
  /** As published; null when the source published none (never invented). */
  deadline: string | null;
  deadlineAt: string | null;
  url: string;
  sourceName: string;
  lastVerifiedAt: string;
  fit: FitExplanation;
}

const ORDER: Record<FitState, number> = { strong_fit: 0, potential_fit: 1, insufficient_information: 2, not_eligible: 3 };

/** The SQL gate every surface uses: active, verified within the TTL, deadline not passed, real link. */
export function recommendableWhere(now: Date) {
  const cutoff = new Date(now.getTime() - VERIFICATION_TTL_DAYS * 86_400_000);
  return and(
    eq(opportunities.status, "active"),
    gte(opportunities.lastVerifiedAt, cutoff),
    or(isNull(opportunities.deadlineAt), gt(opportunities.deadlineAt, now)),
    // A listing without a source link is never shown (the 0014 fabricated rows had none).
    gt(opportunities.canonicalUrl, ""),
  );
}

export async function researchForStudent(db: OppDb, student: StudentSignals, now = new Date()): Promise<ResearchCard[]> {
  const rows = await db
    .select({ o: opportunities, sourceName: opportunitySources.name })
    .from(opportunities)
    .innerJoin(opportunitySources, eq(opportunities.sourceId, opportunitySources.id))
    .where(and(eq(opportunities.type, "research"), recommendableWhere(now)))
    .orderBy(sql`${opportunities.deadlineAt} asc nulls last`, desc(opportunities.lastVerifiedAt))
    .limit(ACTIVE_RESEARCH_CAP);
  if (rows.length === ACTIVE_RESEARCH_CAP) console.warn(`[research] active catalogue reached the ${ACTIVE_RESEARCH_CAP}-row read cap; raise ACTIVE_RESEARCH_CAP`);

  return rows
    .map(({ o, sourceName }) => ({
      id: o.id,
      title: o.title,
      organization: o.organization,
      kind: o.kind,
      researchGroup: o.researchGroup,
      location: o.location,
      workMode: o.workMode,
      deadline: o.deadline,
      deadlineAt: o.deadlineAt ? o.deadlineAt.toISOString() : null,
      url: o.url!,
      sourceName,
      lastVerifiedAt: o.lastVerifiedAt!.toISOString(),
      fit: explainFit({ requiredSkills: o.requiredSkills, eligibleLevels: o.eligibleLevels, eligibility: o.eligibility ?? o.details?.qualifications?.value ?? null, topicText: [o.title, o.details?.researchArea?.value, o.details?.qualifications?.value, o.description].filter(Boolean).join(" "), insight: insightOf(o) }, student),
    }))
    .filter((c) => c.fit.relevance?.position !== "Not a research role")
    .sort((a, b) => ORDER[a.fit.state] - ORDER[b.fit.state]);
}

/** The listing intelligence for one stored opportunity row. */
export function insightOf(o: { title: string; kind: string | null; researchGroup: string | null; description: string | null; details?: { researchArea?: { value?: string | null }; qualifications?: { value?: string | null } } | null }) {
  return deriveInsight({ title: o.title, kind: o.kind, researchGroup: o.researchGroup, description: o.description, researchArea: o.details?.researchArea?.value ?? null, qualifications: o.details?.qualifications?.value ?? null });
}