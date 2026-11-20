/**
 * Research-listing intelligence: deterministic signals read from what the institution published (title, department,
 * research area, description). No AI, no network, no invention: every signal comes with the words it was read from, and
 * anything typical (a JRF usually needs a Master's) is labelled as typical, never presented as the listing's own rule.
 *
 *   position     what the role is (JRF, project assistant, postdoc...), fixing sources whose own category is wrong or missing
 *   disciplines  fields named by the department or topic (Electrical Engineering, Physics...)
 *   topics       skills and methods the title or text names, as canonical skill names the student profile also uses
 *   stage        the education stage such roles typically expect, for "is this a sensible next step for you"
 */

export type Position =
  | "internship" | "project_assistant" | "jrf" | "srf" | "research_associate" | "project_scientist"
  | "postdoc" | "phd" | "fellowship" | "scientist" | "non_research" | "other";

export type Stage = "undergraduate" | "postgraduate" | "doctoral";

export interface ListingInsight {
  position: Position;
  positionLabel: string;
  /** Lowest stage the role typically expects. Null when the title doesn't say. */
  typicalStage: Stage | null;
  stageNote: string | null;
  disciplines: string[];
  topics: string[];
  /** The words each signal was read from, for "why". */
  basis: string[];
}

export const POSITION_LABEL: Record<Position, string> = {
  internship: "Research internship", project_assistant: "Project assistant", jrf: "Junior Research Fellow (JRF)", srf: "Senior Research Fellow (SRF)",
  research_associate: "Research associate", project_scientist: "Project scientist", postdoc: "Postdoctoral position", phd: "PhD position",
  fellowship: "Research fellowship", scientist: "Scientist / engineer", non_research: "Not a research role", other: "Research position",
};

