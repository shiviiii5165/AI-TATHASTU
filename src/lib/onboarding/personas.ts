// Client-safe persona catalogue: Step 0 copy and the form definitions for the
// faculty and alumni steps. The same definitions render the forms
// (PersonaStepForm) and build their zod schemas (schemaFor), so the fields and
// their validation can't drift apart.

import { z } from "zod";

import type { Persona } from "@/db/schema";
import { CAREER_ROLES } from "@/lib/onboarding/catalog";

export const PERSONA_COPY: Record<Persona, { title: string; label: string; blurb: string; gets: string[] }> = {
  student: {
    title: "I am a Student",
    label: "Student",
    blurb: "Build my skills, find opportunities and grow my career.",
    gets: ["Internships & jobs", "Learning resources", "Projects and mentors"],
  },
  faculty: {
    title: "I am a Faculty",
    label: "Faculty",
    blurb: "Teach, research and guide students.",
    gets: ["Find and mentor students", "Collaborate on research", "Share opportunities"],
  },
  alumni: {
    title: "I am an Alumni",
    label: "Alumni",
    blurb: "Stay connected, support students and give back.",
    gets: ["Mentor and recruit", "Share opportunities", "Grow the network"],
  },
};

export const ACADEMIC_TITLES = [
  "Professor",
  "Associate Professor",
  "Assistant Professor",
  "Lecturer",
  "Research Scientist",
  "Postdoctoral Researcher",
  "Teaching Fellow",
  "Industry Mentor",
  "Other",
] as const;

export const MAX_MENTEES = 50;

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "select" | "number" | "checkbox";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: readonly { value: string; label: string }[];
  autoComplete?: string;
  maxLength?: number;
  min?: number;
  max?: number;
  wide?: boolean;
};

const opts = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));

export const PERSONA_FORMS = {
  // The institution and degree come from the shared academic block (AcademicFields).
  faculty_profile: [
    { name: "department", label: "Department", type: "text", required: true, placeholder: "Computer Science and Engineering", maxLength: 160 },
    { name: "academicTitle", label: "Title", type: "select", required: true, options: opts(ACADEMIC_TITLES), placeholder: "Select your title" },
  ],
  mentorship: [
    {
      name: "capacity", label: "How many students can you mentor at a time?", type: "number", required: true, min: 0, max: MAX_MENTEES,
      hint: "0 if you're not taking mentees right now. You can change this any time.", wide: true,
    },
    { name: "canVerifyEris", label: "I can verify students' ERIS readiness scores", type: "checkbox", hint: "Review a student's evidence and confirm their score for a role.", wide: true },
    { name: "canReviewResumes", label: "I can review resumes", type: "checkbox", hint: "Give students feedback on their resume before they apply.", wide: true },
  ],
  // Entirely the shared academic block (institution, degree, specialization, graduation year).
  alumni_profile: [],
  professional_profile: [
    { name: "company", label: "Current company", type: "text", required: true, autoComplete: "organization", maxLength: 160 },
    { name: "jobTitle", label: "Job title", type: "text", required: true, autoComplete: "organization-title", placeholder: "ML Engineer", maxLength: 120 },
    {
      name: "careerArea", label: "Closest area", type: "select", options: CAREER_ROLES.filter((r) => r.id !== "still_exploring").map((r) => ({ value: r.id, label: r.label })),
      placeholder: "Select an area", hint: "Helps us match you with students heading the same way.", wide: true,
    },
  ],
  give_back: [
    { name: "mentor", label: "Willing to mentor", type: "checkbox", hint: "Students in your field can ask you for guidance.", wide: true },
    { name: "refer", label: "Willing to refer for jobs", type: "checkbox", hint: "Strong candidates can ask for a referral at your company.", wide: true },
    { name: "speak", label: "Open to guest speaking", type: "checkbox", hint: "Talks, panels and AMAs for students.", wide: true },
  ],
} as const satisfies Record<string, readonly FieldDef[]>;

export type PersonaFormStep = keyof typeof PERSONA_FORMS;
export type FormValues = Record<string, string>;
export type PersonaFormState = { values: FormValues; errors?: Partial<Record<string, string>>; formError?: string };

const collapse = (s: string) => s.replace(/\s+/g, " ");

/** zod schema for a form, built from its field definitions. Checkboxes arrive as "on" or absent. */
export function schemaFor(step: PersonaFormStep) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of PERSONA_FORMS[step] as readonly FieldDef[]) {
    const required = `${f.label.replace(/\?$/, "")} is required.`;
    if (f.type === "checkbox") shape[f.name] = z.string().optional().transform((v) => v === "on");
    else if (f.type === "number") {
      const n = z
        .number({ error: "Enter a number." })
        .int("Enter a whole number.")
        .min(f.min ?? 0, `Use ${f.min ?? 0} or more.`)
        .max(f.max ?? Number.MAX_SAFE_INTEGER, `Use ${f.max} or less.`);
      shape[f.name] = f.required
        ? z.string().trim().min(1, required).transform(Number).pipe(n)
        : z.string().trim().transform((v) => (v ? Number(v) : null)).pipe(n.nullable());
    } else if (f.type === "select") {
      const values = f.options!.map((o) => o.value) as [string, ...string[]];
      shape[f.name] = f.required
        ? z.enum(values, { error: `Choose your ${f.label.toLowerCase()}.` })
        : z.union([z.literal(""), z.enum(values)]).transform((v) => v || null);
    } else {
      const max = f.maxLength ?? 200;
      const base = z.string().trim().max(max, `Keep this under ${max} characters.`).transform(collapse);
      shape[f.name] = f.required ? z.string().trim().min(1, required).max(max, `Keep this under ${max} characters.`).transform(collapse) : base.transform((v) => v || null);
    }
  }
  return z.object(shape);
}

/** FormData → raw string values for the step's fields (re-rendered on validation errors). */
export function readForm(step: PersonaFormStep, formData: FormData): FormValues {
  return Object.fromEntries((PERSONA_FORMS[step] as readonly FieldDef[]).map((f) => [f.name, String(formData.get(f.name) ?? "")]));
}
