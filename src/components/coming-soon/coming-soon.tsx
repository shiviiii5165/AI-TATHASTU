import { ArrowLeft, Award, BookOpen, Bot, Briefcase, CheckCircle2, Code2, GraduationCap, Lightbulb, MessageCircle, Mic, Sparkles, Star, User, UserRoundCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";

/**
 * Animated "coming soon" pages for modules that aren't built yet (Mentors, AI Interview). The scenes are
 * illustrations of what's planned, drawn with generic icons: no invented people, scores or availability, and
 * no sign-up button that wouldn't do anything. Every animation is CSS (globals.css, "cs-*") and stops under
 * prefers-reduced-motion, leaving a complete still picture.
 */
export type ComingSoonModule = "ai-interview" | "mentor";

const COPY: Record<ComingSoonModule, { eyebrow: string; title: string; body: string; points: { icon: LucideIcon; text: string }[] }> = {
  "ai-interview": {
    eyebrow: "AI Interview",
    title: "Your practice interview room is on its way",
    body: "We're building a place to rehearse interviews for the role you're aiming at, out loud or in writing, and get clear feedback on how to answer better.",
    points: [
      { icon: Briefcase, text: "Questions shaped around your chosen career goal" },
      { icon: Mic, text: "Practise by speaking or typing, at your own pace" },
      { icon: Lightbulb, text: "Feedback on structure, clarity and what to improve" },
    ],
  },
  mentor: {
    eyebrow: "Mentors",
    title: "Your mentor network is on its way",
    body: "We're building a way to find faculty and alumni whose experience fits your goals, so you can ask for guidance, feedback and introductions.",
    points: [
      { icon: GraduationCap, text: "Faculty and alumni matched to your goals and skills" },
      { icon: MessageCircle, text: "Ask for guidance, project feedback or career advice" },
      { icon: UserRoundCheck, text: "Only people who've chosen to mentor will appear" },
    ],
  },
};

export function ComingSoon({ module }: { module: ComingSoonModule }) {
  const copy = COPY[module];
  return (
    <div className="mx-auto max-w-5xl pb-16" data-testid={`coming-soon-${module}`}>
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to dashboard
      </Link>

      <section className="relative overflow-hidden rounded-3xl border border-border bg-card shadow-xs">
        {/* Soft background light */}
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-gradient-to-br from-[#FF496D]/12 to-[#8554FF]/10 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-20 size-96 rounded-full bg-gradient-to-tr from-[#06b6d4]/10 to-[#8554FF]/10 blur-3xl" />

        <div className="relative grid grid-cols-1 items-center gap-8 p-6 sm:p-10 lg:grid-cols-2">
          <div className="cs-rise">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF496D]/20 bg-[#FFF1F4] px-3 py-1 text-xs font-bold text-[#E0264E] dark:bg-[#FF496D]/10 dark:text-[#ff8aa1]">
              <span aria-hidden className="relative flex size-2">
                <span className="cs-ring absolute inline-flex size-full rounded-full bg-[#FF496D]" />
                <span className="relative inline-flex size-2 rounded-full bg-[#FF496D]" />
              </span>
              {copy.eyebrow} · Coming soon
            </span>
            <h1 className="mt-4 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              {copy.title.split(" ").slice(0, -2).join(" ")}{" "}
              <span className="cs-shimmer bg-gradient-to-r from-[#FF496D] via-[#8554FF] to-[#FF496D] bg-clip-text text-transparent">{copy.title.split(" ").slice(-2).join(" ")}</span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
            <ul className="mt-6 space-y-3">
              {copy.points.map((p, i) => (
                <li key={p.text} className="cs-rise flex items-start gap-3" style={{ animationDelay: `${200 + i * 120}ms` }}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#F4F1FD] text-[#8554FF] dark:bg-[#8554FF]/15 dark:text-[#b9a3ff]">
                    <p.icon aria-hidden className="size-4" />
                  </span>
                  <span className="pt-1.5 text-sm text-foreground">{p.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-muted-foreground">Not available yet. Everything else on your dashboard works today.</p>
            <Link href="/dashboard" className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF496D] to-[#FF713D] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-95">
              Return to dashboard
            </Link>
          </div>

          <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[420px]">{module === "ai-interview" ? <InterviewScene /> : <MentorScene />}</div>
        </div>
      </section>
    </div>
  );
}

// ─── AI Interview: a live practice room ─────────────────────────────────────

function InterviewScene() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center">
      {/* The interviewer's voice orb */}
      <div className="relative flex size-32 items-center justify-center">
        {[0, 0.9, 1.8].map((d) => (
          <span key={d} className="cs-ring absolute inset-0 rounded-full bg-gradient-to-br from-[#8554FF]/40 to-[#FF496D]/30" style={{ animationDelay: `${d}s` }} />
        ))}
        <span className="cs-float relative flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-[#8554FF] via-[#a855f7] to-[#FF496D] text-white shadow-[0_18px_40px_-12px_rgba(133,84,255,0.6)]">
          <Bot className="size-10" />
        </span>
      </div>

      {/* Live waveform */}
      <div className="mt-6 flex h-10 items-center gap-1">
        {Array.from({ length: 21 }, (_, i) => (
          <span key={i} className="cs-wave block w-1.5 rounded-full bg-gradient-to-t from-[#8554FF] to-[#FF496D]" style={{ height: `${14 + ((i * 7) % 24)}px`, animationDelay: `${(i % 7) * 0.12}s` }} />
        ))}
      </div>

      {/* The conversation */}
      <div className="mt-6 w-full max-w-[340px] space-y-2.5">
        <div className="cs-question flex items-end gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#F4F1FD] text-[#8554FF] dark:bg-[#8554FF]/20"><Bot className="size-3.5" /></span>
          <div className="rounded-2xl rounded-bl-md border border-border bg-card px-3.5 py-2.5 text-xs text-foreground shadow-2xs">Tell me about a project you&apos;re proud of. What was the hardest part?</div>
        </div>
        <div className="relative h-11">
          <div className="cs-typing absolute right-0 flex items-center gap-1 rounded-2xl rounded-br-md bg-gradient-to-r from-[#FF496D] to-[#FF713D] px-3.5 py-3">
            {[0, 0.15, 0.3].map((d) => (
              <span key={d} className="cs-dot block size-1.5 rounded-full bg-white" style={{ animationDelay: `${d}s` }} />
            ))}
          </div>
          <div className="cs-answer absolute right-0 flex items-end gap-2">
            <div className="rounded-2xl rounded-br-md bg-gradient-to-r from-[#FF496D] to-[#FF713D] px-3.5 py-2.5 text-xs text-white shadow-xs">I built a model end to end, and the hard part was…</div>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#FFF1F4] text-[#FF496D] dark:bg-[#FF496D]/15"><User className="size-3.5" /></span>
          </div>
        </div>
        <div className="cs-feedback mx-auto flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="size-3.5" />
          Clear structure, now add a result
        </div>
      </div>

      {/* Floating accents */}
      <span className="cs-float absolute left-2 top-10 flex size-10 items-center justify-center rounded-2xl border border-border bg-card text-[#FF496D] shadow-xs" style={{ animationDelay: "1.2s" }}><Mic className="size-4" /></span>
      <span className="cs-float absolute right-3 top-16 flex size-10 items-center justify-center rounded-2xl border border-border bg-card text-[#06b6d4] shadow-xs" style={{ animationDelay: "0.4s" }}><Sparkles className="size-4" /></span>
    </div>
  );
}

// ─── Mentors: a network forming around you ──────────────────────────────────

const INNER: { icon: LucideIcon; tone: string }[] = [
  { icon: GraduationCap, tone: "from-[#8554FF] to-[#a78bfa]" },
  { icon: Briefcase, tone: "from-[#06b6d4] to-[#22d3ee]" },
  { icon: Code2, tone: "from-[#10b981] to-[#34d399]" },
  { icon: BookOpen, tone: "from-[#f97316] to-[#fb923c]" },
];
const OUTER: { icon: LucideIcon; tone: string }[] = [
  { icon: UserRoundCheck, tone: "from-[#ec4899] to-[#f472b6]" },
  { icon: Award, tone: "from-[#3b82f6] to-[#60a5fa]" },
  { icon: Star, tone: "from-[#eab308] to-[#facc15]" },
  { icon: Lightbulb, tone: "from-[#14b8a6] to-[#2dd4bf]" },
  { icon: MessageCircle, tone: "from-[#a855f7] to-[#c084fc]" },
  { icon: GraduationCap, tone: "from-[#FF496D] to-[#FF713D]" },
];

function MentorScene() {
  return (
    <div className="absolute inset-0">
      {/* Rings and pulsing connections */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 size-full">
        <circle cx="200" cy="200" r="92" fill="none" stroke="#e9e3ff" strokeWidth="1.5" />
        <circle cx="200" cy="200" r="160" fill="none" stroke="#f1edff" strokeWidth="1.5" strokeDasharray="2 6" />
        {[0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
          return <line key={i} className="cs-line" x1="200" y1="200" x2={200 + 92 * Math.cos(a)} y2={200 + 92 * Math.sin(a)} stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" style={{ animationDelay: `${i * 0.3}s` }} />;
        })}
      </svg>

      {/* Inner ring: four mentors orbiting */}
      <div className="cs-orbit absolute inset-0">
        {INNER.map((m, i) => {
          const a = (i / INNER.length) * Math.PI * 2 - Math.PI / 2;
          return (
            <span key={i} className="absolute" style={{ left: `${50 + 23 * Math.cos(a)}%`, top: `${50 + 23 * Math.sin(a)}%` }}>
              <span className="cs-upright -ml-6 -mt-6 flex size-12 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-lg ring-4 ring-card" style={{ backgroundImage: undefined }}>
                <span className={`flex size-full items-center justify-center rounded-full bg-gradient-to-br ${m.tone}`}><m.icon className="size-5" /></span>
              </span>
            </span>
          );
        })}
      </div>

      {/* Outer ring: six more, slower, the other way */}
      <div className="cs-orbit-slow absolute inset-0">
        {OUTER.map((m, i) => {
          const a = (i / OUTER.length) * Math.PI * 2;
          return (
            <span key={i} className="absolute" style={{ left: `${50 + 40 * Math.cos(a)}%`, top: `${50 + 40 * Math.sin(a)}%` }}>
              <span className={`cs-upright-slow -ml-[18px] -mt-[18px] flex size-9 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-md ring-[3px] ring-card ${m.tone}`}>
                <m.icon className="size-4" />
              </span>
            </span>
          );
        })}
      </div>

      {/* You, at the centre */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <span className="cs-ring absolute inset-0 rounded-full bg-[#FF496D]/30" />
        <span className="cs-ring absolute inset-0 rounded-full bg-[#8554FF]/25" style={{ animationDelay: "1.4s" }} />
        <span className="relative flex size-20 flex-col items-center justify-center rounded-full bg-gradient-to-br from-[#FF496D] to-[#8554FF] text-white shadow-[0_16px_40px_-10px_rgba(255,73,109,0.55)] ring-4 ring-card">
          <User className="size-7" />
          <span className="text-[10px] font-bold">You</span>
        </span>
      </div>

      {/* Floating expertise chips */}
      <span className="cs-float absolute left-0 top-6 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-xs">Career advice</span>
      <span className="cs-float absolute bottom-8 right-0 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-xs" style={{ animationDelay: "1.6s" }}>Project feedback</span>
      <span className="cs-float absolute bottom-2 left-6 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-xs" style={{ animationDelay: "0.8s" }}>Referrals</span>
    </div>
  );
}
