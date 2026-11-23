// Source of truth for the academic catalogue. Migration 0010 was generated
// from this file; after editing it, run `npm run db:seed:academic` (idempotent
// upsert). Pure data: imported by the seed builder, the matcher and tests.

import type { DegreeLevel, InstitutionType } from "@/db/schema";
import { DIRECTORY_ROWS } from "./institutions-directory";

export type SeedInstitution = {
  name: string;
  aliases: string[];
  type: InstitutionType;
  city: string;
  state: string | null;
  country: string; // ISO 3166-1 alpha-2
  website: string | null;
};

export type SeedDegree = { name: string; aliases: string[]; level: DegreeLevel; duration: number | null };

// Exactly eight, in display order.
export const DEGREES: SeedDegree[] = [
  { name: "B.Tech / B.E.", aliases: ["BTech", "B.Tech", "B Tech", "BE", "B.E.", "B.E", "Bachelor of Technology", "Bachelor of Engineering"], level: "undergraduate", duration: 4 },
  { name: "M.Tech", aliases: ["MTech", "M Tech", "M.E.", "ME", "Master of Technology", "Master of Engineering"], level: "postgraduate", duration: 2 },
  { name: "MCA", aliases: ["M.C.A.", "Master of Computer Applications"], level: "postgraduate", duration: 2 },
  { name: "BCA", aliases: ["B.C.A.", "Bachelor of Computer Applications"], level: "undergraduate", duration: 3 },
  { name: "Diploma", aliases: ["Polytechnic Diploma", "Diploma in Engineering"], level: "diploma", duration: 3 },
  { name: "Ph.D.", aliases: ["PhD", "Ph.D", "Doctorate", "Doctor of Philosophy"], level: "doctoral", duration: null },
  {
    name: "Integrated bachelor's and master's programmes",
    aliases: ["Integrated", "Dual Degree", "Integrated M.Tech", "Integrated MSc", "BS-MS", "B.Tech + M.Tech", "Integrated Masters"],
    level: "integrated",
    duration: 5,
  },
  { name: "Other", aliases: ["Others"], level: "other", duration: null },
];

const BTECH = "B.Tech / B.E.";
const MTECH = "M.Tech";
const PHD = "Ph.D.";
const INTEGRATED = "Integrated bachelor's and master's programmes";

// Each specialization lists the degrees it applies to ("Other" applies to all).
export const SPECIALIZATIONS: { name: string; aliases: string[]; degrees: string[] }[] = [
  { name: "Computer Science and Engineering", aliases: ["CSE", "CS", "Computer Science", "Computer Engineering", "COE"], degrees: [BTECH, MTECH, "Diploma", PHD, INTEGRATED] },
  { name: "Artificial Intelligence and Machine Learning", aliases: ["AI/ML", "AIML", "AI & ML", "AI and ML", "CSE (AI&ML)", "Artificial Intelligence"], degrees: [BTECH, MTECH, "MCA", "BCA", PHD, INTEGRATED] },
  { name: "Data Science", aliases: ["DS", "CSE (Data Science)", "Data Science and Engineering"], degrees: [BTECH, MTECH, "MCA", "BCA", PHD, INTEGRATED] },
  { name: "Information Technology", aliases: ["IT"], degrees: [BTECH, MTECH, "Diploma"] },
  { name: "Electronics and Communication Engineering", aliases: ["ECE", "EC", "Electronics", "ENTC", "Electronics and Telecommunication"], degrees: [BTECH, "Diploma", PHD] },
  { name: "Electrical and Electronics Engineering", aliases: ["EEE", "EE", "Electrical Engineering", "Electrical"], degrees: [BTECH, "Diploma", PHD] },
  { name: "Mechanical Engineering", aliases: ["ME", "Mech", "Mechanical"], degrees: [BTECH, "Diploma", PHD] },
  { name: "Civil Engineering", aliases: ["CE", "Civil"], degrees: [BTECH, "Diploma"] },
  { name: "Chemical Engineering", aliases: ["ChE", "Chemical"], degrees: [BTECH] },
  { name: "Biotechnology", aliases: ["BT", "Biotech"], degrees: [BTECH] },
  { name: "Electronics and Instrumentation Engineering", aliases: ["EIE", "Instrumentation"], degrees: [BTECH] },
  { name: "Cyber Security", aliases: ["Cybersecurity", "Information Security", "CSE (Cyber Security)"], degrees: [BTECH, MTECH, "MCA", "BCA"] },
  { name: "Robotics and Automation", aliases: ["Robotics", "RAE", "Mechatronics"], degrees: [BTECH, MTECH] },
  { name: "Aerospace Engineering", aliases: ["Aeronautical Engineering", "Aero"], degrees: [BTECH] },
  { name: "VLSI Design", aliases: ["VLSI", "Microelectronics and VLSI"], degrees: [MTECH] },
  { name: "Communication Systems", aliases: ["Communication Engineering", "Wireless Communication"], degrees: [MTECH] },
  { name: "Power Systems", aliases: ["Power Electronics", "Power Engineering"], degrees: [MTECH] },
  { name: "Structural Engineering", aliases: ["Structures"], degrees: [MTECH] },
  { name: "Thermal Engineering", aliases: ["Thermal"], degrees: [MTECH] },
  { name: "Cloud Computing", aliases: ["Cloud"], degrees: ["MCA", "BCA"] },
  { name: "General", aliases: ["Computer Applications", "Software Development"], degrees: ["MCA", "BCA"] },
  { name: "Mathematics and Computing", aliases: ["MnC", "M&C", "Mathematics & Computing"], degrees: [INTEGRATED, BTECH] },
  { name: "Mathematics", aliases: ["Maths", "Applied Mathematics"], degrees: [PHD, INTEGRATED] },
  { name: "Physics", aliases: ["Engineering Physics", "Applied Physics"], degrees: [PHD, INTEGRATED] },
  { name: "Chemistry", aliases: [], degrees: [INTEGRATED] },
  { name: "Biological Sciences", aliases: ["Biology", "Life Sciences"], degrees: [INTEGRATED] },
  { name: "Economics", aliases: [], degrees: [INTEGRATED] },
  { name: "Other", aliases: ["Others"], degrees: DEGREES.map((d) => d.name) },
];

