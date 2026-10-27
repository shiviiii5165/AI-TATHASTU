import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, GraduationCap, Layers, Sparkles } from "lucide-react";

import { db } from "@/db";
import { profileViews } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import type { ProfileViewDoc } from "@/lib/dashboard/types";

import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Recommended Learning Paths | AI Tathastu",
};

export default function LearningPage() {
  return (
    <Suspense fallback={<LearningSkeleton />}>
      <LearningContent />
    </Suspense>
  );
}

function LearningSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-10 w-64 bg-slate-200 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-96 bg-slate-100 rounded-2xl" />
        <div className="h-96 bg-slate-100 rounded-2xl" />
        <div className="h-96 bg-slate-100 rounded-2xl" />
      </div>
    </div>
  );
}

async function LearningContent() {
  const { user } = await requireOnboardedUser();

  const [row] = await db
    .select()
    .from(profileViews)
    .where(eq(profileViews.userId, user.id));

  interface LearningPathItem {
    title?: string;
    subtitle?: string;
    description?: string;
    provider?: string;
    duration?: string;
    level?: string;
    modules?: string | string[];
    modules_count?: number;
    syllabus?: string[];
    focus_areas?: string[];
    skillsCovered?: string[];
    url?: string;
  }

  const view = (row?.view || {}) as ProfileViewDoc;
  const pathsObj = view.skillGapsAndPaths as {
    recommendedPaths?: LearningPathItem[];
    learning_paths?: LearningPathItem[];
  } | undefined;

  const learningPaths: LearningPathItem[] =
    pathsObj?.recommendedPaths || pathsObj?.learning_paths || [];

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
              Recommended Learning Paths
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Curated curricula tailored specifically to close your verified skill gaps and advance your career roadmap.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#EDF5FF] text-[#2878F0] border border-[#2878F0]/20">
              <Sparkles className="size-3.5" />
              {learningPaths.length} Active Tracks
            </span>
          </div>
        </div>
      </div>

      {/* Learning Paths Grid */}
      {learningPaths.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {learningPaths.map((path, idx: number) => (
            <div
              key={idx}
              className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-md bg-purple-50 text-purple-700 text-[10px] font-bold px-2 py-0.5 border border-purple-200">
                    {path.level || "Curated"}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                    <Clock className="size-3 text-slate-400" />
                    {path.duration || "6 Weeks"}
                  </span>
                </div>

                <h2 className="mt-3.5 font-sans text-base font-bold text-slate-900">
                  {path.title}
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">{path.subtitle || path.description}</p>

                {/* Only what the path states; no invented module counts or certificates. */}
                {(path.modules || path.modules_count) && (
                  <div className="mt-4 flex items-center gap-3 text-xs text-slate-600 font-medium">
                    <span className="flex items-center gap-1">
                      <Layers className="size-3.5 text-slate-400" />
                      {path.modules || `${path.modules_count} Modules`}
                    </span>
                  </div>
                )}

                {/* Syllabus Overview */}
                <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                  <p className="font-sans text-xs font-bold text-slate-900">Module Outline:</p>
                  <ul className="space-y-1.5 text-[11px] text-slate-600">
                    {(path.syllabus || path.focus_areas || [
                      "Core architectural foundations",
                      "Hands-on project development",
                      "Production evaluation & benchmarking",
                    ]).map((item: string, sIdx: number) => (
                      <li key={sIdx} className="flex items-center gap-1.5">
                        <CheckCircle className="size-3 text-emerald-500 shrink-0" />
                        <span className="truncate">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  className="w-full min-h-[44px] py-2.5 rounded-xl bg-gradient-to-r from-[#FF496D] to-[#FF713D] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all text-center cursor-pointer touch-manipulation"
                >
                  Enroll in Path →
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#E7EAF3] bg-white p-12 text-center max-w-lg mx-auto">
          <div className="size-12 rounded-full bg-emerald-50 text-[#19C58A] flex items-center justify-center mx-auto mb-3">
            <GraduationCap className="size-6" />
          </div>
          <h2 className="font-sans text-base font-bold text-slate-900">No Learning Paths Active</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Confirm your skills and target roles to trigger AI-generated curriculum tracks.
          </p>
          <div className="mt-5">
            <Link
              href="/skills"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#19C58A] text-white text-xs font-semibold hover:bg-[#15A876] transition-colors"
            >
              <Sparkles className="size-4" />
              <span>Map Your Skills</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
