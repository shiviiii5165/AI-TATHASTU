import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Google from "next-auth/providers/google";
import LinkedIn from "next-auth/providers/linkedin";
import Nodemailer from "next-auth/providers/nodemailer";
import Resend from "next-auth/providers/resend";

import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { accounts, onboardingState, sessions, users, verificationTokens } from "@/db/schema";
import { configuredProviders, emailProviderId } from "@/lib/auth-providers";
import { connectSource } from "@/lib/connectors/connections";
import { importLinkedInProfileFacts } from "@/lib/connectors/linkedin";
import { enqueueComputeIntelligence } from "@/lib/jobs-queue";
import { sendEmail } from "@/lib/email";
import { magicLinkEmail, welcomeEmail } from "@/lib/email/templates";

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
  createUser: (user) => drizzleAdapter.createUser!({ ...user, email: user.email.toLowerCase() }),
  getUserByEmail: (email) => drizzleAdapter.getUserByEmail!(email.toLowerCase()),
};

/** Magic link: Resend if RESEND_API_KEY is set, else SMTP (Gmail app password) via Nodemailer. */
function emailProvider() {
  const id = emailProviderId();
  if (id === "resend") return [Resend({ apiKey: process.env.RESEND_API_KEY, from: process.env.AUTH_EMAIL_FROM })];
  if (id === "nodemailer") {
    const port = Number(process.env.SMTP_PORT ?? 465);
    return [
      Nodemailer({
        server: {
          host: process.env.SMTP_HOST,
          port,
          secure: port === 465, // implicit TLS on 465; STARTTLS otherwise
          // Gmail shows app passwords in groups of four; the spaces aren't part of it.
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD?.replace(/\s+/g, "") },
        },
        // Gmail rewrites any other From to the authenticated account, so default to it.
        from: process.env.AUTH_EMAIL_FROM || `AI Tathastu <${process.env.SMTP_USER}>`,
        // Our template, sent from the auth profile (src/lib/email.ts).
        async sendVerificationRequest({ identifier, url }) {
          await sendEmail({ profile: "auth", to: identifier, email: magicLinkEmail({ url }) });
        },
      }),
    ];
  }
  return [];
}

async function isAdminUser(userId: string) {
  const [row] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId));
  return row?.isAdmin === true;
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
    async signIn({ user, account }) {
      if (account?.provider === "linkedin" && account.providerAccountId) {
        // Prevent collision / duplicate linking: if already linked to a DIFFERENT user, reject
        const [existing] = await db
          .select({ userId: accounts.userId })
          .from(accounts)
          .where(and(eq(accounts.provider, "linkedin"), eq(accounts.providerAccountId, account.providerAccountId)));
        if (existing && user?.id && existing.userId !== user.id) {
          // Account already linked to another AI Tathastu user
          return false;
        }
      }
      return true;
    },
    // Runs only here (Node, with DB), never in the proxy: refreshes the
    // `onboarded` claim the proxy uses to gate /dashboard. It is set at sign-in
    // and when "Generate my profile" calls unstable_update().
    async jwt(params) {
      const token = authConfig.callbacks.jwt(params);
      if (params.trigger && token.sub) {
        // users.is_admin, as a claim the proxy can check without the database.
        // Independent reads: one round trip instead of two.
        [token.onboarded, token.admin] = await Promise.all([isOnboarded(token.sub), isAdminUser(token.sub)]);
      }
      return token;
    },
  },
  // Only providers with credentials are registered; the login page shows the same set.
  providers: [
    ...(configuredProviders().google
      ? [Google({ clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET })]
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
    ...emailProvider(),
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
