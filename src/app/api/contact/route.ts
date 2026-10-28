import { NextResponse } from "next/server";
import { z } from "zod";
import { isEmailConfigured, sendEmail, senderAddress } from "@/lib/email";

// In-memory rate limiting map (IP -> timestamps array)
// Restricts to 5 submissions per 60 seconds per IP address
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;

// Clean up old rate limit entries every 5 minutes to prevent memory growth
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, valid);
    }
  }
}, 5 * 60 * 1000).unref?.();

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

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>?/gm, "") // strip html tags
    .replace(/[^\w\s\d.,!?'"@#%&*()_\-+:;/]/gi, ""); // strip suspicious scripting chars
}

export async function POST(request: Request) {
  // Rate limiting by client IP
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "127.0.0.1";

  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment before trying again." },
      { status: 429 }
    );
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);

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
  const cleanName = sanitize(name);
  const cleanSubject = sanitize(subject);
  const cleanMessage = sanitize(message);

  // Generate unique confirmation reference code
  const referenceId = `#TAT-${Math.floor(1000 + Math.random() * 9000)}`;

  // If support email delivery is configured, forward the message
  if (isEmailConfigured("support")) {
    const supportAddr = senderAddress("support");
    if (supportAddr) {
      try {
        await sendEmail({
          profile: "support",
          to: supportAddr,
          email: {
            subject: `[Contact ${referenceId}] [${category.toUpperCase()}] ${cleanSubject}`,
            html: `
              <h2>New Contact Form Submission</h2>
              <p><strong>Reference:</strong> ${referenceId}</p>
              <p><strong>Name:</strong> ${cleanName}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Category:</strong> ${category}</p>
              <p><strong>Subject:</strong> ${cleanSubject}</p>
              <hr />
              <p><strong>Message:</strong></p>
              <p style="white-space: pre-wrap;">${cleanMessage}</p>
            `,
            text: `Reference: ${referenceId}\nName: ${cleanName}\nEmail: ${email}\nCategory: ${category}\nSubject: ${cleanSubject}\n\nMessage:\n${cleanMessage}`,
          },
        });
      } catch (err) {
        console.error("Failed to forward contact email via SMTP:", err);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    referenceId,
    timestamp: new Date().toISOString(),
  });
}
