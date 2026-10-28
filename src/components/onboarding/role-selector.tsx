"use client";

import { ArrowRight, BookOpen, Briefcase, FileText, Share2, Users } from "lucide-react";
import { useState, useTransition } from "react";

import type { Persona } from "@/db/schema";
import { cn } from "@/lib/utils";

interface RoleSelectorProps {
  initialPersona: Persona | null;
  action: (formData: FormData) => Promise<void>;
}

export function StudentBadge() {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-20 sm:size-22 shrink-0 select-none"
      aria-hidden="true"
    >
      {/* Soft pink halo background blob */}
      <circle cx="48" cy="52" r="38" fill="#FCE7F0" />

      {/* Spark rays at top right */}
      <line x1="72" y1="26" x2="78" y2="16" stroke="#FF2A85" strokeWidth="3" strokeLinecap="round" />
      <line x1="82" y1="36" x2="92" y2="30" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
      <line x1="86" y1="48" x2="96" y2="46" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />

      {/* Skull cap underneath */}
      <path d="M31 49V59C31 64.5 38.5 69 48 69C57.5 69 65 64.5 65 59V49" fill="#141724" />
      <path d="M31 51C31 56.5 38.5 61 48 61C57.5 61 65 56.5 65 51" fill="#22283E" />

      {/* Mortarboard Diamond Top */}
      <path d="M15 47L48 34L81 47L48 58L15 47Z" fill="#1E2238" />
      <path d="M15 47L48 58V60L15 49V47Z" fill="#121524" />
      <path d="M48 58L81 47V49L48 60V58Z" fill="#0D101A" />
      <path d="M17 47L48 35.5L79 47L48 56.5L17 47Z" fill="#29304B" />

      {/* Center Button */}
      <circle cx="48" cy="45" r="3.5" fill="#3B82F6" />

      {/* Blue tassel cord & brush */}
      <path
        d="M48 45C56 45 68 46 71 51C73 54 73 58 72 62"
        stroke="#2563EB"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="69" y="61" width="6" height="3" rx="1.5" fill="#1D4ED8" />
      <path d="M69.5 64L68 72C68 73.5 76 73.5 76 72L74.5 64Z" fill="#3B82F6" />
    </svg>
  );
}

export function FacultyBadge() {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-20 sm:size-22 shrink-0 select-none"
      aria-hidden="true"
    >
      {/* Soft blue halo background blob */}
      <circle cx="48" cy="52" r="38" fill="#E0F0FE" />

      {/* Spark rays at top right */}
      <line x1="72" y1="26" x2="78" y2="16" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
      <line x1="82" y1="36" x2="92" y2="30" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
      <line x1="86" y1="48" x2="96" y2="46" stroke="#93C5FD" strokeWidth="3" strokeLinecap="round" />

      {/* Bottom Book (Navy) */}
      <g transform="translate(0, 6)">
        <path d="M22 56C22 54 24 53 27 53H72C74 53 76 54 76 56V65C76 67 74 68 72 68H27C24 68 22 67 22 65V56Z" fill="#1E293B" />
        <path d="M28 55H74V63H28C26 63 25 61.5 25 60C25 58.5 26 57 28 55Z" fill="#FFFFFF" />
        <line x1="32" y1="59" x2="70" y2="59" stroke="#E2E8F0" strokeWidth="1" />
        <path d="M22 56C22 54 24 53 26 53C27 53 28 54 28 56V65C28 67 27 68 26 68C24 68 22 67 22 65V56Z" fill="#0F172A" />
      </g>

      {/* Top Book (Royal Blue with Bookmark) */}
      <g transform="translate(2, -4)">
        <path d="M24 46C24 44 26 43 29 43H74C76 43 78 44 78 46V55C78 57 76 58 74 58H29C26 58 24 57 24 55V46Z" fill="#2563EB" />
        <path d="M30 45H76V53H30C28 53 27 51.5 27 50C27 48.5 28 47 30 45Z" fill="#FFFFFF" />
        <line x1="34" y1="49" x2="72" y2="49" stroke="#E2E8F0" strokeWidth="1" />
        {/* Bookmark ribbon */}
        <path d="M52 45V57L55 54.5L58 57V45H52Z" fill="#EF4444" />
        <path d="M24 46C24 44 26 43 28 43C29 43 30 44 30 46V55C30 57 29 58 28 58C26 58 24 57 24 55V46Z" fill="#1D4ED8" />
        <path d="M29 42H75C76.5 42 78 43 78 44.5V46H28V44.5C28 43 29 42 29 42Z" fill="#3B82F6" />
      </g>
    </svg>
  );
}

export function AlumniBadge() {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="size-20 sm:size-22 shrink-0 select-none"
      aria-hidden="true"
    >
      {/* Soft green halo background blob */}
      <circle cx="48" cy="52" r="38" fill="#DCFCE7" />

      {/* Spark rays at top right */}
      <line x1="72" y1="26" x2="78" y2="16" stroke="#10B981" strokeWidth="3" strokeLinecap="round" />
      <line x1="82" y1="36" x2="92" y2="30" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
      <line x1="86" y1="48" x2="96" y2="46" stroke="#6EE7B7" strokeWidth="3" strokeLinecap="round" />

      {/* Briefcase Handle */}
      <path
        d="M39 37V33C39 30.5 41 28.5 43.5 28.5H54.5C57 28.5 59 30.5 59 33V37"
        stroke="#1E293B"
        strokeWidth="4.5"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="37" y="36" width="4" height="3" rx="1" fill="#94A3B8" />
      <rect x="57" y="36" width="4" height="3" rx="1" fill="#94A3B8" />

      {/* Briefcase Body */}
      <rect x="23" y="38" width="54" height="36" rx="8" fill="#1E293B" />
      <path d="M23 48C23 48 35 52 50 52C65 52 77 48 77 48" stroke="#334155" strokeWidth="1.5" fill="none" />
      <path d="M24 39C24 39 35 41 50 41C65 41 76 39 76 39" stroke="#475569" strokeWidth="1" fill="none" />

      {/* Golden Latch Clasp */}
      <rect x="46" y="47" width="8" height="9" rx="2" fill="#F59E0B" />
      <rect x="48" y="52" width="4" height="2" rx="0.5" fill="#78350F" />
    </svg>
  );
}

