/**
 * Research-opportunity source catalogue. Every candidate source examined is recorded here with its
 * outcome, so coverage and gaps are auditable.
 *
 * Review method (2026-11-11/12): official domain; access method in priority order (API → feed → structured
 * page → PDF); robots.txt checked with the ingester's own group-aware rules; the site's terms / copyright /
 * website-policy pages looked for and read; current listings confirmed on the live page.
 *
 * Terms outcome: every institution below publishes at most a general copyright line ("subject to copyright
 * protection" / "All rights reserved") and none grants or prohibits reuse of public announcements or automated
 * access; four publish no terms page at all. Whether to collect under those conditions is a policy decision
 * for the owner, so every collectable source is NEEDS_HUMAN_REVIEW and stays disabled until approved with
 * `npm run opportunities:sources -- --approve <id> --by <name>`. Robots.txt permission alone never approves.
 */
export type TermsStatus = "approved" | "needs_human_review" | "rejected";
export type InstitutionType = "university" | "institute_of_national_importance" | "government_lab" | "research_society" | "international_lab";

export interface CatalogueSource {
  id: string;
  name: string;
  organization: string;
  country: string;
  institutionType: InstitutionType;
  kind: "rss" | "json_feed" | "page_monitor";
  url: string;
  adapter?: string;
  /** Extra research-title signal for this source (the general classifier always applies too). */
  includePattern?: string;
  withdrawOnAbsence: boolean;
  autoVerify: boolean;
  minFetchIntervalMinutes: number;
  termsStatus: TermsStatus;
  /** Where the site's policy was found; null when no terms page is published. */
  termsUrl: string | null;
  /** What the review found. */
  termsEvidence: string;
  /** What was verified about the data and access. */
  note: string;
}

const GERMAN_RESEARCH = "phd student|doctoral|post-?doc|scientific employee|research";
const GENERAL_COPYRIGHT_ONLY = "No published terms grant or prohibit reuse of public announcements or automated access.";

