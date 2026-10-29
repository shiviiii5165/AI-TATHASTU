import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  type EmailDelivery,
  type EmailTemplate,
  emailDeliveries,
  emailTemplates,
  emailTemplateVersions,
  type TemplateStatus,
} from "@/db/schema";
import { isEmailConfigured, sendEmail, type SenderProfile } from "@/lib/email";
import {
  APPROVED_VARIABLES,
  escapeHtml,
  renderTemplateContent,
  validateTemplateVariables,
  type VariableKey,
} from "./email-template-utils";
export {
  APPROVED_VARIABLES,
  escapeHtml,
  renderTemplateContent,
  validateTemplateVariables,
  type VariableKey,
};
import { recordAdminAudit } from "./audit";

// Complete starter templates library
export const STARTER_TEMPLATES = [
  {
    slug: "welcome",
    name: "Welcome to AI Tathastu",
    category: "account",
    description: "Sent to newly registered students upon account creation",
    subject: "Welcome to AI Tathastu, {{student_name}}!",
    preheader: "Your Dreams. Our Intelligence. Tathastu.",
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
  <h2 style="color: #0f172a; font-size: 24px; font-weight: 800;">Welcome to AI Tathastu</h2>
  <p style="font-size: 16px; line-height: 1.6;">Hi {{student_name}},</p>
  <p style="font-size: 16px; line-height: 1.6;">We're thrilled to have you onboard. AI Tathastu helps you map your skills, analyze GitHub repositories, and connect with academic opportunities.</p>
  <div style="margin: 32px 0;">
    <a href="{{action_url}}" style="background: #e11d48; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Start Building Your Profile</a>
  </div>
  <p style="font-size: 14px; color: #64748b;">If you have any questions, our support team is always here to help at {{support_email}}.</p>
</div>`,
    textBody: `Welcome to AI Tathastu, {{student_name}}!

We're thrilled to have you onboard. AI Tathastu helps you map your skills, analyze GitHub repositories, and connect with academic opportunities.

Start building your profile: {{action_url}}

If you have any questions, write to us at {{support_email}}.`,
    variables: ["student_name", "action_url", "support_email"],
  },
  {
    slug: "ticket_received",
    name: "Support Ticket Acknowledgement",
    category: "support",
    description: "Sent to requester immediately when a new ticket is submitted",
    subject: "[{{ticket_id}}] We received your request: {{ticket_subject}}",
    preheader: "Your support request has been logged and assigned to our queue.",
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
  <h2 style="color: #0f172a; font-size: 22px; font-weight: 800;">We've received your request</h2>
  <p style="font-size: 15px; line-height: 1.6;">Hi {{student_name}},</p>
  <p style="font-size: 15px; line-height: 1.6;">Your support request <strong>{{ticket_id}}</strong> has been assigned to our operations queue. Our team is actively reviewing the details.</p>
  <div style="background: #f8fafc; border-left: 4px solid #e11d48; padding: 16px; margin: 20px 0; border-radius: 4px;">
    <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Subject:</strong> {{ticket_subject}}</p>
    <p style="margin: 6px 0 0; font-size: 14px; color: #475569;"><strong>Priority:</strong> {{ticket_priority}}</p>
  </div>
  <div style="margin: 28px 0;">
    <a href="{{tracking_url}}" style="background: #0f172a; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Track Your Request</a>
  </div>
  <p style="font-size: 13px; color: #64748b;">AI Tathastu Support Operations · {{support_email}}</p>
</div>`,
    textBody: `Support Request Received [{{ticket_id}}]

Hi {{student_name}},

Your support request "{{ticket_subject}}" has been received. Our team will review it and reply as soon as possible.

Track your request: {{tracking_url}}

AI Tathastu Support Operations`,
    variables: ["ticket_id", "student_name", "ticket_subject", "ticket_priority", "tracking_url", "support_email"],
  },
  {
    slug: "ticket_reply",
    name: "Agent Public Reply Notification",
    category: "support",
    description: "Sent to student when a support agent posts a public reply",
    subject: "[{{ticket_id}}] New reply on: {{ticket_subject}}",
    preheader: "An agent has responded to your support ticket.",
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
  <h2 style="color: #0f172a; font-size: 22px; font-weight: 800;">New reply on your ticket</h2>
  <p style="font-size: 15px; line-height: 1.6;">Hi {{student_name}},</p>
  <p style="font-size: 15px; line-height: 1.6;"><strong>{{assigned_agent}}</strong> posted a new response to your ticket <strong>{{ticket_id}}</strong>:</p>
  <div style="background: #f1f5f9; padding: 18px; border-radius: 8px; margin: 20px 0; font-size: 15px; line-height: 1.6; color: #0f172a;">
    {{message_body}}
  </div>
  <div style="margin: 28px 0;">
    <a href="{{tracking_url}}" style="background: #e11d48; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reply or View Thread</a>
  </div>
  <p style="font-size: 13px; color: #64748b;">AI Tathastu Support Operations</p>
</div>`,
    textBody: `New reply on your ticket [{{ticket_id}}]

Hi {{student_name}},

{{assigned_agent}} posted a response:

{{message_body}}

View and reply here: {{tracking_url}}`,
    variables: ["ticket_id", "student_name", "assigned_agent", "message_body", "tracking_url", "ticket_subject"],
  },
  {
    slug: "ticket_resolved",
    name: "Ticket Resolution Notice",
    category: "support",
    description: "Sent to requester when a ticket is marked resolved",
    subject: "[{{ticket_id}}] Issue Resolved: {{ticket_subject}}",
    preheader: "Your support ticket has been marked as resolved.",
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
  <h2 style="color: #0f172a; font-size: 22px; font-weight: 800;">Your issue has been resolved</h2>
  <p style="font-size: 15px; line-height: 1.6;">Hi {{student_name}},</p>
  <p style="font-size: 15px; line-height: 1.6;">Ticket <strong>{{ticket_id}}</strong> has been resolved by our support team.</p>
  <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0; font-size: 14px; color: #0f172a;"><strong>Resolution Summary:</strong></p>
    <p style="margin: 6px 0 0; font-size: 14px; color: #334155;">{{resolution_summary}}</p>
  </div>
  <p style="font-size: 14px; color: #475569;">If your issue persists or you need further help, you can reopen this ticket directly from the link below:</p>
  <div style="margin: 24px 0;">
    <a href="{{tracking_url}}" style="background: #0f172a; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Confirm or Reopen</a>
  </div>
</div>`,
    textBody: `Ticket Resolved [{{ticket_id}}]

Hi {{student_name}},

Ticket {{ticket_id}} ("{{ticket_subject}}") has been resolved.

Resolution: {{resolution_summary}}

If you still need assistance, reopen it at: {{tracking_url}}`,
    variables: ["ticket_id", "student_name", "ticket_subject", "resolution_summary", "tracking_url"],
  },
  {
    slug: "security_alert",
    name: "Security Notification Alert",
    category: "security",
    description: "Sent on sensitive account activity, password change, or session revocation",
    subject: "Security Alert for your AI Tathastu account",
    preheader: "Notice of security-sensitive activity on your account.",
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b;">
  <h2 style="color: #b91c1c; font-size: 22px; font-weight: 800;">Security Notice</h2>
  <p style="font-size: 15px; line-height: 1.6;">Hi {{student_name}},</p>
  <p style="font-size: 15px; line-height: 1.6;">We observed the following activity on your account at <strong>{{event_time}}</strong>:</p>
  <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 14px 18px; border-radius: 6px; margin: 20px 0; color: #991b1b; font-size: 14px;">
    {{security_event}}
  </div>
  <p style="font-size: 14px; color: #475569;">If this was you, you can safely ignore this email. If you did not initiate this action, please secure your account immediately.</p>
  <div style="margin: 24px 0;">
    <a href="{{action_url}}" style="background: #b91c1c; color: #ffffff; padding: 11px 22px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Review Security Settings</a>
  </div>
</div>`,
    textBody: `Security Alert

Hi {{student_name}},

Security event observed on your account at {{event_time}}:
{{security_event}}

If you did not authorize this, secure your account at: {{action_url}}`,
    variables: ["student_name", "event_time", "security_event", "action_url"],
  },
];

/**
 * Seeds or synchronizes the default starter templates into the database.
 */
export async function seedStarterTemplates(): Promise<void> {
  for (const starter of STARTER_TEMPLATES) {
    const [existing] = await db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(eq(emailTemplates.slug, starter.slug));

    if (!existing) {
      const [inserted] = await db
        .insert(emailTemplates)
        .values({
          slug: starter.slug,
          name: starter.name,
          category: starter.category,
          description: starter.description,
          subject: starter.subject,
          preheader: starter.preheader,
          htmlBody: starter.htmlBody,
          textBody: starter.textBody,
          variables: starter.variables,
          version: 1,
          status: "published",
        })
        .returning();

      await db.insert(emailTemplateVersions).values({
        templateId: inserted.id,
        versionNumber: 1,
        subject: starter.subject,
        preheader: starter.preheader,
        htmlBody: starter.htmlBody,
        textBody: starter.textBody,
        variables: starter.variables,
        changeNotes: "Initial starter template seed",
      });
    }
  }
}

export interface QueueEmailInput {
  templateSlug?: string;
  recipient: string;
  senderProfile?: SenderProfile;
  subject: string;
  htmlBody: string;
  textBody: string;
  correlationId?: string;
}

/**
 * Enqueues an outgoing email into the durable transactional outbox.
 */
export async function queueEmailDelivery(input: QueueEmailInput): Promise<EmailDelivery> {
  const [delivery] = await db
    .insert(emailDeliveries)
    .values({
      templateSlug: input.templateSlug ?? null,
      recipient: input.recipient.toLowerCase().trim(),
      senderProfile: input.senderProfile ?? "support",
      subject: input.subject,
      htmlBody: input.htmlBody,
      textBody: input.textBody,
      status: "queued",
      attempts: 0,
      maxAttempts: 5,
      correlationId: input.correlationId ?? null,
    })
    .returning();

  return delivery;
}

export function calculateEmailBackoffSeconds(attempts: number): number {
  return Math.pow(2, attempts) * 60;
}

/**
 * Processes queued email deliveries from the outbox with backoff and retry rules.
 */
export async function processEmailDeliveries(limit = 10): Promise<{
  processed: number;
  sent: number;
  failed: number;
}> {
  const dueDeliveries = await db
    .select()
    .from(emailDeliveries)
    .where(
      and(
        eq(emailDeliveries.status, "queued"),
        sql`${emailDeliveries.nextAttemptAt} <= NOW()`
      )
    )
    .orderBy(emailDeliveries.createdAt)
    .limit(limit);

  let sent = 0;
  let failed = 0;

  for (const item of dueDeliveries) {
    const profile = (item.senderProfile as SenderProfile) || "support";

    if (!isEmailConfigured(profile)) {
      // If SMTP is unconfigured in this environment, mark failed with safe error
      await db
        .update(emailDeliveries)
        .set({
          status: "failed",
          lastError: `Email profile "${profile}" is not configured in this environment`,
        })
        .where(eq(emailDeliveries.id, item.id));
      failed++;
      continue;
    }

    try {
      await sendEmail({
        profile,
        to: item.recipient,
        email: {
          subject: item.subject,
          html: item.htmlBody,
          text: item.textBody,
        },
      });

      await db
        .update(emailDeliveries)
        .set({
          status: "delivered",
          deliveredAt: new Date(),
          attempts: item.attempts + 1,
        })
        .where(eq(emailDeliveries.id, item.id));
      sent++;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const nextAttempts = item.attempts + 1;
      const isDead = nextAttempts >= item.maxAttempts;

      // Exponential backoff: 2^attempts * 60 seconds
      const backoffSeconds = calculateEmailBackoffSeconds(nextAttempts);
      const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);

      await db
        .update(emailDeliveries)
        .set({
          status: isDead ? "failed" : "queued",
          attempts: nextAttempts,
          nextAttemptAt: isDead ? undefined : nextAttemptAt,
          lastError: errorMsg,
        })
        .where(eq(emailDeliveries.id, item.id));
      failed++;
    }
  }

  return { processed: dueDeliveries.length, sent, failed };
}

export async function publishTemplateVersion(
  templateId: string,
  newSubject: string,
  newHtmlBody: string,
  newTextBody: string,
  newPreheader: string | null,
  changeNotes: string,
  actorId?: string,
  actorEmail?: string
): Promise<EmailTemplate> {
  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.id, templateId));

  if (!template) throw new Error("Template not found");

  const newVersion = template.version + 1;
  const validation = validateTemplateVariables(newHtmlBody + " " + newSubject);

  if (!validation.valid) {
    throw new Error(
      `Cannot publish template with unknown variables: ${validation.unknownVariables.join(", ")}`
    );
  }

  const [updatedTemplate] = await db
    .update(emailTemplates)
    .set({
      subject: newSubject,
      htmlBody: newHtmlBody,
      textBody: newTextBody,
      preheader: newPreheader,
      version: newVersion,
      status: "published",
      updatedBy: actorId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.id, templateId))
    .returning();

  await db.insert(emailTemplateVersions).values({
    templateId,
    versionNumber: newVersion,
    subject: newSubject,
    preheader: newPreheader,
    htmlBody: newHtmlBody,
    textBody: newTextBody,
    changeNotes,
    authorId: actorId ?? null,
  });

  if (actorEmail) {
    await recordAdminAudit({
      actorId,
      actorEmail,
      action: "template.publish",
      resource: "email_templates",
      targetId: templateId,
      details: { slug: template.slug, version: newVersion },
    });
  }

  return updatedTemplate;
}
