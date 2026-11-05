"use client";

import { ArrowRight, BookOpen, Brain, Check, Code2, Cpu, Database, ExternalLink, GraduationCap, Layers, Network, Rocket, Shield, Sliders, Sparkles, Target, Workflow } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";

import { submitRoadmapEvidence } from "@/app/(dashboard)/dashboard/roadmap-actions";
import { roleLabel } from "@/components/dashboard/widgets/labels";
import type { EngineSkill, GapState, IntelligenceDoc, RoleAnalysis, RoleSkillRow } from "@/lib/dashboard/types";
import { roadmapProgress, type MilestoneStatus, type MilestoneSubmission, type RoadmapStep } from "@/lib/roadmap/progress";

const STATUS_LABEL = { verified: "Verified", claimed: "Claimed", inferred: "Inferred" } as const;
const STATE_LABEL: Record<GapState, string> = {
  met: "At level",
  underdeveloped: "Below expected",
  unverified: "Not shown yet",
  inferred: "Only suggested",
  missing: "No evidence",
  not_assessed: "Not assessed",
};
const PRIORITY_CLASS = {
  High: "bg-rose-50 text-rose-600 ring-rose-200/70 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/30",
  Medium: "bg-amber-50 text-amber-700 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/30",
  Low: "bg-sky-50 text-sky-700 ring-sky-200/70 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/30",
} as const;

/**
 * Colour families for skills and recommendations. A skill keeps its colour everywhere (picked from its
 * name, not its position or a random value), so the palette carries identity and nothing else.
 */
