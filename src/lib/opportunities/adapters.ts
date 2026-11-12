/**
 * Page-monitor adapters: parse an official institution's listing page into entries. Pure functions
 * (no network). Each adapter reads only what the page itself publishes; nothing is inferred. Fields a
 * page does not state stay null. The ingester (ingest.ts) decides each entry's status.
 *
 * Adding a source = adding an adapter here plus a catalogue entry (catalogue.ts). Adapters are written
 * against the real markup of the page and must fail loudly (throw) when it changes beyond recognition,
 * so a redesign never silently withdraws every listing.
 */
export interface MonitoredEntry {
  externalId: string;
  title: string;
  /** The official per-listing link (advertisement PDF or detail page); null when the page has none. */
  url: string | null;
  researchGroup: string | null;
  /** Deadline exactly as the page shows it. */
  deadline: string | null;
  /** Parsed deadline (end of that day, India time) only when the page shows an exact date. */
  deadlineAt: Date | null;
  publishedAt: Date | null;
  /** The page's own explicit status, when it publishes one. */
  statusHint: "open" | "closed" | null;
  /** "Rolling" or similar: open until filled, no fixed date. */
  rolling: boolean;
}

export class AdapterError extends Error {}

const decode = (s: string) =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

/** "21.11.2026", "14-11-2026", "15-Nov-2026" → end of that day in India (UTC+05:30). Anything else → null. */
export function parseIndianDate(raw: string | null | undefined, endOfDay = true): Date | null {
  if (!raw) return null;
  const s = raw.trim();
  let d: number, m: number, y: number;
  let match = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(s);
  if (match) {
    [d, m, y] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  } else if ((match = /^(\d{1,2})[\s\-]([A-Za-z]{3,4})[A-Za-z]*[\s\-,]+(\d{4})/.exec(s))) {
    const mm = MONTHS[match[2]!.toLowerCase()];
    if (mm === undefined) return null;
    [d, m, y] = [Number(match[1]), mm, Number(match[3])];
  } else if ((match = /^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s))) {
    // "November 25, 2026" (IIT Roorkee and many US-style notices)
    const mm = MONTHS[match[1]!.slice(0, 3).toLowerCase()] ?? MONTHS[match[1]!.slice(0, 4).toLowerCase()];
    if (mm === undefined) return null;
    [d, m, y] = [Number(match[2]), mm, Number(match[3])];
  } else return null;
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  // Reject impossible dates (31.02 would otherwise roll over into March).
  const probe = new Date(Date.UTC(y, m, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m || probe.getUTCDate() !== d) return null;
  return new Date(Date.UTC(y, m, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0) - (5 * 60 + 30) * 60_000);
}

/** The earlier of two optional dates (null when neither is known). */
const earliest = (a: Date | null, b: Date | null) => (a && b ? (a.getTime() <= b.getTime() ? a : b) : (a ?? b));

const absolute = (href: string, base: string) => {
  try {
    const u = new URL(href.trim(), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
};

/** IISc "Contract/Project Staff": TablePress table Post | Department | Advertisement | Closing Date | Status. */
function iiscContractStaff(html: string, pageUrl: string): MonitoredEntry[] {
  const table = /<table[^>]*tablepress[^>]*>([\s\S]*?)<\/table>/i.exec(html)?.[1];
  if (!table || !/Status of Recruitment/i.test(table)) throw new AdapterError("IISC_TABLE_NOT_FOUND");
  const rows = table.match(/<tr class="row-\d+[^"]*">[\s\S]*?<\/tr>/gi) ?? [];
  const out: MonitoredEntry[] = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td class="column-\d+">([\s\S]*?)<\/td>/gi)].map((m) => m[1] ?? "");
    const cell = (n: number) => cells[n - 1] ?? "";
    const title = decode(cell(1));
    if (!title) continue;
    const href = /href="([^"]+)"/i.exec(cell(3))?.[1] ?? null;
    const url = href ? absolute(href, pageUrl) : null;
    const deadline = decode(cell(4)) || null;
    const status = decode(cell(5)).toLowerCase();
    out.push({
      externalId: url ?? `${title}|${deadline}`,
      title,
      url,
      researchGroup: decode(cell(2)) || null,
      deadline,
      deadlineAt: parseIndianDate(deadline),
      publishedAt: null,
      statusHint: status.startsWith("open") ? "open" : status.startsWith("closed") ? "closed" : null,
      rolling: false,
    });
  }
  return out;
}

