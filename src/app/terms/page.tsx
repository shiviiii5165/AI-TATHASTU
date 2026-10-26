import { ArrowLeft, CheckCircle2, Shield, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";

export const metadata: Metadata = {
  title: "Terms of Service · AI Tathastu",
  description: "Terms of Service and Usage Agreement for AI Tathastu.",
};

export default function TermsPage() {
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
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF2A85]/10 px-3 py-1 text-xs font-bold text-[#FF2A85]">
            <Sparkles className="size-3.5" />
            <span>Official Legal Documentation</span>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0F172A]">
            Terms of Service
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
              <strong className="font-bold">Core Principle: You own 100% of your work.</strong>
              <p className="mt-1 text-xs sm:text-sm text-emerald-800 leading-relaxed">
                Everything you build, upload, or connect—including code, preprints, notebooks, and model weights—remains your intellectual property. AI Tathastu exists solely to verify proof of work and connect you with opportunities.
              </p>
            </div>
          </div>
        </div>

        {/* Terms Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-600">
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">1. Acceptance of Terms</h2>
            <p className="mt-2">
              By accessing or using AI Tathastu (&quot;Platform&quot;), creating a profile, or signing in via Google OAuth or email sign-in link, you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not access or use the Platform.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">2. Eligibility &amp; Campus Accounts</h2>
            <p className="mt-2">
              The Platform is designed for university students, academic researchers, mentors, and hiring teams. You agree to provide accurate, current, and verifiable information during onboarding and maintain the confidentiality of your authentication credentials.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">3. Intellectual Property Rights</h2>
            <p className="mt-2">
              Students and researchers retain all copyright, patent, and intellectual property rights in and to their projects, repositories, code commits, and publications. AI Tathastu does not claim ownership over any user-submitted content. You grant AI Tathastu a limited, non-exclusive license solely to process and display your verified achievements within your profile according to your privacy settings.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">4. Verified Proof-of-Work &amp; Telemetry</h2>
            <p className="mt-2">
              Skill scores, badges, and readiness telemetry generated across our modules (Avasar, Learn, Collaborate, Meet, Iris) reflect algorithmic analysis of publicly consented repositories, coding contributions, and academic publications. We do not guarantee employment or placement, but commit to transparent, objective evaluation without artificial bias.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">5. Prohibited Conduct</h2>
            <p className="mt-2">
              Users agree not to: (a) impersonate others or fabricate academic credentials; (b) upload malicious code, exploits, or viruses; (c) attempt unauthorized access to platform servers; or (d) scrape or reverse engineer platform telemetry algorithms without prior written consent.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">6. Termination &amp; Account Deletion</h2>
            <p className="mt-2">
              You may delete your profile and all associated telemetry at any time via your account settings. Upon deletion, your profile will be removed from public indexing immediately, and telemetry data will be permanently purged in accordance with our Privacy Policy.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-xs">
            <h2 className="text-lg font-bold text-[#0F172A]">7. Contact &amp; Questions</h2>
            <p className="mt-2">
              For questions concerning these Terms, contact our legal and campus compliance team at{" "}
              <a href="mailto:legal@aitathastu.com" className="font-semibold text-[#FF2A85] underline">
                legal@aitathastu.com
              </a>{" "}
              or via our{" "}
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
