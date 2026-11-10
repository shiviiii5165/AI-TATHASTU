import { ChevronDown, ExternalLink, Info } from "lucide-react";

import { assessedLevel, confidenceOf, EVIDENCE_STATE, evidenceSources, evidenceStateOf, groupSkills, LEVELS, type ShownState } from "@/lib/dashboard/skill-assessment";
import type { EngineSkill } from "@/lib/dashboard/types";

/**
 * "Your skills" on /skills: assessed skills first as cards, then claimed and suggested skills as compact,
 * collapsible lists. Every value shown is the engine's own output.
 */
export function SkillCollection({ skills, inferred }: { skills: EngineSkill[]; inferred: EngineSkill[] }) {
  const { assessed, claimed, suggested } = groupSkills(skills, inferred);
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-2xs sm:p-6" aria-labelledby="your-skills" data-testid="skill-collection">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="your-skills" className="text-base font-bold text-foreground">
          Your skills
        </h2>
        <p className="text-xs tabular-nums text-muted-foreground">
          {assessed.length} assessed · {claimed.length} claimed · {suggested.length} suggested
        </p>
      </div>

      <details className="group mt-3 rounded-xl border border-border bg-muted/30 text-xs" data-testid="level-guide">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <Info aria-hidden className="size-3.5 text-muted-foreground" />
          How skills are assessed
          <ChevronDown aria-hidden className="ml-auto size-3.5 text-muted-foreground transition-transform duration-150 group-open:rotate-180" />
        </summary>
        <div className="grid gap-4 border-t border-border px-3 py-3 md:grid-cols-2">
          <div>
            <p className="font-semibold text-foreground">Assessed level</p>
            <dl className="mt-1.5 space-y-1">
              {LEVELS.map((l) => (
                <div key={l.level} className="flex gap-2">
                  <dt className="w-24 shrink-0 font-semibold text-foreground">{l.level}</dt>
                  <dd className="text-muted-foreground">{l.meaning}</dd>
                </div>
              ))}
              <div className="flex gap-2">
                <dt className="w-24 shrink-0 font-semibold text-foreground">Not assessed</dt>
                <dd className="text-muted-foreground">Not enough evidence to judge. Listing a skill on its own is never assessed.</dd>
              </div>
            </dl>
          </div>
          <div className="space-y-2 text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Score (out of 100):</span> where your evidence places you across the four levels. It is worked out from your evidence, not from an exam, and it is not a measure of job readiness.
            </p>
            <p>
              <span className="font-semibold text-foreground">Evidence confidence:</span> how reliable the evidence behind the level is, based on how many independent kinds of source back it. A high level can still have low confidence.
            </p>
            <p>
              <span className="font-semibold text-foreground">Evidence status:</span> <strong className="font-semibold text-foreground">Demonstrated</strong> means a source we read directly shows it; <strong className="font-semibold text-foreground">Unverified</strong>, only your own project or work descriptions; <strong className="font-semibold text-foreground">Claimed</strong>, only your skills list; <strong className="font-semibold text-foreground">Suggested</strong>, only related skills.
            </p>
            <p>Completed courses and certifications are shown, but they are not treated as proof of proficiency.</p>
          </div>
        </div>
      </details>

      <h3 className="mt-5 text-sm font-semibold text-foreground">Assessed skills</h3>
      {assessed.length > 0 ? (
        <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Assessed skills">
          {assessed.map((s) => (
            <AssessedCard key={s.name} skill={s} />
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">No skill has enough evidence to be assessed yet. Connecting GitHub or adding projects gives the engine work to assess.</p>
      )}

      {claimed.length > 0 && (
        <Group
          id="claimed"
          title="Claimed skills"
          hint="Listed by you or described in your resume, but not shown well enough to assess."
          count={claimed.length}
          open={assessed.length === 0}
        >
          {claimed.map((s) => (
            <CompactRow key={s.name} skill={s} />
          ))}
        </Group>
      )}

      {suggested.length > 0 && (
        <Group id="suggested" title="Suggested skills" hint="Related to skills you have. These are pointers to explore, not skills you have shown." count={suggested.length} open={false}>
          {suggested.map((s) => (
            <CompactRow key={s.name} skill={s} suggestion />
          ))}
        </Group>
      )}
    </section>
  );
}

const STATE_STYLE: Record<ShownState, string> = {
  demonstrated: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30",
  unverified: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30",
  claimed: "bg-muted text-foreground ring-border",
  inferred: "bg-card text-muted-foreground ring-border",
  none: "bg-muted text-muted-foreground ring-border",
};

function StateBadge({ state }: { state: ShownState }) {
  const meta = EVIDENCE_STATE[state];
  return (
    <span title={meta.explain} data-state={state} className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATE_STYLE[state]}`}>
      {meta.label}
    </span>
  );
}

function Sources({ skill }: { skill: EngineSkill }) {
  const sources = evidenceSources(skill);
  if (!sources.length) return <span className="text-muted-foreground">None recorded</span>;
  return <span>{sources.map((s) => `${s.label}${s.count > 1 ? ` (${s.count})` : ""}`).join(" · ")}</span>;
}

function AssessedCard({ skill }: { skill: EngineSkill }) {
  const state = evidenceStateOf(skill);
  const confidence = confidenceOf(skill);
  const shown = skill.evidence.filter((e) => e.kind !== "claim").slice(0, 3);
  const extra = Math.max(0, skill.evidenceCount - shown.length - skill.evidence.filter((e) => e.kind === "claim").length);
  return (
    <li className="flex flex-col rounded-xl border border-border p-3.5" data-skill={skill.name}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 break-words text-sm font-bold text-foreground">{skill.name}</h4>
        <StateBadge state={state} />
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted-foreground">Level</dt>
        <dd className="font-semibold text-foreground">
          {assessedLevel(skill)} <span className="font-normal tabular-nums text-muted-foreground" title="Worked out from your evidence. Not an exam result or job readiness.">· score {Math.round(skill.proficiency!)}/100</span>
        </dd>
        <dt className="text-muted-foreground">Confidence</dt>
        <dd className="text-foreground" title="How reliable the evidence behind this level is.">
          {confidence ?? "Unavailable"}
        </dd>
        <dt className="text-muted-foreground">Sources</dt>
        <dd className="min-w-0 text-foreground">
          <Sources skill={skill} />
        </dd>
      </dl>
      {skill.credential || skill.coursesCompleted ? (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {skill.credential ? `Certification (${skill.credential === "verified" ? "verified" : "self-reported"})` : ""}
          {skill.credential && skill.coursesCompleted ? " · " : ""}
          {skill.coursesCompleted ? `${skill.coursesCompleted} ${skill.coursesCompleted === 1 ? "course" : "courses"} completed` : ""}. Not counted as proof of proficiency.
        </p>
      ) : null}
      {shown.length > 0 && (
        <ul className="mt-2.5 space-y-0.5 border-t border-border pt-2 text-[11px]" aria-label={`${skill.name} evidence`}>
          {shown.map((e, i) => (
            <li key={i} className="flex min-w-0 items-baseline gap-1.5">
              {e.ref?.startsWith("https://") ? (
                <a href={e.ref} target="_blank" rel="noopener noreferrer" className="inline-flex min-w-0 items-center gap-1 text-primary hover:underline">
                  <span className="truncate">{e.label}</span>
                  <ExternalLink aria-hidden className="size-2.5 shrink-0" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              ) : (
                <span className="min-w-0 truncate text-foreground" title={e.label}>
                  {e.label}
                </span>
              )}
            </li>
          ))}
          {extra > 0 && <li className="text-muted-foreground">and {extra} more</li>}
        </ul>
      )}
    </li>
  );
}

function Group({ id, title, hint, count, open, children }: { id: string; title: string; hint: string; count: number; open: boolean; children: React.ReactNode }) {
  return (
    <details className="group mt-5 border-t border-border pt-4" open={open} data-testid={`group-${id}`}>
      <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold text-foreground">
          {title} <span className="font-normal tabular-nums text-muted-foreground">({count})</span>
        </h3>
        <span className="text-xs text-muted-foreground">{hint}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
          <ChevronDown aria-hidden className="size-3.5 transition-transform duration-150 group-open:rotate-180" />
        </span>
      </summary>
      <ul className="mt-2 divide-y divide-border rounded-xl border border-border" aria-label={title}>
        {children}
      </ul>
    </details>
  );
}

function CompactRow({ skill, suggestion = false }: { skill: EngineSkill; suggestion?: boolean }) {
  const state = suggestion ? "inferred" : evidenceStateOf(skill);
  return (
    <li className="flex flex-col gap-1 px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-3" data-skill={skill.name}>
      <span className="min-w-0 break-words font-semibold text-foreground sm:w-48 sm:shrink-0">{skill.name}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground">
        <StateBadge state={state} />
        <span>Not assessed</span>
        <span aria-hidden>·</span>
        {suggestion ? <span className="min-w-0 break-words">{skill.inferredFrom?.length ? `Suggested by ${skill.inferredFrom.join(", ")}` : "Suggested by related skills"}</span> : <Sources skill={skill} />}
      </span>
    </li>
  );
}
