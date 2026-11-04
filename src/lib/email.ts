// Outgoing email: three sender profiles, each its own Gmail account (Gmail
// rewrites any From that isn't the authenticated mailbox, so each profile
// signs in as itself). Templates live in src/lib/email/templates.ts.
//
//   auth    → hello@   magic links (Auth.js)
//   system  → info@    welcome, resume ready / failed
//   support → support@ connector alerts; also the Reply-To for the others
//
// Server-only in practice: nodemailer can't be bundled for the browser.
import nodemailer, { type Transporter } from "nodemailer";

import type { Email } from "./email/templates";

export type SenderProfile = "auth" | "system" | "support";

const PROFILES: Record<SenderProfile, { name: string; user: string[]; password: string[] }> = {
  // SMTP_USER / SMTP_PASSWORD were the single-sender settings; still honoured for auth.
  auth: { name: "AI Tathastu", user: ["SMTP_HELLO_USER", "SMTP_USER"], password: ["SMTP_HELLO_PASSWORD", "SMTP_PASSWORD"] },
  system: { name: "AI Tathastu", user: ["SMTP_INFO_USER"], password: ["SMTP_INFO_PASSWORD"] },
  support: { name: "AI Tathastu Support", user: ["SMTP_SUPPORT_USER"], password: ["SMTP_SUPPORT_PASSWORD"] },
};

const first = (keys: string[]) => keys.map((k) => process.env[k]?.trim()).find(Boolean) ?? null;

function credentials(profile: SenderProfile) {
  const def = PROFILES[profile];
  const user = first(def.user);
  // Gmail shows app passwords in groups of four; the spaces aren't part of it.
  const pass = first(def.password)?.replace(/\s+/g, "");
  return user && pass && process.env.SMTP_HOST ? { user, pass, name: def.name } : null;
}

export function isEmailConfigured(profile: SenderProfile) {
  return credentials(profile) !== null;
}

/** The address a profile sends from, e.g. for Reply-To. */
export function senderAddress(profile: SenderProfile) {
  return credentials(profile)?.user ?? null;
}

const transports = new Map<SenderProfile, Transporter>();

/** Without this, a network attacker can strip STARTTLS and read the SMTP password. Only a local test server is exempt. */
export function requiresStartTls(host: string | undefined, port: number) {
  return port !== 465 && host !== "127.0.0.1" && host !== "localhost";
}

function transport(profile: SenderProfile) {
  const creds = credentials(profile);
  if (!creds) throw new Error(`Email profile "${profile}" isn't configured (see .env.example: SMTP_*).`);
  let t = transports.get(profile);
  if (!t) {
    const port = Number(process.env.SMTP_PORT ?? 465);
    t = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // implicit TLS on 465; STARTTLS otherwise
      requireTLS: requiresStartTls(process.env.SMTP_HOST, port),
      auth: { user: creds.user, pass: creds.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    transports.set(profile, t);
  }
  return { t, from: { name: creds.name, address: creds.user } };
}

/** Sends one templated email. Throws on SMTP errors; callers decide whether that matters. */
export async function sendEmail({ profile, to, email }: { profile: SenderProfile; to: string; email: Email }) {
  const { t, from } = transport(profile);
  const replyTo = profile === "support" ? undefined : (senderAddress("support") ?? undefined);
  const info = await t.sendMail({ from, to, replyTo, subject: email.subject, html: email.html, text: email.text });
  // SMTP accepted the message for delivery; it can still bounce later.
  return { messageId: info.messageId, accepted: (info.accepted ?? []).map(String) };
}
