import type { MetadataRoute } from "next";

const SITE = "https://www.aitathastu.com";

// Signed-in areas redirect to /login anyway; disallowing them just keeps crawlers
// from wasting requests. This is not access control.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin-mfa", "/api/", "/dashboard", "/settings/", "/onboarding", "/embed", "/integrations/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
