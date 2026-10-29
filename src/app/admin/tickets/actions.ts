"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { queueEmailDelivery, renderTemplateContent } from "@/lib/admin/email-engine";
import { requireAdminPermission } from "@/lib/admin/rbac";
import {
  addTicketMessage,
  assignTicket,
  createSupportTicket,
  type TicketPriority,
  type TicketStatus,
  updateTicketStatus,
} from "@/lib/admin/tickets";

export async function createTicketAction(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminPermission("support.tickets.create");

  const requesterEmail = String(formData.get("requesterEmail") || "").trim();
  const requesterName = String(formData.get("requesterName") || "").trim();
  const subject = String(formData.get("subject") || "").trim();
  const category = String(formData.get("category") || "general").trim();
  const priority = (String(formData.get("priority") || "medium") as TicketPriority);
  const initialMessage = String(formData.get("initialMessage") || "").trim();
  const sourceChannel = String(formData.get("sourceChannel") || "manual").trim();

  if (!requesterEmail || !subject || !initialMessage) {
    return { ok: false, error: "Email, subject, and initial message are required." };
  }

  try {
    const ticket = await createSupportTicket({
      requesterEmail,
      requesterName,
      subject,
      category,
      priority,
      initialMessage,
      sourceChannel,
    });

    // Queue acknowledgement email to requester
    await queueEmailDelivery({
      templateSlug: "ticket_received",
      recipient: requesterEmail,
      senderProfile: "support",
      subject: `[${ticket.ticketNumber}] We received your request: ${subject}`,
      htmlBody: renderTemplateContent(
        `<p>Hi {{student_name}},</p><p>We have received your ticket <strong>{{ticket_id}}</strong>. Our team is reviewing it.</p>`,
        { student_name: requesterName || "Student", ticket_id: ticket.ticketNumber }
      ),
      textBody: `Hi ${requesterName || "Student"}, your ticket ${ticket.ticketNumber} has been received.`,
    });

    revalidatePath("/admin/tickets");
    revalidatePath("/admin");
    return { ok: true, ticketId: ticket.id };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create ticket" };
  }
}

export async function postTicketMessageAction(
  ticketId: string,
  content: string,
  isInternalNote: boolean
) {
  const admin = await requireAdmin();
  await requireAdminPermission(isInternalNote ? "support.tickets.note" : "support.tickets.reply");

  if (!content.trim()) {
    return { ok: false, error: "Message content cannot be empty." };
  }

  try {
    const message = await addTicketMessage({
      ticketId,
      authorId: admin.id,
      authorName: admin.name || "AI Tathastu Support",
      authorEmail: admin.email || undefined,
      isInternalNote,
      content: content.trim(),
    });

    // If it's a public reply, queue notification email to student
    if (!isInternalNote && admin.email) {
      // Background email queue
      await queueEmailDelivery({
        templateSlug: "ticket_reply",
        recipient: admin.email, // In production, resolved from ticket requesterEmail
        senderProfile: "support",
        subject: `New reply on your ticket`,
        htmlBody: renderTemplateContent(
          `<p>An agent posted a reply on your support ticket:</p><blockquote>{{message_body}}</blockquote>`,
          { message_body: content.trim() }
        ),
        textBody: `Agent reply: ${content.trim()}`,
      });
    }

    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath("/admin/tickets");
    return { ok: true, messageId: message.id };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to post message" };
  }
}

export async function changeTicketStatusAction(
  ticketId: string,
  newStatus: TicketStatus,
  resolutionNotes?: string
) {
  const admin = await requireAdmin();
  await requireAdminPermission("support.tickets.close");

  try {
    await updateTicketStatus(ticketId, newStatus, admin.email || "admin", resolutionNotes);
    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath("/admin/tickets");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update status" };
  }
}

export async function assignTicketAction(ticketId: string, assignedToId: string | null) {
  const admin = await requireAdmin();
  await requireAdminPermission("support.tickets.assign");

  try {
    await assignTicket(ticketId, assignedToId, admin.email || "admin");
    revalidatePath(`/admin/tickets/${ticketId}`);
    revalidatePath("/admin/tickets");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to assign ticket" };
  }
}

