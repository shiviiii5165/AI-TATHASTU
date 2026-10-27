import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

// Optimistic gate only: bounces signed-out visitors away from protected routes
// using the JWT cookie. Step ordering is enforced server-side in src/lib/dal.ts.
const { auth } = NextAuth(authConfig);

export default auth;

// Must be a static literal (Next.js analyses it at build time); keep in sync
// with src/lib/dashboard/nav.ts. authorized() decides per path from that list.
export const config = {
  matcher: [
    "/onboarding/:path*",
    "/dashboard/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/(profile|projects|skills|achievements|opportunities|internships|learn|learning|people|mentor|research|ai-interview|collaborate|eris|meet|cv-builder|avasar|connections)/:path*",
  ],
};
