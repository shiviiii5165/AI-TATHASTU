"use client";

import { useState, useTransition } from "react";

import { recordFrameworkReviewAction } from "@/app/admin/intelligence/actions";

/** Records one review decision (insert-only, audit-logged). Shown only to operators with intelligence.manage. */
export function FrameworkReviewForm({ role, questions }: { role: string | null; questions: { id: string; question: string }[] }) {
  const [target, setTarget] = useState<string>(role ? `role:${role}` : "framework");
  const [decision, setDecision] = useState("approved");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const isQuestion = target.startsWith("q:");
  const decisions = isQuestion
    ? [["question_resolved", "Resolved"], ["question_deferred", "Deferred"]]
    : [["approved", "Approve"], ["changes_requested", "Request changes"]];

  return (
    <form
      className="space-y-2 rounded-xl border border-border p-3 text-xs"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await recordFrameworkReviewAction({
            role: target.startsWith("role:") ? target.slice(5) : null,
            questionId: isQuestion ? target.slice(2) : null,
            decision, note,
          });
          setResult(r.ok ? { ok: true, text: r.message ?? "Recorded." } : { ok: false, text: r.error });
          if (r.ok) setNote("");
        });
      }}
    >
      <p className="font-semibold text-foreground">Record a review</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="block">What you reviewed
          <select value={target} onChange={(e) => { setTarget(e.target.value); setDecision(e.target.value.startsWith("q:") ? "question_resolved" : "approved"); }} className="mt-1 w-full min-h-9 rounded-lg border border-border bg-background px-2">
            {role ? <option value={`role:${role}`}>This role profile</option> : <option value="framework">The whole framework version</option>}
            {questions.map((q) => <option key={q.id} value={`q:${q.id}`}>Question: {q.question.slice(0, 70)}</option>)}
          </select>
        </label>
        <label className="block">Decision
          <select value={decision} onChange={(e) => setDecision(e.target.value)} className="mt-1 w-full min-h-9 rounded-lg border border-border bg-background px-2">
            {decisions.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className="block">What you checked (kept as the record)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} required className="mt-1 w-full rounded-lg border border-border bg-background p-2" />
      </label>
      {result && <p role={result.ok ? "status" : "alert"} className={result.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>{result.text}</p>}
      <button type="submit" disabled={pending} className="min-h-9 rounded-lg bg-primary px-3 font-semibold text-primary-foreground disabled:opacity-60">
        {pending ? "Saving…" : "Record review"}
      </button>
    </form>
  );
}
