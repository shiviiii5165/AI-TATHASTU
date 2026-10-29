import "server-only";

import { and, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  type SupportMessage,
  type SupportTicket,
  supportMessages,
  supportTickets,
  type TicketPriority,
  type TicketStatus,
  users,
} from "@/db/schema";
import { recordAdminAudit } from "./audit";

export {
  type SupportMessage,
  type SupportTicket,
  supportMessages,
  supportTickets,
  type TicketPriority,
  type TicketStatus,
  users,
};

// Allowed state transitions
const VALID_TRANSITIONS: Record<TicketStatus, readonly TicketStatus[]> = {
  new: ["open", "in_progress", "waiting_student", "closed"],
  open: ["in_progress", "waiting_student", "waiting_engineering", "escalated", "resolved", "closed"],
  in_progress: ["waiting_student", "waiting_engineering", "escalated", "resolved", "closed"],
  waiting_student: ["in_progress", "resolved", "closed"],
  waiting_engineering: ["in_progress", "resolved", "closed"],
  escalated: ["in_progress", "resolved", "closed"],
  resolved: ["closed", "reopened"],
  closed: ["reopened"],
  reopened: ["in_progress", "waiting_student", "resolved", "closed"],
};

// SLA response time targets (in hours)
const FIRST_RESPONSE_HOURS: Record<TicketPriority, number> = {
  urgent: 2,
  high: 8,
  medium: 24,
  low: 48,
};

const RESOLUTION_HOURS: Record<TicketPriority, number> = {
  urgent: 12,
  high: 36,
  medium: 72,
  low: 120,
};

export function calculateSlaDeadlines(priority: TicketPriority, fromDate = new Date()) {
  const firstResponseDueAt = new Date(fromDate.getTime() + FIRST_RESPONSE_HOURS[priority] * 3600 * 1000);
  const resolutionDueAt = new Date(fromDate.getTime() + RESOLUTION_HOURS[priority] * 3600 * 1000);
  return { firstResponseDueAt, resolutionDueAt };
}

export function isValidTransition(current: TicketStatus, next: TicketStatus): boolean {
  if (current === next) return true;
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export async function generateTicketNumber(): Promise<string> {
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const year = new Date().getFullYear();
  return `TATH-${year}-${randomSuffix}`;
}

export interface CreateTicketInput {
  requesterId?: string;
  requesterEmail: string;
  requesterName?: string;
  subject: string;
  category?: string;
  priority?: TicketPriority;
  sourceChannel?: string;
  initialMessage: string;
}

export async function createSupportTicket(input: CreateTicketInput): Promise<SupportTicket> {
  const ticketNumber = await generateTicketNumber();
  const priority = input.priority ?? "medium";
  const { firstResponseDueAt, resolutionDueAt } = calculateSlaDeadlines(priority);

  const [ticket] = await db
    .insert(supportTickets)
    .values({
      ticketNumber,
      requesterId: input.requesterId ?? null,
      requesterEmail: input.requesterEmail.toLowerCase().trim(),
      requesterName: input.requesterName ?? null,
      subject: input.subject.trim(),
      category: input.category ?? "general",
      priority,
      status: "new",
      sourceChannel: input.sourceChannel ?? "web",
      firstResponseDueAt,
      resolutionDueAt,
    })
    .returning();

  if (input.initialMessage) {
    await db.insert(supportMessages).values({
      ticketId: ticket.id,
      authorId: input.requesterId ?? null,
      authorName: input.requesterName ?? "Requester",
      authorEmail: input.requesterEmail,
      isInternalNote: false,
      content: input.initialMessage.trim(),
    });
  }

  return ticket;
}

export interface AddMessageInput {
  ticketId: string;
  authorId?: string;
  authorName?: string;
  authorEmail?: string;
  isInternalNote: boolean;
  content: string;
}

export async function addTicketMessage(input: AddMessageInput): Promise<SupportMessage> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, input.ticketId));

  if (!ticket) throw new Error("Ticket not found");

  const [message] = await db
    .insert(supportMessages)
    .values({
      ticketId: input.ticketId,
      authorId: input.authorId ?? null,
      authorName: input.authorName ?? "Support Staff",
      authorEmail: input.authorEmail,
      isInternalNote: input.isInternalNote,
      content: input.content.trim(),
    })
    .returning();

  // If this is a public reply by an agent and first response hasn't been tracked, mark it
  if (!input.isInternalNote && !ticket.firstResponseAt) {
    await db
      .update(supportTickets)
      .set({
        firstResponseAt: new Date(),
        status: ticket.status === "new" ? "open" : ticket.status,
        updatedAt: new Date(),
      })
      .where(eq(supportTickets.id, ticket.id));
  } else {
    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticket.id));
  }

  return message;
}

