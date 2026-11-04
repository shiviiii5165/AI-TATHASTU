"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { SaveResult } from "@/app/onboarding/actions";
import { db } from "@/db";
import { institutions, users } from "@/db/schema";
import { clearInstitutionCache } from "@/lib/academic/catalog";
import { countryName } from "@/lib/academic/match";
import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { userFactWrites } from "@/lib/onboarding/user-facts";

const id = z.uuid();

async function pending(institutionId: string) {
  if (!id.safeParse(institutionId).success) return null;
  const [row] = await db
    .select()
    .from(institutions)
    .where(and(eq(institutions.id, institutionId), eq(institutions.verificationStatus, "pending")));
  return row ?? null;
}

const operator = async () => (await requireAdminPermission("institutions.manage")).user;

const done = async (admin: { id: string; email: string | null }, action: string, row: { id: string; canonicalName: string }, details: Record<string, unknown> = {}) => {
  await recordAdminAudit({
    actorId: admin.id,
    actorEmail: admin.email ?? "unknown",
    action,
    resource: "institutions",
    targetId: row.id,
    details: { name: row.canonicalName, ...details },
  });
  clearInstitutionCache();
  revalidatePath("/admin/institutions");
  return { ok: true } as const;
};

/** Pending → verified: it appears in everyone's search; its users keep their link. */
export async function approveInstitution(institutionId: string): Promise<SaveResult> {
  const admin = await operator();
  const row = await pending(institutionId);
  if (!row) return { ok: false, error: "That institution isn't pending any more. Refresh the page." };
  const [clash] = await db
    .select({ id: institutions.id })
    .from(institutions)
    .where(and(eq(institutions.verificationStatus, "verified"), eq(sql`lower(${institutions.canonicalName})`, row.canonicalName.toLowerCase()), ne(institutions.id, row.id)));
  if (clash) return { ok: false, error: "A verified institution already has this name. Merge it instead." };
  await db
    .update(institutions)
    .set({ verificationStatus: "verified", source: "admin", reviewedBy: admin.id, reviewedAt: new Date() })
    .where(eq(institutions.id, row.id));
  return done(admin, "institution.approve", row);
}

/**
 * Pending → merged into a verified institution: every user pointing at the
 * pending entry moves to the target (id, name and location), their confirmed
 * university fact is updated, and the pending row is kept as "merged" for the
 * record.
 */
export async function mergeInstitution(institutionId: string, targetId: string): Promise<SaveResult> {
  const admin = await operator();
  const row = await pending(institutionId);
  if (!row) return { ok: false, error: "That institution isn't pending any more. Refresh the page." };
  const [target] = id.safeParse(targetId).success
    ? await db.select().from(institutions).where(and(eq(institutions.id, targetId), eq(institutions.verificationStatus, "verified")))
    : [];
  if (!target) return { ok: false, error: "Choose a verified institution to merge into." };

  const affected = await db.select({ id: users.id }).from(users).where(eq(users.institutionId, row.id));
  const factWrites = (
    await Promise.all(affected.map((u) => userFactWrites(u.id, [{ group: "identity", field: "university", value: target.canonicalName }])))
  ).flat();
  await db.batch([
    db
      .update(users)
      .set({
        institutionId: target.id,
        university: target.canonicalName,
        city: target.city,
        state: target.state,
        country: countryName(target.countryCode) || null,
        updatedAt: new Date(),
      })
      .where(eq(users.institutionId, row.id)),
    db
      .update(institutions)
      .set({ verificationStatus: "merged", mergedInto: target.id, reviewedBy: admin.id, reviewedAt: new Date() })
      .where(eq(institutions.id, row.id)),
    ...factWrites,
  ]);
  return done(admin, "institution.merge", row, { targetId: target.id, usersMoved: affected.length });
}

/** Pending → rejected: users keep the typed text but lose the link, and pick again next time they edit. */
export async function rejectInstitution(institutionId: string): Promise<SaveResult> {
  const admin = await operator();
  const row = await pending(institutionId);
  if (!row) return { ok: false, error: "That institution isn't pending any more. Refresh the page." };
  await db.batch([
    db.update(users).set({ institutionId: null, updatedAt: new Date() }).where(eq(users.institutionId, row.id)),
    db
      .update(institutions)
      .set({ verificationStatus: "rejected", reviewedBy: admin.id, reviewedAt: new Date() })
      .where(eq(institutions.id, row.id)),
  ]);
  return done(admin, "institution.reject", row);
}
