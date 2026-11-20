// The public shape of a collaboration. This allow-list is the only way a post leaves the server: no owner id,
// email, content hash, moderation fields or internal timestamps. Tested in public.test.ts.
import type { CollabPost } from "@/db/schema-collaborations";

import { CATEGORY_LABEL, CREATOR_LABEL, STATUS_LABEL } from "./rules";

export type PublicPost = {
  id: string;
  title: string;
  summary: string;
  problem: string;
  objectives: string;
  outcome: string;
  category: CollabPost["category"];
  categoryLabel: string;
  stage: CollabPost["stage"];
  status: CollabPost["status"];
  statusLabel: string;
  roles: { title: string; count: number; skills: string[] }[];
  skills: string[];
  capacity: number;
  members: number;
  openPositions: number;
  experience: string;
  commitment: string;
  duration: string;
  mode: CollabPost["mode"];
  location: string | null;
  startDate: string | null;
  deadline: string | null;
  links: string[];
  details: Record<string, string>;
  creator: { name: string; type: CollabPost["creatorType"]; label: string; verified: boolean };
  publishedAt: string | null;
  /** Owner-only: when the 60-day clock started and whether moderators are reviewing it. */
  ownerNote?: { activitySince: string | null; reminderStage: number; suspended: boolean };
};

export function publicPost(p: CollabPost, members: number, ownerName: string | null, opts: { includeStatusNote?: boolean } = {}): PublicPost {
  const out: PublicPost = {
    id: p.id,
    title: p.title,
    summary: p.summary,
    problem: p.problem,
    objectives: p.objectives,
    outcome: p.outcome,
    category: p.category,
    categoryLabel: CATEGORY_LABEL[p.category],
    stage: p.stage,
    status: p.status,
    statusLabel: STATUS_LABEL[p.status],
    roles: (p.roles ?? []).map((r) => ({ title: r.title, count: r.count, skills: r.skills ?? [] })),
    skills: p.skills ?? [],
    capacity: p.capacity,
    members,
    openPositions: Math.max(0, p.capacity - members),
    experience: p.experience,
    commitment: p.commitment,
    duration: p.duration,
    mode: p.mode,
    location: p.location,
    startDate: p.startDate,
    deadline: p.deadline,
    links: p.links ?? [],
    details: p.details ?? {},
    creator: {
      name: ownerName || (p.creatorType === "admin" ? "AI Tathastu" : "AI Tathastu member"),
      type: p.creatorType,
      label: CREATOR_LABEL[p.creatorType],
      // Faculty/alumni labels exist only from an operator-granted verification (see creatorTypeFor).
      verified: p.creatorType === "faculty" || p.creatorType === "alumni" || p.creatorType === "admin",
    },
    publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
  };
  if (opts.includeStatusNote) {
    const since = p.renewedAt ?? p.publishedAt;
    out.ownerNote = { activitySince: since ? new Date(since).toISOString() : null, reminderStage: p.reminderStage, suspended: p.status === "suspended" };
  }
  return out;
}
