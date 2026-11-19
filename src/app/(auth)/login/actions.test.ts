/**
 * Sign-in is Google or LinkedIn only: the public action refuses the retired "email" option (and
 * anything else), the auth config registers no email provider, and the login page offers no email form.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const signIn = vi.hoisted(() => vi.fn(async () => {}));
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  }),
);
vi.mock("@/auth", () => ({ signIn }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next-auth", () => ({ AuthError: class extends Error {} }));
const allow = vi.hoisted(() => ({ ok: true }));
vi.mock("@/lib/auth/abuse", () => ({ allowAuthAttempt: async () => allow.ok }));

const { signInWithProvider } = await import("@/app/(auth)/login/actions");

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};
const redirectedTo = async (fields: Record<string, string>) => {
  try {
    await signInWithProvider(form(fields));
    return null;
  } catch (e) {
    return (e as { to?: string }).to ?? null;
  }
};

beforeEach(() => {
  signIn.mockClear();
  allow.ok = true;
});

describe("signInWithProvider", () => {
  it.each(["google", "linkedin"])("starts %s sign-in with a local redirect only", async (provider) => {
    await signInWithProvider(form({ provider, redirectTo: "/dashboard/profile" }));
    expect(signIn).toHaveBeenCalledWith(provider, { redirectTo: "/dashboard/profile" });
    signIn.mockClear();
    await signInWithProvider(form({ provider, redirectTo: "https://evil.example/steal" }));
    expect(signIn).toHaveBeenCalledWith(provider, { redirectTo: "/dashboard" });
  });

  it.each(["email", "nodemailer", "resend", "credentials", ""])("refuses provider %j and never calls signIn", async (provider) => {
    expect(await redirectedTo({ provider, email: "someone@example.com" })).toBe("/login?error=Configuration");
    expect(signIn).not.toHaveBeenCalled();
  });

  it("blocks abusive attempts before anything else", async () => {
    allow.ok = false;
    expect(await redirectedTo({ provider: "google" })).toBe("/login?error=TooManyAttempts");
    expect(signIn).not.toHaveBeenCalled();
  });
});

describe("no email sign-in anywhere in the auth surface", () => {
  const read = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

  it("auth.ts registers no email (magic-link) provider", () => {
    const src = read("src/auth.ts");
    expect(src).not.toMatch(/next-auth\/providers\/(nodemailer|resend|email)/);
    expect(src).not.toMatch(/sendVerificationRequest/);
  });

  it("the login page has no email field, email button or OR divider", () => {
    const page = read("src/app/(auth)/login/page.tsx");
    expect(page).not.toMatch(/type="email"|name="email"|EmailSignInButton|value="email"/);
    expect(page).not.toMatch(/>\s*OR\s*</);
  });

  it("configuredProviders exposes only Google and LinkedIn", async () => {
    const { configuredProviders } = await import("@/lib/auth-providers");
    expect(Object.keys(configuredProviders()).sort()).toEqual(["google", "linkedin"]);
  });
});
