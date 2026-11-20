"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminPermission } from "@/lib/admin/rbac";
import {
  clearOwnerReview,
  hideMessage,
  removePost,
  resolveReport,
  restorePost,
  revokeCreator,
  suspendPost,
  transferOwnership,
  verifyCreator,
  type ModResult,
} from "@/lib/collaborations/moderation";

// Every action: permission first, then a required reason, then the change (which records a moderation action and
// an admin audit entry). Results come back as a notice on the page they were sent from.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const back = (fd: FormData) => {
  const to = field(fd, "back");
  return /^\/admin\/collaborations(\/[0-9a-f-]{36})?(\?[\w=&%-]*)?$/i.test(to) ? to : "/admin/collaborations";
};

function finish(fd: FormData, r: ModResult | { ok: false; error: string }, done: string): never {
  const to = back(fd);
  revalidatePath("/admin/collaborations", "layout");
  const sep = to.includes("?") ? "&" : "?";
  redirect(`${to}${sep}${r.ok ? `notice=${encodeURIComponent(done)}` : `error=${encodeURIComponent(r.error)}`}`);
}

function needs(fd: FormData, ...keys: string[]): { ok: false; error: string } | null {
  for (const k of keys) {
    const v = field(fd, k);
    if (!v) return { ok: false, error: k === "reason" ? "A reason is required and is kept in the moderation history." : `Missing ${k}.` };
    if (k.endsWith("Id") && !UUID.test(v)) return { ok: false, error: `Invalid ${k}.` };
    if (k === "reason" && v.length > 500) return { ok: false, error: "Keep the reason under 500 characters." };
  }
  return null;
}

export async function suspendCollaborationAction(fd: FormData) {
  const { user } = await requireAdminPermission("collaborations.moderate");
  finish(fd, needs(fd, "postId", "reason") ?? (await suspendPost(user, field(fd, "postId"), field(fd, "reason"))), "Suspended.");
}

export async function restoreCollaborationAction(fd: FormData) {
  const { user } = await requireAdminPermission("collaborations.moderate");
  finish(fd, needs(fd, "postId", "reason") ?? (await restorePost(user, field(fd, "postId"), field(fd, "reason"))), "Restored.");
}

export async function removeCollaborationAction(fd: FormData) {
  const { user } = await requireAdminPermission("collaborations.moderate");
  finish(fd, needs(fd, "postId", "reason") ?? (await removePost(user, field(fd, "postId"), field(fd, "reason"))), "Removed. History is kept.");
}

export async function resolveCollabReportAction(fd: FormData) {
  const { user } = await requireAdminPermission("collaborations.moderate");
  const outcome = field(fd, "outcome") === "actioned" ? "actioned" : "dismissed";
  finish(fd, needs(fd, "reportId", "reason") ?? (await resolveReport(user, field(fd, "reportId"), outcome, field(fd, "reason"))), "Report resolved.");
}

export async function hideCollabMessageAction(fd: FormData) {
  const { user } = await requireAdminPermission("collaborations.moderate");
  finish(fd, needs(fd, "messageId", "reason") ?? (await hideMessage(user, field(fd, "messageId"), field(fd, "reason"))), "Message hidden.");
}

export async function transferCollaborationAction(fd: FormData) {
  const { user } = await requireAdminPermission("collaborations.manage");
  finish(fd, needs(fd, "postId", "memberId", "reason") ?? (await transferOwnership(user, field(fd, "postId"), field(fd, "memberId"), field(fd, "reason"))), "Ownership transferred.");
}

export async function clearCollabReviewAction(fd: FormData) {
  const { user } = await requireAdminPermission("collaborations.manage");
  finish(fd, needs(fd, "postId", "reason") ?? (await clearOwnerReview(user, field(fd, "postId"), field(fd, "reason"))), "Review cleared.");
}

export async function verifyCollabCreatorAction(fd: FormData) {
  const { user } = await requireAdminPermission("collaborations.manage");
  const kind = field(fd, "kind");
  const email = field(fd, "email");
  const r = needs(fd, "reason") ?? (kind !== "faculty" && kind !== "alumni" ? { ok: false as const, error: "Choose faculty or alumni." } : !/^\S+@\S+\.\S+$/.test(email) ? { ok: false as const, error: "Enter the account's email." } : await verifyCreator(user, email, kind, field(fd, "reason")));
  finish(fd, r, "Creator verified.");
}

export async function revokeCollabCreatorAction(fd: FormData) {
  const { user } = await requireAdminPermission("collaborations.manage");
  finish(fd, needs(fd, "userId", "reason") ?? (await revokeCreator(user, field(fd, "userId"), field(fd, "reason"))), "Verification revoked.");
}
