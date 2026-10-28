import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Cpu, Sparkles, CheckCircle2, FileUp } from "lucide-react";

import { Suspense } from "react";
import { SkillBubbleChart } from "@/components/dashboard/mockup-sections/skill-bubble-chart";
import { db } from "@/db";
import { profileFacts, profileViews, skillEvidence, skills } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import { usableFactsOf } from "@/lib/profile/unified";
import type { ProfileViewDoc } from "@/lib/dashboard/types";

export const metadata: Metadata = {
  title: "Skills & Inferred Competencies | AI Tathastu",
};

export default function SkillsPage() {
  return (
    <Suspense fallback={<SkillsSkeleton />}>
      <SkillsContent />
    </Suspense>
  );
}

function SkillsSkeleton() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-pulse">
      <div className="h-10 w-64 bg-slate-200 rounded-xl" />
      <div className="h-96 bg-slate-100 rounded-2xl" />
    </div>
  );
}

async function SkillsContent() {
  const { user } = await requireOnboardedUser();

  const [[row], dbSkills, factSkills] = await Promise.all([
    db
      .select()
      .from(profileViews)
      .where(eq(profileViews.userId, user.id)),
    db
      .select({
        skillName: skills.canonicalName,
        strength: skillEvidence.evidenceStrength,
      })
      .from(skillEvidence)
      .innerJoin(skills, eq(skillEvidence.skillId, skills.id))
      .where(eq(skillEvidence.userId, user.id))
      .catch((err) => {
        console.error("[SkillsContent] skillEvidence query failed:", err);
        return [];
      }),
    db
      .select({
        normalizedValue: profileFacts.normalizedValue,
        extractedValue: profileFacts.extractedValue,
      })
      .from(profileFacts)
      .where(and(usableFactsOf(user.id), eq(profileFacts.fieldGroup, "skills")))
      .catch((err) => {
        console.error("[SkillsContent] profileFacts query failed:", err);
        return [];
      }),
  ]);

  const view = (row?.view || {}) as ProfileViewDoc;
  const inferredSkills = view.inferredSkills || [];
  const skillGraph = view.skillGraph || view.skill_graph;

  // strength is the evidence score from the intelligence engine; null when a
  // skill comes only from confirmed facts (no score is invented for it).
  let confirmedSkills: { name: string; strength: number | null; category: string }[] = (view.skills || []).map((s) => ({
    name: s.name,
    strength: typeof s.evidenceStrength === "number" ? s.evidenceStrength : null,
    category: s.category || "Competency",
  }));

  // If view.skills is empty, fallback to dbSkills or factSkills
  if (confirmedSkills.length === 0 && dbSkills.length > 0) {
    confirmedSkills = dbSkills.map((s) => ({
      name: s.skillName,
      strength: s.strength,
      category: "Evidenced skill",
    }));
  } else if (confirmedSkills.length === 0 && factSkills.length > 0) {
    confirmedSkills = factSkills
      .map((f) => String(f.normalizedValue || f.extractedValue || "").trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        strength: null,
        category: "Confirmed skill",
      }));
  }

  const totalSignals = inferredSkills.length + confirmedSkills.length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Header breadcrumb & title */}
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
              Skills & Inferred Graph
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Deterministic skills extracted from verified code, repos, and publications, expanded via the Skill Graph.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-[#EDF5FF] text-[#2878F0] border border-[#2878F0]/20">
              <Sparkles className="size-3.5" />
              {totalSignals} Total Signals
            </span>
          </div>
        </div>
      </div>

      {totalSignals > 0 ? (
        <>
          {/* Main Grid: Bubble Chart on left + Inferred Skills Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 min-h-[380px] sm:min-h-[420px] h-auto">
              <SkillBubbleChart
                skills={
                  inferredSkills.length > 0
                    ? inferredSkills
                    : // The chart shows a confidence per node: only skills that have a real score.
                      confirmedSkills.flatMap((s) => (s.strength === null ? [] : [{ name: s.name, strength: s.strength }]))
                }
                skillGraph={skillGraph}
                fullView
                height={400}
              />
            </div>

            <div className="lg:col-span-7 rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between pb-4 border-b border-[#F0F2F7]">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-[#F4F1FD] text-[#8554FF]">
                    <Cpu className="size-4" />
                  </div>
                  <h2 className="font-sans text-sm font-bold text-[#11182B]">
                    AI-Inferred Skills
                  </h2>
                </div>
                <span className="text-[11px] font-semibold text-[#8554FF] bg-[#F4F1FD] px-2.5 py-0.5 rounded-full">
                  Skills Analysis
                </span>
              </div>

              {inferredSkills.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 py-4">
                  {inferredSkills.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-[#8554FF]/30 transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-sans text-xs font-bold text-[#11182B] truncate max-w-[140px]" title={s.name}>
                          {s.name}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            s.isDirect
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-purple-50 text-purple-700 border border-purple-200"
                          }`}
                        >
                          {s.isDirect ? "Direct Evidence" : "AI-inferred"}
                        </span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-200/70 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#8554FF] to-[#2878F0]"
                            style={{ width: `${Math.round(s.strength * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-slate-700">
                          {Math.round(s.strength * 100)}%
                        </span>
                      </div>
                      {s.inferredFrom && s.inferredFrom.length > 0 && (
                        <p className="mt-1.5 text-[10px] text-slate-400 truncate" title={s.inferredFrom.join(", ")}>
                          Inferred from: {s.inferredFrom.join(", ")}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Connecting related skills based on your profile…
                </div>
              )}

              <p className="text-[11px] text-slate-500 pt-2 border-t border-[#F0F2F7]">
                We suggest broader skills based on the tools and technologies you use in your projects.
              </p>
            </div>
          </div>

          {/* Confirmed Skills Catalogue */}
          {confirmedSkills.length > 0 && (
            <div className="rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#F0F2F7] gap-3">
                <div>
                  <h2 className="font-sans text-base font-bold text-[#11182B]">
                    Confirmed & Evidenced Skills
                  </h2>
                  <p className="text-xs text-[#64748B]">
                    Extracted from commits, repository frameworks, and confirmed profile facts.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-600">
                  {confirmedSkills.length} {confirmedSkills.length === 1 ? "Skill" : "Skills"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-6">
                {confirmedSkills.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border border-slate-200/80 bg-white hover:border-[#2878F0] hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-sans text-sm font-bold text-slate-900 truncate" title={item.name}>
                        {item.name}
                      </span>
                      <CheckCircle2 className="size-4 text-[#19C58A] shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">{item.category}</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500">Confidence</span>
                      <span className="font-mono font-bold text-[#2878F0]">
                        {item.strength === null ? "Not scored yet" : `${Math.round(item.strength * 100)}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-[#E7EAF3] bg-white p-12 text-center max-w-lg mx-auto">
          <div className="size-12 rounded-full bg-purple-50 text-[#8554FF] flex items-center justify-center mx-auto mb-3">
            <Sparkles className="size-6" />
          </div>
          <h2 className="font-sans text-base font-bold text-slate-900">No Skills Found</h2>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Upload your resume or connect GitHub to automatically extract and verify your skills graph.
          </p>
          <div className="mt-5">
            <Link
              href="/onboarding/resume"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#8554FF] text-white text-xs font-semibold hover:bg-[#703DE5] transition-colors"
            >
              <FileUp className="size-4" />
              <span>Upload Resume</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