const iit = (name: string, aliases: string[], city: string, state: string, website: string): SeedInstitution => ({
  name, aliases, type: "iit", city, state, country: "IN", website,
});
const nit = (name: string, aliases: string[], city: string, state: string, website: string): SeedInstitution => ({
  name, aliases, type: "nit", city, state, country: "IN", website,
});
const inst = (
  name: string, aliases: string[], type: InstitutionType, city: string, state: string | null, country: string, website: string,
): SeedInstitution => ({ name, aliases, type, city, state, country, website });

export const CORE_INSTITUTIONS: SeedInstitution[] = [
  // ── IITs ──
  iit("Indian Institute of Technology Bombay", ["IIT Bombay", "IITB", "IIT Mumbai", "IIT-B"], "Mumbai", "Maharashtra", "https://www.iitb.ac.in"),
  iit("Indian Institute of Technology Delhi", ["IIT Delhi", "IITD", "IIT-D"], "New Delhi", "Delhi", "https://home.iitd.ac.in"),
  iit("Indian Institute of Technology Madras", ["IIT Madras", "IITM", "IIT Chennai", "IIT-M"], "Chennai", "Tamil Nadu", "https://www.iitm.ac.in"),
  iit("Indian Institute of Technology Kanpur", ["IIT Kanpur", "IITK", "IIT-K"], "Kanpur", "Uttar Pradesh", "https://www.iitk.ac.in"),
  iit("Indian Institute of Technology Kharagpur", ["IIT Kharagpur", "IITKGP", "IIT KGP", "IIT-KGP"], "Kharagpur", "West Bengal", "https://www.iitkgp.ac.in"),
  iit("Indian Institute of Technology Roorkee", ["IIT Roorkee", "IITR", "IIT-R"], "Roorkee", "Uttarakhand", "https://www.iitr.ac.in"),
  iit("Indian Institute of Technology Hyderabad", ["IIT Hyderabad", "IITH", "IIT-H"], "Sangareddy", "Telangana", "https://www.iith.ac.in"),
  iit("Indian Institute of Technology Gandhinagar", ["IIT Gandhinagar", "IITGN", "IIT-GN"], "Gandhinagar", "Gujarat", "https://iitgn.ac.in"),
  iit("Indian Institute of Technology Ropar", ["IIT Ropar", "IIT Rupnagar", "IITRPR"], "Rupnagar", "Punjab", "https://www.iitrpr.ac.in"),
  iit("Indian Institute of Technology (BHU) Varanasi", ["IIT (BHU) Varanasi", "IIT BHU", "IIT Varanasi", "IIT-BHU"], "Varanasi", "Uttar Pradesh", "https://www.iitbhu.ac.in"),
  // ── NITs ──
  nit("National Institute of Technology Tiruchirappalli", ["NIT Trichy", "NIT Tiruchirappalli", "NITT", "REC Trichy"], "Tiruchirappalli", "Tamil Nadu", "https://www.nitt.edu"),
  nit("National Institute of Technology Warangal", ["NIT Warangal", "NITW", "REC Warangal"], "Warangal", "Telangana", "https://www.nitw.ac.in"),
  nit("National Institute of Technology Karnataka, Surathkal", ["NIT Surathkal", "NITK", "NIT Karnataka", "NITK Surathkal"], "Mangaluru", "Karnataka", "https://www.nitk.ac.in"),
  nit("National Institute of Technology Calicut", ["NIT Calicut", "NITC", "NIT Kozhikode"], "Kozhikode", "Kerala", "https://nitc.ac.in"),
  nit("National Institute of Technology Rourkela", ["NIT Rourkela", "NITR"], "Rourkela", "Odisha", "https://www.nitrkl.ac.in"),
  nit("National Institute of Technology Durgapur", ["NIT Durgapur", "NITDGP"], "Durgapur", "West Bengal", "https://nitdgp.ac.in"),
  nit("Dr B R Ambedkar National Institute of Technology Jalandhar", ["NIT Jalandhar", "NITJ"], "Jalandhar", "Punjab", "https://www.nitj.ac.in"),
  nit("National Institute of Technology Hamirpur", ["NIT Hamirpur", "NITH"], "Hamirpur", "Himachal Pradesh", "https://nith.ac.in"),
  // ── IIITs ──
  inst("International Institute of Information Technology Hyderabad", ["IIIT Hyderabad", "IIITH", "IIIT-H"], "deemed_university", "Hyderabad", "Telangana", "IN", "https://www.iiit.ac.in"),
  inst("International Institute of Information Technology Bangalore", ["IIIT Bangalore", "IIITB", "IIIT-B", "IIIT Bengaluru"], "deemed_university", "Bengaluru", "Karnataka", "IN", "https://www.iiitb.ac.in"),
  inst("Indraprastha Institute of Information Technology Delhi", ["IIIT Delhi", "IIITD", "IIIT-D"], "state_university", "New Delhi", "Delhi", "IN", "https://www.iiitd.ac.in"),
  inst("Indian Institute of Information Technology Allahabad", ["IIIT Allahabad", "IIITA", "IIIT Prayagraj"], "iiit", "Prayagraj", "Uttar Pradesh", "IN", "https://www.iiita.ac.in"),
  // ── Research institutes ──
  inst("Indian Institute of Science", ["IISc", "IISc Bangalore", "IISc Bengaluru"], "research_institute", "Bengaluru", "Karnataka", "IN", "https://iisc.ac.in"),
  inst("Indian Institute of Science Education and Research Mohali", ["IISER Mohali"], "research_institute", "Mohali", "Punjab", "IN", "https://www.iisermohali.ac.in"),
  // ── Private and deemed universities ──
  inst("Birla Institute of Technology and Science, Pilani", ["BITS Pilani", "BITS"], "deemed_university", "Pilani", "Rajasthan", "IN", "https://www.bits-pilani.ac.in"),
  inst("Vellore Institute of Technology", ["VIT", "VIT Vellore", "VIT University"], "deemed_university", "Vellore", "Tamil Nadu", "IN", "https://vit.ac.in"),
  inst("Manipal Academy of Higher Education", ["MAHE", "Manipal University", "Manipal", "MIT Manipal"], "deemed_university", "Manipal", "Karnataka", "IN", "https://manipal.edu"),
  inst("Thapar Institute of Engineering and Technology", ["Thapar", "TIET", "Thapar University"], "deemed_university", "Patiala", "Punjab", "IN", "https://www.thapar.edu"),
  inst("Amrita Vishwa Vidyapeetham", ["Amrita", "Amrita University"], "deemed_university", "Coimbatore", "Tamil Nadu", "IN", "https://www.amrita.edu"),
  inst("SRM Institute of Science and Technology", ["SRM", "SRMIST", "SRM University", "SRM Chennai"], "deemed_university", "Chennai", "Tamil Nadu", "IN", "https://www.srmist.edu.in"),
  inst("Shiv Nadar University", ["SNU", "Shiv Nadar Institution of Eminence", "SNIoE"], "deemed_university", "Greater Noida", "Uttar Pradesh", "IN", "https://snu.edu.in"),
  inst("Ashoka University", ["Ashoka"], "private_university", "Sonipat", "Haryana", "IN", "https://www.ashoka.edu.in"),
  inst("O.P. Jindal Global University", ["JGU", "Jindal Global University", "OP Jindal University"], "private_university", "Sonipat", "Haryana", "IN", "https://jgu.edu.in"),
  inst("Symbiosis International University", ["Symbiosis", "SIU", "Symbiosis Pune"], "deemed_university", "Pune", "Maharashtra", "IN", "https://www.siu.edu.in"),
  inst("Kalinga Institute of Industrial Technology", ["KIIT", "KIIT University", "KIIT Bhubaneswar"], "deemed_university", "Bhubaneswar", "Odisha", "IN", "https://kiit.ac.in"),
  inst("Amity University", ["Amity", "Amity University Noida", "AUUP"], "private_university", "Noida", "Uttar Pradesh", "IN", "https://www.amity.edu"),
  // ── Central universities ──
  inst("University of Delhi", ["DU", "Delhi University"], "central_university", "Delhi", "Delhi", "IN", "https://www.du.ac.in"),
  inst("Banaras Hindu University", ["BHU"], "central_university", "Varanasi", "Uttar Pradesh", "IN", "https://www.bhu.ac.in"),
  inst("Jawaharlal Nehru University", ["JNU"], "central_university", "New Delhi", "Delhi", "IN", "https://www.jnu.ac.in"),
  inst("University of Hyderabad", ["UoH", "HCU", "Hyderabad Central University", "Central University of Hyderabad"], "central_university", "Hyderabad", "Telangana", "IN", "https://uohyd.ac.in"),
  inst("Jamia Millia Islamia", ["JMI", "Jamia"], "central_university", "New Delhi", "Delhi", "IN", "https://www.jmi.ac.in"),
  inst("Aligarh Muslim University", ["AMU"], "central_university", "Aligarh", "Uttar Pradesh", "IN", "https://www.amu.ac.in"),
  inst("Central University of Punjab", ["CUP", "CUPB", "CU Punjab"], "central_university", "Bathinda", "Punjab", "IN", "https://www.cup.edu.in"),
  inst("Central University of Himachal Pradesh", ["CUHP", "CU Himachal"], "central_university", "Dharamshala", "Himachal Pradesh", "IN", "https://www.cuhimachal.ac.in"),
  // ── State universities ──
  inst("Anna University", ["AU Chennai", "Anna Univ"], "state_university", "Chennai", "Tamil Nadu", "IN", "https://www.annauniv.edu"),
  inst("Jadavpur University", ["JU", "JU Kolkata"], "state_university", "Kolkata", "West Bengal", "IN", "https://jadavpuruniversity.in"),
  inst("University of Calcutta", ["Calcutta University", "CU Kolkata"], "state_university", "Kolkata", "West Bengal", "IN", "https://www.caluniv.ac.in"),
  inst("Panjab University", ["PU", "PU Chandigarh", "Panjab University Chandigarh"], "state_university", "Chandigarh", "Chandigarh", "IN", "https://puchd.ac.in"),
  inst("University of Mumbai", ["Mumbai University", "MU"], "state_university", "Mumbai", "Maharashtra", "IN", "https://mu.ac.in"),
  inst("Savitribai Phule Pune University", ["SPPU", "Pune University", "University of Pune"], "state_university", "Pune", "Maharashtra", "IN", "http://www.unipune.ac.in"),
  inst("Punjab Agricultural University", ["PAU", "PAU Ludhiana"], "state_university", "Ludhiana", "Punjab", "IN", "https://www.pau.edu"),
  inst("Guru Nanak Dev University", ["GNDU"], "state_university", "Amritsar", "Punjab", "IN", "https://www.gndu.ac.in"),
  inst("I.K. Gujral Punjab Technical University", ["IKGPTU", "PTU", "IKG PTU", "Punjab Technical University"], "state_university", "Kapurthala", "Punjab", "IN", "https://ptu.ac.in"),
  inst("Himachal Pradesh University", ["HPU", "HPU Shimla"], "state_university", "Shimla", "Himachal Pradesh", "IN", "https://www.hpuniv.ac.in"),
  inst("Kurukshetra University", ["KUK", "KU Kurukshetra"], "state_university", "Kurukshetra", "Haryana", "IN", "https://kuk.ac.in"),
  inst("Delhi Technological University", ["DTU", "Delhi College of Engineering", "DCE"], "state_university", "Delhi", "Delhi", "IN", "https://dtu.ac.in"),
  inst("Netaji Subhas University of Technology", ["NSUT", "NSIT", "Netaji Subhas Institute of Technology"], "state_university", "New Delhi", "Delhi", "IN", "https://www.nsut.ac.in"),
  // ── Punjab and North India private / deemed ──
  inst("Chandigarh University", ["CU", "CU Mohali", "CU Gharuan"], "private_university", "Mohali", "Punjab", "IN", "https://www.cuchd.in"),
  inst("Chitkara University", ["Chitkara", "Chitkara Punjab"], "private_university", "Rajpura", "Punjab", "IN", "https://www.chitkara.edu.in"),
  inst("DAV University", ["DAVU", "DAV University Jalandhar"], "private_university", "Jalandhar", "Punjab", "IN", "https://www.davuniversity.org"),
  inst("Sant Longowal Institute of Engineering and Technology", ["SLIET", "SLIET Longowal"], "deemed_university", "Longowal", "Punjab", "IN", "https://sliet.ac.in"),
  inst("Lovely Professional University", ["LPU", "Lovely University", "LPU Phagwara"], "private_university", "Phagwara", "Punjab", "IN", "https://www.lpu.in"),
  // ── United Kingdom ──
  inst("University of Oxford", ["Oxford", "Oxford University"], "foreign_university", "Oxford", "England", "GB", "https://www.ox.ac.uk"),
  inst("University of Cambridge", ["Cambridge", "Cambridge University"], "foreign_university", "Cambridge", "England", "GB", "https://www.cam.ac.uk"),
  inst("Imperial College London", ["Imperial", "ICL", "Imperial College"], "foreign_university", "London", "England", "GB", "https://www.imperial.ac.uk"),
  inst("University of Manchester", ["Manchester", "UoM", "Manchester University"], "foreign_university", "Manchester", "England", "GB", "https://www.manchester.ac.uk"),
  inst("Staffordshire University", ["Staffs", "Staffordshire"], "foreign_university", "Stoke-on-Trent", "England", "GB", "https://www.staffs.ac.uk"),
  // ── Canada ──
  inst("University of Toronto", ["UofT", "U of T", "UToronto"], "foreign_university", "Toronto", "Ontario", "CA", "https://www.utoronto.ca"),
  inst("University of Waterloo", ["UWaterloo", "Waterloo", "UW"], "foreign_university", "Waterloo", "Ontario", "CA", "https://uwaterloo.ca"),
  inst("University of British Columbia", ["UBC"], "foreign_university", "Vancouver", "British Columbia", "CA", "https://www.ubc.ca"),
  inst("University of Lethbridge", ["uLethbridge", "U of L"], "foreign_university", "Lethbridge", "Alberta", "CA", "https://www.ulethbridge.ca"),
  // ── Australia ──
  inst("University of Melbourne", ["UniMelb", "Melbourne University"], "foreign_university", "Melbourne", "Victoria", "AU", "https://www.unimelb.edu.au"),
  inst("Monash University", ["Monash"], "foreign_university", "Melbourne", "Victoria", "AU", "https://www.monash.edu"),
  inst("UNSW Sydney", ["UNSW", "University of New South Wales"], "foreign_university", "Sydney", "New South Wales", "AU", "https://www.unsw.edu.au"),
  // ── Asia ──
  inst("National University of Singapore", ["NUS"], "foreign_university", "Singapore", null, "SG", "https://www.nus.edu.sg"),
  inst("Nanyang Technological University", ["NTU", "NTU Singapore"], "foreign_university", "Singapore", null, "SG", "https://www.ntu.edu.sg"),
  inst("University of Tokyo", ["UTokyo", "Todai", "Tokyo University"], "foreign_university", "Tokyo", "Tokyo", "JP", "https://www.u-tokyo.ac.jp"),
  inst("KAIST", ["Korea Advanced Institute of Science and Technology"], "foreign_university", "Daejeon", null, "KR", "https://www.kaist.ac.kr"),
  inst("Seoul National University", ["SNU", "SNU Seoul"], "foreign_university", "Seoul", null, "KR", "https://en.snu.ac.kr"),
  inst("Hong Kong University of Science and Technology", ["HKUST"], "foreign_university", "Hong Kong", null, "HK", "https://hkust.edu.hk"),
  // ── Europe ──
  inst("ETH Zurich", ["ETH", "ETHZ", "Swiss Federal Institute of Technology Zurich", "ETH Zürich"], "foreign_university", "Zurich", "Zurich", "CH", "https://ethz.ch"),
  inst("Technical University of Munich", ["TUM", "TU Munich", "TU München"], "foreign_university", "Munich", "Bavaria", "DE", "https://www.tum.de"),
  inst("Delft University of Technology", ["TU Delft", "Delft"], "foreign_university", "Delft", "South Holland", "NL", "https://www.tudelft.nl"),
  inst("University of Bologna", ["UniBo", "Alma Mater Studiorum", "Bologna"], "foreign_university", "Bologna", "Emilia-Romagna", "IT", "https://www.unibo.it"),
  // ── United States ──
  inst("Massachusetts Institute of Technology", ["MIT"], "foreign_university", "Cambridge", "Massachusetts", "US", "https://www.mit.edu"),
  inst("Stanford University", ["Stanford"], "foreign_university", "Stanford", "California", "US", "https://www.stanford.edu"),
  inst("Carnegie Mellon University", ["CMU", "Carnegie Mellon"], "foreign_university", "Pittsburgh", "Pennsylvania", "US", "https://www.cmu.edu"),
  inst("University of California, Berkeley", ["UC Berkeley", "UCB", "Berkeley", "University of California Berkeley"], "foreign_university", "Berkeley", "California", "US", "https://www.berkeley.edu"),
  inst("University at Buffalo", ["UB", "SUNY Buffalo", "University at Buffalo SUNY", "State University of New York at Buffalo"], "foreign_university", "Buffalo", "New York", "US", "https://www.buffalo.edu"),
];