export async function updateTicketStatus(
  ticketId: string,
  newStatus: TicketStatus,
  actorEmail: string,
  resolutionNotes?: string
): Promise<SupportTicket> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId));

  if (!ticket) throw new Error("Ticket not found");

  if (!isValidTransition(ticket.status, newStatus)) {
    throw new Error(`Cannot transition ticket from "${ticket.status}" to "${newStatus}"`);
  }

  const updates: Partial<SupportTicket> = {
    status: newStatus,
    updatedAt: new Date(),
  };

  if (newStatus === "resolved") {
    updates.resolvedAt = new Date();
    if (resolutionNotes) updates.resolutionNotes = resolutionNotes;
  } else if (newStatus === "closed") {
    updates.closedAt = new Date();
  }

  const [updated] = await db
    .update(supportTickets)
    .set(updates)
    .where(eq(supportTickets.id, ticketId))
    .returning();

  await recordAdminAudit({
    actorEmail,
    action: "ticket.status_change",
    resource: "support_tickets",
    targetId: ticketId,
    details: { previousStatus: ticket.status, newStatus, ticketNumber: ticket.ticketNumber },
  });

  return updated;
}

export async function assignTicket(
  ticketId: string,
  assignedToId: string | null,
  actorEmail: string
): Promise<SupportTicket> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId));

  if (!ticket) throw new Error("Ticket not found");

  const [updated] = await db
    .update(supportTickets)
    .set({
      assignedToId,
      status: ticket.status === "new" ? "open" : ticket.status,
      updatedAt: new Date(),
    })
    .where(eq(supportTickets.id, ticketId))
    .returning();

  await recordAdminAudit({
    actorEmail,
    action: "ticket.assign",
    resource: "support_tickets",
    targetId: ticketId,
    details: { previousAssignee: ticket.assignedToId, newAssignee: assignedToId },
  });

  return updated;
}

export interface TicketWithMessages extends SupportTicket {
  messages: SupportMessage[];
  assignedToName?: string | null;
}

export async function getTicketDetails(
  ticketId: string,
  options: { includeInternalNotes: boolean }
): Promise<TicketWithMessages | null> {
  const [ticket] = await db
    .select()
    .from(supportTickets)
    .where(eq(supportTickets.id, ticketId));

  if (!ticket) return null;

  let messageQuery = db
    .select()
    .from(supportMessages)
    .where(
      options.includeInternalNotes
        ? eq(supportMessages.ticketId, ticketId)
        : and(eq(supportMessages.ticketId, ticketId), eq(supportMessages.isInternalNote, false))
    )
    .orderBy(supportMessages.createdAt);

  const messages = await messageQuery;

  let assignedToName: string | null = null;
  if (ticket.assignedToId) {
    const [assignee] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, ticket.assignedToId));
    assignedToName = assignee?.name ?? null;
  }

  return {
    ...ticket,
    messages,
    assignedToName,
  };
}

export interface ListTicketsOptions {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
  assignedToId?: string;
  requesterEmail?: string;
  query?: string;
  limit?: number;
  offset?: number;
}

export async function listSupportTickets(options: ListTicketsOptions = {}) {
  const limit = Math.min(options.limit ?? 25, 100);
  const offset = options.offset ?? 0;

  const conditions = [];

  if (options.status) {
    conditions.push(eq(supportTickets.status, options.status));
  }
  if (options.priority) {
    conditions.push(eq(supportTickets.priority, options.priority));
  }
  if (options.category) {
    conditions.push(eq(supportTickets.category, options.category));
  }
  if (options.assignedToId) {
    conditions.push(eq(supportTickets.assignedToId, options.assignedToId));
  }
  if (options.requesterEmail) {
    conditions.push(eq(supportTickets.requesterEmail, options.requesterEmail.toLowerCase().trim()));
  }
  if (options.query) {
    const search = `%${options.query.trim()}%`;
    conditions.push(
      or(
        ilike(supportTickets.ticketNumber, search),
        ilike(supportTickets.subject, search),
        ilike(supportTickets.requesterEmail, search),
        ilike(supportTickets.requesterName, search)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const tickets = await db
    .select()
    .from(supportTickets)
    .where(whereClause)
    .orderBy(desc(supportTickets.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(supportTickets)
    .where(whereClause);

  return {
    tickets,
    total: Number(countResult?.count ?? 0),
  };
}

