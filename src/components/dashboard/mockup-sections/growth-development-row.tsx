"use client";

import { ArrowRight, BookOpen, Brain, Code2, Cpu, Database, ExternalLink, GraduationCap, Layers, Network, Shield, Sliders, Sparkles, Workflow } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { roleLabel } from "@/components/dashboard/widgets/labels";
import { EVIDENCE_BASIS, LEVEL_STEPS, basisLine, evidenceBasisOf, levelStep, openRows, primaryAnalysis } from "@/lib/dashboard/intelligence";
import { expectsText, needsShort, stateText } from "@/lib/dashboard/plain-language";
import type { EngineSkill, IntelligenceDoc, RoleAnalysis, RoleSkillRow } from "@/lib/dashboard/types";
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

/**
 * Skill proficiency and learning paths. Skill Gaps sits with the Career Roadmap in the career-development
 * section (dashboard-view.tsx), as <SkillGaps />.
 */
export function GrowthDevelopmentRow({ intelligence }: { intelligence?: IntelligenceDoc }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <SkillProficiencyCard intelligence={intelligence} />
      <LearningPathsCard intelligence={intelligence} />
    </div>
  );
}

/** Skill Gaps for the user's chosen goal(s), with its own goal picker. */
export function SkillGaps({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const [roleIndex, setRoleIndex] = useState(0);
  return <SkillGapsCard intelligence={intelligence} role={intelligence?.roles[roleIndex]} roleIndex={roleIndex} onRole={setRoleIndex} />;
}

// ─── Skill Proficiency ──────────────────────────────────────────────────────

/**
 * Filled steps of the four-level bar: the engine's level, never a percentage. The score behind it is a points total with
 * evidence gates, so showing "70%" would suggest a precision the evidence doesn't have. Exported for tests.
 */
export function filledSteps(skill: Pick<EngineSkill, "proficiency" | "level">): number {
  return skill.proficiency === null || skill.proficiency === undefined ? 0 : levelStep(skill.level);
}

export function SkillRow({ skill, index, expectedLevel, met }: { skill: EngineSkill; index: number; expectedLevel?: string; met?: boolean }) {
  const filled = filledSteps(skill);
  const expected = expectedLevel ? levelStep(expectedLevel) : 0;
  const p = paletteFor(skill.name);
  const basis = evidenceBasisOf(skill);
  const line = filled ? basisLine(skill) : EVIDENCE_BASIS[basis].label;
  const label = `${skill.name}: ${filled ? skill.level : "not assessed"}${expected ? `, expected ${expectedLevel}` : ""}. ${EVIDENCE_BASIS[basis].explain}`;
  return (
    <li className="flex items-start gap-2.5" data-skill={skill.name}>
      <span aria-hidden className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${p.chip}`}>
        <SkillIcon name={skill.name} className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="min-w-0 truncate font-semibold text-foreground" title={skill.name}>
            {skill.name}
          </span>
          {filled ? (
            <span className="flex shrink-0 items-center gap-1.5">
              {expected > 0 && (
                <span className={`text-[10px] font-medium ${met ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}`}>{met ? "meets goal" : `goal: ${expectedLevel}`}</span>
              )}
              <span className={`rounded-md px-1.5 py-px text-[10px] font-semibold ${LEVEL_BADGE[skill.level] ?? "bg-muted text-muted-foreground"}`}>{skill.level}</span>
            </span>
          ) : (
            <span className="shrink-0 text-[11px] text-muted-foreground">{expected > 0 ? `Not assessed · goal: ${expectedLevel}` : "Not assessed"}</span>
          )}
        </div>
        <div className="mt-1 grid grid-cols-4 gap-1" role="img" aria-label={label}>
          {LEVEL_STEPS.map((step, i) => {
            const on = i < filled;
            const isGoal = expected === i + 1;
            return (
              <span
                key={step}
                title={step}
                data-testid={on ? "skill-step-filled" : "skill-step"}
                className={`relative h-1.5 rounded-full ${on ? "" : filled ? "bg-muted/80" : "border border-dashed border-border"} ${isGoal ? "outline outline-1 outline-offset-1 outline-foreground/40" : ""}`}
              >
                {on && (
                  // Each filled step scales in once, staggered; reduced motion shows the end state at once.
                  <span
                    className={`absolute inset-0 origin-left rounded-full bg-gradient-to-r ${p.bar} ${basis === "demonstrated" || basis === "assessed" ? "" : "opacity-60"} motion-safe:animate-[skillBarGrow_500ms_cubic-bezier(0.22,1,0.36,1)_both] motion-reduce:animate-none`}
                    style={{ animationDelay: `${index * 60 + i * 70}ms` }}
                  />
                )}
              </span>
            );
          })}
        </div>
        {line && <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground" title={(skill.levelBasis ?? []).join(" · ") || EVIDENCE_BASIS[basis].explain}>{line}</p>}
      </div>
    </li>
  );
}

/** A role row as a skill for the goal view, using the engine's skill entry when there is one so both views agree. */
function skillForRow(row: RoleSkillRow, skills: EngineSkill[]): EngineSkill {
  return (
    skills.find((s) => s.name === row.skill) ??
    ({ name: row.skill, category: "other", status: "inferred", proficiency: null, level: "Not assessed", confidence: 0, evidenceCount: 0, evidence: [], lastEvidenceAt: null, evidenceBasis: row.evidenceBasis ?? "not_found" } as EngineSkill)
  );
}

function SkillProficiencyCard({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const skills = intelligence?.skills ?? [];
  const analysis = primaryAnalysis(intelligence);
  const [view, setView] = useState<"goal" | "all">("goal");
  const showGoal = view === "goal" && Boolean(analysis);
  const goalRows = analysis ? [...analysis.skills].sort((a, b) => Number(a.tier === "supporting") - Number(b.tier === "supporting") || levelStep(b.level) - levelStep(a.level)) : [];
  const required = goalRows.filter((r) => (r.tier ?? "required") === "required");
  const basisCounts = skills.reduce<Record<string, number>>((acc, s) => ((acc[evidenceBasisOf(s)] = (acc[evidenceBasisOf(s)] ?? 0) + 1), acc), {});
  const footer = !intelligence || skills.length === 0
    ? undefined
    : showGoal
      ? `${required.filter((r) => r.state === "met").length} of ${required.length} required skills meet the level ${roleLabel(analysis!.role)} expects. The outlined step marks that level.`
      : [
          basisCounts.demonstrated || basisCounts.assessed ? `${(basisCounts.demonstrated ?? 0) + (basisCounts.assessed ?? 0)} shown in code or assessed` : null,
          basisCounts.repository_mention || basisCounts.described ? `${(basisCounts.repository_mention ?? 0) + (basisCounts.described ?? 0)} named or described only` : null,
          basisCounts.claimed ? `${basisCounts.claimed} listed only (not assessed)` : null,
        ].filter(Boolean).join(" · ");
  return (
    <Card
      icon={<Sliders aria-hidden className="size-4" />}
      iconClass="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
      title="Skill Proficiency"
      href="/skills"
      linkLabel="View all"
      footer={footer}
    >
      {!intelligence ? (
        <Empty {...UPDATING} />
      ) : skills.length === 0 && !analysis ? (
        <Empty title="No skills to assess yet" body="Levels come from your repositories and projects." href="/connections" action="Connect GitHub" />
      ) : (
        <>
          {analysis && (
            <div role="tablist" aria-label="Which skills to show" className="mb-2.5 inline-flex self-start rounded-lg bg-muted/60 p-0.5 text-[11px] font-semibold">
              {(["goal", "all"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  onClick={() => setView(v)}
                  className={`rounded-md px-2 py-0.5 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${view === v ? "bg-card text-foreground shadow-2xs" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {v === "goal" ? `For ${roleLabel(analysis.role)}` : "All skills"}
                </button>
              ))}
            </div>
          )}
          <ul className="space-y-2">
            {showGoal
              ? goalRows.slice(0, 7).map((r, i) => <SkillRow key={r.skill} skill={skillForRow(r, skills)} index={i} expectedLevel={r.expectedLevel} met={r.state === "met"} />)
              : skills.slice(0, 7).map((s, i) => <SkillRow key={s.name} skill={s} index={i} />)}
          </ul>
        </>
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
        <p className="mt-0.5 text-[11px] text-muted-foreground" title={stateText(row).sentence}>
          <span className="font-medium text-foreground/80">{stateText(row).label}</span>
          {row.proficiency !== null ? ` · now ${row.level}` : ""}
        </p>
        <p className="truncate text-[11px] text-muted-foreground" title={expectsText("This role", row.expectedLevel)}>
          {needsShort(row.expectedLevel)}
        </p>
      </div>
    </li>
  );
}

