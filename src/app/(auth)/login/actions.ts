"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/auth";
import { allowAuthAttempt } from "@/lib/auth/abuse";
import { toLocalPath } from "@/lib/safe-redirect";

/** Google or LinkedIn only. Anything else (including the retired "email" option) is refused. */
export async function signInWithProvider(formData: FormData) {
  if (!(await allowAuthAttempt(new Request("https://internal.invalid", { headers: await headers() })))) {
    redirect("/login?error=TooManyAttempts");
  }
  const provider = formData.get("provider");
  if (provider !== "google" && provider !== "linkedin") {
    redirect("/login?error=Configuration");
  }

  const rawRedirect = formData.get("redirectTo");
  const redirectTo = toLocalPath(typeof rawRedirect === "string" ? rawRedirect : null, "/dashboard");

  try {
    await signIn(provider, { redirectTo });
  } catch (error) {
    // signIn() redirects by throwing; only Auth.js errors are ours to handle.
    if (error instanceof AuthError) {
      redirect(`/login?error=${error.type}`);
    }
    throw error;
  }
}