// ── Extended directory (institutions-directory.ts) ──
// Rows already in CORE_INSTITUTIONS (by canonical name or alias) or repeated
// within the directory are skipped, so the core entries keep their aliases.
const normName = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/^the /, "").trim();

const DIRECTORY_TYPE: Record<string, InstitutionType> = {
  C: "central_university", S: "state_university", D: "deemed_university", P: "private_university", O: "other", F: "foreign_university",
};
const nationalImportanceType = (name: string): InstitutionType =>
  /^Indian Institute of Technology /.test(name) ? "iit"
  : /National Institute of Technology/.test(name) ? "nit"
  : /^(Indian Institute of Information Technology|Atal Bihari Vajpayee Indian Institute of Information)/.test(name) ? "iiit"
  : "research_institute";

function directoryInstitutions(core: SeedInstitution[]): SeedInstitution[] {
  const seen = new Set<string>();
  for (const c of core) for (const n of [c.name, ...c.aliases]) seen.add(normName(n));
  const out: SeedInstitution[] = [];
  for (const line of DIRECTORY_ROWS.split("\n")) {
    if (!line.trim()) continue;
    const [name, city, state, code, country = "IN"] = line.split("|").map((s) => s.trim());
    const key = normName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const type = code === "N" ? nationalImportanceType(name) : DIRECTORY_TYPE[code];
    if (!type) throw new Error(`institutions-directory: bad type code "${code}" for ${name}`);
    out.push({ name, aliases: [], type, city, state: state || null, country, website: null });
  }
  return out;
}

export const DIRECTORY_INSTITUTIONS: SeedInstitution[] = directoryInstitutions(CORE_INSTITUTIONS);
export const INSTITUTIONS: SeedInstitution[] = [...CORE_INSTITUTIONS, ...DIRECTORY_INSTITUTIONS];
