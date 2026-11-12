"use client";

import { Check, Hammer, Pencil } from "lucide-react";
import { useState, useTransition } from "react";

import { saveProjectIntent } from "@/app/(dashboard)/dashboard/intent-actions";
import { roleLabel } from "@/components/dashboard/widgets/labels";
import { intentSummary, PROJECT_INTENT_MAX } from "@/lib/dashboard/project-intent";
import type { IntelligenceDoc, ProjectRequirementRow } from "@/lib/dashboard/types";

const PLACEHOLDER =
  "For example: a study assistant that answers questions from my lecture PDFs, for students at my college, as a web app.";

/**
 * What the student wants to build, and what the engine read from it (worker/intelligence/project_intent.py). Every
 * project skill shows the words that led to it, so the student can see and correct how their description was read.
 */
export function ProjectIntentCard({ intelligence }: { intelligence?: IntelligenceDoc }) {
  const project = intelligence?.project;
  const [saved, setSaved] = useState<string | null | undefined>(undefined);
  const summary = intentSummary(project, saved);
  const [editing, setEditing] = useState(false);
  const role = intelligence?.roles[0]?.role;
  if (!intelligence || intelligence.engineVersion < 4) return null;

  const showEditor = editing || summary.state === "none";
  const startText = summary.state === "none" ? "" : summary.text;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5" aria-labelledby="project-intent-title" data-testid="project-intent">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300">
            <Hammer aria-hidden className="size-4.5" />
          </span>
          <div className="min-w-0">
            <h2 id="project-intent-title" className="text-sm font-bold text-foreground">What you want to build</h2>
            <p className="text-xs text-muted-foreground">
              Your roadmap plans for {role ? roleLabel(role) : "your career goal"} and for this project. We read it with fixed phrase rules, not AI, and show what each skill came from.
            </p>
          </div>
        </div>
        {!showEditor && (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Pencil aria-hidden className="size-3" /> Edit
          </button>
        )}
      </div>

      {showEditor ? (
        <IntentEditor
          initial={startText}
          prompts={project?.prompts ?? []}
          onSaved={(text) => {
            setSaved(text);
            setEditing(false);
          }}
          onCancel={summary.state === "none" ? undefined : () => setEditing(false)}
        />
      ) : summary.state === "pending" ? (
        <div className="mt-3 text-xs">
          <blockquote className="border-l-2 border-sky-300 pl-2.5 text-foreground">{summary.text}</blockquote>
          <p className="mt-2 text-muted-foreground" role="status">Saved. Your skills and roadmap are recalculated with it shortly; refresh in a minute to see what this project needs.</p>
        </div>
      ) : summary.state === "too_vague" ? (
        <div className="mt-3 text-xs">
          <blockquote className="border-l-2 border-sky-300 pl-2.5 text-foreground">{summary.text}</blockquote>
          <p className="mt-2 text-muted-foreground">{summary.reason}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {(summary.questions.length ? summary.questions : summary.prompts).map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      ) : summary.state === "analysed" ? (
        <div className="mt-3 space-y-3 text-xs">
          <blockquote className="line-clamp-3 border-l-2 border-sky-300 pl-2.5 text-foreground" title={summary.text}>
            {summary.text}
          </blockquote>
          {summary.fromOnboarding && <p className="text-[11px] text-muted-foreground">Taken from the goal you typed during onboarding. Edit it to describe the project in more detail.</p>}
          <div>
            <p className="font-semibold text-foreground">
              What this project needs <span className="font-normal text-muted-foreground">· {summary.ready} of {summary.core.length} core skills already shown in your work</span>
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {(project?.rows ?? []).map((r) => <RequirementChip key={r.skill} row={r} />)}
            </ul>
          </div>
          {summary.questions.length > 0 && (
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-2.5 dark:border-amber-400/30 dark:bg-amber-500/5" data-testid="project-intent-questions">
              <p className="font-semibold text-foreground">We weren&apos;t sure about part of this</p>
              <p className="mt-0.5 text-muted-foreground">
                {summary.possible.length > 0 && <>It might also need {summary.possible.slice(0, 4).join(", ")}, but we haven&apos;t added these to your plan. </>}
                Edit your description to answer:
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
                {summary.questions.map((q) => <li key={q}>{q}</li>)}
              </ul>
            </div>
          )}
          <dl className="grid gap-2 sm:grid-cols-3">
            {summary.projectOnly.length > 0 && (
              <div className="rounded-lg bg-sky-50/70 p-2 dark:bg-sky-500/10">
                <dt className="font-semibold text-foreground">Beyond {role ? roleLabel(role) : "your career"}</dt>
                <dd className="mt-0.5 text-muted-foreground">Your project needs {summary.projectOnly.join(", ")}, which the career framework doesn&apos;t require. They&apos;re on your roadmap anyway.</dd>
              </div>
            )}
            {summary.careerOnly.length > 0 && role && (
              <div className="rounded-lg bg-muted/50 p-2">
                <dt className="font-semibold text-foreground">Beyond this project</dt>
                <dd className="mt-0.5 text-muted-foreground">{roleLabel(role)} also requires {summary.careerOnly.slice(0, 5).join(", ")}{summary.careerOnly.length > 5 ? " and more" : ""}, which this project doesn&apos;t call for.</dd>
              </div>
            )}
            {summary.closest.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-2">
                <dt className="font-semibold text-foreground">Closest careers for this project</dt>
                <dd className="mt-0.5 text-muted-foreground">{summary.closest.join(", ")}. Shown for information: your chosen goal stays yours.</dd>
              </div>
            )}
          </dl>
        </div>
      ) : null}
    </section>
  );
}

function RequirementChip({ row }: { row: ProjectRequirementRow }) {
  const met = row.state === "met";
  const from = row.triggers.length ? `From “${row.triggers.slice(0, 3).join("”, “")}”. ` : "";
  return (
    <li
      title={`${from}${row.why}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        met ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-200" : row.importance === "core" ? "border-sky-200 bg-card text-foreground dark:border-sky-400/30" : "border-dashed border-border bg-card text-muted-foreground"
      }`}
    >
      {met && <Check aria-hidden className="size-3" strokeWidth={3} />}
      {row.skill}
      <span className="sr-only">{met ? " (already shown)" : row.importance === "core" ? " (core)" : " (supporting)"}. {from}</span>
    </li>
  );
}

function IntentEditor({ initial, prompts, onSaved, onCancel }: { initial: string; prompts: string[]; onSaved: (text: string) => void; onCancel?: () => void }) {
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveProjectIntent({ text });
          if (res.ok) onSaved(text);
          else setError(res.error);
        });
      }}
    >
      <label htmlFor="project-intent-text" className="sr-only">Describe what you want to build</label>
      <textarea
        id="project-intent-text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={PROJECT_INTENT_MAX}
        placeholder={PLACEHOLDER}
        aria-describedby="project-intent-help"
        className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div id="project-intent-help" className="mt-1 flex flex-wrap items-start justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{prompts.length ? `Helpful to mention: ${prompts.map((p) => p.replace(/\?$/, "").toLowerCase()).join("; ")}.` : "Who it's for, what goes in and comes out, and where it runs."}</span>
        <span className="tabular-nums">{text.length}/{PROJECT_INTENT_MAX}</span>
      </div>
      {error && <p role="alert" className="mt-1 text-[11px] text-destructive">{error}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : "Save"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
