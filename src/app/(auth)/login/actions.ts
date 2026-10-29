"use server";

import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { emailProviderId } from "@/lib/auth-providers";
import { toLocalPath } from "@/lib/safe-redirect";

export async function signInWithProvider(formData: FormData) {
  const requested = formData.get("provider");
  // The form says "email"; the configured email provider decides the Auth.js id.
  const provider = requested === "email" ? emailProviderId() : requested;
  if (provider !== "google" && provider !== "linkedin" && provider !== "resend" && provider !== "nodemailer") {
    redirect("/login?error=Configuration");
  }

  const rawRedirect = formData.get("redirectTo");
  const safeRedirect = toLocalPath(typeof rawRedirect === "string" ? rawRedirect : null, "/dashboard");

  // Email magic-link: land on the dedicated verification transition screen
  // (/login/verify?callbackUrl=...), which confirms verification and routes smoothly
  const redirectTo = requested === "email"
    ? `/login/verify?callbackUrl=${encodeURIComponent(safeRedirect)}`
    : safeRedirect;

  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  if (requested === "email") {
    if (!email || !email.includes("@") || email.length < 5) {
      redirect("/login?error=InvalidEmail");
    }

    // Retain target email in cookie for check-email page UX & resend cooldown without exposing to 3rd parties
    const cookieStore = await cookies();
    cookieStore.set("tat_auth_email", email, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 15, // 15 minutes
      secure: process.env.NODE_ENV === "production",
    });
  }

  try {
    await signIn(provider, {
      redirectTo,
      ...(requested === "email" ? { email } : {}),
    });
  } catch (error) {
    // signIn() redirects by throwing; only Auth.js errors are ours to handle.
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    throw error;
  }
}
