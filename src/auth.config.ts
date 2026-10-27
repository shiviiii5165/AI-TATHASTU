import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin-emails";
import { MODULE_SLUGS } from "@/lib/dashboard/nav";

// /learning (alias of /learn) and /connections are built pages outside the nav list.
const APP_PREFIXES = ["/dashboard", "/settings", "/learning", "/connections", ...MODULE_SLUGS.map((s) => `/${s}`)];
const isAppPath = (p: string) => APP_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));

// Adapter-free config shared with src/proxy.ts. The proxy only decodes the JWT
// cookie (no DB round trip); real authorization happens in src/lib/dal.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
    verifyRequest: "/login/check-email",
    error: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isApp = isAppPath(pathname);
      // /admin needs a session only; src/lib/admin.ts decides who's an admin.
      const isProtected = isApp || pathname.startsWith("/onboarding") || pathname.startsWith("/admin");
      // Returning false redirects to pages.signIn with a callbackUrl.
      if (!isProtected) return true;
      if (!auth?.user) return false;
      // Non-admins get a real 404 before anything renders (the page re-checks against the DB).
      if (pathname.startsWith("/admin") && !auth.admin && !isAdminEmail(auth.user.email)) {
        return NextResponse.rewrite(new URL("/404", request.nextUrl), { status: 404 });
      }
      // Mid-onboarding: /onboarding resolves the exact step from the DB.
      if (isApp && !auth.onboarded) return Response.redirect(new URL("/onboarding", request.nextUrl));
      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.onboarded = token.onboarded === true;
      session.admin = token.admin === true;
      return session;
    },
  },
} satisfies NextAuthConfig;
