/**
 * Announcement understanding: reads the official advertisement (PDF or page) a listing links to and
 * extracts structured fields, each with the exact sentence it came from. Deterministic rules only, no AI,
 * so nothing can be invented: a field the document does not state is simply absent. A scanned PDF with no
 * text layer yields 'not_available' and the student is sent to the original document.
 *
 * Also classifies how to apply, strictly from what the document publishes:
 *   email         an address on a line about applying, on an institutional domain
 *   portal        an http(s) link on a line about applying (e.g. the institute's form)
 *   announcement  otherwise: follow the official announcement's own instructions
 *   unavailable   the listing has no official link at all (no Apply button is shown)
 */
import { and, eq, sql } from "drizzle-orm";

import { opportunities, type OpportunityDetails } from "@/db/schema";

import type { OppDb } from "./ingest";

const MAX_DOC_BYTES = 5_000_000;
const TIMEOUT_MS = 20_000;
const MAX_QUOTE = 280;
const USER_AGENT = "AITathastu-OpportunityBot/1.0 (+https://www.aitathastu.com)";

const INSTITUTIONAL_EMAIL = /@[a-z0-9.-]+\.(ac\.in|edu|edu\.[a-z]{2}|res\.in|gov\.in|nic\.in|ernet\.in|ac\.uk|mpg\.de|org)$/i;
const APPLY_LINE = /\b(appl(y|ication|icants?)|send|submit|forward|e-?mail)\b/i;

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const quote = (s: string) => clean(s).slice(0, MAX_QUOTE);

/**
 * Splits extracted text into sentence-sized lines. PDF text layers often arrive as one long run, so
 * long lines are split into sentences and at wide gaps (table cells).
 */
function linesOf(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.replace(/\r/g, "").split(/\n/)) {
    for (const cell of raw.split(/\s{3,}|\t+/)) {
      const c = clean(cell);
      if (c.length <= 2) continue;
      if (c.length <= 300) out.push(c);
      else for (const s of c.split(/(?<=[.;])\s+(?=[A-Z0-9(])/)) if (clean(s).length > 2) out.push(clean(s));
    }
  }
  return out;
}

const LABEL_ONLY = (rest: string) => rest.replace(/^[\s:.\-–]+/, "").length < 3;

/**
 * A labelled field. When the line holds only the label (a table cell such as "Upper Age Limit"), the
 * value is the next line, provided that line is not itself another label. Evidence is the exact text used.
 */
function field(lines: string[], re: RegExp, accept: (value: string) => boolean = () => true): { value: string; evidence: string } | null {
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    const m = re.exec(l);
    if (!m) continue;
    const rest = l.slice((m.index ?? 0) + m[0].length);
    // "Eligibility: Essential Qualifications" is a heading followed by a sub-heading: still a label.
    const restClean = rest.replace(/^[\s:.\-–]+/, "").trim();
    const restIsLabel = LABEL_ONLY(rest) || new RegExp(`^(?:${re.source})[\\s:.\\-–]*$`, re.flags.replace("g", "")).test(restClean);
    if (!restIsLabel) {
      const value = quote(rest.replace(/^[\s:.\-–]+/, ""));
      if (accept(value)) return { value, evidence: quote(l) };
      continue;
    }
    const next = lines[i + 1];
    if (next && next.length >= 3 && !/:\s*$/.test(next) && accept(next)) return { value: quote(next), evidence: quote(`${l} ${next}`) };
  }
  return null;
}
/** Adds the PDF page (from "[[page N]]" markers) to each field whose evidence is found in the text. */
function attachPages(text: string, details: OpportunityDetails) {
  if (!/\[\[page \d+\]\]/.test(text)) return;
  const flat = clean(text);
  for (const v of Object.values(details) as { evidence?: string; page?: number }[]) {
    if (!v || typeof v !== "object" || !v.evidence) continue;
    const at = flat.indexOf(clean(v.evidence).slice(0, 60));
    if (at < 0) continue;
    const marks = [...flat.slice(0, at).matchAll(/\[\[page (\d+)\]\]/g)];
    if (marks.length) v.page = Number(marks[marks.length - 1]![1]);
  }
}

export interface Extraction {
  details: OpportunityDetails;
  requiredSkills: string[];
  applicationMethod: "portal" | "email" | "announcement";
  applicationUrl: string | null;
  applicationEmail: string | null;
}

