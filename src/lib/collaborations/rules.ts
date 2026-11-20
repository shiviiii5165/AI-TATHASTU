// Pure business rules for AVSAR Collaborations: no database, no framework. Unit-tested in rules.test.ts.
import type { CollabCategory, CollabCreatorType, CollabStatus } from "@/db/schema-collaborations";

export const DAY_MS = 86_400_000;
/** Inactivity policy: reminders on days 45 and 55, expiry on day 60 without a renewal. */
export const EXPIRY_DAYS = 60;
export const REMINDER_DAYS = [45, 55] as const;
/** An owner who hasn't managed an active team for this long is flagged for an administrator. */
export const OWNER_INACTIVE_DAYS = 90;

export const CATEGORY_LABEL: Record<CollabCategory, string> = {
  project: "Project",
  hackathon: "Hackathon Team",
  research: "Research Collaboration",
  learning_group: "Learning Group",
};

export const STATUS_LABEL: Record<CollabStatus, string> = {
  draft: "Draft",
  recruiting: "Recruiting",
  paused: "Paused",
  team_full: "Team full",
  in_progress: "In progress",
  completed: "Completed",
  closed: "Closed",
  expired: "Expired",
  suspended: "Suspended",
};

export const CREATOR_LABEL: Record<CollabCreatorType, string> = {
  student: "Student-led",
  faculty: "Faculty-led",
  alumni: "Alumni-led",
  admin: "AI Tathastu team",
  community: "Community-led",
};

/** Statuses a visitor can find in Discover. */
export const DISCOVERABLE: readonly CollabStatus[] = ["recruiting", "team_full", "in_progress"];
/** Statuses whose detail page is public (anything once published, except moderation removals). */
export const PUBLICLY_VISIBLE: readonly CollabStatus[] = ["recruiting", "paused", "team_full", "in_progress", "completed", "closed", "expired"];

/**
 * Who a post says its creator is. Only server-side records count: an operator, then an operator-granted
 * faculty/alumni verification. A persona chosen at sign-up is never enough to be "Faculty-led".
 */
export function creatorTypeFor(input: { isOperator: boolean; verification: "faculty" | "alumni" | null; persona: "student" | "faculty" | "alumni" }): CollabCreatorType {
  if (input.isOperator) return "admin";
  if (input.verification) return input.verification;
  return input.persona === "student" ? "student" : "community";
}

/** Owner-driven status changes. Suspension and restoration are administrative and handled separately. */
export type OwnerAction = "publish" | "pause" | "resume" | "start" | "complete" | "close" | "reopen" | "renew";

const OWNER_TRANSITIONS: Record<OwnerAction, { from: readonly CollabStatus[]; to: CollabStatus | "recruiting_or_full" }> = {
  publish: { from: ["draft"], to: "recruiting" },
  pause: { from: ["recruiting", "team_full"], to: "paused" },
  resume: { from: ["paused"], to: "recruiting_or_full" },
  start: { from: ["recruiting", "paused", "team_full"], to: "in_progress" },
  complete: { from: ["in_progress", "team_full"], to: "completed" },
  close: { from: ["recruiting", "paused", "team_full", "in_progress", "expired"], to: "closed" },
  reopen: { from: ["closed"], to: "recruiting_or_full" },
  renew: { from: ["recruiting", "paused", "expired"], to: "recruiting_or_full" },
};

export function isOwnerAction(v: unknown): v is OwnerAction {
  return typeof v === "string" && v in OWNER_TRANSITIONS;
}

/**
 * The status an owner action leads to, or null when not allowed from `from`. "recruiting_or_full" resolves on the
 * member count: a renewed or resumed post that is already at capacity is a full team, not recruiting.
 * Renewing a post that is still active keeps its status and only resets the inactivity clock.
 */
export function nextStatus(from: CollabStatus, action: OwnerAction, members: number, capacity: number): CollabStatus | null {
  const t = OWNER_TRANSITIONS[action];
  if (!t.from.includes(from)) return null;
  if (action === "renew" && from !== "expired") return from;
  if (t.to === "recruiting_or_full") return members >= capacity ? "team_full" : "recruiting";
  return t.to;
}

/** When a post's inactivity clock started: its last renewal, else its publication. */
export const activitySince = (p: { renewedAt: Date | null; publishedAt: Date | null; createdAt: Date }) => p.renewedAt ?? p.publishedAt ?? p.createdAt;

/** Statuses the 60-day clock applies to: a listing that is visibly asking for people. */
export const EXPIRY_TRACKED: readonly CollabStatus[] = ["recruiting", "paused"];

export type LifecycleStep = { kind: "remind"; stage: 1 | 2; daysLeft: number } | { kind: "expire" } | null;

/** What the daily lifecycle job does to one post now. Each reminder is sent once (reminderStage records it). */
export function lifecycleStep(p: { status: CollabStatus; renewedAt: Date | null; publishedAt: Date | null; createdAt: Date; reminderStage: number }, now: Date): LifecycleStep {
  if (!EXPIRY_TRACKED.includes(p.status)) return null;
  const days = Math.floor((now.getTime() - activitySince(p).getTime()) / DAY_MS);
  if (days >= EXPIRY_DAYS) return { kind: "expire" };
  if (days >= REMINDER_DAYS[1] && p.reminderStage < 2) return { kind: "remind", stage: 2, daysLeft: EXPIRY_DAYS - days };
  if (days >= REMINDER_DAYS[0] && p.reminderStage < 1) return { kind: "remind", stage: 1, daysLeft: EXPIRY_DAYS - days };
  return null;
}

/** Can a renewal bring this expired post back? Not once its application deadline has passed. */
export function canRenew(p: { status: CollabStatus; deadline: string | null }, today: string): boolean {
  if (!["recruiting", "paused", "expired"].includes(p.status)) return false;
  return !p.deadline || p.deadline >= today;
}

/** Normalised skill tag: trimmed, single-spaced, lower case, at most 40 characters. */
export const normalizeSkill = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 40);
