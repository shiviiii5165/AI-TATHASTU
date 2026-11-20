/**
 * The one AVSAR category model, shared by the dashboard section and the /opportunities page.
 *
 * Sources (no category is filled from another's data):
 *  - internships:    Avsar partner API (lib/opportunities/avsar.ts)
 *  - research:       verified research catalogue (lib/opportunities), kinds other than collaboration
 *  - collaborations: same catalogue, kind collaboration / call_for_collaborators
 *  - jobs:           no connected source yet. The tab exists and says so; it never shows other records.
 */
export const AVSAR_CATEGORIES = {
  all: { label: "All", dot: "bg-[#7C4DDB]", active: "border-[#7C4DDB] bg-[#7C4DDB] text-white" },
  jobs: { label: "Jobs", dot: "bg-[#E0264E]", active: "border-[#E0264E] bg-[#E0264E] text-white" },
  internships: { label: "Internships", dot: "bg-[#1D5FC4]", active: "border-[#1D5FC4] bg-[#1D5FC4] text-white" },
  research: { label: "Research", dot: "bg-[#0F9F8A]", active: "border-[#0E7C66] bg-[#0E7C66] text-white" },
  collaborations: { label: "Collaborations", dot: "bg-[#D97706]", active: "border-[#B45309] bg-[#B45309] text-white" },
} as const;

export type AvsarCategory = keyof typeof AVSAR_CATEGORIES;
export const AVSAR_CATEGORY_KEYS = Object.keys(AVSAR_CATEGORIES) as AvsarCategory[];

export const isAvsarCategory = (v: string | undefined): v is AvsarCategory => !!v && v in AVSAR_CATEGORIES;

/** Research-catalogue kinds that belong under Collaborations. */
export const COLLAB_KINDS = new Set(["collaboration", "call_for_collaborators"]);

export const AVSAR_TAGLINE = "Explore internships, jobs, research opportunities and collaborations aligned with your skills, interests and career goals.";

export const JOBS_UNAVAILABLE = {
  title: "Jobs aren't connected to AVSAR yet",
  body: "No jobs source is integrated today, so nothing is shown here rather than mislabelled internships or research. Internships and research are available in their tabs.",
};

export const tabClass = (c: AvsarCategory, on: boolean) =>
  `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B4FE0] ${
    on ? AVSAR_CATEGORIES[c].active : "border-[#E7EAF3] bg-white text-[#475569] hover:border-[#C9CFE0] hover:text-[#11182B]"
  }`;
