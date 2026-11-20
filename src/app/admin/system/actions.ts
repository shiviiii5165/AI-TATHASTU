"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAdminAudit } from "@/lib/admin/audit";
import { INCIDENT_STATES, type IncidentState, setIncidentState } from "@/lib/admin/monitoring";
import { requireAdminPermission } from "@/lib/admin/rbac";

/** Moves an incident through its lifecycle. Needs system.manage; every change is audited. Health isn't touched. */
export async function updateIncidentAction(formData: FormData) {
  const ctx = await requireAdminPermission("system.manage");
  const fingerprint = String(formData.get("fingerprint") || "");
  const to = String(formData.get("state") || "") as IncidentState;
  const note = String(formData.get("note") || "");
  if (!/^[0-9a-f]{12}$/.test(fingerprint) || !(INCIDENT_STATES as readonly string[]).includes(to)) redirect("/admin/system?lifecycle=error:Invalid%20request#incidents");

  const res = await setIncidentState(fingerprint, to, ctx.user.email || "admin", note);
  if (res.ok) {
    await recordAdminAudit({ actorId: ctx.user.id, actorEmail: ctx.user.email || "admin", action: "incident.state_change", resource: "monitoring_incidents", targetId: fingerprint, details: { from: res.from, to, note: note.slice(0, 200) || undefined } });
  }
  revalidatePath("/admin/system");
  redirect(`/admin/system?lifecycle=${encodeURIComponent(res.ok ? `ok:Incident ${to}.` : `error:${res.error}`)}#incidents`);
}
