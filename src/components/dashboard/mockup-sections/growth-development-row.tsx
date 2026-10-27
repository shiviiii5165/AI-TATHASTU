"use client";

import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Network,
  Sliders,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import Link from "next/link";

export interface SkillGapItem {
  skill: string;
  description: string;
  priority: string;
  action?: string;
}

export interface LearningPathItem {
  title: string;
  description?: string;
  provider?: string;
  duration?: string;
  modules_count?: number;
  duration_weeks?: number;
  focus_areas?: string[];
  url?: string;
}

export interface CareerRoadmapData {
  currentStage?: string;
  current_stage?: string;
  shortTerm?: { title?: string; timeline?: string; milestones?: string[]; focus?: string };
  short_term?: { title?: string; timeline?: string; milestones?: string[]; focus?: string };
  midTerm?: { title?: string; timeline?: string; milestones?: string[]; focus?: string };
  mid_term?: { title?: string; timeline?: string; milestones?: string[]; focus?: string };
  longTerm?: { title?: string; timeline?: string; milestones?: string[]; focus?: string };
  long_term?: { title?: string; timeline?: string; milestones?: string[]; focus?: string };
}

interface GrowthDevelopmentRowProps {
  proficiencySkills?: Array<{ name: string; pct: number }>;
  gaps?: SkillGapItem[];
  learningPaths?: LearningPathItem[];
  roadmap?: CareerRoadmapData;
}

export function GrowthDevelopmentRow({
  proficiencySkills,
  gaps,
  learningPaths,
  roadmap,
}: GrowthDevelopmentRowProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SkillProficiencyCard skills={proficiencySkills} />
      <SkillGapsCard gaps={gaps} />
      <LearningPathsCard paths={learningPaths} />
      <CareerRoadmapCard roadmap={roadmap} />
    </div>
  );
}

