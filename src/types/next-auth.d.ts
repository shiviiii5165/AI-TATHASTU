import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    // Optimistic hint for the proxy; the DAL re-checks onboarding_state.
    onboarded: boolean;
    admin: boolean;
    // When this session last proved the user's identity (seconds), for sensitive changes.
    authTime?: number;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    onboarded?: boolean;
    admin?: boolean;
    sessionVersion?: number;
    authTime?: number;
  }
}
