import { ArrowLeft, CheckCircle2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Privacy Policy · AI Tathastu",
  description: "Privacy Policy, Data Protection, and Telemetry Rights for AI Tathastu.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-[#FAFAFD] text-[#0F172A]">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLogo href="/" withTagline size="md" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:text-slate-900"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Login</span>
            </Link>
            <Link
              href="/"
              className="hidden sm:inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <div className="mb-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
            <ShieldCheck className="size-3.5" />
            <span>Privacy &amp; Data Rights</span>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0F172A]">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Last updated: October 2025 · Effective date: October 2025
          </p>
        </div>

        {/* Highlight Callout */}
        <div className="mb-10 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 text-sm text-emerald-900">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
            <div>
              <strong className="font-bold">Our Privacy Promise</strong>
              <p className="mt-1 text-xs sm:text-sm text-emerald-800 leading-relaxed">
                We never touch private code repositories without your permission, never sell student data to third-party brokers, and never conduct invasive background surveillance. Your telemetry is completely yours.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Policy Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-600">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">1. Information We Collect</h2>
            <p className="mt-2">
              We collect information you provide directly to us when you sign in, create a profile, or connect your developer footprint:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li><strong>Account Identifiers:</strong> Name, university/student email address, and avatar provided via Google OAuth or magic link authentication.</li>
              <li><strong>Connected Profiles:</strong> Public repository metadata (GitHub), publications (ORCID, arXiv), and competitive profiles (Kaggle, LeetCode) only when explicitly connected by you.</li>
              <li><strong>Profile Metadata:</strong> Skills, bio, project descriptions, and academic interests that you choose to display.</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">2. How We Use Information</h2>
            <p className="mt-2">
              We use collected telemetry strictly to:
            </p>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Generate your verifiable proof-of-work skill graph.</li>
              <li>Match your verified capabilities with research lab openings, fellowships, and placement opportunities (Avasar).</li>
              <li>Provide personalized curriculum and skill-gap diagnostics (Learn &amp; Iris).</li>
              <li>Enable safe cross-campus project collaborations (Collaborate).</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">3. Zero Data Selling &amp; AI Training Consent</h2>
            <p className="mt-2">
              <strong>We never sell, rent, or trade your personal data.</strong> Your submitted projects and code commits are never harvested to train general commercial AI models without explicit, opt-in consent.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">4. Essential Cookies &amp; Tracking</h2>
            <p className="mt-2">
              We only use strictly essential cookies required for session security, authentication state, and CSRF protection. We do not use third-party advertising tracking cookies or invasive fingerprinters.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">5. Data Retention &amp; Your Right to Erasure</h2>
            <p className="mt-2">
              You maintain total control over your data. You may review, modify, or delete your account at any time. When you request deletion, all personal data, verified graphs, and active tokens are permanently purged from our operational databases.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">6. Contact Our Data Protection Team</h2>
            <p className="mt-2">
              For privacy inquiries or data rights requests, email{" "}
              <a href="mailto:privacy@aitathastu.com" className="font-semibold text-emerald-600 underline">
                privacy@aitathastu.com
              </a>{" "}
              or contact us via our{" "}
              <Link href="/contact" className="font-semibold text-slate-800 underline">
                Support Channel
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
