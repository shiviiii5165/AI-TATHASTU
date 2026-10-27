import { and, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Award, BookOpen, CheckCircle, FileCheck, Sparkles, Trophy } from "lucide-react";

import { db } from "@/db";
import { profileFacts } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { usableFactsOf } from "@/lib/profile/unified";

import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Achievements, Patents & Publications | AI Tathastu",
};

export default function AchievementsPage() {
  return (
    <Suspense fallback={<AchievementsSkeleton />}>
      <AchievementsContent />
    </Suspense>
  );
}

function AchievementsSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-10 w-64 bg-slate-200 rounded-xl" />
      <div className="h-64 bg-slate-100 rounded-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-48 bg-slate-100 rounded-2xl" />
        <div className="h-48 bg-slate-100 rounded-2xl" />
      </div>
    </div>
  );
}

async function AchievementsContent() {
  const { user } = await requireOnboardedUser();

  const facts = await db
    .select({
      fieldGroup: profileFacts.fieldGroup,
      fieldName: profileFacts.fieldName,
      recordKey: profileFacts.recordKey,
      normalizedValue: profileFacts.normalizedValue,
      extractedValue: profileFacts.extractedValue,
    })
    .from(profileFacts)
    .where(
      and(
        usableFactsOf(user.id),
        inArray(profileFacts.fieldGroup, [
          "achievements",
          "publications",
          "certifications",
          "achievement",
          "publication",
          "certification",
          "patents",
          "patent",
          "awards",
          "award",
        ])
      )
    )
    .catch((err) => {
      console.error("[AchievementsContent] profileFacts query failed:", err);
      return [];
    });

  // Group facts by recordKey
  const itemsMap = new Map<string, { group: string; fields: Record<string, string> }>();
  for (const f of facts) {
    if (!f.recordKey) continue;
    if (!itemsMap.has(f.recordKey)) {
      itemsMap.set(f.recordKey, { group: f.fieldGroup, fields: {} });
    }
    itemsMap.get(f.recordKey)!.fields[f.fieldName.toLowerCase()] = String(
      f.normalizedValue || f.extractedValue || ""
    );
  }

  const publications: Array<{ title: string; venue: string; year: string }> = [];
  const certifications: Array<{ title: string; issuer: string; year: string }> = [];
  const awards: Array<{ title: string; desc: string; year: string }> = [];

  for (const item of itemsMap.values()) {
    const group = item.group.toLowerCase();
    const f = item.fields;

    if (group.includes("pub")) {
      publications.push({
        // Only extracted values; missing fields stay empty (no invented venues or years).
        title: f["title"] || f["paper_title"] || "Untitled publication",
        venue: f["venue"] || f["journal"] || f["publisher"] || "",
        year: f["year"] || f["date"] || "",
      });
    } else if (group.includes("cert")) {
      certifications.push({
        title: f["name"] || f["title"] || f["certificate"] || "Untitled certification",
        issuer: f["issuer"] || f["organization"] || "",
        year: f["year"] || f["issue_date"] || "",
      });
    } else {
      awards.push({
        title: f["title"] || f["award_name"] || "Untitled award",
        desc: f["description"] || f["organization"] || "",
        year: f["year"] || f["date"] || "",
      });
    }
  }

  const displayPubs = publications;
  const displayCerts = certifications;
  const displayAwards = awards;
  const totalCount = displayPubs.length + displayCerts.length + displayAwards.length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-2"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Dashboard</span>
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="editorial-title text-3xl sm:text-4xl text-[#11182B] tracking-tight">
              Achievements, Patents & Publications
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Verified scholarly accomplishments, technical patents, and industry credentials extracted from your proof-of-work.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              <Trophy className="size-3.5" />
              {totalCount} Verified Records
            </span>
          </div>
        </div>
      </div>

      {totalCount > 0 ? (
        <>
          {/* Publications Section */}
          <div className="rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-2xs">
            <div className="flex items-center justify-between pb-4 border-b border-[#F0F2F7]">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <BookOpen className="size-4" />
                </div>
                <h2 className="font-sans text-sm font-bold text-[#11182B]">
                  Research Publications & Preprints ({displayPubs.length})
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                {displayPubs.length > 0 ? "Peer Reviewed" : "0 Indexed"}
              </span>
            </div>

            {displayPubs.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                {displayPubs.map((pub, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-blue-200 transition-all shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <p className="font-sans text-xs font-bold text-slate-900 line-clamp-2">
                        {pub.title}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">{pub.venue}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/50 text-[10px]">
                      <span className="font-mono text-slate-400">{pub.year}</span>
                      <span className="font-semibold text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle className="size-3" /> Indexed
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">No research publications extracted yet.</p>
            )}
          </div>

          {/* Patents & Awards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Patents & Honors */}
            <div className="rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-2 pb-4 border-b border-[#F0F2F7]">
                <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Award className="size-4" />
                </div>
                <h2 className="font-sans text-sm font-bold text-[#11182B]">
                  Patents & Honors ({displayAwards.length})
                </h2>
              </div>

              {displayAwards.length > 0 ? (
                <div className="space-y-3 mt-5">
                  {displayAwards.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-100 bg-amber-50/30 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-sans text-xs font-bold text-slate-900">{item.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono text-slate-400 font-semibold">{item.year}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">No patents or awards recorded yet.</p>
              )}
            </div>

            {/* Certifications */}
            <div className="rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-2xs">
              <div className="flex items-center gap-2 pb-4 border-b border-[#F0F2F7]">
                <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <FileCheck className="size-4" />
                </div>
                <h2 className="font-sans text-sm font-bold text-[#11182B]">
                  Certifications & Credentials ({displayCerts.length})
                </h2>
              </div>

              {displayCerts.length > 0 ? (
                <div className="space-y-3 mt-5">
                  {displayCerts.map((cert, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-slate-100 bg-emerald-50/20 flex items-start justify-between gap-3"
                    >
                      <div>
                        <p className="font-sans text-xs font-bold text-slate-900">{cert.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{cert.issuer}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-mono text-emerald-700 font-semibold">{cert.year}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">No certifications recorded yet.</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#E7EAF3] bg-white p-12 text-center max-w-lg mx-auto">
          <div className="size-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Trophy className="size-6" />
          </div>
          <h2 className="font-sans text-base font-bold text-slate-900">No Achievements Found</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Upload your resume or curriculum vitae to automatically verify your publications, patents, and certifications.
          </p>
          <div className="mt-5">
            <Link
              href="/onboarding/resume"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
            >
              <Sparkles className="size-4" />
              <span>Upload Resume</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