// Order matters: the first match wins (an "SRF" title is not a JRF; "Post-doctoral Fellowship" is a postdoc).
const POSITION_RULES: [Position, RegExp][] = [
  ["non_research", /\b(animal welfare|administrat|accountant|clerk|driver|technician \(non|office assistant|receptionist|caretaker|security guard|nurse|lab attendant|mts\b|multi.?tasking)/i],
  ["postdoc", /\bpost.?doc|post.?doctoral/i],
  // JRF/SRF before PhD: "Post of JRF/PhD" and "JRF (convertible to PhD)" are JRF posts.
  ["srf", /\bsrf\b|senior research fellow/i],
  ["jrf", /\bjrf\b|junior research fellow/i],
  ["phd", /\bph\.?\s?d\b|\bdoctoral (student|candidate|researcher|position)/i],
  ["internship", /\bintern(ship)?\b|summer (research|school|programme|program|fellowship)|winter (school|programme)|visiting student/i],
  ["research_associate", /\bresearch associate|\bra(-?i{1,3})?\b(?![a-z])/i],
  ["project_scientist", /\bproject (research )?scientist/i],
  ["project_assistant", /\b(sr\.?|senior|junior)?\s*project (research )?(assistant|associate|fellow|engineer|officer)|\bresearch assistant|\bproject staff/i],
  ["fellowship", /\bfellowship|\bresearch fellow\b/i],
  ["scientist", /\bscientist|\bresearch engineer|\bscientific (employee|staff|programmer)|\bresearch software engineer|\bgroup leader|\bresearcher\b/i],
];

const TYPICAL_STAGE: Partial<Record<Position, [Stage, string]>> = {
  internship: ["undergraduate", "Research internships are usually open to undergraduate and postgraduate students."],
  project_assistant: ["undergraduate", "Project assistant roles usually ask for a Bachelor's degree (B.Tech/B.Sc) or equivalent."],
  jrf: ["postgraduate", "JRF posts usually ask for a Master's degree, or a B.Tech/B.E. with GATE or NET."],
  srf: ["postgraduate", "SRF posts usually ask for a Master's degree plus about two years of research experience."],
  research_associate: ["doctoral", "Research associate posts usually ask for a PhD (sometimes a submitted thesis)."],
  project_scientist: ["postgraduate", "Project scientist posts usually ask for a Master's or PhD with research experience."],
  postdoc: ["doctoral", "Postdoctoral positions need a completed PhD."],
  phd: ["postgraduate", "PhD positions usually ask for a Master's degree (some accept an excellent Bachelor's)."],
  scientist: ["postgraduate", "Scientist and research-engineer roles usually ask for a Master's or PhD."],
};

// Department / field names as institutions write them. Each maps to one discipline label.
const DISCIPLINES: [string, RegExp][] = [
  ["Computer Science & AI", /\b(computer science|cse\b|artificial intelligence|\bai\b|machine learning|data science|information technology|computing|software|ai coe|digital twin|hpc|high performance computing|research software)/i],
  ["Electrical & Electronics", /\b(electrical|electronics?|e ?& ?c\b|ece\b|eee\b|vlsi|signal processing|communication engineering|power systems|embedded|mems|sensors?)\b/i],
  ["Mechanical & Aerospace", /\b(mechanical|aerospace|aeronautic|flapping wing|fluid|cfd|thermal|manufacturing|robot)/i],
  ["Civil & Environmental", /\b(civil|structural|hydraulic|water resources|environmental|geotechnical|transportation|bim\b|building)/i],
  ["Chemical & Materials", /\b(chemical engineering|chemical|materials?|metallurg|graphene|polymer|nano|coal|gasification|catalys)/i],
  ["Physics", /\b(physics|quantum|photonics|lasers?|optics|astro|gravity|spin|semiconductor|scattering amplitudes)/i],
  ["Chemistry", /\b(chemistry|spectrometr|isotope|synthesis)\b/i],
  ["Biology & Life Sciences", /\b(biolog|genom|cell|molecular|plant|ecology|neuro|animal|evolution|capuchin|biotech|life science)/i],
  ["Biomedical & Health", /\b(biomedical|bme\b|medical|clinical|health|mri|imaging|bio ?sensors?)/i],
  ["Earth & Climate", /\b(climate|weather|earth|geo(physics|logy|science)|ocean|atmospher|radiocarbon|methane|soil)/i],
  ["Mathematics & Statistics", /\b(mathemat|statistic|applied math|theory group)\b/i],
  ["Social Sciences, Law & Economics", /\b(law|legal|crime|economic|social science|psycholog|normativity|policy)\b/i],
  ["Design & Heritage", /\b(heritage|design|architect)/i],
];

// Methods and skills named in titles, mapped to the canonical skill names the student profile uses (skills catalogue).
const TOPICS: [string, RegExp][] = [
  ["Machine Learning", /\bmachine learning|\bml\b|ai.?driven|\bai\b|artificial intelligence/i],
  ["Deep Learning", /\bdeep learning|neural network/i],
  ["Computer Vision", /\bcomputer vision|visual perception|image (processing|analysis)|imaging/i],
  ["Natural Language Processing", /\bnatural language|\bnlp\b|indic language/i],
  ["Data Science", /\bdata science|data analytics|statistical model|database/i],
  ["Python", /\bpython\b/i],
  ["High Performance Computing", /\bhpc\b|high performance computing|research software|supercomput/i],
  ["Computational Fluid Dynamics", /\bcfd\b|computational fluid|fluid dynamics|fluid.?mediated/i],
  ["Digital Twin", /\bdigital twin|\bbim\b/i],
  ["Robotics", /\brobot/i],
  ["Embedded Systems", /\bembedded|\bmems\b|piezo|sensors?\b/i],
  ["Photonics", /\bphotonic|\blaser|optic/i],
  ["Quantum", /\bquantum/i],
  ["Simulation", /\bsimulat|model(l)?ing\b/i],
  ["Process Optimization", /\bprocess optimi[sz]ation|optimi[sz]ation/i],
];

const clean = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function deriveInsight(o: {
  title: string; kind?: string | null; researchGroup?: string | null; description?: string | null; researchArea?: string | null; qualifications?: string | null;
}): ListingInsight {
  const title = clean(o.title);
  const context = clean([o.researchGroup, o.researchArea, o.qualifications, o.description?.slice(0, 1500)].filter(Boolean).join(" "));
  const basis: string[] = [];

  let position: Position = "other";
  for (const [p, re] of POSITION_RULES) {
    const m = title.match(re);
    if (m) {
      position = p;
      basis.push(`"${m[0].trim()}" in the title`);
      break;
    }
  }
  if (position === "other" && o.kind) {
    const fromKind: Record<string, Position> = { research_assistant: "project_assistant", phd_position: "phd", fellowship: "fellowship", research_internship: "internship" };
    if (fromKind[o.kind]) {
      position = fromKind[o.kind];
      basis.push("the source's own category");
    }
  }

  const text = `${title} ${context}`;
  const disciplines = DISCIPLINES.filter(([, re]) => re.test(text)).map(([d]) => d);
  const topics = TOPICS.filter(([, re]) => re.test(text)).map(([t]) => t);
  // "Department of X" is the strongest discipline signal; note it.
  const dept = text.match(/department of ([a-z &,-]+?)(?:,|\.|$| iit| under| in the)/i);
  if (dept) basis.push(`department: ${dept[1].trim()}`);
  if (topics.length) basis.push(`topics named: ${topics.join(", ")}`);

  const typical = TYPICAL_STAGE[position];
  return {
    position, positionLabel: POSITION_LABEL[position],
    typicalStage: typical ? typical[0] : null, stageNote: typical ? typical[1] : null,
    disciplines, topics, basis,
  };
}

/** A student's fields, from their degree and specialisation as entered (e.g. "B.Tech Electrical Engineering"). */
export function studentDisciplines(...texts: (string | null | undefined)[]): string[] {
  const text = texts.filter(Boolean).join(" ");
  if (!text) return [];
  return DISCIPLINES.filter(([, re]) => re.test(text)).map(([d]) => d);
}

const STAGE_ORDER: Record<Stage, number> = { undergraduate: 0, postgraduate: 1, doctoral: 2 };

/**
 * Is this a sensible next step for a student at `level`? Typical requirements only: never presented as the listing's rule.
 *   suitable    the student is at or past the typical stage
 *   next_step   one stage below: plausible soon (a final-year B.Tech looking at JRF posts)
 *   later       two stages below (an undergraduate looking at a postdoc)
 */
export function stageFit(typical: Stage | null, level: Stage | "secondary" | null): "suitable" | "next_step" | "later" | "unknown" {
  if (!typical || !level) return "unknown";
  if (level === "secondary") return "later";
  const gap = STAGE_ORDER[typical] - STAGE_ORDER[level];
  return gap <= 0 ? "suitable" : gap === 1 ? "next_step" : "later";
}