/** IIT Kharagpur SRIC "Temporary Position(s)": title (advView(id)), PI, Dept, vacancies, last date. */
function iitkgpSric(html: string, pageUrl: string): MonitoredEntry[] {
  if (!/Temporary Position\(s\)/i.test(html)) throw new AdapterError("IITKGP_TABLE_NOT_FOUND");
  const out: MonitoredEntry[] = [];
  const rows = html.match(/<tr>\s*<td align="left"[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const id = /advView\((\d+)\)/.exec(row)?.[1];
    if (!id) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    const first = cells[0] ?? "";
    const title = decode(/<a[^>]*>([\s\S]*?)<\/a>/i.exec(first)?.[1] ?? "");
    if (!title) continue;
    const pi = /PI Name\s*-\s*([^<]*)/i.exec(first)?.[1]?.trim() || null;
    const dept = /Dept\s*-\s*([^<]*)/i.exec(first)?.[1]?.trim() || null;
    const deadline = decode(cells[2] ?? "") || null;
    out.push({
      externalId: `iitkgp-sric-${id}`,
      title,
      url: new URL(`AdvertiseView.jsp?serial_no=${id}`, pageUrl).href,
      researchGroup: [dept, pi ? `PI: ${pi}` : null].filter(Boolean).join(" · ") || null,
      deadline,
      deadlineAt: parseIndianDate(deadline),
      publishedAt: null,
      statusHint: null,
      rolling: false,
    });
  }
  return out;
}

/** IIT Hyderabad careers, section #postdoc ("Postdoc/JRF/SRF positions"): Start Date | Advertisement | End Date. */
function iithPostdoc(html: string, pageUrl: string): MonitoredEntry[] {
  const section = /<section id="postdoc"[\s\S]*?<\/section>/i.exec(html)?.[0];
  if (!section) throw new AdapterError("IITH_POSTDOC_SECTION_NOT_FOUND");
  const out: MonitoredEntry[] = [];
  for (const row of section.match(/<tr[\s>][\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    if (cells.length < 3) continue;
    const link = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(cells[1]!);
    if (!link) continue;
    const url = absolute(link[1]!.replace(/ /g, "%20"), pageUrl);
    // Strip the announcement boilerplate around the position name, keep the position itself.
    const title = decode(link[2]!)
      .replace(/^(applications? (are )?invited for (the )?((post|position)s? of )?|advertisement for (the )?)/i, "")
      .replace(/,?\s*(at|under (the )?department of [^,]+,)?\s*IIT Hyderabad\.?$/i, "")
      .trim();
    const end = decode(cells[2]!);
    const expires = /data-career-expires="(\d+)"/.exec(row)?.[1];
    out.push({
      externalId: url ?? title,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      url,
      researchGroup: /Department of (.+?)(?: at |[,.]|$)/i.exec(decode(link[2]!))?.[1]?.trim() ?? null,
      deadline: end || null,
      // The published end date wins: the page's own expiry attribute can be later than the date it states.
      deadlineAt: earliest(parseIndianDate(end), expires ? new Date(Number(expires) * 1000) : null),
      publishedAt: parseIndianDate(decode(cells[0]!), false),
      statusHint: null,
      rolling: /rolling/i.test(end),
    });
  }
  return out;
}

/**
 * IIT Roorkee "Project Jobs": each entry is one sentence, e.g. "Advertisement dated November 05, 2026:
 * Advertisement for the position(s) of Junior Research Fellow (JRF) in Dept. of Chemical Engg. (Last date
 * to apply: November 25, 2026 by 05:00 PM, Date and time for interview: December 02, 2026)", then a PDF link.
 * The last date to apply is the deadline; a walk-in-only call closes on its interview date.
 */
function iitrProjectJobs(html: string, pageUrl: string): MonitoredEntry[] {
  const items = html.match(/<div class="publicationListItem">[\s\S]*?(?=<div class="publicationListItem">|<\/section>|$)/gi);
  if (!items || !/Project_Jobs/i.test(html)) throw new AdapterError("IITR_LIST_NOT_FOUND");
  const out: MonitoredEntry[] = [];
  for (const block of items) {
    const text = decode(/<div class="ui intro-text[^"]*">([\s\S]*?)<\/div>/i.exec(block)?.[1] ?? "");
    const href = /<a href="([^"]+\.pdf)"/i.exec(block)?.[1];
    if (!text || !href) continue;
    const url = absolute(href, pageUrl);
    const position = /position\(s\) of (.+?) in ((?:Dept\.|Department|Centre|Center|School)[^(]*?)\s*\(/i.exec(text) ?? /position\(s\) of (.+?)\s*\(/i.exec(text);
    if (!position) continue;
    const last = /Last date (?:to apply|of application|for application)\s*:?\s*([A-Za-z]+\.? \d{1,2},? \d{4})/i.exec(text);
    // Interview-only calls ("walk-in interview: …" or "Date and time for interview: …") close on that date.
    const walkIn = /(walk-?in )?interview\s*(?:date)?\s*:?\s*([A-Za-z]+\.? \d{1,2},? \d{4})/i.exec(text);
    const deadline = last ? `Last date to apply: ${last[1]}` : walkIn ? `${walkIn[1] ? "Walk-in interview" : "Interview"}: ${walkIn[2]}` : null;
    out.push({
      externalId: url ?? text.slice(0, 200),
      title: position[1]!.trim(),
      url,
      researchGroup: position[2]?.trim().replace(/\s+/g, " ") ?? null,
      deadline,
      deadlineAt: parseIndianDate(last?.[1] ?? walkIn?.[2] ?? null),
      publishedAt: parseIndianDate(/Advertisement dated ([A-Za-z]+\.? \d{1,2},? \d{4})/i.exec(text)?.[1] ?? null, false),
      statusHint: null,
      rolling: false,
    });
  }
  return out;
}

/** IIIT Hyderabad careers, R&D recruitment table: Start Date | Advt. No. | Title (PDF) | End Date | Status. */
function iiithRnd(html: string, pageUrl: string): MonitoredEntry[] {
  const table = (html.match(/<table[\s\S]*?<\/table>/gi) ?? []).find((t) => /RnD Recruitments/i.test(t) && /Status/i.test(t));
  if (!table) throw new AdapterError("IIITH_RND_TABLE_NOT_FOUND");
  const out: MonitoredEntry[] = [];
  for (const row of table.match(/<tr[\s>][\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    if (cells.length < 5) continue;
    const link = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(cells[2]!);
    if (!link) continue;
    const url = absolute(link[1]!, pageUrl);
    const full = decode(link[2]!);
    const title = full.replace(/^IIIT Hyderabad Invites Applications for the Position of /i, "").replace(/ under research projects?.*$/i, "").trim() || full;
    const end = decode(cells[3]!) || null;
    const status = decode(cells[4]!).toLowerCase();
    out.push({
      externalId: url ?? full,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      url,
      researchGroup: /\bat ([A-Z][^,(]+?(?:Center|Centre|Lab|Laboratory)[^,(]*)/.exec(full)?.[1]?.trim() ?? null,
      deadline: end,
      deadlineAt: parseIndianDate(end),
      publishedAt: parseIndianDate(decode(cells[0]!), false),
      statusHint: status.startsWith("open") ? "open" : status.startsWith("closed") ? "closed" : null,
      rolling: false,
    });
  }
  return out;
}

export const ADAPTERS: Record<string, (html: string, pageUrl: string) => MonitoredEntry[]> = {
  iisc_contract_staff: iiscContractStaff,
  iitkgp_sric: iitkgpSric,
  iith_postdoc: iithPostdoc,
  iitr_project_jobs: iitrProjectJobs,
  iiith_rnd: iiithRnd,
};
