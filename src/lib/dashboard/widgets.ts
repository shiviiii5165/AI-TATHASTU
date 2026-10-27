// The single source of truth for dashboard widgets on the web side. The worker's
// scoring registry (worker/intelligence/config.py) must use the same ids;
// worker/tests/test_pipeline.py fails if an id here is missing there.
// Client-safe: no component imports, so both server and client can read it.

import type { Persona, SourceId } from "@/db/schema";
import type { PriorityId } from "@/lib/onboarding/catalog";
import type { FieldGroupId } from "@/lib/profile/field-groups";
import type { ProfileViewDoc, ScoredWidget } from "@/lib/dashboard/types";

export type WidgetId =
  | "eris_readiness"
  | "job_matches"
  | "skill_gaps"
  | "github_activity"
  | "profile_completeness"
  // Faculty
  | "student_matches"
  | "mentee_requests"
  | "research_feed"
  // Alumni
  | "top_talent"
  | "referral_requests"
  | "alumni_network";

export interface WidgetDefinition {
  id: WidgetId;
  module: string;
  label: string;
  // Which personas' dashboards include it.
  personas: Persona[];
  // Preview widgets: what the card will show, and what it's waiting for.
  preview?: { body: string; rows: string[]; waitingOn: string };
  // Priorities this widget serves (the I term of P(w)).
  requiredIntent: PriorityId[];
  // Field groups that need confirmed data for the widget to be actionable (R).
  requiredData: FieldGroupId[];
  // Whether the widget has something real to show. False renders its empty state.
  eligibility: (view: ProfileViewDoc, scored: ScoredWidget | undefined) => boolean;
  primaryAction: { label: string; href: string };
  // Connector whose sync age drives freshness (F); null if none.
  freshnessField: SourceId | null;
  // Grid footprint: "wide" spans two columns on large screens.
  size: "regular" | "wide";
  // Shown when eligibility fails or data is missing.
  empty: { title: string; body: string; action?: { label: string; href: string; disabled?: boolean } };
}

