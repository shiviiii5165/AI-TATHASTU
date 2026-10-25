"use client";

import { CheckCheck, Plus, Quote, Trash2, Undo2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { saveResumeReview, type ResumeReviewInput } from "@/app/onboarding/actions";
import { ContinueButton, StepFooter } from "@/components/onboarding/continue-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ConfidenceLevel } from "@/lib/profile/field-groups";
import { cn } from "@/lib/utils";

export type ReviewFact = {
  id: string;
  fieldName: string;
  label: string;
  value: string;
  evidence: string | null;
  page: number | null;
  confidence: number | null;
  level: ConfidenceLevel;
  validationStatus: string | null;
};

export type ReviewGroup = {
  id: string;
  label: string;
  repeatable: boolean;
  addLabel?: string;
  template: { name: string; label: string }[];
  entries: { recordKey: string; facts: ReviewFact[] }[];
};

type Decision = "pending" | "save" | "reject";
type RowState = { decision: Decision; value: string };
type Addition = { recordKey: string; values: Record<string, string> };

const LONG_FIELDS = new Set(["description", "headline"]);

export function ReviewForm({ groups, nothingFound }: { groups: ReviewGroup[]; nothingFound?: boolean }) {
  const allFacts = useMemo(() => groups.flatMap((g) => g.entries.flatMap((e) => e.facts)), [groups]);
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(allFacts.map((f) => [f.id, { decision: "pending", value: f.value }])),
  );
  const [additions, setAdditions] = useState<Record<string, Addition[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const counts = useMemo(() => {
    const c = { save: 0, reject: 0, pending: 0 };
    for (const r of Object.values(rows)) c[r.decision]++;
    return c;
  }, [rows]);
  const addedCount = Object.values(additions)
    .flat()
    .filter((a) => Object.values(a.values).some((v) => v.trim())).length;

  const highPending = allFacts.filter((f) => f.level === "high" && rows[f.id].decision === "pending");

  const setRow = (id: string, patch: Partial<RowState>) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  function confirmHigh() {
    setRows((r) => {
      const next = { ...r };
      for (const f of highPending) next[f.id] = { ...next[f.id], decision: "save" };
      return next;
    });
  }

  function submit() {
    setError(null);
    const payload: ResumeReviewInput = {
      decisions: Object.entries(rows)
        .filter(([, r]) => r.decision !== "pending")
        .map(([id, r]) => ({ id, action: r.decision === "save" ? "confirm" : "reject", value: r.value.trim() })),
      additions: Object.entries(additions).flatMap(([fieldGroup, list]) =>
        list.flatMap((a) =>
          Object.entries(a.values)
            .filter(([, v]) => v.trim())
            .map(([fieldName, value]) => ({ fieldGroup, recordKey: a.recordKey, fieldName, value: value.trim() })),
        ),
      ),
    };
    startTransition(async () => {
      const result = await saveResumeReview(payload);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4">
        <p className="text-sm">
          {nothingFound ? (
            "We couldn't pick out any fields from your resume. Add the important ones below, or continue."
          ) : (
            <>
              <span className="font-medium">{allFacts.length} fields found.</span>{" "}
              <span className="text-muted-foreground">Only the ones you tick are saved.</span>
            </>
          )}
        </p>
        {!nothingFound && (
          <Button
            type="button"
            variant="outline"
            className="h-10 px-4"
            onClick={confirmHigh}
            disabled={highPending.length === 0}
          >
            <CheckCheck data-icon="inline-start" aria-hidden />
            {highPending.length ? `Confirm all high confidence (${highPending.length})` : "High confidence confirmed"}
          </Button>
        )}
      </div>

      <div className="mt-10 space-y-14">
        {groups.map((group) => (
          <GroupSection
            key={group.id}
            group={group}
            rows={rows}
            setRow={setRow}
            additions={additions[group.id] ?? []}
            setAdditions={(list) => setAdditions((a) => ({ ...a, [group.id]: list }))}
          />
        ))}
      </div>

      <StepFooter
        backStep="resume"
        error={error ?? undefined}
        status={
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground">{counts.save + addedCount} to save</span> · {counts.reject} rejected ·{" "}
            {counts.pending} not reviewed
          </p>
        }
      >
        <form action={submit}>
          <ContinueButton
            pending={pending}
            label="Save and continue"
            hint={counts.pending ? "Unreviewed fields stay unsaved" : undefined}
          />
        </form>
      </StepFooter>
    </>
  );
}

// ─── Group ──────────────────────────────────────────────────────────────────

function GroupSection({
  group,
  rows,
  setRow,
  additions,
  setAdditions,
}: {
  group: ReviewGroup;
  rows: Record<string, RowState>;
  setRow: (id: string, patch: Partial<RowState>) => void;
  additions: Addition[];
  setAdditions: (list: Addition[]) => void;
}) {
  const factCount = group.entries.reduce((n, e) => n + e.facts.length, 0);
  const lowCount = group.entries.flatMap((e) => e.facts).filter((f) => f.level === "low").length;
  const headingId = `group-${group.id}`;
  // Single-field groups (skills) read better as one list than one card each.
  const flat = group.template.length <= 1;

  return (
    <section aria-labelledby={headingId}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3">
        <h2 id={headingId} className="font-heading text-xl font-bold leading-tight text-[#0F172A]">
          {group.label}
        </h2>
        <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">
          {factCount === 0 ? "Nothing found" : `${factCount} ${factCount === 1 ? "field" : "fields"}`}
          {lowCount > 0 && <span className="text-destructive"> · {lowCount} low confidence</span>}
        </p>
      </div>

      {flat ? (
        group.entries.length > 0 && (
          <ul className="mt-4 divide-y rounded-lg border bg-card">
            {group.entries.flatMap((e) =>
              e.facts.map((f) => (
                <li key={f.id}>
                  <FactRow fact={f} row={rows[f.id]} setRow={setRow} />
                </li>
              )),
            )}
          </ul>
        )
      ) : (
        <div className="mt-4 space-y-4">
          {group.entries.map((entry, i) => (
            <div key={entry.recordKey} className="rounded-lg border bg-card">
              {group.repeatable && (
                <p className="border-b px-4 py-2 font-mono text-xs tracking-wider text-muted-foreground uppercase">
                  Entry {i + 1}
                </p>
              )}
              <ul className="divide-y">
                {entry.facts.map((f) => (
                  <li key={f.id}>
                    <FactRow fact={f} row={rows[f.id]} setRow={setRow} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {additions.map((a, i) => (
        <NewEntry
          key={a.recordKey}
          group={group}
          addition={a}
          onChange={(values) => setAdditions(additions.map((x, j) => (j === i ? { ...x, values } : x)))}
          onRemove={() => setAdditions(additions.filter((_, j) => j !== i))}
        />
      ))}

      {group.repeatable && (
        <Button
          type="button"
          variant="ghost"
          className="mt-3 h-9 px-3"
          onClick={() =>
            setAdditions([
              ...additions,
              { recordKey: crypto.randomUUID(), values: Object.fromEntries(group.template.map((t) => [t.name, ""])) },
            ])
          }
        >
          <Plus data-icon="inline-start" aria-hidden />
          {group.entries.length || additions.length ? "Add another" : (group.addLabel ?? "Add")}
          <span className="sr-only"> to {group.label}</span>
        </Button>
      )}
    </section>
  );
}

// ─── Fact row ───────────────────────────────────────────────────────────────

function FactRow({
  fact,
  row,
  setRow,
}: {
  fact: ReviewFact;
  row: RowState;
  setRow: (id: string, patch: Partial<RowState>) => void;
}) {
  const inputId = `fact-${fact.id}`;
  const evidenceId = `${inputId}-evidence`;
  const rejected = row.decision === "reject";
  const edited = row.value.trim() !== fact.value;
  const long = LONG_FIELDS.has(fact.fieldName) || fact.value.length > 80;

  const inputProps = {
    id: inputId,
    value: row.value,
    disabled: rejected,
    "aria-describedby": evidenceId,
    // Editing a value is a decision to keep it.
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setRow(fact.id, { value: e.target.value, decision: row.decision === "pending" ? "save" : row.decision }),
  };

  return (
    <div
      className={cn(
        "grid gap-x-6 gap-y-3 p-4 transition-colors duration-150 md:grid-cols-[11rem_minmax(0,1fr)_auto]",
        rejected && "bg-muted",
      )}
    >
      <div className="flex flex-wrap items-start gap-2 md:flex-col">
        <Label htmlFor={inputId} className={cn("text-sm font-medium", rejected && "text-muted-foreground line-through")}>
          {fact.label}
        </Label>
        <div className="flex flex-wrap gap-1.5">
          <ConfidenceBadge level={fact.level} confidence={fact.confidence} />
          {fact.validationStatus === "conflicting" && <Tag tone="destructive">Conflicts</Tag>}
          {fact.validationStatus === "unresolved" && <Tag tone="warning">Unverified</Tag>}
          {edited && !rejected && <Tag tone="neutral">Edited</Tag>}
        </div>
      </div>

      <div className="min-w-0">
        {long ? <Textarea {...inputProps} rows={3} className="min-h-20 text-base md:text-sm" /> : <Input {...inputProps} className="h-10 text-base md:text-sm" />}
        <Evidence id={evidenceId} evidence={fact.evidence} page={fact.page} />
      </div>

      <div className="flex items-center gap-4 md:flex-col md:items-end md:gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Checkbox
            checked={row.decision === "save"}
            disabled={rejected}
            onCheckedChange={(checked) => setRow(fact.id, { decision: checked ? "save" : "pending" })}
          />
          Save
        </label>
        {rejected ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setRow(fact.id, { decision: "pending" })}
            aria-label={`Undo reject ${fact.label}`}
          >
            <Undo2 data-icon="inline-start" aria-hidden />
            Undo
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setRow(fact.id, { decision: "reject" })}
            aria-label={`Reject ${fact.label}`}
          >
            <X data-icon="inline-start" aria-hidden />
            Reject
          </Button>
        )}
      </div>
    </div>
  );
}

function Evidence({ id, evidence, page }: { id: string; evidence: string | null; page: number | null }) {
  if (!evidence) {
    return (
      <p id={id} className="mt-2 text-sm text-muted-foreground">
        No source quote. Check this one carefully.
      </p>
    );
  }
  return (
    <figure id={id} className="mt-2 flex gap-2 text-sm text-muted-foreground">
      <Quote aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <figcaption className="sr-only">From your resume{page ? `, page ${page}` : ""}:</figcaption>
      <blockquote className="min-w-0 break-words">
        “{evidence}”
        {page !== null && <span className="ml-2 font-mono text-xs whitespace-nowrap">p. {page}</span>}
      </blockquote>
    </figure>
  );
}

const LEVEL_TEXT: Record<ConfidenceLevel, string> = { high: "High", medium: "Medium", low: "Low" };

function ConfidenceBadge({ level, confidence }: { level: ConfidenceLevel; confidence: number | null }) {
  const tone = level === "high" ? "success" : level === "medium" ? "warning" : "destructive";
  return (
    <Tag tone={tone}>
      {LEVEL_TEXT[level]}
      {confidence !== null && <span className="font-mono"> {Math.round(confidence * 100)}%</span>}
      <span className="sr-only"> confidence</span>
    </Tag>
  );
}

function Tag({ tone, children }: { tone: "success" | "warning" | "destructive" | "neutral"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm border px-1.5 text-xs",
        tone === "success" && "border-success/40 text-success",
        tone === "warning" && "border-warning-foreground/30 bg-warning text-warning-foreground",
        tone === "destructive" && "border-destructive/30 bg-destructive-surface text-destructive",
        tone === "neutral" && "border-border-strong text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

// ─── Hand-added entry ───────────────────────────────────────────────────────

function NewEntry({
  group,
  addition,
  onChange,
  onRemove,
}: {
  group: ReviewGroup;
  addition: Addition;
  onChange: (values: Record<string, string>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="mt-4 rounded-lg border border-dashed bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">New · added by you</p>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 data-icon="inline-start" aria-hidden />
          Remove
        </Button>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        {group.template.map((t) => {
          const id = `new-${addition.recordKey}-${t.name}`;
          const long = LONG_FIELDS.has(t.name);
          const props = {
            id,
            value: addition.values[t.name] ?? "",
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              onChange({ ...addition.values, [t.name]: e.target.value }),
            maxLength: 2000,
          };
          return (
            <div key={t.name} className={cn(long && "sm:col-span-2")}>
              <Label htmlFor={id} className="text-sm font-medium">
                {t.label}
              </Label>
              {long ? <Textarea {...props} rows={3} className="mt-2 text-base md:text-sm" /> : <Input {...props} className="mt-2 h-10 text-base md:text-sm" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