const PALETTE = [
  { bar: "from-violet-500 via-fuchsia-500 to-pink-500", glow: "bg-pink-400 shadow-[0_0_8px_2px] shadow-pink-400/60", chip: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300", tint: "bg-violet-50/70 dark:bg-violet-500/10" },
  { bar: "from-blue-600 to-cyan-400", glow: "bg-cyan-300 shadow-[0_0_8px_2px] shadow-cyan-400/60", chip: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300", tint: "bg-blue-50/70 dark:bg-blue-500/10" },
  { bar: "from-indigo-500 to-sky-400", glow: "bg-sky-300 shadow-[0_0_8px_2px] shadow-sky-400/60", chip: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300", tint: "bg-indigo-50/70 dark:bg-indigo-500/10" },
  { bar: "from-purple-600 to-violet-400", glow: "bg-violet-300 shadow-[0_0_8px_2px] shadow-violet-400/60", chip: "bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300", tint: "bg-purple-50/70 dark:bg-purple-500/10" },
  { bar: "from-orange-500 to-amber-300", glow: "bg-amber-200 shadow-[0_0_8px_2px] shadow-amber-400/60", chip: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300", tint: "bg-orange-50/70 dark:bg-orange-500/10" },
  { bar: "from-teal-500 to-emerald-300", glow: "bg-emerald-200 shadow-[0_0_8px_2px] shadow-emerald-400/60", chip: "bg-teal-50 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300", tint: "bg-emerald-50/70 dark:bg-emerald-500/10" },
  { bar: "from-pink-500 to-rose-300", glow: "bg-rose-200 shadow-[0_0_8px_2px] shadow-rose-400/60", chip: "bg-pink-50 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300", tint: "bg-pink-50/70 dark:bg-pink-500/10" },
] as const;

export function paletteIndex(name: string): number {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % PALETTE.length;
}
const paletteFor = (name: string) => PALETTE[paletteIndex(name)];

const LEVEL_BADGE: Record<string, string> = {
  Advanced: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  Proficient: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  Working: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  Foundational: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
};

/** An icon for a skill or gap from its name: a hint at the area, never a claim about the user. */
function SkillIcon({ name, className }: { name: string; className: string }) {
  const n = name.toLowerCase();
  if (/llm|language model|prompt|rag|retrieval|agent|generative|evaluation/.test(n)) return <Sparkles aria-hidden className={className} />;
  if (/sql|postgres|mongo|redis|database|vector/.test(n)) return <Database aria-hidden className={className} />;
  if (/docker|kubernetes|ci\/cd|mlops|mlflow|deploy|terraform|aws|cloud|linux|airflow/.test(n)) return <Workflow aria-hidden className={className} />;
  if (/cuda|gpu|tensorrt|onnx|edge|device|quantization|distributed/.test(n)) return <Cpu aria-hidden className={className} />;
  if (/safety|privacy|security/.test(n)) return <Shield aria-hidden className={className} />;
  if (/learning|neural|vision|speech|nlp|language|graph|deep|statistics|probability|algebra/.test(n)) return <Brain aria-hidden className={className} />;
  if (/react|next|html|css|typescript|javascript/.test(n)) return <Layers aria-hidden className={className} />;
  return <Code2 aria-hidden className={className} />;
}

function Card({ icon, iconClass, title, href, linkLabel, children, footer }: { icon: ReactNode; iconClass: string; title: string; href: string; linkLabel: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="flex h-full xl:min-h-72 flex-col rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>{icon}</div>
          <h2 className="font-sans text-sm font-bold leading-tight text-foreground">{title}</h2>
        </div>
        <Link href={href} className="inline-flex shrink-0 items-center whitespace-nowrap gap-1 rounded-full px-2 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">
          <span>{linkLabel}</span>
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>
      <div className="flex flex-1 flex-col pt-3">{children}</div>
      {footer && <div className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">{footer}</div>}
    </section>
  );
}

function Empty({ title, body, href, action }: { title: string; body: string; href?: string; action?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-4 text-center">
      <p className="text-xs font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-[230px] text-[11px] text-muted-foreground">{body}</p>
      {href && action && (
        <Link href={href} className="mt-3 text-xs font-semibold text-primary hover:underline">
          {action}
        </Link>
      )}
    </div>
  );
}

const UPDATING = { title: "Being updated", body: "This is recalculated from your evidence the next time your profile is processed." };

export function GrowthDevelopmentRow({ intelligence, roadmapSubmissions }: { intelligence?: IntelligenceDoc; roadmapSubmissions?: MilestoneSubmission[] }) {
  const [roleIndex, setRoleIndex] = useState(0);
  const role = intelligence?.roles[roleIndex];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SkillProficiencyCard intelligence={intelligence} />
      <SkillGapsCard intelligence={intelligence} role={role} roleIndex={roleIndex} onRole={setRoleIndex} />
      <LearningPathsCard intelligence={intelligence} />
      <CareerRoadmapCard intelligence={intelligence} submissions={roadmapSubmissions} />
    </div>
  );
}

// ─── Skill Proficiency ──────────────────────────────────────────────────────

/** Bar width is the engine's score, clamped to 0-100 and never padded. Exported for tests. */
export function barWidth(proficiency: number | null): number | null {
  if (proficiency === null || !Number.isFinite(proficiency)) return null;
  return Math.max(0, Math.min(100, proficiency));
}

export function SkillRow({ skill, index }: { skill: EngineSkill; index: number }) {
  const width = barWidth(skill.proficiency);
  const p = paletteFor(skill.name);
  return (
    <li className="flex items-center gap-2.5">
      <span aria-hidden className={`flex size-6 shrink-0 items-center justify-center rounded-md ${p.chip}`}>
        <SkillIcon name={skill.name} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate font-semibold text-foreground" title={skill.name}>
            {skill.name}
          </span>
          {width !== null ? (
            <span className="flex shrink-0 items-center gap-1.5">
              <span className={`rounded-md px-1.5 py-px text-[10px] font-semibold ${LEVEL_BADGE[skill.level] ?? "bg-muted text-muted-foreground"}`}>{skill.level}</span>
              <span className="w-8 text-right text-[11px] font-bold tabular-nums text-foreground">{Math.round(width)}%</span>
            </span>
          ) : (
            <span className="shrink-0 text-[11px] text-muted-foreground">Not assessed</span>
          )}
        </div>
        {width !== null ? (
          <div className="mt-1 h-1.5 w-full rounded-full bg-muted/80" role="img" aria-label={`${skill.name}: ${Math.round(width)} of 100, ${STATUS_LABEL[skill.status].toLowerCase()}`}>
            {/* The fill is sized to the real score; the animation only scales it in from zero, once, on mount. */}
            <div
              data-testid="skill-bar-fill"
              className={`relative h-full origin-left rounded-full bg-gradient-to-r ${p.bar} ${skill.status === "verified" ? "" : "opacity-75"} motion-safe:animate-[skillBarGrow_900ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none`}
              style={{ width: `${width}%`, animationDelay: `${index * 80}ms` }}
            >
              <span aria-hidden className={`absolute -right-0.5 top-1/2 size-2 -translate-y-1/2 rounded-full ring-2 ring-card ${p.glow}`} />
            </div>
          </div>
        ) : (
          <div className="mt-1 h-1.5 w-full rounded-full border border-dashed border-border" aria-hidden />
        )}
      </div>
    </li>
  );
}

function SkillProficiencyCard({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const skills = intelligence?.skills ?? [];
  return (
    <Card
      icon={<Sliders aria-hidden className="size-4" />}
      iconClass="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
      title="Skill Proficiency"
      href="/skills"
      linkLabel="View all"
      footer={intelligence && skills.length > 0 ? `${intelligence.counts.verified} verified · ${intelligence.counts.claimed} claimed · ${skills.length - intelligence.counts.assessed} not assessed` : undefined}
    >
      {!intelligence ? (
        <Empty {...UPDATING} />
      ) : skills.length === 0 ? (
        <Empty title="No skills to assess yet" body="Scores come from your repositories and projects." href="/connections" action="Connect GitHub" />
      ) : (
        <ul className="space-y-2.5">
          {skills.slice(0, 7).map((s, i) => (
            <SkillRow key={s.name} skill={s} index={i} />
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─── Skill Gaps ─────────────────────────────────────────────────────────────

function RolePicker({ roles, index, onChange }: { roles: RoleAnalysis[]; index: number; onChange: (i: number) => void }) {
  if (roles.length < 2) return <p className="mb-2 truncate text-[11px] text-muted-foreground">For {roles[0] ? roleLabel(roles[0].role) : ""}</p>;
  return (
    <label className="mb-2 block text-[11px] text-muted-foreground">
      <span className="sr-only">Career goal</span>
      <select
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {roles.map((r, i) => (
          <option key={r.role} value={i}>
            {roleLabel(r.role)}
          </option>
        ))}
      </select>
    </label>
  );
}

function GapRow({ row }: { row: RoleSkillRow }) {
  const p = paletteFor(row.skill);
  return (
    <li className="-mx-1.5 flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors duration-150 hover:bg-muted/60">
      <span aria-hidden className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${p.chip}`}>
        <SkillIcon name={row.skill} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-semibold text-foreground" title={row.skill}>
            {row.skill}
          </p>
          <span className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ${PRIORITY_CLASS[row.priority]}`}>{row.priority}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {STATE_LABEL[row.state]}
          {row.proficiency !== null ? ` · ${row.level}` : ""} · needs {row.expectedLevel}
        </p>
      </div>
    </li>
  );
}

function SkillGapsCard({ intelligence, role, roleIndex, onRole }: { intelligence?: IntelligenceDoc; role?: RoleAnalysis; roleIndex: number; onRole: (i: number) => void }) {
  return (
    <Card
      icon={<Network aria-hidden className="size-4" />}
      iconClass="bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300"
      title="Skill Gaps"
      href="/skills"
      linkLabel="View all"
      footer={role?.assessed ? `${role.counts.met} of ${role.skills.length} at expected level · ${role.counts.unverified + role.counts.inferred} need evidence` : undefined}
    >
      {!intelligence ? (
        <Empty {...UPDATING} />
      ) : !role ? (
        <Empty title="No role framework to compare with" body={intelligence.unsupportedRoles.length ? "Your selected goal doesn't have a competency framework yet." : "Choose a career goal to see what it needs."} href="/settings" action="Your settings" />
      ) : !role.assessed ? (
        <>
          <RolePicker roles={intelligence.roles} index={roleIndex} onChange={onRole} />
          <Empty title="Not enough evidence to assess" body="That isn't the same as a gap. Add a resume or connect GitHub." href="/connections" action="Add evidence" />
        </>
      ) : role.open.length === 0 ? (
        <>
          <RolePicker roles={intelligence.roles} index={roleIndex} onChange={onRole} />
          <Empty title="Every skill for this goal is at its expected level" body="Based on your current evidence." />
        </>
      ) : (
        <>
          <RolePicker roles={intelligence.roles} index={roleIndex} onChange={onRole} />
          <ul className="space-y-0.5">
            {role.open.slice(0, 4).map((row) => (
              <GapRow key={row.skill} row={row} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

// ─── Learning Paths ─────────────────────────────────────────────────────────

function LearningPathsCard({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const recommendations = intelligence?.recommendations ?? [];
  return (
    <Card
      icon={<GraduationCap aria-hidden className="size-4" />}
      iconClass="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
      title="Learning Paths"
      href="/learning"
      linkLabel="View all"
      footer={recommendations.length > 0 ? `Picked from your gaps · ${recommendations.length} in total` : undefined}
    >
      {!intelligence ? (
        <Empty {...UPDATING} />
      ) : recommendations.length === 0 ? (
        <Empty title="No recommendations yet" body={intelligence.hasEvidenceBase ? "They appear when your evidence shows a gap for your goal." : "Add evidence first, so these fit you."} />
      ) : (
        <ul className="space-y-2">
          {recommendations.slice(0, 3).map((r) => {
            const p = paletteFor(r.skill);
            return (
              <li key={r.skill} className={`flex items-start gap-2.5 rounded-xl p-2.5 transition-shadow duration-150 hover:shadow-sm ${p.tint}`}>
                <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-lg bg-card/80 ${p.chip}`}>
                  {r.resource ? <BookOpen aria-hidden className="size-4" /> : <SkillIcon name={r.skill} className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground" title={r.skill}>
                    {r.skill}
                  </p>
                  {r.resource ? (
                    <a href={r.resource.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[11px] text-primary hover:underline">
                      <span className="truncate">{r.resource.title}</span>
                      <ExternalLink aria-hidden className="size-3 shrink-0" />
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  ) : (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">Self-directed: learn by building</p>
                  )}
                  {/* Only the catalogue's own facts: provider and duration when it has them. No module counts are invented. */}
                  {r.resource && (r.resource.provider || r.resource.duration) && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{[r.resource.provider, r.resource.duration].filter(Boolean).join(" • ")}</p>
                  )}
                  {!r.resource && <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{r.why}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

// ─── Career Roadmap ─────────────────────────────────────────────────────────

// Fixed geometry for the curve; node positions are its segment endpoints.
const VIEW = { w: 300, h: 128 };
const NODES = [
  { x: 18, y: 106 },
  { x: 108, y: 84 },
  { x: 196, y: 54 },
  { x: 280, y: 18 },
];
const PATH = `M ${NODES[0].x} ${NODES[0].y} Q 64 108 ${NODES[1].x} ${NODES[1].y} Q 150 70 ${NODES[2].x} ${NODES[2].y} Q 240 40 ${NODES[3].x} ${NODES[3].y}`;
const STAGE_KEYS = ["foundation", "build", "deepen"] as const;
const STAGE_LABEL = { foundation: "Short Term", build: "Mid Term", deepen: "Long Term" } as const;

const STEP_BADGE: Record<MilestoneStatus, { label: string; className: string }> = {
  completed: { label: "Completed", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  submitted: { label: "Submitted for review", className: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  needs_more_evidence: { label: "Needs more evidence", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  active: { label: "Active", className: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  upcoming: { label: "Upcoming", className: "bg-muted text-muted-foreground" },
};

function EvidenceForm({ step, onDone }: { step: RoadmapStep; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-2 flex flex-wrap gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await submitRoadmapEvidence({ milestoneId: step.id, evidenceUrl: url });
          if (res.ok) {
            setUrl("");
            onDone();
          } else setMessage(res.error);
        });
      }}
    >
      <label className="sr-only" htmlFor={`evidence-${step.id}`}>
        Link to your work for {step.skill}
      </label>
      <input
        id={`evidence-${step.id}`}
        type="url"
        required
        inputMode="url"
        placeholder="https://github.com/you/project"
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setMessage(null);
        }}
        className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1 text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <button type="submit" disabled={pending} className="shrink-0 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
        {pending ? "Sending…" : "Submit"}
      </button>
      {message && (
        <p role="alert" className="basis-full text-[10px] text-destructive">
          {message}
        </p>
      )}
    </form>
  );
}

function CareerRoadmapCard({ intelligence, submissions }: { intelligence?: IntelligenceDoc; submissions?: MilestoneSubmission[] }) {
  const roadmap = intelligence?.roadmap;
  const progress = useMemo(() => (roadmap && intelligence ? roadmapProgress(roadmap, intelligence.computedAt, submissions) : null), [roadmap, intelligence, submissions]);
  const [stageKey, setStageKey] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [sent, setSent] = useState(false);

  const percent = progress ? Math.round(progress.progress * 100) : 0;
  const stages = STAGE_KEYS.map((key) => ({ key, steps: progress?.steps.filter((s) => s.stageKey === key) ?? [] }));
  const nextStep = progress?.steps.find((s) => s.id === progress.nextId) ?? null;
  const activeStage = stageKey ?? nextStep?.stageKey ?? stages.find((s) => s.steps.length)?.key ?? null;
  const focus = activeStage ? (stages.find((s) => s.key === activeStage)?.steps ?? []) : [];
  const shown = focus.find((s) => s.id === progress?.nextId) ?? focus.find((s) => s.status !== "completed") ?? focus[0] ?? null;

  return (
    <Card
      icon={<Target aria-hidden className="size-4" />}
      iconClass="bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300"
      title="Career Roadmap"
      href="/learning"
      linkLabel="View plan"
      footer={progress ? `${percent}% of ${roleLabel(progress.role)} skills shown at level by your evidence` : undefined}
    >
      {!intelligence ? (
        <Empty {...UPDATING} />
      ) : !roadmap || !progress ? (
        <Empty title="No roadmap yet" body="Choose a career goal that has a competency framework." href="/settings" action="Your settings" />
      ) : (
        <>
          <p className="truncate text-xs font-semibold text-foreground">Towards {roleLabel(progress.role)}</p>
          <div className="relative mb-6 mt-1" style={{ aspectRatio: `${VIEW.w} / ${VIEW.h}` }}>
            <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} className="absolute inset-0 size-full overflow-visible" aria-hidden>
              <defs>
                <linearGradient id="roadmap-gradient" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="60%" stopColor="#a855f7" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
                <filter id="roadmap-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="2.5" />
                </filter>
              </defs>
              <path d={PATH} fill="none" stroke="var(--border)" strokeWidth="3" strokeLinecap="round" />
              {/* Drawn only as far as the engine's evidence coverage; the animation starts from zero and stops on it. */}
              <path
                data-testid="roadmap-progress-path"
                d={PATH}
                pathLength={100}
                fill="none"
                stroke="url(#roadmap-gradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="100 100"
                strokeDashoffset={100 - percent}
                className="motion-safe:animate-[roadmapDraw_1200ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none"
              />
            </svg>

            {/* Current position: always reached. */}
            <RoadmapNode x={NODES[0].x} y={NODES[0].y} state="reached" label="Current" />
            {stages.map((s, i) => (
              <RoadmapNode
                key={s.key}
                x={NODES[i + 1].x}
                y={NODES[i + 1].y}
                state={s.steps.length === 0 ? "empty" : s.key === nextStep?.stageKey ? "active" : "upcoming"}
                label={STAGE_LABEL[s.key]}
                selected={activeStage === s.key}
                onClick={s.steps.length ? () => (setStageKey(s.key), setFormOpen(false), setSent(false)) : undefined}
                rocket={i === 2}
              />
            ))}

            {/* Captions: the stage name and its first open skill from the user's own roadmap. */}
            <Caption x={NODES[0].x} y={NODES[0].y} title="Current" body={roadmap.currentPosition ?? "Not on your profile"} />
            {stages.map((s, i) => (
              <Caption key={s.key} x={NODES[i + 1].x} y={NODES[i + 1].y} title={STAGE_LABEL[s.key]} body={s.steps.length ? s.steps.map((x) => x.skill).join(", ") : "Nothing open"} align={i === 2 ? "right" : "left"} />
            ))}
          </div>

          {shown && (
            <div className="mt-2 rounded-xl bg-muted/50 p-2.5" aria-live="polite">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] font-semibold text-foreground" title={shown.deliverable}>
                  {STAGE_LABEL[shown.stageKey as keyof typeof STAGE_LABEL]}: {shown.skill}
                </p>
                <span className={`shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ${STEP_BADGE[shown.status].className}`}>{STEP_BADGE[shown.status].label}</span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground" title={shown.criterion}>
                {shown.deliverable}
              </p>
              {shown.status !== "completed" &&
                (sent ? (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">Submitted. It counts once your evidence shows {shown.skill} at level.</p>
                ) : formOpen ? (
                  <EvidenceForm step={shown} onDone={() => (setSent(true), setFormOpen(false))} />
                ) : (
                  <button type="button" onClick={() => setFormOpen(true)} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                    <Check aria-hidden className="size-3" />
                    Submit evidence
                  </button>
                ))}
            </div>
          )}
          {progress.steps.length === 0 && <p className="mt-2 text-xs font-semibold text-foreground">Every skill for this goal is at its expected level.</p>}
        </>
      )}
    </Card>
  );
}

function Caption({ x, y, title, body, align = "left" }: { x: number; y: number; title: string; body: string; align?: "left" | "right" }) {
  const style = align === "right" ? { right: `${100 - (x / VIEW.w) * 100 - 3}%`, top: `${(y / VIEW.h) * 100 + 14}%` } : { left: `${Math.max(0, (x / VIEW.w) * 100 - 4)}%`, top: `${(y / VIEW.h) * 100 + 9}%` };
  return (
    <div style={style} className={`pointer-events-none absolute w-[32%] text-[10px] leading-tight ${align === "right" ? "text-right" : ""}`}>
      <p className="truncate font-bold text-foreground">{title}</p>
      <p className="truncate text-muted-foreground" title={body}>
        {body}
      </p>
    </div>
  );
}

function RoadmapNode({ x, y, state, label, selected, onClick, rocket }: { x: number; y: number; state: "reached" | "active" | "upcoming" | "empty"; label: string; selected?: boolean; onClick?: () => void; rocket?: boolean }) {
  const style = { left: `${(x / VIEW.w) * 100}%`, top: `${(y / VIEW.h) * 100}%` };
  const dot =
    state === "reached"
      ? "size-3 bg-violet-500 ring-4 ring-violet-500/20"
      : state === "active"
        ? "size-3.5 bg-fuchsia-500 ring-4 ring-fuchsia-500/25 motion-safe:animate-pulse"
        : state === "empty"
          ? "size-2.5 bg-emerald-500 ring-4 ring-emerald-500/15"
          : "size-2.5 border-2 border-violet-400 bg-card";
  const content = rocket ? (
    <span className={`flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_14px] shadow-fuchsia-500/50 ${state === "upcoming" ? "opacity-80" : ""}`}>
      <Rocket aria-hidden className="size-3.5" />
    </span>
  ) : (
    <span className={`block rounded-full ${dot}`} />
  );
  const cls = `absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-150 ${selected ? "scale-110" : ""}`;
  const name = `${label}${state === "empty" ? ": nothing open" : state === "active" ? ": next" : ""}`;
  return onClick ? (
    <button type="button" onClick={onClick} style={style} aria-label={`${name}. Show milestones`} aria-pressed={selected} className={`${cls} p-1.5 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}>
      {content}
    </button>
  ) : (
    <span style={style} className={cls} title={name}>
      {content}
    </span>
  );
}