export const widgets: WidgetDefinition[] = [
  {
    id: "eris_readiness",
    personas: ["student"],
    module: "eris",
    label: "Interview readiness",
    requiredIntent: ["avasar_jobs"],
    requiredData: ["skills", "experience"],
    eligibility: (view) => view.erisScore.overall !== null,
    primaryAction: { label: "Start mock interview", href: "/eris" },
    freshnessField: null,
    size: "wide",
    empty: {
      title: "No readiness score yet",
      body: "Pick a target role and confirm a few skills, and we'll score how interview-ready you are for it.",
      action: { label: "Review your skills", href: "/skills" },
    },
  },
  {
    id: "job_matches",
    personas: ["student"],
    module: "avasar",
    label: "Jobs that fit you",
    requiredIntent: ["avasar_jobs"],
    requiredData: ["skills", "experience", "education"],
    // Avasar isn't connected yet (Phase 4), so there is never data to show.
    eligibility: (_view, scored) => Boolean(scored?.data),
    primaryAction: { label: "View matches", href: "/avasar" },
    freshnessField: null,
    size: "regular",
    empty: {
      title: "Connect your Avasar account to see jobs that fit you",
      body: "Internship and job matches ranked against your confirmed skills will appear here.",
      action: { label: "Connect Avasar", href: "/avasar", disabled: true },
    },
  },
  {
    id: "skill_gaps",
    personas: ["student"],
    module: "learn",
    label: "Skills to develop",
    requiredIntent: ["learn_ai_ml", "avasar_jobs"],
    requiredData: ["skills"],
    eligibility: (view) => view.erisScore.gaps.length > 0,
    primaryAction: { label: "Start learning", href: "/learn" },
    freshnessField: null,
    size: "regular",
    empty: {
      title: "No gaps found",
      body: "Either your skills already cover your target role, or there isn't enough confirmed data to tell yet.",
    },
  },
  {
    id: "github_activity",
    personas: ["student", "faculty", "alumni"],
    module: "profile",
    label: "Recent GitHub work",
    requiredIntent: ["build_projects", "avasar_jobs"],
    requiredData: [],
    eligibility: (_view, scored) => scored !== undefined,
    primaryAction: { label: "View projects", href: "/projects" },
    freshnessField: "github",
    size: "regular",
    empty: {
      title: "Connect GitHub to see your projects",
      body: "We'll pull your repositories and languages as evidence for your skills.",
      action: { label: "Go to connections", href: "/connections" },
    },
  },
  {
    id: "profile_completeness",
    personas: ["student", "faculty", "alumni"],
    module: "profile",
    label: "Finish your profile",
    requiredIntent: [],
    requiredData: [],
    eligibility: (_view, scored) => scored !== undefined,
    primaryAction: { label: "Open profile", href: "/profile" },
    freshnessField: null,
    size: "regular",
    empty: { title: "Your profile is complete", body: "Nothing left to add right now." },
  },
  // ─── Faculty / mentor (previews until Collaborate and Meet supply data) ───
  {
    id: "student_matches",
    module: "collaborate",
    label: "Students who match your expertise",
    personas: ["faculty"],
    requiredIntent: [],
    requiredData: [],
    eligibility: () => true,
    primaryAction: { label: "Browse students", href: "/collaborate" },
    freshnessField: null,
    size: "wide",
    preview: {
      body: "Students whose target role and skills match your research areas, with their readiness score and strongest evidence.",
      rows: ["Student · target role · ERIS score", "Student · target role · ERIS score", "Student · target role · ERIS score"],
      waitingOn: "Collaborate's student directory",
    },
    empty: { title: "No matches yet", body: "Add research areas to be matched with students." },
  },
  {
    id: "mentee_requests",
    module: "mentor",
    label: "Mentee requests",
    personas: ["faculty"],
    requiredIntent: [],
    requiredData: [],
    eligibility: () => true,
    primaryAction: { label: "Review requests", href: "/mentor" },
    freshnessField: null,
    size: "regular",
    preview: {
      body: "Students asking for your mentorship, resume reviews or ERIS verification, oldest first.",
      rows: ["Request · student · asked 2 days ago", "Request · student · asked 5 days ago"],
      waitingOn: "mentoring requests in Collaborate",
    },
    empty: { title: "No requests", body: "Requests from students appear here." },
  },
  {
    id: "research_feed",
    module: "meet",
    label: "Papers and events in your areas",
    personas: ["faculty"],
    requiredIntent: [],
    requiredData: [],
    eligibility: () => true,
    primaryAction: { label: "Open Meet", href: "/meet" },
    freshnessField: null,
    size: "regular",
    preview: {
      body: "New papers, seminars and research rooms matched to your interests and ORCID record.",
      rows: ["Paper · venue · this week", "Seminar · room · Thursday"],
      waitingOn: "Tathastu Meet's research rooms",
    },
    empty: { title: "Nothing new", body: "Add research interests to fill this feed." },
  },
  // ─── Alumni (previews until Avasar and Collaborate supply data) ───────────
  {
    id: "top_talent",
    module: "avasar",
    label: "Top student talent",
    personas: ["alumni"],
    requiredIntent: [],
    requiredData: [],
    eligibility: () => true,
    primaryAction: { label: "See candidates", href: "/avasar" },
    freshnessField: null,
    size: "wide",
    preview: {
      body: "Students from your university whose verified skills fit roles like yours, ranked by readiness.",
      rows: ["Candidate · target role · ERIS score", "Candidate · target role · ERIS score", "Candidate · target role · ERIS score"],
      waitingOn: "Avasar's candidate matching",
    },
    empty: { title: "No candidates yet", body: "Add your current role to see matching talent." },
  },
  {
    id: "referral_requests",
    module: "avasar",
    label: "Referral requests",
    personas: ["alumni"],
    requiredIntent: [],
    requiredData: [],
    eligibility: () => true,
    primaryAction: { label: "Review requests", href: "/avasar" },
    freshnessField: null,
    size: "regular",
    preview: {
      body: "Students asking for a referral at your company, with their profile and the role they want.",
      rows: ["Request · student · role", "Request · student · role"],
      waitingOn: "referrals in Avasar",
    },
    empty: { title: "No requests", body: "Turn on referrals in your profile to receive requests." },
  },
  {
    id: "alumni_network",
    module: "collaborate",
    label: "Your alumni network",
    personas: ["alumni"],
    requiredIntent: [],
    requiredData: [],
    eligibility: () => true,
    primaryAction: { label: "Open network", href: "/collaborate" },
    freshnessField: null,
    size: "regular",
    preview: {
      body: "Alumni from your university by company and field, and students who'd like to hear from them.",
      rows: ["Alumnus · company · class of", "Alumnus · company · class of"],
      waitingOn: "Collaborate's alumni directory",
    },
    empty: { title: "No connections yet", body: "Your network appears as more alumni join." },
  },
];

export const WIDGET_IDS = widgets.map((w) => w.id);
export const widgetsFor = (persona: Persona) => widgets.filter((w) => w.personas.includes(persona));