export function extractFromText(text: string): Extraction {
  const lines = linesOf(text).filter((l) => !/^\[\[page \d+\]\]$/.test(l));
  const details: OpportunityDetails = {};
  const put = <K extends keyof OpportunityDetails>(k: K, f: { value: string; evidence: string } | null) => {
    if (f) (details as Record<string, unknown>)[k] = f;
  };

  // Money must appear in the value itself (a currency marker and a number).
  const MONEY = /(₹|\bRs\.?\s?\d|\bINR\b|\b\d{1,3}(,\d{2,3})+\b|\d{4,}\s*(\/-|per month|p\.m\.))/i;
  put("stipend", field(lines, /\b(stipend|emoluments?|fellowship amount|consolidated (pay|salary)|remuneration|salary)\b/i, (v) => MONEY.test(v)));
  put("duration", field(lines, /\b(duration|tenure)( of (the )?(project|position|appointment))?\b/i, (v) => /\d|month|year|week/i.test(v) && v.length <= 160));
  put("qualifications", field(lines, /\b(essential )?qualifications?\b|\beligibility( criteria)?\b/i, (v) => v.length >= 10));
  put("ageLimit", field(lines, /\b(upper )?age limit\b/i, (v) => /\d/.test(v) && v.length <= 160));
  put("researchArea", field(lines, /\b(project title|title of the project|name of the project|research area)\b/i, (v) => v.length >= 6 && v.length <= 240));

  const qualText = details.qualifications?.value ?? "";
  const levels = new Set<string>();
  if (/\b(b\.?\s?tech|b\.?\s?e\.?|b\.?\s?sc|bachelor'?s?)\b/i.test(qualText)) levels.add("bachelor's degree");
  if (/\b(m\.?\s?tech|m\.?\s?e\.?|m\.?\s?sc|mca|master'?s?|post ?graduate)\b/i.test(qualText)) levels.add("master's degree");
  if (/\bph\.?\s?d\b|\bdoctoral\b/i.test(qualText)) levels.add("PhD");
  if (levels.size && details.qualifications) details.educationLevels = { value: [...levels], evidence: details.qualifications.evidence };

  // Skills only from a line that explicitly names skills or knowledge; tokens must look like skills.
  let requiredSkills: string[] = [];
  const SKILL_LABEL = /\b(desirable skills?|skills? required|required skills?|technical skills?|skill set|knowledge of|proficiency in|familiarity with|hands-on experience (?:in|with))\b/i;
  const skillLine = lines.find((l) => SKILL_LABEL.test(l));
  if (skillLine) {
    const after = skillLine.split(SKILL_LABEL).slice(-1)[0] ?? "";
    requiredSkills = after
      // Asides are not skills: "(or any other language) especially for ..." and unclosed "(...".
      .replace(/\([^)]*\)?/g, " ")
      .replace(/\b(especially|preferably|particularly)\b.*$/i, " ")
      .split(/,|;|\band\b|\/|\bor\b|\betc\b/i)
      .map((s) => clean(s.replace(/^[\s:.\-–]+|[.\s]+$/g, "").replace(/^(coding|programming|working|work|experience)\s+(in|with)\s+|^(use of|tools like|languages like|such as)\s+/i, "").replace(/^(the|a|an|other|any)\s+/i, "")))
      .filter((s) => s.length >= 2 && s.length <= 40 && /[a-z]/i.test(s) && s.split(" ").length <= 4 && !/@|\b(department|institute|university|candidates?|degree|years?|experience)\b|\d{3,}/i.test(s))
      .slice(0, 8);
    if (requiredSkills.length) details.skills = { value: requiredSkills, evidence: quote(skillLine) };
  }

  const docs = lines.find((l) => /\b(cv|resume|curriculum vitae|transcripts?|certificates?|documents?)\b/i.test(l) && /\b(attach|along with|submit|send|enclose|upload)\b/i.test(l));
  if (docs) details.documents = { value: [quote(docs)], evidence: quote(docs) };

  // A bare "How to Apply" heading is not the procedure: take the instructions that follow it.
  const procedureField = field(lines, /\b(how to apply|mode of application|application procedure|procedure for applying)\b/i, (v) => v.length >= 15);
  const procedureLine = lines.find((l) => /\b(interested (and eligible )?candidates|applications? (should|must|may|can) be|eligible applicants must)\b/i.test(l) && l.length >= 25);
  const procedure = procedureField ?? (procedureLine ? { value: quote(procedureLine), evidence: quote(procedureLine) } : null);
  if (procedure) details.procedure = procedure;

  const pi = /\b(?:Principal Investigator|PI)\s*[:\-–]\s*((?:Prof\.?|Dr\.?)\s*)?([A-Z][A-Za-z.\- ]{2,60}?)(?=[,;\n(]|\s{2}|$)/m.exec(text);
  if (pi) details.principalInvestigator = { value: clean(`${pi[1] ?? ""}${pi[2]}`), evidence: quote(pi[0]) };
  // Application destination, only from a line about applying.
  let applicationEmail: string | null = null;
  let applicationUrl: string | null = null;
  for (const l of lines) {
    if (!APPLY_LINE.test(l)) continue;
    const email = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.exec(l)?.[0]?.replace(/[.,;:]+$/, "");
    if (!applicationEmail && email && INSTITUTIONAL_EMAIL.test(email)) applicationEmail = email.toLowerCase();
    const url = /https?:\/\/[^\s<>"')]+/i.exec(l)?.[0]?.replace(/[.,;:)]+$/, "");
    if (!applicationUrl && url) {
      try {
        const u = new URL(url);
        // A bare homepage ("https://www.iitx.ac.in/") is not an application destination: keep looking, and
        // fall back to the specific announcement rather than sending students to a generic page.
        const bareHomepage = (u.pathname === "/" || u.pathname === "") && !u.search;
        if ((u.protocol === "https:" || u.protocol === "http:") && !bareHomepage) applicationUrl = u.href;
      } catch {
        /* not a usable link */
      }
    }
  }
  const applicationMethod = applicationUrl ? "portal" : applicationEmail ? "email" : "announcement";
  attachPages(text, details);
  return { details, requiredSkills, applicationMethod, applicationUrl, applicationEmail };
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** Text of an official document: PDF text layer (unpdf) or page text. Null when there is no text (e.g. scanned). */
export async function documentText(fetchImpl: Fetch, url: string): Promise<{ text: string | null; status: number }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { headers: { "user-agent": USER_AGENT }, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return { text: null, status: res.status };
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_DOC_BYTES) return { text: null, status: 413 };
    const isPdf = (res.headers.get("content-type") ?? "").includes("pdf") || /\.pdf($|\?)/i.test(url) || String.fromCharCode(...buf.slice(0, 4)) === "%PDF";
    if (isPdf) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(buf);
      // Page by page, with markers, so evidence can cite its page.
      const { text } = await extractText(pdf, { mergePages: false });
      const pages = Array.isArray(text) ? text : [text];
      const joined = pages.map((t, i) => `\n[[page ${i + 1}]]\n${t}`).join("\n");
      return { text: joined.replace(/\s+\n/g, "\n").trim().length > 40 ? joined : null, status: res.status };
    }
    const html = new TextDecoder().decode(buf);
    const textOnly = html
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<(br|p|div|li|tr|h\d)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
    return { text: textOnly.trim().length > 40 ? textOnly : null, status: res.status };
  } finally {
    clearTimeout(t);
  }
}

/** Extracts details for up to `limit` pending listings. Failures are recorded per listing; nothing is guessed. */
export async function runExtraction(db: OppDb, opts: { fetchImpl?: Fetch; now?: Date; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const rows = await db
    .select({ id: opportunities.id, url: opportunities.url, requiredSkills: opportunities.requiredSkills, researchGroup: opportunities.researchGroup })
    .from(opportunities)
    .where(and(eq(opportunities.extractionStatus, "pending"), sql`${opportunities.status} in ('active','unverified')`))
    .limit(opts.limit ?? 15);
  const counts = { extracted: 0, notAvailable: 0, failed: 0 };
  for (const r of rows) {
    if (!r.url) {
      await db.update(opportunities).set({ extractionStatus: "not_available", applicationMethod: "unavailable", extractedAt: now }).where(eq(opportunities.id, r.id));
      counts.notAvailable++;
      continue;
    }
    try {
      const { text } = await documentText(fetchImpl, r.url);
      if (!text) {
        await db.update(opportunities).set({ extractionStatus: "not_available", extractedAt: now }).where(eq(opportunities.id, r.id));
        counts.notAvailable++;
        continue;
      }
      const x = extractFromText(text);
      await db
        .update(opportunities)
        .set({
          details: { ...x.details, sourceDocument: r.url },
          extractionStatus: "extracted",
          extractedAt: now,
          applicationMethod: x.applicationMethod,
          applicationUrl: x.applicationUrl,
          applicationEmail: x.applicationEmail,
          // Only fill skills the source page didn't already give, and only from an explicit skills line.
          ...(r.requiredSkills.length === 0 && x.requiredSkills.length ? { requiredSkills: x.requiredSkills } : {}),
        })
        .where(eq(opportunities.id, r.id));
      counts.extracted++;
    } catch {
      await db.update(opportunities).set({ extractionStatus: "failed", extractedAt: now }).where(eq(opportunities.id, r.id));
      counts.failed++;
    }
  }
  return { attempted: rows.length, ...counts };
}
