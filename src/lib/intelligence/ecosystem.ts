import type { IntegrationClientId } from "@/db/schema";

// What each ecosystem product actually exchanges with AI Tathastu today, as found in the code (Nov 2026 audit).
// Data flows one way: integrated apps read a consent-filtered profile from AI Tathastu; none sends records back.
// When a product gains an inbound data contract, its status changes here and its benchmarks join the catalogue.

export interface EcosystemProduct {
  id: string;
  name: string;
  clientId: IntegrationClientId | null;
  integrated: boolean;
  flow: string;
  sendsDataBack: boolean;
  needed: string;
}

export const ECOSYSTEM: EcosystemProduct[] = [
  { id: "ai_tathastu", name: "AI Tathastu", clientId: null, integrated: true, sendsDataBack: true,
    flow: "Resume, connectors (GitHub, ORCID, LeetCode…), learning records and the career engine. Every benchmark here comes from it.",
    needed: "Assessments, quizzes and tutor sessions would need new learning event tables; none exist yet." },
  { id: "avsar", name: "Avsar", clientId: "avasar", integrated: true, sendsDataBack: false,
    flow: "Signs in with AI Tathastu and reads the shared profile (skills, ERIS, projects…). Applications, interviews and outcomes stay in Avsar.",
    needed: "A signed outbound event contract from Avsar (application status changes, interviews, offers) and an inbound endpoint here." },
  { id: "collaborate", name: "Collaborate", clientId: "collaborate", integrated: true, sendsDataBack: false,
    flow: "Signs in with AI Tathastu and reads the shared profile. It is a professional network (connections, posts); no team-contribution records exist there yet.",
    needed: "A contribution or deliverable model in Collaborate, plus an outbound event contract." },
  { id: "meet", name: "Tathastu Meet", clientId: "meet", integrated: true, sendsDataBack: false,
    flow: "Reads shared skills only.", needed: "Nothing is planned to flow back." },
  { id: "mentormaze", name: "MentorMaze", clientId: null, integrated: false, sendsDataBack: false,
    flow: "No integration. Its repository wasn't available to inspect.", needed: "Repository access, an identity link to AI Tathastu users and a consented data contract (sessions, goals, action items)." },
  { id: "ai_interviewer", name: "AI Interviewer", clientId: null, integrated: false, sendsDataBack: false,
    flow: "No integration. Its repository wasn't available to inspect.", needed: "Repository access and a data contract for evaluated results (never raw recordings)." },
  { id: "iris", name: "Iris", clientId: null, integrated: false, sendsDataBack: false,
    flow: "No integration. A proctored coding-exam system (IRIS Exam) exists with its own Supabase identity; whether it is this product needs confirming.",
    needed: "Confirmation of the product, an identity mapping and an exam-result contract." },
];