const CARDS = [
  {
    id: "student" as Persona,
    title: "I am a Student",
    subtitle: "Build my skills, find opportunities and grow my career.",
    bg: "bg-[#FFF5F8]",
    borderUnselected: "border-[#FCE7F0]",
    borderHover: "hover:border-pink-300",
    borderSelected: "border-[#FF2A85] ring-4 ring-pink-500/15 shadow-lg shadow-pink-500/10",
    radioSelected: "border-[#FF2A85] bg-[#FF2A85] text-white",
    Badge: StudentBadge,
    items: [
      { icon: Briefcase, text: "Internships & jobs" },
      { icon: BookOpen, text: "Learning resources" },
      { icon: Users, text: "Projects and mentors" },
    ],
  },
  {
    id: "faculty" as Persona,
    title: "I am a Faculty",
    subtitle: "Teach, research and guide students.",
    bg: "bg-[#F0F7FF]",
    borderUnselected: "border-[#E0EEFF]",
    borderHover: "hover:border-blue-300",
    borderSelected: "border-[#2563EB] ring-4 ring-blue-500/15 shadow-lg shadow-blue-500/10",
    radioSelected: "border-[#2563EB] bg-[#2563EB] text-white",
    Badge: FacultyBadge,
    items: [
      { icon: Users, text: "Find and mentor students" },
      { icon: FileText, text: "Collaborate on research" },
      { icon: BookOpen, text: "Share opportunities" },
    ],
  },
  {
    id: "alumni" as Persona,
    title: "I am an Alumni",
    subtitle: "Stay connected, support students and give back.",
    bg: "bg-[#F0FBF6]",
    borderUnselected: "border-[#DCFCE7]",
    borderHover: "hover:border-emerald-300",
    borderSelected: "border-[#10B981] ring-4 ring-emerald-500/15 shadow-lg shadow-emerald-500/10",
    radioSelected: "border-[#10B981] bg-[#10B981] text-white",
    Badge: AlumniBadge,
    items: [
      { icon: Users, text: "Mentor and recruit" },
      { icon: Briefcase, text: "Share opportunities" },
      { icon: Share2, text: "Grow the network" },
    ],
  },
];

export function RoleSelector({ initialPersona, action }: RoleSelectorProps) {
  const [selected, setSelected] = useState<Persona | null>(initialPersona ?? null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    if (!selected) return;
    formData.set("persona", selected);
    startTransition(async () => {
      await action(formData);
    });
  };

  return (
    <form id="role-form" action={handleSubmit} className="mt-8 pb-16">
      <input type="hidden" name="persona" value={selected ?? ""} />

      <div
        role="radiogroup"
        aria-label="Choose how you'll use AI Tathastu"
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {CARDS.map((card) => {
          const isSelected = selected === card.id;
          const { Badge } = card;

          return (
            <button
              type="button"
              key={card.id}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${card.title}. ${card.subtitle}`}
              onClick={() => setSelected(card.id)}
              className={cn(
                "group relative flex flex-col justify-between rounded-3xl border-2 p-6 sm:p-7 text-left transition-all duration-200 cursor-pointer touch-manipulation select-none w-full",
                card.bg,
                isSelected
                  ? card.borderSelected
                  : cn(card.borderUnselected, card.borderHover, "hover:-translate-y-0.5 hover:shadow-md"),
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900",
              )}
            >
              <div className="w-full">
                {/* Top illustration and radio button */}
                <div className="flex items-start justify-between w-full">
                  <Badge />
                  <div
                    aria-hidden="true"
                    className={cn(
                      "mt-1 size-6 rounded-full border-2 transition-all flex items-center justify-center shrink-0",
                      isSelected
                        ? card.radioSelected
                        : "border-slate-300 bg-white/70 group-hover:border-slate-400",
                    )}
                  >
                    {isSelected && <div className="size-2 rounded-full bg-white shadow-xs" />}
                  </div>
                </div>

                {/* Title & Subtitle */}
                <h2 className="mt-4 sm:mt-5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                  {card.title}
                </h2>
                <p className="mt-1.5 text-xs sm:text-sm text-slate-500 font-normal leading-relaxed">
                  {card.subtitle}
                </p>

                {/* Divider */}
                <div className="my-5 sm:my-6 w-full border-t border-slate-200/60" />

                {/* Bullet Items */}
                <ul className="space-y-3.5">
                  {card.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.text} className="flex items-center gap-3 text-xs sm:text-sm font-medium text-slate-600">
                        <Icon className="size-4.5 text-slate-700 stroke-[1.8] shrink-0" aria-hidden="true" />
                        <span>{item.text}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom Action Footer */}
      <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          {initialPersona && (
            <p className="text-xs text-slate-500 font-medium">
              Switching starts that path from its first step. Anything you&apos;ve already saved, like your resume, is kept.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={!selected || isPending}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl px-7 py-3 text-sm font-semibold transition-all duration-200 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900",
            selected
              ? "bg-[#0F172A] hover:bg-slate-800 text-white shadow-md active:scale-95 cursor-pointer"
              : "bg-[#94A3B8] text-white cursor-not-allowed",
          )}
        >
          <span>{isPending ? "Continuing..." : "Continue"}</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
