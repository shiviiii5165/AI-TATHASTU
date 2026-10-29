import { ArrowLeft, CheckCircle2, Cookie, FileText, Mail, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Cookie Policy · AI Tathastu",
  description:
    "Official Cookie Policy for AI Tathastu. Explains how we use cookies, session storage, and security tokens to operate our platform.",
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-dvh bg-[#FAFAFD] dark:bg-[#0B0F19] text-[#0F172A] dark:text-slate-100 transition-colors">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLogo href="/" withTagline size="md" />
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Cookie Policy Navigation">
            <Link
              href="/privacy"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#8B5CF6] dark:hover:text-[#8B5CF6] transition-colors hidden sm:inline-block"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#8B5CF6] dark:hover:text-[#8B5CF6] transition-colors hidden sm:inline-block"
            >
              Terms of Use
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-2xs transition-colors hover:border-slate-300 dark:hover:border-slate-700"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Login</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="mx-auto max-w-4xl px-6 py-10 sm:py-14">
        {/* Header Lockup */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-3 py-1 text-xs font-bold text-purple-600 dark:text-purple-400">
            <Cookie className="size-3.5" />
            <span>Official Legal Documentation</span>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
            AI Tathastu — Cookie Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            <strong>Effective Date:</strong> {LEGAL_CONFIG.effectiveDate} · <strong>Last Updated:</strong> {LEGAL_CONFIG.lastUpdated}
          </p>
        </div>

        {/* Quick Contact & Summary Bar */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
            <Mail className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Privacy Email</span>
              <a href={`mailto:${LEGAL_CONFIG.privacyEmail}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-purple-600">
                {LEGAL_CONFIG.privacyEmail}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
            <Mail className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Support Email</span>
              <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-purple-600">
                {LEGAL_CONFIG.supportEmail}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
            <MapPin className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Contact Address</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{LEGAL_CONFIG.address}</span>
            </div>
          </div>
        </div>

        {/* Highlight Callout */}
        <div className="mb-10 rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/70 dark:bg-purple-950/20 p-5 text-sm text-purple-900 dark:text-purple-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
            <div>
              <strong className="font-bold text-base">Privacy-First Storage Architecture</strong>
              <p className="mt-1 text-xs sm:text-sm text-purple-800 dark:text-purple-300 leading-relaxed">
                We use strictly essential browser storage and authentication cookies required for session security, account access, and theme preferences. We do not deploy third-party advertising trackers or invasive fingerprinters.
              </p>
            </div>
          </div>
        </div>

        {/* Table of Contents Pill Nav */}
        <nav className="mb-10 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs" aria-label="Table of Contents">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            <FileText className="size-3.5 text-purple-600 dark:text-purple-400" />
            <span>Table of Contents (11 Sections)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              { id: "cookie-1", title: "1. Introduction" },
              { id: "cookie-2", title: "2. What Are Cookies?" },
              { id: "cookie-3", title: "3. Categories of Technologies" },
              { id: "cookie-4", title: "4. Why We Use These Techs" },
              { id: "cookie-5", title: "5. Cookie Preferences & Consent" },
              { id: "cookie-6", title: "6. Browser Controls" },
              { id: "cookie-7", title: "7. Retention & Expiry" },
              { id: "cookie-8", title: "8. Personal Info & Cookies" },
              { id: "cookie-9", title: "9. International Services" },
              { id: "cookie-10", title: "10. Updates to This Policy" },
              { id: "cookie-11", title: "11. Contact Information" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-slate-600 dark:text-slate-300 hover:text-purple-600 transition-colors py-1 truncate"
              >
                {item.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Cookie Policy Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <section id="cookie-1" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">1. Introduction</h2>
            <p className="mb-2">
              This Cookie Policy explains how AI Tathastu (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) may use cookies and similar technologies on its website ({LEGAL_CONFIG.website}) and web applications.
            </p>
            <p className="mb-2">
              These technologies support authentication, account security, user preferences, website functionality, performance measurement, and error diagnostics.
            </p>
            <p>
              This Policy should be read in conjunction with our{" "}
              <Link href="/privacy" className="text-purple-600 dark:text-purple-400 font-semibold underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="text-purple-600 dark:text-purple-400 font-semibold underline">
                Terms of Use
              </Link>
              .
            </p>
          </section>

          <section id="cookie-2" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">2. What Are Cookies?</h2>
            <p className="mb-2">
              Cookies are small text files that a website stores on your device when you visit. They enable the service to remember your authentication session, retain security state, and preserve user preferences across requests.
            </p>
            <p className="mb-2">We also use related browser storage mechanisms:</p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li><strong>Local Storage:</strong> Used for persistent client preferences such as dark/light theme choice.</li>
              <li><strong>Session Storage:</strong> Used for temporary multi-step wizard state during onboarding.</li>
              <li><strong>Security Tokens &amp; HTTP-Only Cookies:</strong> Encrypted, tamper-proof session tokens used for secure authentication.</li>
            </ul>
          </section>

          <section id="cookie-3" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">3. Categories of Cookies and Similar Technologies</h2>
            <div className="space-y-4">
              <div className="border-l-2 border-purple-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.1 Strictly Necessary Technologies</h3>
                <p className="mt-1">
                  Required to operate requested platform functions—including account sign-in, Auth.js session cookies, CSRF protection, and load balancer routing. Strictly necessary cookies operate without separate consent as they are required to deliver the core service.
                </p>
              </div>

              <div className="border-l-2 border-purple-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.2 Functional Technologies</h3>
                <p className="mt-1">
                  Remember user interface preferences, such as system theme (light/dark mode) and layout choices, to provide a consistent experience across visits.
                </p>
              </div>

              <div className="border-l-2 border-purple-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.3 Analytics and Performance Technologies</h3>
                <p className="mt-1">
                  Aggregate performance diagnostic metrics to identify system bottlenecks, track page load speeds, and monitor server health. Optional analytics are activated only after consent where required by applicable law.
                </p>
              </div>

              <div className="border-l-2 border-purple-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.4 Advertising and Marketing Technologies</h3>
                <p className="mt-1">
                  AI Tathastu does not deploy third-party advertising cookies, cross-site behavior trackers, or programmatic retargeting tags.
                </p>
              </div>

              <div className="border-l-2 border-purple-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.5 Third-Party Technologies</h3>
                <p className="mt-1">
                  Authorized integrations (e.g., Google OAuth or LinkedIn authentication) may utilize their respective security mechanisms during external sign-in flows.
                </p>
              </div>
            </div>
          </section>

          <section id="cookie-4" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">4. Why We Use These Technologies</h2>
            <p className="mb-2">We utilize these mechanisms to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Maintain authenticated sessions securely without exposing credentials.</li>
              <li>Protect student and recruiter accounts against cross-site request forgery (CSRF).</li>
              <li>Remember your appearance settings (Dark/Light mode).</li>
              <li>Diagnose server errors and monitor infrastructure availability.</li>
            </ul>
          </section>

          <section id="cookie-5" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">5. Cookie Preferences and Consent</h2>
            <p className="mb-2">
              Where mandated by law, AI Tathastu provides controls allowing users to accept or decline optional non-essential technologies.
            </p>
            <p>
              Strictly necessary cookies cannot be disabled while using the platform, as they are technically indispensable for authenticated service delivery.
            </p>
          </section>

          <section id="cookie-6" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">6. Browser Controls</h2>
            <p className="mb-2">
              Most web browsers allow you to manage or delete cookies via browser settings. You may clear cookies or configure your browser to reject cookies.
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              <strong>Notice:</strong> Disabling essential cookies will prevent authentication and disrupt core platform functionality.
            </p>
          </section>

          <section id="cookie-7" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">7. Retention and Expiry</h2>
            <p className="mb-2">
              Session cookies expire automatically when you close your browser or log out. Persistent tokens (such as theme preferences or extended login sessions) remain until their declared expiry or until cleared by the user.
            </p>
          </section>

          <section id="cookie-8" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">8. Personal Information and Cookies</h2>
            <p>
              Any personal data associated with cookies or session tokens is handled in strict accordance with our{" "}
              <Link href="/privacy" className="text-purple-600 dark:text-purple-400 font-semibold underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section id="cookie-9" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">9. International Services and Third Parties</h2>
            <p>
              Where external OAuth providers or cloud hosting nodes process session integrity across jurisdictions, processing is safeguarded under compliant international transfer mechanisms.
            </p>
          </section>

          <section id="cookie-10" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">10. Updates to This Policy</h2>
            <p>
              We may revise this Cookie Policy as browser standards and platform architecture change. The updated version will be indicated by the &quot;Last Updated&quot; date at the top of this document.
            </p>
          </section>

          <section id="cookie-11" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">11. Contact Information</h2>
            <p className="mb-3">
              If you have any questions regarding our use of cookies or storage technologies, please contact:
            </p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-1.5 text-xs">
              <p><strong>Website:</strong> {LEGAL_CONFIG.website}</p>
              <p><strong>Privacy Inquiries:</strong> <a href={`mailto:${LEGAL_CONFIG.privacyEmail}`} className="text-purple-600 dark:text-purple-400 underline">{LEGAL_CONFIG.privacyEmail}</a></p>
              <p><strong>Support Team:</strong> <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-purple-600 dark:text-purple-400 underline">{LEGAL_CONFIG.supportEmail}</a></p>
              <p><strong>Contact Address:</strong> {LEGAL_CONFIG.address}</p>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {LEGAL_CONFIG.currentYear} {LEGAL_CONFIG.tradingName}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#FF2A85] transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-[#FF2A85] transition-colors">
              Terms of Use
            </Link>
            <Link href="/contact" className="hover:text-[#FF2A85] transition-colors">
              Support Center
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