function SkillProficiencyCard({
  skills = [],
}: {
  skills?: Array<{ name: string; pct: number }>;
}) {
  const hasSkills = skills.length > 0;

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#EDF5FF] text-[#2878F0]">
            <Sliders className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Skill Proficiency</h2>
        </div>
        <Link
          href="/skills"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View All</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {hasSkills ? (
        <div className="my-auto space-y-2.5 py-2">
          {skills.slice(0, 8).map((s, i) => (
            <div key={i} className="group">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-[#11182B] group-hover:text-[#2878F0] transition-colors truncate max-w-[170px]">
                  {s.name}
                </span>
                <span className="font-mono text-[#617493]">{s.pct}%</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#F1F5F9]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2878F0] to-[#8554FF] transition-all duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(5, s.pct))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-blue-50 text-[#2878F0] flex items-center justify-center mb-2.5">
            <Sliders className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No Skills Evaluated Yet</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Confirm your competencies or sync GitHub to compute verified skill proficiency levels.
          </p>
          <Link
            href="/skills"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2878F0] text-white text-xs font-semibold hover:bg-[#2063CC] transition-colors"
          >
            <Sparkles className="size-3" />
            <span>Map Skills</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>Evaluated from code & papers</span>
        <span className="font-semibold text-[#8554FF]">
          {hasSkills ? "AI Scored" : "Pending"}
        </span>
      </div>
    </div>
  );
}

function SkillGapsCard({ gaps = [] }: { gaps?: SkillGapItem[] }) {
  const hasGaps = gaps && gaps.length > 0;

  const displayGaps = hasGaps
    ? gaps.slice(0, 4).map((g) => {
        const isHigh = g.priority.toLowerCase().includes("high");
        const isLow = g.priority.toLowerCase().includes("low");
        const priorityColor = isHigh
          ? "bg-[#FFF0F4] text-[#FF496D] border-[#FF496D]/20"
          : isLow
          ? "bg-[#EDF5FF] text-[#2878F0] border-[#2878F0]/20"
          : "bg-[#FFF6E9] text-[#FFB547] border-[#FFB547]/20";
        return {
          title: g.skill,
          desc: g.description,
          priority: g.priority,
          priorityColor,
        };
      })
    : [];

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#F4F1FD] text-[#8554FF]">
            <Network className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Skill Gaps & Recommendations</h2>
        </div>
        <Link
          href="/skills"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View Full</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {hasGaps ? (
        <div className="my-auto divide-y divide-[#F4F6F9] py-1">
          {displayGaps.map((g, i) => (
            <div key={i} className="py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#11182B]">{g.title}</p>
                  <p className="mt-0.5 text-[10px] text-[#617493] line-clamp-1">{g.desc}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold ${g.priorityColor}`}>
                  {g.priority}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-purple-50 text-[#8554FF] flex items-center justify-center mb-2.5">
            <Network className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No Skill Gaps Identified</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Target career roles in your profile to run the AI gap analysis engine.
          </p>
          <Link
            href="/skills"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8554FF] text-white text-xs font-semibold hover:bg-[#703DE5] transition-colors"
          >
            <span>View Skill Graph</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>Target benchmark</span>
        <span className="font-medium text-[#FF496D]">
          {hasGaps ? `${displayGaps.length} gaps identified` : "Aligned"}
        </span>
      </div>
    </div>
  );
}

function LearningPathsCard({ paths = [] }: { paths?: LearningPathItem[] }) {
  const hasPaths = paths && paths.length > 0;

  const displayPaths = hasPaths
    ? paths.slice(0, 3).map((p, idx) => {
        const iconBg =
          idx === 0
            ? "bg-[#F3EFFF] text-[#8554FF]"
            : idx === 1
            ? "bg-[#E8FAF4] text-[#19C58A]"
            : "bg-[#FFF0F4] text-[#FF496D]";
        const Icon = idx === 0 ? BookOpen : idx === 1 ? Sparkles : Zap;
        return {
          title: p.title,
          desc: p.description,
          // Only what the path actually states; no invented defaults.
          meta: [
            p.modules_count ? `${p.modules_count} Modules` : null,
            p.duration_weeks ? `${p.duration_weeks} Weeks` : null,
          ].filter(Boolean).join(" · "),
          icon: Icon,
          iconBg,
        };
      })
    : [];

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#E8FAF4] text-[#19C58A]">
            <GraduationCap className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Recommended Learning Paths</h2>
        </div>
        <Link
          href="/learning"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View All</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {hasPaths ? (
        <div className="my-auto divide-y divide-[#F4F6F9] py-1">
          {displayPaths.map((p, i) => {
            const Icon = p.icon;
            return (
              <Link
                key={i}
                href="/learning"
                className="group flex items-start gap-3 py-2.5 transition-colors hover:text-[#8554FF]"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105 ${p.iconBg}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[#11182B] group-hover:text-[#8554FF] transition-colors truncate">
                    {p.title}
                  </p>
                  <p className="text-[10px] text-[#617493] line-clamp-1">{p.desc}</p>
                  {p.meta && <p className="mt-1 text-[9px] font-mono font-medium text-[#8C9AA8]">{p.meta}</p>}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-emerald-50 text-[#19C58A] flex items-center justify-center mb-2.5">
            <GraduationCap className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">No Active Learning Paths</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Confirm your skills to generate personalized AI curriculum recommendations.
          </p>
          <Link
            href="/learning"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#19C58A] text-white text-xs font-semibold hover:bg-[#15A876] transition-colors"
          >
            <span>Browse Courses</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>Curated for your goals</span>
        <span className="font-medium text-[#19C58A]">
          {hasPaths ? "Free Certificate" : "Available"}
        </span>
      </div>
    </div>
  );
}

function CareerRoadmapCard({ roadmap }: { roadmap?: CareerRoadmapData }) {
  const hasRoadmap = Boolean(roadmap && (roadmap.currentStage || roadmap.current_stage));

  const currentStage = roadmap?.currentStage || roadmap?.current_stage || "Student / Engineer";
  const shortTerm =
    roadmap?.shortTerm?.focus ||
    roadmap?.shortTerm?.title ||
    roadmap?.short_term?.focus ||
    roadmap?.short_term?.title ||
    "Core Foundation";
  const longTerm =
    roadmap?.longTerm?.focus ||
    roadmap?.longTerm?.title ||
    roadmap?.long_term?.focus ||
    roadmap?.long_term?.title ||
    "Industry Impact";

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E7EAF3] bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="flex items-center justify-between border-b border-[#F0F2F7] pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-[#EDF5FF] text-[#2878F0]">
            <Target className="size-4" />
          </div>
          <h2 className="font-sans text-sm font-bold text-[#11182B]">Career Roadmap</h2>
        </div>
        <Link
          href="/profile"
          className="group inline-flex items-center gap-1 text-xs font-semibold text-[#8554FF] hover:text-[#703DE5]"
        >
          <span>View Full</span>
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {hasRoadmap ? (
        <div className="relative my-auto py-3">
          {/* Curved visual roadmap SVG matching mockup */}
          <div className="relative h-24 w-full overflow-hidden">
            <svg className="h-full w-full overflow-hidden" viewBox="0 0 260 70" preserveAspectRatio="xMidYMid meet" fill="none">
              <path
                d="M 15 50 Q 80 48, 110 32 T 235 15"
                stroke="#E2E8F0"
                strokeWidth="2.5"
                strokeDasharray="4 4"
              />
              <path
                d="M 15 50 Q 80 48, 110 32"
                stroke="url(#gradient-path)"
                strokeWidth="2.5"
              />
              <defs>
                <linearGradient id="gradient-path" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#2878F0" />
                  <stop offset="100%" stopColor="#8554FF" />
                </linearGradient>
              </defs>
            </svg>

            {/* Stage 1: Current */}
            <div className="absolute left-[5%] bottom-[12px] flex flex-col items-center">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2878F0] ring-4 ring-[#2878F0]/20 shadow-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
              </div>
              <span className="mt-1 font-sans text-[10px] font-bold text-[#11182B] whitespace-nowrap max-w-[70px] truncate" title={currentStage}>
                {currentStage}
              </span>
              <span className="text-[8px] font-medium text-[#19C58A]">Now</span>
            </div>

            {/* Stage 2: Short-term */}
            <div className="absolute left-[42%] top-[14px] flex flex-col items-center">
              <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#8554FF] bg-white shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-[#8554FF]" />
              </div>
              <span className="mt-1 font-sans text-[10px] font-bold text-[#11182B] whitespace-nowrap max-w-[75px] truncate" title={shortTerm}>
                {shortTerm}
              </span>
              <span className="text-[8px] text-[#617493]">0–6m</span>
            </div>

            {/* Stage 3: Long-term */}
            <div className="absolute right-[5%] top-[0px] flex flex-col items-center">
              <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#E2E8F0] bg-white">
                <span className="h-1.5 w-1.5 rounded-full bg-[#A0AEC0]" />
              </div>
              <span className="mt-1 font-sans text-[10px] font-bold text-[#617493] whitespace-nowrap max-w-[75px] truncate" title={longTerm}>
                {longTerm}
              </span>
              <span className="text-[8px] text-[#8C9AA8]">2–4y</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="my-auto py-6 px-2 text-center flex flex-col items-center">
          <div className="size-10 rounded-full bg-blue-50 text-[#2878F0] flex items-center justify-center mb-2.5">
            <Target className="size-5" />
          </div>
          <p className="text-xs font-bold text-[#11182B]">Roadmap Not Generated</p>
          <p className="text-[11px] text-[#617493] mt-1 max-w-[200px]">
            Upload your resume or confirm your background to build your milestone roadmap.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2878F0] text-white text-xs font-semibold hover:bg-[#2063CC] transition-colors"
          >
            <span>Set Career Goals</span>
          </Link>
        </div>
      )}

      <div className="border-t border-[#F8FAFC] pt-2 text-[11px] text-[#617493] flex justify-between items-center">
        <span>Strategic milestones</span>
        <span className="font-semibold text-[#2878F0]">
          {hasRoadmap ? "Active Track" : "Uninitialized"}
        </span>
      </div>
    </div>
  );
}
