"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
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

