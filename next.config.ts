import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Browser-side resume uploads PUT straight to a presigned R2 URL.
const r2Origin = process.env.R2_ENDPOINT ? new URL(process.env.R2_ENDPOINT).origin : "https://*.r2.cloudflarestorage.com";

// script-src keeps 'unsafe-inline'. Next's App Router writes its RSC payload as
// inline <script> tags that differ per page, so hashes can't cover them, and a
// nonce would need a per-request value, which turns every static and partially
// prerendered page (the landing page included) into a dynamic render on each hit.
// The other directives still block scripts from any other origin, plugins,
// <base> hijacking and framing. XSS sinks are covered by e2e/security-matrix.spec.ts.
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${r2Origin}${isProd ? "" : " ws: wss:"}`,
  "media-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // form-action is left out on purpose: Chrome applies it to the redirect chain
  // after a submit, which would block the Auth.js OAuth hop to Google/GitHub.
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  // Two years. includeSubDomains only reaches *.www.aitathastu.com from this host;
  // preload eligibility is decided by the apex response, see docs/security.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// Vercel's CDN adds `Access-Control-Allow-Origin: *` to every response it serves.
// Pages and assets never need cross-origin reads, so pin them to our own origin.
// API routes are excluded: /api/profile/v1/me and /api/integrations/jwks set their
// own CORS per request.
const PAGE_CORS = [{ key: "Access-Control-Allow-Origin", value: "https://www.aitathastu.com" }];

// COOP isolates our window from cross-origin openers. Not on the embed popup or
// the sign-in pages it can pass through: Collaborate and Avsar open
// /embed/authorize with window.open and need window.opener for postMessage.
const COOP = [{ key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" }];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      { source: "/((?!api/).*)", headers: PAGE_CORS },
      { source: "/((?!embed|login|api/auth).*)", headers: COOP },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
