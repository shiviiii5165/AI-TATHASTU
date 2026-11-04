"use client";

import { ArrowRight, CheckCircle2, Circle, ExternalLink, GraduationCap, Network, Sliders, Target } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { roleLabel } from "@/components/dashboard/widgets/labels";
import type { EngineSkill, GapState, IntelligenceDoc, RoleAnalysis, RoleSkillRow } from "@/lib/dashboard/types";

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
  High: "border-destructive/30 text-destructive",
  Medium: "border-border text-foreground",
  Low: "border-border text-muted-foreground",
} as const;

function Card({ icon, title, href, linkLabel, children, footer }: { icon: ReactNode; title: string; href: string; linkLabel: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="flex h-full min-h-72 flex-col rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">{icon}</div>
          <h2 className="truncate font-sans text-sm font-bold text-foreground">{title}</h2>
        </div>
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
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

export function GrowthDevelopmentRow({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const [roleIndex, setRoleIndex] = useState(0);
  const role = intelligence?.roles[roleIndex];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SkillProficiencyCard intelligence={intelligence} />
      <SkillGapsCard intelligence={intelligence} role={role} roleIndex={roleIndex} onRole={setRoleIndex} />
      <LearningPathsCard intelligence={intelligence} />
      <CareerRoadmapCard intelligence={intelligence} />
    </div>
  );
}

function SkillRow({ skill }: { skill: EngineSkill }) {
  const assessed = skill.proficiency !== null;
  return (
    <li>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-semibold text-foreground" title={skill.name}>
          {skill.name}
        </span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{assessed ? `${skill.level} · ${Math.round(skill.proficiency!)}` : "Not assessed"}</span>
      </div>
      {assessed ? (
        <div className="mt-1 h-1.5 w-full rounded-full bg-muted" role="img" aria-label={`${skill.name}: ${Math.round(skill.proficiency!)} of 100, ${STATUS_LABEL[skill.status].toLowerCase()}`}>
          <div className={`h-full rounded-full ${skill.status === "verified" ? "bg-primary" : "bg-muted-foreground"}`} style={{ width: `${skill.proficiency}%` }} />
        </div>
      ) : (
        <div className="mt-1 h-1.5 w-full rounded-full border border-dashed border-border" aria-hidden />
      )}
    </li>
  );
}

function SkillProficiencyCard({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const skills = intelligence?.skills ?? [];
  return (
    <Card
      icon={<Sliders aria-hidden className="size-4" />}
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
          {skills.slice(0, 7).map((s) => (
            <SkillRow key={s.name} skill={s} />
          ))}
        </ul>
      )}
    </Card>
  );
}

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
  return (
    <li className="py-2 first:pt-0">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold text-foreground" title={row.skill}>
          {row.skill}
        </p>
        <span className={`shrink-0 rounded-full border px-1.5 py-px text-[10px] font-semibold ${PRIORITY_CLASS[row.priority]}`}>{row.priority}</span>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {STATE_LABEL[row.state]}
        {row.proficiency !== null ? ` · ${row.level}` : ""} · needs {row.expectedLevel}
      </p>
    </li>
  );
}

function SkillGapsCard({ intelligence, role, roleIndex, onRole }: { intelligence?: IntelligenceDoc; role?: RoleAnalysis; roleIndex: number; onRole: (i: number) => void }) {
  return (
    <Card
      icon={<Network aria-hidden className="size-4" />}
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
          <ul className="divide-y divide-border">
            {role.open.slice(0, 4).map((row) => (
              <GapRow key={row.skill} row={row} />
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function LearningPathsCard({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const recommendations = intelligence?.recommendations ?? [];
  return (
    <Card
      icon={<GraduationCap aria-hidden className="size-4" />}
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
        <ul className="divide-y divide-border">
          {recommendations.slice(0, 3).map((r) => (
            <li key={r.skill} className="py-2 first:pt-0">
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
                <p className="mt-0.5 text-[11px] text-muted-foreground">No course in our catalogue yet: learn by building</p>
              )}
              <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{r.why}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function CareerRoadmapCard({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const roadmap = intelligence?.roadmap;
  const percent = roadmap ? Math.round(roadmap.progress * 100) : 0;
  return (
    <Card
      icon={<Target aria-hidden className="size-4" />}
      title="Career Roadmap"
      href="/learning"
      linkLabel="View plan"
      footer={roadmap ? "Progress counts only skills your evidence shows at their expected level." : undefined}
    >
      {!intelligence ? (
        <Empty {...UPDATING} />
      ) : !roadmap ? (
        <Empty title="No roadmap yet" body="Choose a career goal that has a competency framework." href="/settings" action="Your settings" />
      ) : (
        <>
          <p className="truncate text-[11px] text-muted-foreground" title={roadmap.currentPosition ?? undefined}>
            {roadmap.currentPosition ? `Now: ${roadmap.currentPosition}` : "Current position not on your profile"}
          </p>
          <p className="mt-1 truncate text-xs font-semibold text-foreground">Towards {roleLabel(roadmap.role)}</p>
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Skills at expected level">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
            <span className="text-[11px] font-semibold text-foreground">{percent}%</span>
          </div>
          <ol className="mt-3 space-y-2">
            {roadmap.stages.slice(0, 3).map((stage) => (
              <li key={stage.key} className="flex items-start gap-2">
                {stage.milestones.every((m) => m.done) ? <CheckCircle2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-primary" /> : <Circle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">{stage.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground" title={stage.milestones.map((m) => m.skill).join(", ")}>
                    {stage.milestones.map((m) => m.skill).join(", ")}
                  </p>
                </div>
              </li>
            ))}
            {roadmap.stages.length === 0 && <li className="text-xs font-semibold text-foreground">Every skill for this goal is at its expected level.</li>}
          </ol>
        </>
      )}
    </Card>
  );
}
