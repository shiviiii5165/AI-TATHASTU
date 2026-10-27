// Client-safe catalogue of the 10 profile_facts field groups. The worker's
// extraction output must use these group and field names.

export type FieldGroupId =
  | "identity"
  | "contact"
  | "education"
  | "experience"
  | "projects"
  | "skills"
  | "certifications"
  | "achievements"
  | "publications"
  | "languages";

export type FieldGroupDef = {
  id: FieldGroupId;
  label: string;
  // Repeatable groups hold several entries, each tied together by record_key.
  repeatable: boolean;
  // Fields offered when the user adds an entry by hand.
  fields: { name: string; label: string }[];
  addLabel?: string;
};

export const FIELD_GROUPS: FieldGroupDef[] = [
  {
    id: "identity",
    label: "Identity",
    repeatable: false,
    fields: [
      { name: "full_name", label: "Full name" },
      { name: "headline", label: "Headline" },
      { name: "location", label: "Location" },
    ],
  },
  {
    id: "contact",
    label: "Contact & links",
    repeatable: false,
    fields: [
      { name: "email", label: "Email" },
      { name: "phone", label: "Phone" },
      { name: "linkedin_url", label: "LinkedIn" },
      { name: "github_url", label: "GitHub" },
      { name: "website", label: "Website" },
    ],
  },
  {
    id: "education",
    label: "Education",
    repeatable: true,
    addLabel: "Add education",
    fields: [
      { name: "institution", label: "Institution" },
      { name: "degree", label: "Degree" },
      { name: "field_of_study", label: "Field of study" },
      { name: "start_date", label: "Start" },
      { name: "end_date", label: "End" },
      { name: "grade", label: "Grade" },
    ],
  },
  {
    id: "experience",
    label: "Experience",
    repeatable: true,
    addLabel: "Add experience",
    fields: [
      { name: "organization", label: "Organization" },
      { name: "role", label: "Role" },
      { name: "start_date", label: "Start" },
      { name: "end_date", label: "End" },
      { name: "description", label: "What you did" },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    repeatable: true,
    addLabel: "Add project",
    fields: [
      { name: "title", label: "Title" },
      { name: "description", label: "Description" },
      { name: "technologies", label: "Technologies" },
      { name: "url", label: "Link" },
    ],
  },
  {
    id: "skills",
    label: "Skills",
    repeatable: true,
    addLabel: "Add skill",
    fields: [{ name: "skill", label: "Skill" }],
  },
  {
    id: "certifications",
    label: "Certifications",
    repeatable: true,
    addLabel: "Add certification",
    fields: [
      { name: "name", label: "Name" },
      { name: "issuer", label: "Issuer" },
      { name: "date", label: "Date" },
    ],
  },
  {
    id: "achievements",
    label: "Achievements",
    repeatable: true,
    addLabel: "Add achievement",
    fields: [
      { name: "title", label: "Title" },
      { name: "description", label: "Description" },
      { name: "date", label: "Date" },
    ],
  },
  {
    id: "publications",
    label: "Publications",
    repeatable: true,
    addLabel: "Add publication",
    fields: [
      { name: "title", label: "Title" },
      { name: "venue", label: "Venue" },
      { name: "date", label: "Date" },
      { name: "url", label: "Link" },
    ],
  },
  {
    id: "languages",
    label: "Languages",
    repeatable: true,
    addLabel: "Add language",
    fields: [
      { name: "language", label: "Language" },
      { name: "proficiency", label: "Proficiency" },
    ],
  },
];


export function fieldLabel(groupId: string, fieldName: string) {
  const group = FIELD_GROUPS.find((g) => g.id === groupId);
  return (
    group?.fields.find((f) => f.name === fieldName)?.label ??
    fieldName.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
  );
}

export type ConfidenceLevel = "high" | "medium" | "low";

/** High ≥ 85 %, Medium ≥ 60 %, Low below that (or unscored). */
export function confidenceLevel(confidence: number | null): ConfidenceLevel {
  if (confidence === null) return "low";
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}
