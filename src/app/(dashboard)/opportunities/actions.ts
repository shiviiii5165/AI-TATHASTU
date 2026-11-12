"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { requireOnboardedUser } from "@/lib/dal";
import { getOpportunity, loadStudentSignals, recordInteraction, setSaved } from "@/lib/opportunities/browse";
import type { OppDb } from "@/lib/opportunities/ingest";

const d = db as unknown as OppDb;

/** Save / unsave, with an explicit opt-in to one deadline reminder. Only verified, active listings can be saved. */
export async function toggleSave(formData: FormData) {
  const { user } = await requireOnboardedUser();
  const id = String(formData.get("id") ?? "");
  const save = formData.get("save") === "1";
  const remind = formData.get("remind") === "1";
  if (save) {
    const o = await getOpportunity(d, id, user.id, await loadStudentSignals(d, user.id));
    if (!o) return;
  }
  await setSaved(d, user.id, id, save, remind);
  revalidatePath(`/opportunities/${id}`);
  revalidatePath("/opportunities");
}

/** The student tells us they applied on the official site. Recorded as their statement, never as a verified submission. */
export async function confirmApplied(formData: FormData) {
  const { user } = await requireOnboardedUser();
  const id = String(formData.get("id") ?? "");
  const o = await getOpportunity(d, id, user.id, await loadStudentSignals(d, user.id));
  if (!o || o.interactions.confirmedApplied) return;
  await recordInteraction(d, user.id, id, "confirmed_applied");
  revalidatePath(`/opportunities/${id}`);
}
