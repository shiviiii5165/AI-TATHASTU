/**
 * Central configuration for AI Tathastu legal documentation, notices, and contact channels.
 * Dynamically resolves from environment variables with production-ready defaults.
 */

export const LEGAL_CONFIG = {
  website: process.env.NEXT_PUBLIC_APP_URL || "https://aitathastu.com",
  currentYear: 2026,
  effectiveDate: "30 October 2026",
  lastUpdated: "30 October 2026",
  companyName: "AI Tathastu Technologies",
  tradingName: "AI Tathastu",
  address: process.env.NEXT_PUBLIC_CONTACT_ADDRESS || process.env.CONTACT_ADDRESS || "AI Tathastu, India",
  jurisdiction: "New Delhi, Delhi, India",
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "privacy@aitathastu.com",
  supportEmail: process.env.SMTP_SUPPORT_USER || "support.aitathastu@gmail.com",
  helloEmail: process.env.SMTP_HELLO_USER || process.env.SMTP_USER || "hello.aitathastu@gmail.com",
  infoEmail: process.env.SMTP_INFO_USER || "info.aitathastu@gmail.com",
  legalEmail: process.env.NEXT_PUBLIC_LEGAL_EMAIL || "legal@aitathastu.com",
  grievanceEmail: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || "grievance@aitathastu.com",
  grievanceOfficer: {
    name: "Grievance Officer",
    designation: "Nodal & Grievance Redressal Officer",
    email: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || "grievance@aitathastu.com",
  },
};
