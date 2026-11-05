import { careerRoleLabel, PRIORITIES } from "@/lib/onboarding/catalog";

export const roleLabel = (id: string | null) => careerRoleLabel(id) ?? "your target role";
export const priorityLabel = (id: string) => PRIORITIES.find((p) => p.id === id)?.label ?? id;

/** ERIS weights are 0–1 importance for the role. */
export const importance = (weight: number) => (weight >= 0.9 ? "Core" : weight >= 0.6 ? "Important" : "Useful");
