// Input schemas for AVSAR Collaborations. Only the fields listed here are ever read from a request: owner, creator
// type, status, counts and ids come from the server (mass-assignment protection).
import { createHash } from "node:crypto";

import { z } from "zod";

import { COLLAB_CATEGORIES, COLLAB_MODES, COLLAB_REPORT_REASONS, COLLAB_STAGES } from "@/db/schema-collaborations";

import { CATEGORY_FIELDS, REQUIRED_DETAIL } from "./fields";
import { normalizeSkill } from "./rules";

// Control characters other than tab/newline are stripped; markup is stored as text and React escapes it on output.
const clean = (s: string) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
const text = (max: number) => z.string().transform(clean).pipe(z.string().max(max, `Keep this under ${max} characters.`));
const required = (max: number, label: string) =>
  z.string({ error: `${label} is required.` }).transform(clean).pipe(z.string().min(1, `${label} is required.`).max(max, `Keep ${label.toLowerCase()} under ${max} characters.`));

/** http(s) only: no javascript:, data: or relative links reach anyone's browser. */
export const safeUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && !u.username && !u.password;
    } catch {
      return false;
    }
  }, "Use a full http(s) link, like https://github.com/you/project.");

const skills = z
  .array(z.string())
  .max(20, "Add at most 20 skills.")
  .transform((list) => Array.from(new Set(list.map(normalizeSkill).filter(Boolean))));

const role = z.object({
  title: required(60, "Role title"),
  count: z.coerce.number().int().min(1, "Each role needs at least one position.").max(20),
  skills: skills.default([]),
});

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date.")
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Use a valid date.");
const optionalDate = z.union([isoDate, z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));

// Category-specific fields are stored together in `details`; keys outside these lists are dropped.
export { CATEGORY_FIELDS } from "./fields";

export const postInput = z
  .object({
    category: z.enum(COLLAB_CATEGORIES, { error: "Choose a category." }),
    title: required(120, "Title").pipe(z.string().min(6, "Give the title at least 6 characters.")),
    summary: required(300, "Short description"),
    problem: text(3000).default(""),
    objectives: text(3000).default(""),
    outcome: text(2000).default(""),
    stage: z.enum(COLLAB_STAGES, { error: "Choose a project stage." }).default("idea"),
    roles: z.array(role).min(1, "Add at least one role you need.").max(10, "Add at most 10 roles."),
    skills: skills.default([]),
    experience: text(200).default(""),
    commitment: text(120).default(""),
    duration: text(120).default(""),
    mode: z.enum(COLLAB_MODES, { error: "Choose remote, hybrid or in person." }).default("remote"),
    location: text(120).optional().transform((v) => v || null),
    startDate: optionalDate,
    deadline: optionalDate,
    links: z.array(safeUrl).max(5, "Add at most 5 links.").default([]),
    details: z.record(z.string(), z.string()).default({}),
  })
  .transform((v, ctx) => {
    const allowed = CATEGORY_FIELDS[v.category];
    const details: Record<string, string> = {};
    for (const f of allowed) {
      const value = clean(String(v.details[f.key] ?? "")).slice(0, f.max);
      if (value) details[f.key] = value;
    }
    const need = REQUIRED_DETAIL[v.category];
    if (need && !details[need]) {
      const label = allowed.find((f) => f.key === need)!.label;
      ctx.addIssue({ code: "custom", path: ["details", need], message: `${label} is required for this category.` });
    }
    if (v.mode !== "remote" && !v.location) ctx.addIssue({ code: "custom", path: ["location"], message: "Add a location for hybrid or in-person teams." });
    if (v.startDate && v.deadline && v.deadline > v.startDate) {
      ctx.addIssue({ code: "custom", path: ["deadline"], message: "The application deadline should be on or before the start date." });
    }
    const capacity = v.roles.reduce((n, r) => n + r.count, 0);
    if (capacity > 50) ctx.addIssue({ code: "custom", path: ["roles"], message: "A team can have at most 50 open positions." });
    // Post-level skills include every role's skills, so filtering by skill finds the post.
    const allSkills = Array.from(new Set([...v.skills, ...v.roles.flatMap((r) => r.skills)])).slice(0, 30);
    return { ...v, details, skills: allSkills, capacity };
  });

export type PostInput = z.output<typeof postInput>;

/** A deadline must be in the future to publish; drafts may hold any date. */
export function publishProblems(p: { deadline: string | null }, today: string): Record<string, string> {
  return p.deadline && p.deadline < today ? { deadline: "The application deadline has passed. Choose a later date." } : {};
}

/** Same owner, same normalized title and summary: used to refuse a duplicate active post. */
export function contentHash(p: { title: string; summary: string }) {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return createHash("sha256").update(`${norm(p.title)}\n${norm(p.summary)}`).digest("hex").slice(0, 32);
}

/** Obvious spam: many links in the text, or one character repeated at length. Kept deliberately conservative. */
export function looksLikeSpam(...texts: string[]): boolean {
  const all = texts.join(" ");
  const urls = all.match(/https?:\/\//gi)?.length ?? 0;
  return urls > 5 || /(.)\1{24,}/u.test(all);
}

export const applicationInput = z.object({
  role: text(60).optional().transform((v) => v || null),
  intro: required(600, "Introduction"),
  skills: skills.default([]),
  motivation: required(1500, "Motivation"),
  links: z.array(safeUrl).max(3, "Add at most 3 links.").default([]),
});

export const messageInput = z.object({ body: required(2000, "Message") });
export const enquiryInput = z.object({ body: required(1000, "Question") });

export const reportInput = z.object({
  targetType: z.enum(["post", "message", "thread"]),
  targetId: z.uuid(),
  reason: z.enum(COLLAB_REPORT_REASONS),
  details: text(1000).default(""),
});

export const reasonInput = required(500, "Reason");

export const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(COLLAB_CATEGORIES).optional(),
  skill: z.string().trim().max(40).optional(),
  creator: z.enum(["student", "faculty", "alumni", "admin", "community"]).optional(),
  mode: z.enum(COLLAB_MODES).optional(),
  stage: z.enum(COLLAB_STAGES).optional(),
  open: z.enum(["1"]).optional(),
  sort: z.enum(["newest", "deadline", "open"]).default("newest"),
  page: z.coerce.number().int().min(1).max(500).default(1),
});

export type ListQuery = z.output<typeof listQuery>;

/** First error message per field, for the form. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}
