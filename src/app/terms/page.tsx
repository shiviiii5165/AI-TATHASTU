import { ArrowLeft, CheckCircle2, FileText, Mail, MapPin, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Terms of Use · AI Tathastu",
  description:
    "Official Terms of Use and Service Agreement for AI Tathastu. Details user rights, intellectual property ownership, AI analysis, and acceptable use.",
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[#FAFAFD] dark:bg-[#0B0F19] text-[#0F172A] dark:text-slate-100 transition-colors">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLogo href="/" withTagline size="md" />
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Terms Navigation">
            <Link
              href="/privacy"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#FF2A85] dark:hover:text-[#FF2A85] transition-colors hidden sm:inline-block"
            >
              Privacy Policy
            </Link>
            <Link
              href="/cookie-policy"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#FF2A85] dark:hover:text-[#FF2A85] transition-colors hidden sm:inline-block"
            >
              Cookie Policy
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
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FF2A85]/10 px-3 py-1 text-xs font-bold text-[#FF2A85]">
            <Sparkles className="size-3.5" />
            <span>Official Legal Documentation</span>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
            AI Tathastu — Terms of Use
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            <strong>Effective Date:</strong> {LEGAL_CONFIG.effectiveDate} · <strong>Last Updated:</strong> {LEGAL_CONFIG.lastUpdated}
          </p>
        </div>

        {/* Quick Contact & Summary Bar */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
            <Mail className="size-4 text-[#FF2A85] shrink-0" />
            <div>
              <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Support Email</span>
              <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-[#FF2A85]">
                {LEGAL_CONFIG.supportEmail}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
            <Mail className="size-4 text-[#FF2A85] shrink-0" />
            <div>
              <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Legal Email</span>
              <a href={`mailto:${LEGAL_CONFIG.legalEmail}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-[#FF2A85]">
                {LEGAL_CONFIG.legalEmail}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
            <MapPin className="size-4 text-[#FF2A85] shrink-0" />
            <div>
              <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Operated By</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{LEGAL_CONFIG.companyName}</span>
            </div>
          </div>
        </div>

        {/* Highlight Callout */}
        <div className="mb-10 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-5 text-sm text-emerald-900 dark:text-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div>
              <strong className="font-bold text-base">Core Principle: You own 100% of your work.</strong>
              <p className="mt-1 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">
                Everything you create, submit, or connect—including resumes, code repositories, research papers, and portfolios—remains your intellectual property. AI Tathastu processes your content solely to provide requested analysis and career opportunities.
              </p>
            </div>
          </div>
        </div>

        {/* Table of Contents Pill Nav */}
        <nav className="mb-10 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs" aria-label="Table of Contents">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            <FileText className="size-3.5 text-[#FF2A85]" />
            <span>Table of Contents (27 Sections)</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              { id: "term-1", title: "1. Acceptance of Terms" },
              { id: "term-2", title: "2. About AI Tathastu" },
              { id: "term-3", title: "3. Operator & Contacts" },
              { id: "term-4", title: "4. Eligibility & Age" },
              { id: "term-5", title: "5. Accounts & Security" },
              { id: "term-6", title: "6. User Content & Info" },
              { id: "term-7", title: "7. Resume Extraction" },
              { id: "term-8", title: "8. AI Analysis & Scores" },
              { id: "term-9", title: "9. No Outcome Guarantee" },
              { id: "term-10", title: "10. Profiles & Discovery" },
              { id: "term-11", title: "11. Recruiter Rules" },
              { id: "term-12", title: "12. External Platforms" },
              { id: "term-13", title: "13. Acceptable Use" },
              { id: "term-14", title: "14. Moderation & Abuse" },
              { id: "term-15", title: "15. Intellectual Property" },
              { id: "term-16", title: "16. Feedback" },
              { id: "term-17", title: "17. Third-Party Listings" },
              { id: "term-18", title: "18. Paid Services" },
              { id: "term-19", title: "19. Service Availability" },
              { id: "term-20", title: "20. Suspension & Exit" },
              { id: "term-21", title: "21. Disclaimers" },
              { id: "term-22", title: "22. Liability Limitations" },
              { id: "term-23", title: "23. Indemnity" },
              { id: "term-24", title: "24. Privacy Reference" },
              { id: "term-25", title: "25. Governing Law" },
              { id: "term-26", title: "26. Terms Modifications" },
              { id: "term-27", title: "27. Contact Information" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-slate-600 dark:text-slate-300 hover:text-[#FF2A85] transition-colors py-1 truncate"
              >
                {item.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Terms Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          <section id="term-1" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">1. Acceptance of Terms</h2>
            <p className="mb-2">
              These Terms of Use (&quot;Terms&quot;) govern your access to and use of AI Tathastu, including its website, accounts, professional profiles, AI-powered analysis, recommendations, profile-discovery features, learning features, and other services made available through the platform.
            </p>
            <p className="mb-2">
              By accessing or using the service, you agree to these Terms, subject to any mandatory rights provided by applicable law. If you do not agree to these Terms, do not use the relevant service.
            </p>
            <p>
              If you access the platform on behalf of an organization, you represent that you are authorized to act for that organization.
            </p>
          </section>

          <section id="term-2" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">2. About AI Tathastu</h2>
            <p className="mb-2">AI Tathastu is designed to help students and professionals:</p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>Build and maintain verified professional profiles.</li>
              <li>Extract and organize relevant information from resumes and authorized sources.</li>
              <li>Understand skills, projects, and practical competencies.</li>
              <li>Receive AI-generated profile insights and identify potential skill gaps.</li>
              <li>Discover jobs, internships, projects, and learning opportunities.</li>
              <li>Explore mentorship, networking, and cross-campus collaboration features.</li>
              <li>Showcase selected professional information with verified proof of work.</li>
              <li>Access career-related recommendations and readiness indicators.</li>
            </ul>
            <p>
              The platform&apos;s available features may evolve as the service develops, subject to applicable law and any contractual commitments.
            </p>
          </section>

          <section id="term-3" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">3. Operator and Contact Information</h2>
            <p className="mb-3">
              AI Tathastu is a brand and service operated by:
            </p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-1 text-xs">
              <p><strong>Legal Operator:</strong> {LEGAL_CONFIG.companyName}</p>
              <p><strong>Contact Address:</strong> {LEGAL_CONFIG.address}</p>
              <p><strong>Support Email:</strong> <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-[#FF2A85] underline">{LEGAL_CONFIG.supportEmail}</a></p>
              <p><strong>Legal Notices:</strong> <a href={`mailto:${LEGAL_CONFIG.legalEmail}`} className="text-[#FF2A85] underline">{LEGAL_CONFIG.legalEmail}</a></p>
            </div>
          </section>

          <section id="term-4" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">4. Eligibility and Age Requirements</h2>
            <p className="mb-2">
              AI Tathastu may serve users under the age of 18 only in accordance with applicable legal requirements and safeguards implemented for relevant features.
            </p>
            <p className="mb-2">
              Where verified parental or guardian consent is mandated by law, the relevant feature will not be activated until the process has completed. Under-18 users are not made publicly discoverable by default.
            </p>
            <p>
              You agree to provide truthful age information. We reserve the right to restrict access where required to enforce age policies or comply with legal mandates.
            </p>
          </section>

          <section id="term-5" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">5. Accounts and Account Security</h2>
            <p className="mb-2">When maintaining an account, you agree to:</p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>Provide accurate, reasonably current credentials and information.</li>
              <li>Keep login sessions and credentials strictly confidential.</li>
              <li>Promptly report any suspected unauthorized access.</li>
              <li>Avoid impersonating others or misrepresenting qualifications.</li>
              <li>Avoid sharing secret tokens or credentials in public profile areas.</li>
            </ul>
          </section>

          <section id="term-6" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">6. User Content and Uploaded Information</h2>
            <p className="mb-2">
              You remain fully responsible for content you upload or publish through AI Tathastu—including resumes, CVs, portfolio links, certificates, code samples, and text.
            </p>
            <p>
              You warrant that you possess the necessary rights and permissions to upload the materials and that they do not infringe third-party intellectual property or confidentiality agreements.
            </p>
          </section>

          <section id="term-7" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">7. Resume Extraction and Profile Creation</h2>
            <p className="mb-2">
              AI Tathastu processes submitted documents to parse and organize relevant career data. Extraction is automated and may contain inaccuracies. Users are encouraged to review extracted data and make corrections via profile controls.
            </p>
            <p>
              Uploading a document authorizes AI Tathastu to parse and store it to deliver requested features, but does not transfer document ownership to us.
            </p>
          </section>

          <section id="term-8" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">8. AI Analysis, Scores, and Recommendations</h2>
            <p className="mb-2">
              We employ software heuristics, local models, and external AI providers to generate profile summaries, skill taxonomies, readiness indicators, and opportunity matches.
            </p>
            <p>
              AI-generated scores and insights are algorithmic estimates based on available telemetry. They are not guaranteed or scientifically infallible evaluations of capability.
            </p>
          </section>

          <section id="term-9" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">9. No Guarantee of Employment or Career Results</h2>
            <p className="mb-2">
              AI Tathastu provides tools for profile building and opportunity discovery. We do not guarantee:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>Employment, job offers, or internship selections.</li>
              <li>Interview invites or specific promotion outcomes.</li>
              <li>Academic admissions or fellowship awards.</li>
              <li>Universal acceptance of generated skill scores by third-party recruiters.</li>
            </ul>
            <p>
              All hiring and recruitment determinations are made independently by employers and opportunity providers.
            </p>
          </section>

          <section id="term-10" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">10. Public Profiles and Professional Discovery</h2>
            <p className="mb-2">
              Your profile visibility settings dictate who may view your verified skills and achievements. Profiles are private by default.
            </p>
            <p>
              Enabling public discovery allows designated fields (such as your bio, projects, and skills) to be viewed by recruiters, peers, and search engines. You may adjust or revoke public visibility at any time in your account settings.
            </p>
          </section>

          <section id="term-11" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">11. Rules for Recruiters and Opportunity Providers</h2>
            <p className="mb-2">
              Employers, recruiters, and academic labs accessing candidate profiles must:
            </p>
            <ul className="list-disc pl-5 space-y-1 mb-2">
              <li>Use candidate information strictly for legitimate, declared hiring purposes.</li>
              <li>Respect candidate privacy preferences and avoid unauthorized data scraping or resale.</li>
              <li>Provide accurate job details and refrain from deceptive or fraudulent postings.</li>
              <li>Comply with all applicable labor, anti-discrimination, and data privacy regulations.</li>
            </ul>
          </section>

          <section id="term-12" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">12. External Platforms and Integrations</h2>
            <p>
              When connecting third-party platforms (such as GitHub, LinkedIn, Kaggle, or ORCID), you agree to abide by their terms of service. AI Tathastu is not endorsed by or affiliated with these platforms merely because an integration is available.
            </p>
          </section>

          <section id="term-13" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">13. Acceptable Use and Prohibited Conduct</h2>
            <p className="mb-2">Users must not:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Violate applicable national or international laws.</li>
              <li>Impersonate individuals or forge academic credentials.</li>
              <li>Distribute malicious software, scrapers, or exploits.</li>
              <li>Interfere with platform infrastructure or session integrity.</li>
              <li>Harass, exploit, or unlawfully discriminate against others.</li>
              <li>Infringe intellectual property or confidentiality protections.</li>
            </ul>
          </section>

          <section id="term-14" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">14. Public Content, Reporting, and Moderation</h2>
            <p className="mb-2">
              We reserve the right to review, restrict, or remove content that violates these Terms, poses security risks, or breaches law.
            </p>
            <p>
              To report abuse, fake listings, or copyright violations, email{" "}
              <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-[#FF2A85] font-semibold underline">
                {LEGAL_CONFIG.supportEmail}
              </a>
              .
            </p>
          </section>

          <section id="term-15" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">15. Intellectual Property</h2>
            <p className="mb-3">
              The AI Tathastu platform, branding, logos, graphics, and interface code are protected under intellectual property laws and owned by the operator or licensors.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl text-xs space-y-2">
              <strong className="block text-slate-800 dark:text-slate-200">15.1 Licence to Process Your Content:</strong>
              <p>
                You grant AI Tathastu a limited, non-exclusive license to host, format, analyze, and display your submitted content strictly as necessary to deliver platform features in accordance with your settings. This license does not transfer your ownership.
              </p>
            </div>
          </section>

          <section id="term-16" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">16. Feedback</h2>
            <p>
              Any unsolicited suggestions or feature ideas you provide may be used by AI Tathastu to improve the service without obligation of compensation, to the extent permitted by law.
            </p>
          </section>

          <section id="term-17" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">17. Third-Party Opportunities and Services</h2>
            <p>
              External opportunity listings are provided for informational discovery. Users should independently verify employer legitimacy and offer terms before sharing sensitive financial information.
            </p>
          </section>

          <section id="term-18" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">18. Paid Services and Future Monetization</h2>
            <p>
              Future premium features will present clear pricing, renewal, cancellation, and refund terms at checkout prior to user commitment. No recurring charges will be initiated without explicit user consent.
            </p>
          </section>

          <section id="term-19" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">19. Availability and Changes to the Platform</h2>
            <p>
              We aim for high availability, but uninterrupted service is not guaranteed due to maintenance, cloud provider outages, or network constraints. We may introduce or alter features for operational or security reasons.
            </p>
          </section>

          <section id="term-20" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">20. Suspension and Termination</h2>
            <p>
              You may terminate your account at any time via settings or by contacting{" "}
              <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-[#FF2A85] font-semibold underline">
                {LEGAL_CONFIG.supportEmail}
              </a>
              . We reserve the right to suspend accounts engaged in fraud, security breaches, or material violation of these Terms.
            </p>
          </section>

          <section id="term-21" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">21. Disclaimers</h2>
            <p>
              To the maximum extent permitted by law, the platform is provided on an &quot;as available&quot; basis without warranties of fitness for a particular purpose or infallibility of algorithmic insights.
            </p>
          </section>

          <section id="term-22" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">22. Limitation of Liability</h2>
            <p>
              To the extent permitted by law, the operator is not liable for indirect, incidental, or consequential losses. Mandatory statutory rights that cannot be legally excluded remain unaffected.
            </p>
          </section>

          <section id="term-23" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">23. Indemnity</h2>
            <p>
              You agree to indemnify the operator against losses or claims arising directly from your unlawful conduct, willful infringement of third-party rights, or material breach of these Terms.
            </p>
          </section>

          <section id="term-24" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">24. Privacy</h2>
            <p>
              All personal data processing is governed by our{" "}
              <Link href="/privacy" className="text-[#FF2A85] font-semibold underline">
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link href="/cookie-policy" className="text-[#FF2A85] font-semibold underline">
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          <section id="term-25" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">25. Governing Law and Jurisdiction</h2>
            <p>
              These Terms are governed by the laws of India. Courts having jurisdiction in {LEGAL_CONFIG.jurisdiction} shall have jurisdiction over legal disputes arising under these Terms, subject to mandatory statutory consumer protections.
            </p>
          </section>

          <section id="term-26" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">26. Changes to These Terms</h2>
            <p>
              We may revise these Terms as our platform evolves. Material changes will be communicated via website notices or email prior to taking effect.
            </p>
          </section>

          <section id="term-27" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">27. Contact Information</h2>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 text-xs">
              <p><strong>Legal Operator:</strong> {LEGAL_CONFIG.companyName}</p>
              <p><strong>Trading Name:</strong> {LEGAL_CONFIG.tradingName}</p>
              <p><strong>Website:</strong> {LEGAL_CONFIG.website}</p>
              <p><strong>Contact Address:</strong> {LEGAL_CONFIG.address}</p>
              <p><strong>Support Email:</strong> <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-[#FF2A85] underline">{LEGAL_CONFIG.supportEmail}</a></p>
              <p><strong>Legal Email:</strong> <a href={`mailto:${LEGAL_CONFIG.legalEmail}`} className="text-[#FF2A85] underline">{LEGAL_CONFIG.legalEmail}</a></p>
              <p><strong>Grievance Redressal Officer:</strong> {LEGAL_CONFIG.grievanceOfficer.name} ({LEGAL_CONFIG.grievanceOfficer.designation})</p>
              <p><strong>Grievance Contact:</strong> <a href={`mailto:${LEGAL_CONFIG.grievanceEmail}`} className="text-[#FF2A85] underline">{LEGAL_CONFIG.grievanceEmail}</a></p>
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
            <Link href="/cookie-policy" className="hover:text-[#FF2A85] transition-colors">
              Cookie Policy
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
