// Which sign-in methods are configured, from env. Shared by src/auth.ts
// (what to register) and the login page (which buttons to show).

export type EmailProviderId = "resend" | "nodemailer";

/** Resend when RESEND_API_KEY is set, otherwise SMTP (Gmail app password) via Nodemailer. */
export function emailProviderId(): EmailProviderId | null {
  if (process.env.RESEND_API_KEY) return "resend";
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD) return "nodemailer";
  return null;
}

export function configuredProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    linkedin: Boolean(
      (process.env.LINKEDIN_CLIENT_ID || process.env.AUTH_LINKEDIN_ID) &&
      (process.env.LINKEDIN_CLIENT_SECRET || process.env.AUTH_LINKEDIN_SECRET),
    ),
    email: emailProviderId() !== null,
  };
}
