/**
 * Whether a provider's identity may sign in. An already-linked account is known
 * to us; a new one can create a user or be linked to one by email, so its
 * address must be asserted as verified. Google is checked on every sign-in.
 */
export function isSignInAllowed(provider: string | undefined, emailVerified: unknown, alreadyLinked: boolean) {
  if (provider === "google") return emailVerified === true;
  if (provider === "linkedin" && !alreadyLinked) return emailVerified === true;
  return true;
}

/** A token issued before the user's last revocation is dead. Tokens predating the claim count as version 0. */
export const isSessionCurrent = (tokenVersion: number | undefined, currentVersion: number) =>
  (tokenVersion ?? 0) === currentVersion;
