import type { NextConfig } from "next";

// 'unsafe-inline' stays until the inline theme script and Next's inline payloads have
// nonces or hashes: this stops injected scripts loading from other origins, not inline
// ones. Dev also needs eval and a websocket for hot reload.
const scriptSrc = process.env.NODE_ENV === "production" ? "script-src 'self' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: `${scriptSrc}; frame-ancestors 'none'; object-src 'none'; base-uri 'self'` },
  // One year, this host only: a subdomain still on plain HTTP must not be locked out.
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
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
