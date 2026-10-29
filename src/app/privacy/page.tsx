import { ArrowLeft, CheckCircle2, FileText, Mail, MapPin, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { LEGAL_CONFIG } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Privacy Policy · AI Tathastu",
  description:
    "Official Privacy Policy for AI Tathastu. Explains what personal information we collect, how AI analysis works, profile visibility, and your privacy rights.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-[#FAFAFD] dark:bg-[#0B0F19] text-[#0F172A] dark:text-slate-100 transition-colors">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-[#0B0F19]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <BrandLogo href="/" withTagline size="md" />
          <nav className="flex items-center gap-2 sm:gap-4" aria-label="Policy Navigation">
            <Link
              href="/terms"
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#FF2A85] dark:hover:text-[#FF2A85] transition-colors hidden sm:inline-block"
            >
              Terms of Use
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
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="size-3.5" />
            <span>Official Legal Documentation</span>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
            AI Tathastu — Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            <strong>Effective Date:</strong> {LEGAL_CONFIG.effectiveDate} · <strong>Last Updated:</strong> {LEGAL_CONFIG.lastUpdated}
          </p>
        </div>

        {/* Quick Contact & Summary Bar */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
            <Mail className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Privacy Email</span>
              <a href={`mailto:${LEGAL_CONFIG.privacyEmail}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400">
                {LEGAL_CONFIG.privacyEmail}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
            <Mail className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Support Email</span>
              <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="font-bold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400">
                {LEGAL_CONFIG.supportEmail}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 text-xs">
            <MapPin className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <span className="block font-semibold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">Contact Address</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{LEGAL_CONFIG.address}</span>
            </div>
          </div>
        </div>

        {/* Highlight Callout */}
        <div className="mb-10 rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20 p-5 text-sm text-emerald-900 dark:text-emerald-200">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div>
              <strong className="font-bold text-base">Our Privacy Promise</strong>
              <p className="mt-1 text-xs sm:text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">
                We never touch private repositories without explicit authorization, never sell your data to third-party data brokers, and never conduct invasive surveillance. You own your telemetry, with granular export and deletion controls available at any time.
              </p>
            </div>
          </div>
        </div>

        {/* Table of Contents Pill Nav */}
        <nav className="mb-10 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs" aria-label="Table of Contents">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            <FileText className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Table of Contents</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              { id: "sec-1", title: "1. Introduction" },
              { id: "sec-2", title: "2. Scope of This Policy" },
              { id: "sec-3", title: "3. Information We Collect" },
              { id: "sec-4", title: "4. How We Use Information" },
              { id: "sec-5", title: "5. AI Processing & Analysis" },
              { id: "sec-6", title: "6. Profiles & Visibility" },
              { id: "sec-7", title: "7. Lawful Basis & Consent" },
              { id: "sec-8", title: "8. Disclosure & Sharing" },
              { id: "sec-9", title: "9. Cookies & Tracking" },
              { id: "sec-10", title: "10. Data Retention" },
              { id: "sec-11", title: "11. Data Security" },
              { id: "sec-12", title: "12. International Processing" },
              { id: "sec-13", title: "13. Privacy Rights & Requests" },
              { id: "sec-14", title: "14. Children's Privacy" },
              { id: "sec-15", title: "15. Third-Party Services" },
              { id: "sec-16", title: "16. Policy Changes" },
              { id: "sec-17", title: "17. Contact & Grievance" },
            ].map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors py-1 truncate"
              >
                {item.title}
              </a>
            ))}
          </div>
        </nav>

        {/* Privacy Policy Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {/* Section 1 */}
          <section id="sec-1" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">1. Introduction</h2>
            <p className="mb-3">
              AI Tathastu (&quot;AI Tathastu&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is an AI-powered platform designed to help students and professionals build professional profiles, understand their skills, discover opportunities, improve their career readiness, and access personalized learning and career recommendations.
            </p>
            <p className="mb-3">
              Depending on the features used, our platform may collect information from users, process resumes and professional profiles, analyze skills and projects using artificial intelligence (AI), generate derived insights, and make selected professional information available to other users, recruiters, employers, or the public through profile-discovery features.
            </p>
            <p className="mb-3">
              This Privacy Policy explains what personal information we may collect, why we process it, how AI analysis works, how profile visibility operates, when information may be shared, how long information may be retained, and how you can contact us about privacy concerns.
            </p>
            <p className="mb-3">
              Your use of AI Tathastu is subject to this Privacy Policy and our{" "}
              <Link href="/terms" className="text-emerald-600 dark:text-emerald-400 font-semibold underline">
                Terms of Use
              </Link>
              .
            </p>
            <p>
              We will provide applicable notices and obtain consent where required by the laws in force and applicable to the relevant processing activity.
            </p>
          </section>

          {/* Section 2 */}
          <section id="sec-2" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">2. Scope of This Policy</h2>
            <p className="mb-3">This Privacy Policy applies to information processed through:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li>The AI Tathastu website and web applications ({LEGAL_CONFIG.website}).</li>
              <li>Account registration, login, authentication, and profile management.</li>
              <li>Resume and CV uploads, document extraction, and profile creation.</li>
              <li>AI-powered skill analysis, career insights, and recommendation features.</li>
              <li>Professional profile discovery and profile-sharing features.</li>
              <li>Connected third-party professional and learning platforms.</li>
              <li>Job, internship, project, learning, mentorship, and collaboration features, when available.</li>
              <li>Customer support, privacy requests, and grievance handling.</li>
              <li>Future paid services, if introduced.</li>
              <li>Other services that link to or expressly incorporate this Privacy Policy.</li>
            </ul>
            <p>
              Third-party services accessed through external links may have their own privacy policies and terms.
            </p>
          </section>

          {/* Section 3 */}
          <section id="sec-3" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">3. Information We Collect</h2>
            <p className="mb-4">
              The information we process depends on the features you use, the information you submit, the permissions you grant, and the applicable legal requirements.
            </p>

            <div className="space-y-4">
              <div className="border-l-2 border-emerald-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.1 Account and Registration Information</h3>
                <p className="mt-1">
                  We may collect: name and display name; email address and account identifiers; contact information you choose to provide; authentication and account-security information; profile photograph or avatar, if supplied; account preferences and profile settings; age-eligibility information where reasonably necessary; and records of consent, authorization, and relevant account-setting changes.
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  <strong>Notice:</strong> We do not intend to collect unnecessary identity information merely because it may be useful in a future feature. Do not submit passwords, authentication secrets, or private access tokens in public profile fields.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.2 Education and Professional Information</h3>
                <p className="mt-1">
                  You may choose to provide: school, college, university, or institution; degree, course, discipline, and graduation year; education history and qualifications; employment and internship experience; skills, tools, programming languages, and competencies; projects, portfolios, awards, and achievements; certifications and training; career interests and preferred roles; learning goals and professional aspirations; and professional profiles and portfolio links.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.3 Resumes, CVs, and Uploaded Documents</h3>
                <p className="mt-1">
                  When you upload a resume, CV, certificate, project document, or other file, we may process its contents to extract relevant information including contact information, education, skills, projects, and achievements.
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Automated extraction may be incomplete or inaccurate. Review the resulting profile and correct any errors where the relevant controls are available. Uploading a resume does not, by itself, authorize us to make every extracted detail publicly visible.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.4 Connected and External Professional Profiles</h3>
                <p className="mt-1">
                  If you supply a professional profile URL or connect an external platform (such as GitHub, LinkedIn, Kaggle, LeetCode, or ORCID), we process authorized public data according to platform permissions.
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  <strong>Mention of a platform does not mean an integration is currently active.</strong> Actual availability depends on implemented features and granted permissions.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.5 AI-Generated and Derived Information</h3>
                <p className="mt-1">
                  AI Tathastu may derive structured profiles, skill classifications, estimated proficiencies, identified skill gaps, career-readiness scores, suggested learning roadmaps, and opportunity-match estimates using local AI models, external AI services, or matching algorithms.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.6 Technical and Usage Information</h3>
                <p className="mt-1">
                  We process IP addresses, browser and device information, session identifiers, security timestamps, pages used, error reports, and essential cookies to operate and protect the service.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.7 Communications and Support</h3>
                <p className="mt-1">
                  Support communications, tickets, and feedback are retained to investigate issues and resolve user inquiries.
                </p>
              </div>

              <div className="border-l-2 border-emerald-500/50 pl-4">
                <h3 className="font-bold text-[#0F172A] dark:text-white">3.8 Payment and Billing Information</h3>
                <p className="mt-1">
                  Paid services are planned for the future. If paid services are introduced, transaction references and billing details will be handled through approved payment infrastructure with prior disclosure.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section id="sec-4" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">4. How We Use Your Information</h2>
            <div className="space-y-3">
              <p><strong>4.1 Platform Operations:</strong> To create and manage accounts, maintain authentication sessions, store profiles, and process user requests.</p>
              <p><strong>4.2 AI Analysis:</strong> To extract resume details, organize skills, identify gaps, estimate career readiness, and suggest personalized projects.</p>
              <p><strong>4.3 Opportunity Recommendations:</strong> To recommend matching internships, jobs, research projects, and mentorship opportunities based on verified skills.</p>
              <p><strong>4.4 Profile Discovery:</strong> Depending on chosen visibility settings, to showcase selected skills and achievements to recruiters or peers. <em>AI analysis, profile creation, and public disclosure are strictly distinct activities.</em></p>
              <p><strong>4.5 Platform Security:</strong> To detect abuse, troubleshoot technical faults, evaluate recommendation quality, and enforce platform terms.</p>
              <p><strong>4.6 Communications:</strong> To send essential account alerts, security notifications, and responses to support tickets.</p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="sec-5" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">5. AI Processing and Automated Analysis</h2>
            <div className="space-y-3">
              <p><strong>5.1 Local and External AI Systems:</strong> Information may be processed by software within our infrastructure or through vetted external AI providers for document parsing, inference, or matching. External providers are evaluated for security, retention, and contractual safeguards.</p>
              <p><strong>5.2 Accuracy &amp; Limitations:</strong> AI outputs may contain errors or unsupported inferences. An estimated readiness score is not an objectively guaranteed measure of employability or future performance.</p>
              <p><strong>5.3 Profiling and Matching:</strong> Matching methods compare profile attributes with opportunity criteria. Scores are heuristic estimates and not presented as infallible evaluations.</p>
              <p><strong>5.4 Model Improvement:</strong> We do not use submitted student personal data for third-party commercial model training without explicit consent. Aggregated, de-identified data may be used to assess system reliability.</p>
            </div>
          </section>

          {/* Section 6 */}
          <section id="sec-6" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">6. Public Profiles and Visibility</h2>
            <div className="space-y-3">
              <p><strong>6.1 Visibility Settings:</strong> Profiles remain private by default until a user deliberately chooses to enable public or recruiter discovery.</p>
              <p><strong>6.2 Information That May Be Public:</strong> Only fields designated by the user (such as display name, bio, public skills, projects, and portfolio links) become visible. Passwords, contact details, dates of birth, and raw resume files are never automatically published.</p>
              <p><strong>6.3 Search Engines &amp; Caches:</strong> If a profile is made public, search engines may index it. Disabling visibility removes future platform access, though third-party caches may take time to expire.</p>
              <p><strong>6.4 Users Under 18:</strong> Profiles belonging to users under 18 are not publicly discoverable by default. Parental or guardian consent is obtained where required by applicable law.</p>
              <p><strong>6.5 Recruiter Access:</strong> When you share a profile with an employer, they process information under their own privacy practices.</p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="sec-7" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">7. Lawful Processing, Notice, and Consent</h2>
            <p className="mb-2">
              We process personal information only under valid legal grounds—including consent, performance of requested services, and legal compliance.
            </p>
            <p>
              We do not treat acceptance of this Privacy Policy as a substitute for separate, explicit consent where required. You may withdraw consent at any time via your account settings or by contacting{" "}
              <a href={`mailto:${LEGAL_CONFIG.privacyEmail}`} className="text-emerald-600 dark:text-emerald-400 font-semibold underline">
                {LEGAL_CONFIG.privacyEmail}
              </a>
              .
            </p>
          </section>

          {/* Section 8 */}
          <section id="sec-8" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">8. Disclosure and Sharing of Information</h2>
            <p className="mb-3">We may share relevant information under the following limited circumstances:</p>
            <ul className="list-disc pl-5 space-y-1 mb-3">
              <li><strong>8.1 Service Providers:</strong> Trusted infrastructure partners for hosting, database management, authentication, document storage, and transactional emails under strict data processing agreements.</li>
              <li><strong>8.2 Recruiters &amp; Employers:</strong> When you explicitly apply for an opportunity or opt into verified talent discovery.</li>
              <li><strong>8.3 Connected Platforms:</strong> When you authorize bidirectional synchronization with GitHub, LinkedIn, or ORCID.</li>
              <li><strong>8.4 Legal &amp; Safety Requirements:</strong> To comply with valid legal processes, investigate security violations, or defend legal rights.</li>
              <li><strong>8.5 Business Transfers:</strong> In the event of a merger, acquisition, or restructuring, subject to equivalent confidentiality protections.</li>
              <li><strong>8.6 At Your Direction:</strong> Whenever you share your verified profile with collaborators or third parties.</li>
            </ul>
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
              We do not sell personal information or provide standalone data-broker feeds.
            </p>
          </section>

          {/* Section 9 */}
          <section id="sec-9" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">9. Cookies and Similar Technologies</h2>
            <p className="mb-2">
              We utilize essential cookies for session management, security tokens, and theme preferences. Non-essential tracking cookies are not activated without user consent.
            </p>
            <p>
              For comprehensive details on our cookie inventory, lifetimes, and management options, please review our dedicated{" "}
              <Link href="/cookie-policy" className="text-emerald-600 dark:text-emerald-400 font-semibold underline">
                Cookie Policy
              </Link>
              .
            </p>
          </section>

          {/* Section 10 */}
          <section id="sec-10" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">10. Data Retention</h2>
            <p className="mb-2">
              We retain personal data only for as long as needed to fulfill the purposes for which it was gathered, provide active services, resolve disputes, and satisfy statutory obligations.
            </p>
            <p>
              When an account is deleted, active profile records and extracted metadata are permanently removed from production stores in accordance with our deletion protocols.
            </p>
          </section>

          {/* Section 11 */}
          <section id="sec-11" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">11. Data Security</h2>
            <p className="mb-2">
              We maintain technical, administrative, and physical safeguards including SSL/TLS encryption in transit, AES-256 encryption at rest, role-based access control, vulnerability scanning, and isolated database clusters.
            </p>
            <p>
              In the event of a verified security incident, we will promptly take remediation actions and notify affected users in accordance with applicable Indian law.
            </p>
          </section>

          {/* Section 12 */}
          <section id="sec-12" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">12. International Processing</h2>
            <p>
              Although AI Tathastu is primarily intended for users in India, some technical service providers (e.g., cloud hosting or AI inference pipelines) may operate globally. International transfers are governed by appropriate contractual safeguards and legal protections.
            </p>
          </section>

          {/* Section 13 */}
          <section id="sec-13" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">13. Privacy Rights and Requests</h2>
            <p className="mb-3">
              Under applicable data protection laws, you have the right to request access, correction of inaccuracies, complete deletion of your records, or withdrawal of consent.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl mb-3 text-xs">
              <strong className="block text-slate-800 dark:text-slate-200 mb-1">13.1 Deletion Limitations:</strong>
              Data deletion requests purge operational profile records, uploaded resumes, and indexes. Backups follow automated rolling expiry cycles. Information legally required for tax, compliance, or security logs may be retained as mandated by law.
            </div>
            <p>
              To exercise your privacy rights, email{" "}
              <a href={`mailto:${LEGAL_CONFIG.privacyEmail}`} className="text-emerald-600 dark:text-emerald-400 font-semibold underline">
                {LEGAL_CONFIG.privacyEmail}
              </a>
              . We will verify your identity and respond within statutory deadlines.
            </p>
          </section>

          {/* Section 14 */}
          <section id="sec-14" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">14. Children&apos;s Privacy</h2>
            <p className="mb-2">
              AI Tathastu may serve students who are under 18 only with appropriate consent mechanisms and safeguards.
            </p>
            <p>
              Under-18 profiles are not included in public search indexes by default. If you believe a minor&apos;s data has been submitted without required parental consent, please contact{" "}
              <a href={`mailto:${LEGAL_CONFIG.privacyEmail}`} className="text-emerald-600 dark:text-emerald-400 font-semibold underline">
                {LEGAL_CONFIG.privacyEmail}
              </a>
              .
            </p>
          </section>

          {/* Section 15 */}
          <section id="sec-15" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">15. Third-Party Services</h2>
            <p>
              Our platform may contain links to external universities, coding platforms, or employer job boards. We encourage you to review their independent privacy policies, as their processing practices are governed by their respective terms.
            </p>
          </section>

          {/* Section 16 */}
          <section id="sec-16" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">16. Changes to This Privacy Policy</h2>
            <p>
              We periodically update this Privacy Policy as our services and legal requirements evolve. Material updates will be announced via platform notices or email. Continued use of AI Tathastu after the effective date constitutes acknowledgment of the revised policy.
            </p>
          </section>

          {/* Section 17 */}
          <section id="sec-17" className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 sm:p-8 shadow-xs">
            <h2 className="text-xl font-bold text-[#0F172A] dark:text-white mb-3">17. Contact and Grievance Information</h2>
            <p className="mb-4">
              For any privacy inquiries, data rights exercises, or formal grievances, please reach out to our team:
            </p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 text-xs">
              <p><strong>Legal Operator:</strong> {LEGAL_CONFIG.companyName}</p>
              <p><strong>Trading Name:</strong> {LEGAL_CONFIG.tradingName}</p>
              <p><strong>Website:</strong> {LEGAL_CONFIG.website}</p>
              <p><strong>Contact Address:</strong> {LEGAL_CONFIG.address}</p>
              <p><strong>Privacy Email:</strong> <a href={`mailto:${LEGAL_CONFIG.privacyEmail}`} className="text-emerald-600 dark:text-emerald-400 underline">{LEGAL_CONFIG.privacyEmail}</a></p>
              <p><strong>Support Email:</strong> <a href={`mailto:${LEGAL_CONFIG.supportEmail}`} className="text-emerald-600 dark:text-emerald-400 underline">{LEGAL_CONFIG.supportEmail}</a></p>
              <p><strong>Grievance Redressal Officer:</strong> {LEGAL_CONFIG.grievanceOfficer.name} ({LEGAL_CONFIG.grievanceOfficer.designation})</p>
              <p><strong>Grievance Email:</strong> <a href={`mailto:${LEGAL_CONFIG.grievanceEmail}`} className="text-emerald-600 dark:text-emerald-400 underline">{LEGAL_CONFIG.grievanceEmail}</a></p>
            </div>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {LEGAL_CONFIG.currentYear} {LEGAL_CONFIG.tradingName}. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-[#FF2A85] transition-colors">
              Terms of Use
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