function gapFooter(role: RoleAnalysis): string {
  const c = role.categoryCounts;
  if (!c) {
    return `${role.counts.met} of ${role.skills.length} meet the expected level · ${role.counts.underdeveloped} need more practice · ${role.counts.unverified + role.counts.inferred + role.counts.missing + role.counts.not_assessed} without work examples yet`;
  }
  return [
    `${c.meets} of ${role.skills.length} meet the expected level`,
    c.needs_practice ? `${c.needs_practice} need more practice` : null,
    c.proof_needed ? `${c.proof_needed} need practical proof` : null,
    c.foundation + c.not_shown ? `${c.foundation + c.not_shown} not shown yet` : null,
  ].filter(Boolean).join(" · ");
}

function SkillGapsCard({ intelligence, role, roleIndex, onRole }: { intelligence?: IntelligenceDoc; role?: RoleAnalysis; roleIndex: number; onRole: (i: number) => void }) {
  const open = role ? openRows(role) : [];
  return (
    <Card
      icon={<Network aria-hidden className="size-4" />}
      iconClass="bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300"
      title="Skill Gaps"
      href="/skills#gap-inventory"
      linkLabel="View all"
      footer={role?.assessed ? gapFooter(role) : undefined}
    >
      {!intelligence ? (
        <Empty {...UPDATING} />
      ) : !role ? (
        <Empty title="No role framework to compare with" body={intelligence.unsupportedRoles.length ? "Your selected goal doesn't have a competency framework yet." : "Choose a career goal to see what it needs. Goals are chosen during onboarding."} />
      ) : !role.assessed ? (
        <>
          <RolePicker roles={intelligence.roles} index={roleIndex} onChange={onRole} />
          <Empty title="We need more examples of your work" body="Until then we can't tell which requirements you meet. That isn't the same as having gaps. Connect GitHub or confirm a project on your resume." href="/connections" action="Add evidence" />
        </>
      ) : open.length === 0 ? (
        <>
          <RolePicker roles={intelligence.roles} index={roleIndex} onChange={onRole} />
          <Empty title="Your work meets every requirement for this goal" body="Based on the work examples we have now. Optional skills, if any, are on the roadmap." />
        </>
      ) : (
        <>
          <RolePicker roles={intelligence.roles} index={roleIndex} onChange={onRole} />
          <p className="mb-2 text-[11px] text-muted-foreground">Requirements your work doesn&apos;t show at the expected level yet, highest priority first. Hover a status for what it means.</p>
          <ul className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2 xl:grid-cols-4">
            {open.slice(0, 8).map((row) => (
              <GapRow key={row.skill} row={row} />
            ))}
          </ul>
          {open.length > 8 && (
            <Link href="/skills#gap-inventory" className="mt-1.5 text-[11px] font-semibold text-primary hover:underline">
              See all {open.length} for this goal
            </Link>
          )}
        </>
      )}
    </Card>
  );
}