export const RESEARCH_SOURCES: CatalogueSource[] = [
  {
    id: "iisc-contract-project-staff",
    name: "IISc Careers: Contract/Project Staff",
    organization: "Indian Institute of Science (IISc), Bengaluru",
    country: "India",
    institutionType: "institute_of_national_importance",
    kind: "page_monitor",
    adapter: "iisc_contract_staff",
    url: "https://iisc.ac.in/careers/contract-project-staff/",
    withdrawOnAbsence: true, // the table lists current postings with an explicit Open/Closed status; older ones move to Archives
    autoVerify: true,
    minFetchIntervalMinutes: 360,
    termsStatus: "needs_human_review",
    termsUrl: null,
    termsEvidence: `No site-wide terms, copyright or website-policy page found (common paths 404; search found only library e-resource policies). robots.txt disallows only /wp-admin/. ${GENERAL_COPYRIGHT_ONLY}`,
    note: "Official IISc page. Table: Post, Department, Advertisement PDF, Closing Date, Status (Open/Closed). No feed or API.",
  },
  {
    id: "iitkgp-sric-project-positions",
    name: "IIT Kharagpur SRIC: Temporary (project) positions",
    organization: "Indian Institute of Technology Kharagpur (SRIC)",
    country: "India",
    institutionType: "institute_of_national_importance",
    kind: "page_monitor",
    adapter: "iitkgp_sric",
    url: "https://erp.iitkgp.ac.in/SRICStaffRecruitment/Advertise.jsp",
    withdrawOnAbsence: true,
    autoVerify: true,
    minFetchIntervalMinutes: 360,
    termsStatus: "needs_human_review",
    termsUrl: "https://www.iitkgp.ac.in/legal-disclaimer",
    termsEvidence: `Terms of use page has no reuse terms; legal disclaimer: "Material on this site is subject to copyright protection unless otherwise indicated." Nothing on hyperlinking to the site or automated access. ERP host has no robots.txt. ${GENERAL_COPYRIGHT_ONLY}`,
    note: "Official IIT Kharagpur ERP. Rows: post, PI, department, vacancies, last date; per-advert page AdvertiseView.jsp?serial_no=<id>. No feed or API.",
  },
  {
    id: "iith-postdoc-jrf-srf",
    name: "IIT Hyderabad Careers: Postdoc/JRF/SRF positions",
    organization: "Indian Institute of Technology Hyderabad",
    country: "India",
    institutionType: "institute_of_national_importance",
    kind: "page_monitor",
    adapter: "iith_postdoc",
    url: "https://iith.ac.in/careers/",
    withdrawOnAbsence: true,
    autoVerify: true,
    minFetchIntervalMinutes: 360,
    termsStatus: "needs_human_review",
    termsUrl: null,
    termsEvidence: `No website terms or copyright page found (common paths 404; search found only library and IP policies). robots.txt has no rules. ${GENERAL_COPYRIGHT_ONLY}`,
    note: "Official IIT Hyderabad page, section #postdoc: start date, advertisement PDF, end date (rows carry data-career-expires). No feed or API.",
  },
  {
    id: "iitr-project-jobs",
    name: "IIT Roorkee Careers: Project Jobs",
    organization: "Indian Institute of Technology Roorkee",
    country: "India",
    institutionType: "institute_of_national_importance",
    kind: "page_monitor",
    adapter: "iitr_project_jobs",
    url: "https://iitr.ac.in/Careers/Project%20Jobs.html",
    withdrawOnAbsence: true, // the list carries every current project advertisement, newest first
    autoVerify: true,
    minFetchIntervalMinutes: 360,
    termsStatus: "needs_human_review",
    termsUrl: null,
    termsEvidence: `No website terms or copyright page found on iitr.ac.in (common paths 404; search found only the IPR policy). No robots.txt. ${GENERAL_COPYRIGHT_ONLY}`,
    note: "Official IIT Roorkee list: advert date, position, department, last date to apply or interview date, PDF. No feed or API.",
  },
  {
    id: "iiith-rnd-recruitment",
    name: "IIIT Hyderabad Careers: R&D (project) recruitment",
    organization: "International Institute of Information Technology Hyderabad",
    country: "India",
    institutionType: "university",
    kind: "page_monitor",
    adapter: "iiith_rnd",
    url: "https://www.iiit.ac.in/careers/",
    withdrawOnAbsence: true,
    autoVerify: true,
    minFetchIntervalMinutes: 720, // a large page (1.2 MB) that changes a few times a month
    termsStatus: "needs_human_review",
    termsUrl: "https://www.iiit.ac.in/privacy-policy/",
    termsEvidence: `Only a privacy policy is published ("Copyright © 2024, International Institute of Information Technology Hyderabad. All rights reserved."); no terms of use. robots.txt allows /careers/. ${GENERAL_COPYRIGHT_ONLY}`,
    note: "Official IIIT Hyderabad careers page, R&D table: start date, advertisement number, title (PDF), end date, Open/Closed status. No feed or API.",
  },
  {
    id: "mpg-job-offers",
    name: "Max Planck Society: job offers",
    organization: "Max Planck Society",
    country: "Germany",
    institutionType: "research_society",
    kind: "rss",
    url: "https://www.mpg.de/feeds/jobs.rss",
    withdrawOnAbsence: false, // rolling feed of the latest offers: absence is not withdrawal
    autoVerify: true,
    minFetchIntervalMinutes: 360,
    termsStatus: "needs_human_review",
    termsUrl: "https://www.mpg.de/imprint",
    termsEvidence: `Imprint: "The layout, graphics employed and any other contents on the homepage of the Max Planck Society Internet site are protected by copyright law ... All rights reserved." The jobs RSS feed is published for syndication; robots.txt allows it. Reuse of feed entries with attribution needs an owner decision.`,
    note: "Official RSS on mpg.de (latest offers across institutes, mixed with IT/administrative jobs; research roles classified).",
  },
  {
    id: "mpi-cbg-open-positions",
    name: "MPI-CBG Dresden: open positions",
    organization: "Max Planck Institute of Molecular Cell Biology and Genetics (MPI-CBG), Dresden",
    country: "Germany",
    institutionType: "research_society",
    kind: "rss",
    url: "https://www.mpi-cbg.de/jobs-feed",
    withdrawOnAbsence: false,
    autoVerify: true,
    minFetchIntervalMinutes: 360,
    termsStatus: "needs_human_review",
    termsUrl: "https://www.mpi-cbg.de/impressum",
    termsEvidence: `Impressum: contents "protected by copyright law. © MPI-CBG, Dresden. All rights reserved." The jobs feed is published for syndication; no robots.txt. Reuse of feed entries with attribution needs an owner decision.`,
    note: "Official RSS on mpi-cbg.de (PhD programme, postdoctoral fellows and other positions).",
  },
  {
    id: "hzdr-job-offers",
    name: "Helmholtz-Zentrum Dresden-Rossendorf (HZDR): job offers",
    organization: "Helmholtz-Zentrum Dresden-Rossendorf (HZDR)",
    country: "Germany",
    institutionType: "research_society",
    kind: "rss",
    url: "https://www.hzdr.de/rss_jobs.xml",
    includePattern: GERMAN_RESEARCH, // German/English pairs share a reference number and are collapsed to one
    withdrawOnAbsence: false,
    autoVerify: true,
    minFetchIntervalMinutes: 360,
    termsStatus: "needs_human_review",
    termsUrl: "https://www.hzdr.de/Cms?pOid=10115&pNid=3114",
    termsEvidence: "Imprint found; a 'Terms of Use (PDF)' is linked from media pages but could not be read; photos carry © HZDR credits. robots.txt allows /rss_jobs.xml. Needs an owner decision.",
    note: "Official HZDR jobs RSS (Helmholtz Association member): PhD and scientific positions plus vocational training places (classified out).",
  },
];

