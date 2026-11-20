"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { emailDeliveries } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import {
  processEmailDeliveries,
  publishTemplateVersion,
  queueEmailDelivery,
  renderTemplateContent,
} from "@/lib/admin/email-engine";
import { requireAdminPermission } from "@/lib/admin/rbac";

export async function saveTemplateVersionAction(
  templateId: string,
  slug: string,
  subject: string,
  htmlBody: string,
  textBody: string,
  preheader: string | null,
  changeNotes: string
) {
  const admin = await requireAdmin();
  await requireAdminPermission("email.templates.publish");

  try {
    const updated = await publishTemplateVersion(
      templateId,
      subject,
      htmlBody,
      textBody,
      preheader,
      changeNotes,
      admin.id,
      admin.email || "admin"
    );

    revalidatePath(`/admin/emails/templates/${slug}`);
    revalidatePath("/admin/emails/templates");
    return { ok: true, version: updated.version };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to publish template" };
  }
}

export async function sendTestEmailAction(
  templateSlug: string,
  recipientEmail: string,
  subject: string,
  htmlBody: string,
  textBody: string
) {
  const admin = await requireAdmin();
  await requireAdminPermission("email.send.test");

  if (!recipientEmail || !recipientEmail.includes("@")) {
    return { ok: false, error: "Please provide a valid test recipient email address." };
  }

  try {
    const delivery = await queueEmailDelivery({
      templateSlug,
      recipient: recipientEmail,
      senderProfile: "support",
      subject: `[TEST PREVIEW] ${subject}`,
      htmlBody: renderTemplateContent(htmlBody, {
        student_name: admin.name || "Test User",
        student_email: recipientEmail,
        ticket_id: "TATH-2026-TEST",
        ticket_subject: "Sample Test Verification",
        ticket_status: "Open",
        ticket_priority: "Normal",
        assigned_agent: "Antigravity Agent",
        message_body: "This is a test notification generated from the Email Template Studio.",
        tracking_url: "https://www.aitathastu.com/support/tickets/TATH-2026-TEST",
        action_url: "https://www.aitathastu.com/dashboard",
        brand_name: "AI Tathastu",
        support_email: "support.aitathastu@gmail.com",
      }),
      textBody: renderTemplateContent(textBody, {
        student_name: admin.name || "Test User",
        action_url: "https://www.aitathastu.com/dashboard",
        support_email: "support.aitathastu@gmail.com",
      }),
    });

    // Attempt processing immediately
    await processEmailDeliveries(5);

    revalidatePath("/admin/emails/deliveries");
    return { ok: true, deliveryId: delivery.id };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to queue test email" };
  }
}

export async function triggerOutboxDeliveryAction() {
  const admin = await requireAdmin();
  await requireAdminPermission("email.delivery.retry");

  try {
    const result = await processEmailDeliveries(25);
    revalidatePath("/admin/emails/deliveries");
    return { ok: true, ...result };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to process outbox" };
  }
}

/**
 * Puts one failed email back in the queue for exactly one more attempt. It is sent by the next outbox run
 * (or "Process due deliveries"); nothing is sent here. Only a failed email can be retried.
 */
export async function retryFailedDeliveryAction(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminPermission("email.delivery.retry");
  const id = String(formData.get("id") || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/emails/deliveries?retry=error");

  const [row] = await db
    .update(emailDeliveries)
    .set({ status: "queued", nextAttemptAt: new Date(), maxAttempts: sql`${emailDeliveries.attempts} + 1` })
    .where(and(eq(emailDeliveries.id, id), eq(emailDeliveries.status, "failed")))
    .returning({ id: emailDeliveries.id, recipient: emailDeliveries.recipient });

  if (row) {
    await recordAdminAudit({ actorId: admin.id, actorEmail: admin.email || "admin", action: "email.delivery_retry", resource: "email_deliveries", targetId: row.id });
  }
  revalidatePath("/admin/emails/deliveries");
  redirect(`/admin/emails/deliveries?retry=${row ? "queued" : "error"}`);
}

