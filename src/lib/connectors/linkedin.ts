import "server-only";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/db";
import { profileFacts, users } from "@/db/schema";

export function linkedinConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID ?? process.env.AUTH_LINKEDIN_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET ?? process.env.AUTH_LINKEDIN_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export type LinkedInProfileInput = {
  userId: string;
  providerAccountId: string;
  name?: string | null;
  email?: string | null;
  picture?: string | null;
};

/**
 * Normalizes and persists verified basic profile facts from LinkedIn OpenID Connect.
 * Idempotent: supersedes/deletes previous linkedin_oidc facts for the user.
 */
export async function importLinkedInProfileFacts({
  userId,
  providerAccountId,
  name,
  email,
  picture,
}: LinkedInProfileInput) {
  // Delete previous linkedin_oidc facts for this user to ensure idempotency
  await db.delete(profileFacts).where(
    and(
      eq(profileFacts.userId, userId),
      eq(profileFacts.origin, "linkedin_oidc"),
    ),
  );

  const factsToInsert: (typeof profileFacts.$inferInsert)[] = [];

  const trimmedName = name?.trim();
  if (trimmedName) {
    factsToInsert.push({
      userId,
      fieldGroup: "identity",
      fieldName: "full_name",
      extractedValue: trimmedName,
      normalizedValue: trimmedName,
      sourceEvidence: "LinkedIn OAuth (OpenID Connect)",
      origin: "linkedin_oidc",
      confidence: 1.0,
      validationStatus: "validated",
      confirmation: "confirmed",
      extractionMethod: "linkedin_oidc",
    });
  }

  const trimmedPic = picture?.trim();
  if (trimmedPic) {
    factsToInsert.push({
      userId,
      fieldGroup: "identity",
      fieldName: "avatar_url",
      extractedValue: trimmedPic,
      normalizedValue: trimmedPic,
      sourceEvidence: "LinkedIn Profile Avatar",
      origin: "linkedin_oidc",
      confidence: 1.0,
      validationStatus: "validated",
      confirmation: "confirmed",
      extractionMethod: "linkedin_oidc",
    });
  }

  const trimmedEmail = email?.trim()?.toLowerCase();
  if (trimmedEmail) {
    factsToInsert.push({
      userId,
      fieldGroup: "contact",
      fieldName: "email",
      extractedValue: trimmedEmail,
      normalizedValue: trimmedEmail,
      sourceEvidence: "LinkedIn Verified Email",
      origin: "linkedin_oidc",
      confidence: 1.0,
      validationStatus: "validated",
      confirmation: "confirmed",
      extractionMethod: "linkedin_oidc",
    });
  }

  if (providerAccountId) {
    factsToInsert.push({
      userId,
      fieldGroup: "identity",
      fieldName: "linkedin_id",
      extractedValue: providerAccountId,
      normalizedValue: providerAccountId,
      sourceEvidence: "LinkedIn Member Identifier (sub)",
      origin: "linkedin_oidc",
      confidence: 1.0,
      validationStatus: "validated",
      confirmation: "confirmed",
      extractionMethod: "linkedin_oidc",
    });
  }

  if (factsToInsert.length > 0) {
    await db.insert(profileFacts).values(factsToInsert);
  }

  // Update avatar in users table if user doesn't currently have one
  if (trimmedPic) {
    await db
      .update(users)
      .set({ image: trimmedPic, updatedAt: new Date() })
      .where(and(eq(users.id, userId), isNull(users.image)));
  }
}