/** Sources examined and not collected, with the reason (for the coverage report). */
export const REJECTED_SOURCES: { name: string; url: string; reason: string }[] = [
  { name: "IIT Gandhinagar careers", url: "https://iitgn.ac.in/careers", reason: "HTTP 403 to automated requests; not bypassed." },
  { name: "IIT Kanpur DoRD project positions", url: "https://www.iitk.ac.in/dord/", reason: "HTTP 403 to automated requests; not bypassed." },
  { name: "CERN (SmartRecruiters Posting API)", url: "https://api.smartrecruiters.com/v1/companies/CERN/postings", reason: "API host's robots.txt disallows our agent; CERN's own site offers only email alerts." },
  { name: "ISRO careers", url: "https://www.isro.gov.in/Careers.html", reason: "Mostly results, answer keys and schedules; research calls are occasional and undated. Candidate for exception curation." },
  { name: "IIT Bombay IRCC jobs", url: "https://rnd.iitb.ac.in/jobs", reason: "Adverts mixed with results and withdrawal notices; no dates." },
  { name: "IIT Madras ICSR openings", url: "https://icsrstaff.iitm.ac.in/careers/current_openings.php", reason: "Obfuscated, dynamically generated links." },
  { name: "IIT Delhi IRD vacancies", url: "https://ird.iitd.ac.in/content/vacancies", reason: "Content rendered client-side (684-byte shell); no data without executing scripts." },
  { name: "IISER Pune opportunities", url: "https://www.iiserpune.ac.in/opportunities", reason: "Main page lists faculty positions only; project tabs need separate review." },
  { name: "IISER Tirupati jobs", url: "https://www.iisertirupati.ac.in/", reason: "Feeds return HTTP 500." },
  { name: "ANRF", url: "https://anrfonline.in/ANRF/HomePage", reason: "Calls are research grants for faculty PIs, not student/early-career openings." },
  { name: "Fraunhofer job portal", url: "https://jobs.fraunhofer.de/", reason: "No official feed or API found (sitemap only, not documented for reuse)." },
  { name: "EMBL jobs", url: "https://www.embl.org/jobs/", reason: "No official feed or API found." },
  { name: "Helmholtz Association (central)", url: "https://www.helmholtz.de/en/career/", reason: "No central job feed; member centres publish their own (HZDR included)." },
  { name: "DESY / FZ Jülich / DKFZ / HZB job feeds", url: "https://www.desy.de/", reason: "Feed URLs found in search return 404 now or are HTML, not feeds." },
  { name: "jobs.ac.uk", url: "https://www.jobs.ac.uk/", reason: "Current official feed URLs could not be confirmed." },
  { name: "EURAXESS", url: "https://euraxess.ec.europa.eu/jobs", reason: "No documented feed or API." },
];
