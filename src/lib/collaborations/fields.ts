// Category-specific fields: one definition shared by validation (server) and the creation form (client).
import type { CollabCategory } from "@/db/schema-collaborations";

export const CATEGORY_FIELDS: Record<CollabCategory, { key: string; label: string; max: number; placeholder?: string }[]> = {
  project: [{ key: "domain", label: "Domain or industry", max: 80, placeholder: "e.g. Health tech, Sustainability" }],
  hackathon: [
    { key: "event", label: "Hackathon name", max: 100, placeholder: "e.g. Smart India Hackathon 2027" },
    { key: "eventDate", label: "Hackathon date", max: 40, placeholder: "e.g. 14–16 March" },
    { key: "theme", label: "Track or theme", max: 100 },
  ],
  research: [
    { key: "field", label: "Research area", max: 100, placeholder: "e.g. Low-resource NLP" },
    { key: "institution", label: "Lab or institution", max: 120 },
    { key: "publicationGoal", label: "Publication goal", max: 120, placeholder: "e.g. Workshop paper at ACL" },
  ],
  learning_group: [
    { key: "topic", label: "Topic", max: 100, placeholder: "e.g. Graph algorithms" },
    { key: "cadence", label: "Meeting cadence", max: 80, placeholder: "e.g. Saturdays, 1 hour" },
  ],
};

/** Each category's own required detail (Hackathon: the event; Research: the area; Learning Group: the topic). */
export const REQUIRED_DETAIL: Partial<Record<CollabCategory, string>> = { hackathon: "event", research: "field", learning_group: "topic" };
