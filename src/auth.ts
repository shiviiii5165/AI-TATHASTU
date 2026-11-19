import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";

import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { accounts, adminTeamMembers, onboardingState, sessions, users, verificationTokens } from "@/db/schema";
import { configuredProviders } from "@/lib/auth-providers";
import { connectSource } from "@/lib/connectors/connections";
import { autoProvisionCollaborate } from "@/lib/integrations/auto-provision";
import { importLinkedInProfileFacts } from "@/lib/connectors/linkedin";
import { enqueueComputeIntelligence } from "@/lib/jobs-queue";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email/templates";
import { isSignInLocked, liveSessionVersion } from "@/lib/auth/account-lock";
import { isSessionCurrent, isSignInAllowed } from "@/lib/auth/sign-in-policy";

const drizzleAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

// users.email is unique on lower(email); normalise on the way in so OAuth
// providers that return mixed-case addresses resolve to the same account.
const adapter: Adapter = {
  ...drizzleAdapter,
  createUser: (user) => drizzleAdapter.createUser!({ ...user, email: user.email.toLowerCase().trim() }),
  getUserByEmail: (email) => drizzleAdapter.getUserByEmail!(email.toLowerCase().trim()),
  updateUser: (user) =>
    drizzleAdapter.updateUser!({
      ...user,
      ...(user.email ? { email: user.email.toLowerCase().trim() } : {}),
    }),
};

/** A hint for the proxy only, so a new team member reaches /admin. Every admin page and action decides for itself from the database. */
async function isAdminUser(userId: string) {
  const [[user], [member]] = await Promise.all([
    db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)),
    db.select({ id: adminTeamMembers.id }).from(adminTeamMembers).where(and(eq(adminTeamMembers.userId, userId), eq(adminTeamMembers.isActive, true))),
  ]);
  return user?.isAdmin === true || Boolean(member);
}

async function isOnboarded(userId: string) {
  const [row] = await db
    .select({ step: onboardingState.currentStep })
    .from(onboardingState)
    .where(eq(onboardingState.userId, userId));
  return row?.step === "done";
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (await isSignInLocked(user)) return false;
      let alreadyLinked = false;
      // Universal collision prevention across all OAuth providers:
      // If the provider account ID is already associated in database, enforce that
      // the authenticating identity matches that exact existing user.
      if (account?.provider && account.providerAccountId) {
        const [existing] = await db
          .select({ userId: accounts.userId })
          .from(accounts)
          .where(and(eq(accounts.provider, account.provider), eq(accounts.providerAccountId, account.providerAccountId)));
        if (existing) {
          if (!user?.id || existing.userId !== user.id) {
            return false;
          }
          alreadyLinked = true;
        }
      }

      // Unverified addresses must not create users or link into them: a pre-created
      // account would later merge with the real owner's sign-in, and ADMIN_EMAILS trusts the address.
      const emailVerified = (profile as { email_verified?: unknown } | undefined)?.email_verified;
      return isSignInAllowed(account?.provider, emailVerified, alreadyLinked);
    },
    // Runs only here (Node, with DB), never in the proxy: refreshes the
    // `onboarded` claim the proxy uses to gate /dashboard. It is set at sign-in
    // and when "Generate my profile" calls unstable_update().
    async jwt(params) {
      const token = authConfig.callbacks.jwt(params);
      if (token.sub) {
        // JWTs can't be recalled, so each auth() compares against the database. A fresh
        // sign-in takes the current number; "update" must not, or it would revive a revoked token.
        const version = await liveSessionVersion(token.sub);
        if (version === null) return null;
        if (params.trigger === "signIn" || params.trigger === "signUp") {
          token.sessionVersion = version;
          token.authTime = Math.floor(Date.now() / 1000);
        } else if (!isSessionCurrent(token.sessionVersion, version)) return null;
        if (params.trigger || token.onboarded === undefined || token.admin === undefined) {
          // users.is_admin and onboardingState.current_step as claims the proxy can check without the database.
          // Independent reads: one round trip instead of two.
          [token.onboarded, token.admin] = await Promise.all([isOnboarded(token.sub), isAdminUser(token.sub)]);
        }
      }
      return token;
    },
  },
  // Only providers with credentials are registered; the login page shows the same set. Sign-in is
  // Google or LinkedIn only: there is no email (magic-link) provider, so /api/auth/signin/<email>
  // cannot start one. Accounts that only ever used email sign in with Google on the same address
  // (allowDangerousEmailAccountLinking links it to the existing user; Google asserts the address).
  providers: [
    ...(configuredProviders().google
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    // OIDC; requests only the default openid/profile/email scopes.
    ...(configuredProviders().linkedin
      ? [
          LinkedIn({
            clientId: process.env.LINKEDIN_CLIENT_ID || process.env.AUTH_LINKEDIN_ID,
            clientSecret: process.env.LINKEDIN_CLIENT_SECRET || process.env.AUTH_LINKEDIN_SECRET,
          }),
        ]
      : []),
  ],
  events: {
    // Fires once, when the adapter inserts the users row on first sign-in.
    // Consents are deliberately not seeded: absence of a row means "unset",
    // and Step 6 appends the user's actual choices.
    async createUser({ user }) {
      if (!user.id) return;
      await db
        .insert(onboardingState)
        .values({ userId: user.id, currentStep: "role" }) // Step 0: choose a persona
        .onConflictDoNothing();
      // Automatic (private) Collaborate profile, after the response so sign-in never waits on it.
      const newUserId = user.id;
      after(() => autoProvisionCollaborate(newUserId).catch((error) => console.error("collaborate auto-provision failed", error)));
      const { email, name } = user;
      if (email) {
        // After the response: a slow or failing SMTP server never delays sign-in.
        after(() =>
          sendEmail({ profile: "system", to: email, email: welcomeEmail({ firstName: name?.split(/\s+/)[0] }) }).catch((error) =>
            console.error("welcome email failed", error),
          ),
        );
      }
    },
    // LinkedIn sign-in or account linking: stores the connection and imports
    // verified basic profile facts from OpenID Connect.
    async linkAccount({ user, account, profile }) {
      if (account.provider !== "linkedin" || !user.id) return;
      const userId = user.id;

      const p = profile as ({ name?: string; email?: string; picture?: string } | undefined);
      const name = p?.name ?? user.name ?? null;
      const email = p?.email ?? user.email ?? null;
      const picture = p?.picture ?? user.image ?? null;

      await connectSource({
        userId,
        sourceId: "linkedin",
        accessMethod: "oauth",
        credential: {
          providerAccountId: account.providerAccountId,
          name,
          email,
          picture,
        },
        syncKey: account.providerAccountId,
        queueSync: false,
        keepExisting: false,
      });

      await importLinkedInProfileFacts({
        userId,
        providerAccountId: account.providerAccountId,
        name,
        email,
        picture,
      });

      after(async () => {
        try {
          await enqueueComputeIntelligence(userId, "oauth:linkedin");
        } catch (error) {
          console.error("Failed to enqueue intelligence compute after linking LinkedIn", error);
        }
      });
    },
  },
});
