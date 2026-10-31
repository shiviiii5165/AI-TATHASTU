// Edge-safe (used by the proxy and the server): ADMIN_EMAILS, comma-separated.
// Driven strictly by the ADMIN_EMAILS environment variable (fail closed if unset).
export const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email: string | null | undefined) =>
  Boolean(email && adminEmails().includes(email.toLowerCase().trim()));
