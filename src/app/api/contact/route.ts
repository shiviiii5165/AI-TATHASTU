import { createHash, randomInt } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";
import { isEmailConfigured, sendEmail, senderAddress } from "@/lib/email";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";

// 5 submissions per 60 seconds per IP, counted across all instances (the key
// stores a hash, never the raw IP).
const CONTACT_LIMIT = { limit: 5, windowSeconds: 60 };

const contactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .max(120, "Email cannot exceed 120 characters"),
  category: z.enum(["general", "partnerships", "support", "feedback"]),
  subject: z
    .string()
    .trim()
    .min(2, "Subject must be at least 2 characters")
    .max(150, "Subject cannot exceed 150 characters"),
  message: z
    .string()
    .trim()
    .min(10, "Message must be at least 10 characters")
    .max(3000, "Message cannot exceed 3000 characters"),
  consent: z.literal(true),
});

/** Escapes for the HTML body; the plain-text copy keeps what the person typed, in any script. */
function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** A subject is one header line: no control characters, so no injected headers. */
function singleLine(input: string): string {
  return input.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, " ").trim();
}

export async function POST(request: Request) {
  const ipHash = createHash("sha256").update(clientIp(request)).digest("hex").slice(0, 32);
  const limited = await hitRateLimit(`contact:${ipHash}`, CONTACT_LIMIT);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const result = contactSchema.safeParse(body);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message || "Invalid contact form submission." },
      { status: 400 }
    );
  }

  const { name, email, category, subject, message } = result.data;
  const cleanName = singleLine(name);
  const cleanSubject = singleLine(subject);

  // Generate unique confirmation reference code via CSPRNG
  const referenceId = `#TAT-${randomInt(1000, 10000)}`;

  // The message is only stored by being emailed, so "sent" means delivered to
  // the support inbox: never report success for a message that went nowhere.
  const supportAddr = isEmailConfigured("support") ? senderAddress("support") : null;
  if (!supportAddr) {
    return NextResponse.json(
      { error: "Sending messages isn't available right now. Please email us directly." },
      { status: 503 }
    );
  }
  try {
    await sendEmail({
      profile: "support",
      to: supportAddr,
      email: {
        subject: `[Contact ${referenceId}] [${category.toUpperCase()}] ${cleanSubject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Reference:</strong> ${referenceId}</p>
          <p><strong>Name:</strong> ${escapeHtml(cleanName)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><strong>Subject:</strong> ${escapeHtml(cleanSubject)}</p>
          <hr />
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
        `,
        text: `Reference: ${referenceId}\nName: ${cleanName}\nEmail: ${email}\nCategory: ${category}\nSubject: ${cleanSubject}\n\nMessage:\n${message}`,
      },
    });
  } catch (err) {
    console.error("Failed to forward contact email via SMTP:", err);
    return NextResponse.json(
      { error: "We couldn't send your message. Please try again in a moment." },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    referenceId,
    timestamp: new Date().toISOString(),
  });
}