// ─── Learning Paths ─────────────────────────────────────────────────────────

const LEVEL_WORD: Record<string, string> = { none: "no experience", Foundational: "Foundational", Working: "Working", Proficient: "Proficient", Advanced: "Advanced" };

/** "From no experience to Working": the catalogue's level window for a resource. */
export function levelWindowText(w: { start: string; reach: string } | undefined): string | null {
  return w ? `From ${LEVEL_WORD[w.start] ?? w.start} to ${LEVEL_WORD[w.reach] ?? w.reach}` : null;
}

function LearningPathsCard({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const recommendations = intelligence?.recommendations ?? [];
  const withResource = recommendations.filter((r) => r.resource).length;
  return (
    <Card
      icon={<GraduationCap aria-hidden className="size-4" />}
      iconClass="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"
      title="Learning Paths"
      href="/learning"
      linkLabel="View all"
      footer={
        recommendations.length > 0
          ? `One per gap, matched to your current level · ${withResource} of ${recommendations.length} with a link we've checked${recommendations.length > withResource ? "; the rest are learnt by building" : ""}`
          : undefined
      }
    >
      {!intelligence ? (
        <Empty {...UPDATING} />
      ) : recommendations.length === 0 ? (
        <Empty title="No recommendations yet" body={intelligence.hasEvidenceBase ? "They appear when your evidence shows a gap that learning can close. Skills you've listed but not shown need proof, not another course." : "Add evidence first, so these fit you."} />
      ) : (
        <ul className="space-y-2">
          {recommendations.slice(0, 3).map((r, i) => {
            const p = paletteFor(r.skill);
            const levels = levelWindowText(r.resource?.levelWindow);
            return (
              <li key={r.skill} className={`flex items-start gap-2.5 rounded-xl p-2.5 transition-shadow duration-150 hover:shadow-sm ${p.tint}`} data-skill={r.skill}>
                <span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-lg bg-card/80 ${p.chip}`}>
                  {r.resource ? <BookOpen aria-hidden className="size-4" /> : <SkillIcon name={r.skill} className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-foreground" title={r.why}>{r.skill}</span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {r.currentLevel === "Not assessed" ? "not shown yet" : r.currentLevel} → {r.targetLevel}
                    </span>
                  </p>
                  {r.resource ? (
                    <>
                      <a href={r.resource.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[11px] font-medium text-primary hover:underline">
                        <span className="truncate">{r.resource.title}</span>
                        <ExternalLink aria-hidden className="size-3 shrink-0" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                      {/* Only the catalogue's own facts: type, provider and level window. No duration, rating or module count is invented. */}
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{[r.resource.typeLabel, r.resource.provider, levels].filter(Boolean).join(" · ")}</p>
                      {r.resource.fitReason && <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground" title={r.resource.fitReason}>{r.resource.fitReason}</p>}
                    </>
                  ) : (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{r.noResourceReason ?? "No checked resource yet: learn by building the project below."}</p>
                  )}
                  {(i === 0 || !r.resource) && r.demonstration && (
                    <p className="mt-1 line-clamp-2 text-[11px] text-foreground/80" title={r.demonstration}>
                      <span className="font-semibold">Then show it: </span>
                      {r.demonstration}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

