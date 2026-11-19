// Which sign-in methods are configured, from env. Shared by src/auth.ts (what to register), the
// login page (which buttons to show) and the LinkedIn connector. Sign-in is Google or LinkedIn
// only; email is still used for notifications (src/lib/email.ts), never as a sign-in method.

export function configuredProviders() {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    linkedin: Boolean(
      (process.env.LINKEDIN_CLIENT_ID || process.env.AUTH_LINKEDIN_ID) &&
      (process.env.LINKEDIN_CLIENT_SECRET || process.env.AUTH_LINKEDIN_SECRET),
    ),
  };
}
