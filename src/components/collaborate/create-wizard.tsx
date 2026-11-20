"use client";

import { ArrowLeft, ArrowRight, Check, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { CATEGORY_FIELDS, REQUIRED_DETAIL } from "@/lib/collaborations/fields";
import type { PublicPost } from "@/lib/collaborations/public";
import { CATEGORY_LABEL } from "@/lib/collaborations/rules";

import { API, call } from "./api";
import s from "./collaborate.module.css";
import { Banner, btn, CATEGORY_ICON, cx, FieldError, inputCls, MODE_LABEL, STAGE_LABEL, themed } from "./ui";

type Role = { title: string; count: number; skills: string };
type Form = {
  category: PublicPost["category"] | "";
  title: string;
  summary: string;
  problem: string;
  objectives: string;
  outcome: string;
  stage: PublicPost["stage"];
  roles: Role[];
  skills: string;
  experience: string;
  commitment: string;
  duration: string;
  mode: PublicPost["mode"];
  location: string;
  startDate: string;
  deadline: string;
  links: string;
  details: Record<string, string>;
};

const BLANK: Form = { category: "", title: "", summary: "", problem: "", objectives: "", outcome: "", stage: "idea", roles: [{ title: "", count: 1, skills: "" }], skills: "", experience: "", commitment: "", duration: "", mode: "remote", location: "", startDate: "", deadline: "", links: "", details: {} };
const STEPS = ["Category", "Basics", "Team", "Details", "Preview"] as const;
const DRAFT_KEY = "collab:new-draft";

const CATEGORY_HINT: Record<PublicPost["category"], string> = {
  project: "Build something with a team: an app, a product, an open-source tool.",
  hackathon: "Assemble a team for a specific hackathon.",
  research: "Find collaborators for a paper, study or lab project.",
  learning_group: "Learn a topic together on a regular schedule.",
};

const toPayload = (f: Form) => ({
  category: f.category,
  title: f.title,
  summary: f.summary,
  problem: f.problem,
  objectives: f.objectives,
  outcome: f.outcome,
  stage: f.stage,
  roles: f.roles.map((r) => ({ title: r.title, count: Number(r.count) || 1, skills: r.skills.split(",").map((x) => x.trim()).filter(Boolean) })),
  skills: f.skills.split(",").map((x) => x.trim()).filter(Boolean),
  experience: f.experience,
  commitment: f.commitment,
  duration: f.duration,
  mode: f.mode,
  location: f.location,
  startDate: f.startDate || null,
  deadline: f.deadline || null,
  links: f.links.split(/\s+/).filter(Boolean),
  details: f.details,
});

/** Which step a server field error belongs to, so the form jumps there. */
const stepOf = (key: string) => (key === "category" ? 0 : ["title", "summary", "problem", "objectives", "outcome", "stage"].includes(key) ? 1 : key.startsWith("roles") || ["skills", "experience", "commitment", "duration", "mode", "location"].includes(key) ? 2 : 3);

function localErrors(f: Form, step: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (step === 0 && !f.category) e.category = "Choose a category.";
  if (step === 1) {
    if (f.title.trim().length < 6) e.title = "Give the title at least 6 characters.";
    if (!f.summary.trim()) e.summary = "Short description is required.";
  }
  if (step === 2) {
    f.roles.forEach((r, i) => {
      if (!r.title.trim()) e[`roles.${i}.title`] = "Role title is required.";
    });
    if (f.mode !== "remote" && !f.location.trim()) e.location = "Add a location for hybrid or in-person teams.";
  }
  if (step === 3 && f.category) {
    const need = REQUIRED_DETAIL[f.category];
    if (need && !f.details[need]?.trim()) e[`details.${need}`] = `${CATEGORY_FIELDS[f.category].find((x) => x.key === need)!.label} is required for this category.`;
    if (f.startDate && f.deadline && f.deadline > f.startDate) e.deadline = "The application deadline should be on or before the start date.";
  }
  return e;
}

type WizardProps = { open: boolean; editId: string | null; onClose: () => void; onSaved: (id: string, published: boolean) => void };
type EditPost = Record<string, unknown> & { roles: { title: string; count: number; skills: string[] }[]; skills: string[]; links: string[]; status: string };

export function CreateWizard(props: WizardProps) {
  return (
    <Sheet open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent side="right" className={cx(themed(s.root), "w-full overflow-y-auto border-l border-[var(--c-border)] bg-[var(--c-surface)] p-0 sm:max-w-2xl")}>
        {/* Mounted per opening: a new post or another edit always starts clean. */}
        {props.open && <WizardBody key={props.editId ?? "new"} {...props} />}
      </SheetContent>
    </Sheet>
  );
}

/** A new post resumes from this browser's unsent draft (never sent anywhere until saved). */
function initialForm(): Form {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    return saved ? { ...BLANK, ...JSON.parse(saved) } : BLANK;
  } catch {
    return BLANK;
  }
}

function fromPost(p: EditPost): Form {
  return {
    ...BLANK,
    ...(Object.fromEntries(Object.entries(p).filter(([k]) => k in BLANK)) as Partial<Form>),
    roles: p.roles.map((x) => ({ title: x.title, count: x.count, skills: x.skills.join(", ") })),
    skills: p.skills.join(", "),
    links: p.links.join(" "),
    location: (p.location as string) ?? "",
    startDate: (p.startDate as string) ?? "",
    deadline: (p.deadline as string) ?? "",
    details: (p.details as Record<string, string>) ?? {},
  };
}

function WizardBody({ editId, onClose, onSaved }: WizardProps) {
  const [form, setForm] = useState<Form>(() => (editId ? BLANK : initialForm()));
  const [step, setStep] = useState(editId ? 1 : 0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!!editId);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!editId) return;
    let live = true;
    void call<{ post: EditPost }>(`${API}/${editId}?edit=1`).then((r) => {
      if (!live) return;
      setLoading(false);
      if (!r.ok) return setError(r.error);
      setEditStatus(r.data.post.status);
      setForm(fromPost(r.data.post));
    });
    return () => {
      live = false;
    };
  }, [editId]);

  useEffect(() => {
    if (editId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {}
  }, [form, editId]);

  useEffect(() => heading.current?.focus(), [step]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const next = () => {
    const e = localErrors(form, step);
    setErrors(e);
    if (Object.keys(e).length === 0) setStep((x) => Math.min(x + 1, STEPS.length - 1));
  };

  async function save(publish: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = editId
      ? await call<{ id: string }>(`${API}/${editId}`, { method: "PATCH", body: { post: toPayload(form) } })
      : await call<{ id: string }>(API, { method: "POST", body: { publish, post: toPayload(form) } });
    const id = editId ?? (r.ok ? r.data.id : null);
    if (r.ok && editId && publish && editStatus === "draft") {
      const pub = await call(`${API}/${editId}/status`, { method: "POST", body: { action: "publish" } });
      if (!pub.ok) {
        setBusy(false);
        setErrors(pub.fields ?? {});
        return setError(pub.error);
      }
    }
    setBusy(false);
    if (!r.ok) {
      const fields = r.fields ?? {};
      setErrors(fields);
      setError(r.error);
      const first = Object.keys(fields)[0];
      if (first) setStep(stepOf(first.split(".")[0]));
      return;
    }
    if (!editId) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
    }
    onSaved(id!, publish || (editStatus !== null && editStatus !== "draft"));
  }

  const err = (k: string) => errors[k];
  const aria = (k: string) => ({ "aria-invalid": !!err(k), "aria-describedby": err(k) ? `cw-${k.replaceAll(".", "-")}-err` : undefined });
  const errEl = (k: string) => <FieldError id={`cw-${k.replaceAll(".", "-")}-err`} msg={err(k)} />;
  const label = "block text-xs font-semibold text-[var(--c-text)]";

  return (
    <>
        <div className={cx(s.hero, "relative px-5 py-5 text-white sm:px-6")}>
          <SheetTitle className="font-heading text-xl font-bold text-white">{editId ? "Edit collaboration" : "Start a collaboration"}</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-white/75">Publish your idea, say who you need, and review requests as they come in.</SheetDescription>
          <ol className="mt-4 flex gap-1.5" aria-label="Progress">
            {STEPS.map((name, i) => (
              <li key={name} className="flex-1">
                <span className={cx("block h-1 rounded-full", i <= step ? "bg-[var(--c-cyan)]" : "bg-white/20")} />
                <span className={cx("mt-1 hidden text-[10px] font-semibold sm:block", i === step ? "text-white" : "text-white/60")} aria-current={i === step ? "step" : undefined}>{i + 1}. {name}</span>
              </li>
            ))}
          </ol>
        </div>

        <form className="space-y-4 px-5 py-5 sm:px-6" noValidate onSubmit={(e) => { e.preventDefault(); if (step < STEPS.length - 1) next(); }}>
          <h3 ref={heading} tabIndex={-1} className="text-base font-bold text-[var(--c-ink)] focus:outline-none">Step {step + 1} of {STEPS.length}: {STEPS[step]}</h3>
          {loading && <p role="status" className="text-sm text-[var(--c-muted)]">Loading…</p>}
          {error && <Banner tone="error">{error}</Banner>}

          {step === 0 && (
            <fieldset>
              <legend className="sr-only">Category</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(Object.keys(CATEGORY_LABEL) as PublicPost["category"][]).map((c) => {
                  const Icon = CATEGORY_ICON[c];
                  const on = form.category === c;
                  return (
                    <label key={c} className={cx("flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors duration-150 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--c-focus)]", on ? "border-[var(--c-accent)] bg-[var(--c-accent-soft)]" : "border-[var(--c-border)] hover:border-[var(--c-border-strong)]")}>
                      <input type="radio" name="category" value={c} checked={on} onChange={() => set("category", c)} className="sr-only" />
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--c-surface)] text-[var(--c-accent)]"><Icon aria-hidden className="size-5" /></span>
                      <span><span className="block text-sm font-bold text-[var(--c-ink)]">{CATEGORY_LABEL[c]}</span><span className="text-xs text-[var(--c-muted)]">{CATEGORY_HINT[c]}</span></span>
                      {on && <Check aria-hidden className="ml-auto size-4 shrink-0 text-[var(--c-accent)]" />}
                    </label>
                  );
                })}
              </div>
              {errEl("category")}
            </fieldset>
          )}

          {step === 1 && (
            <>
              <label className={label}>Collaboration title *<input value={form.title} onChange={(e) => set("title", e.target.value)} maxLength={120} className={cx(inputCls, "mt-1")} {...aria("title")} />{errEl("title")}</label>
              <label className={label}>Short description * <span className="font-normal text-[var(--c-muted)]">({form.summary.length}/300)</span><textarea value={form.summary} onChange={(e) => set("summary", e.target.value)} maxLength={300} rows={2} className={cx(inputCls, "mt-1")} {...aria("summary")} />{errEl("summary")}</label>
              <label className={label}>Problem or idea<textarea value={form.problem} onChange={(e) => set("problem", e.target.value)} maxLength={3000} rows={3} className={cx(inputCls, "mt-1")} /></label>
              <label className={label}>Objectives<textarea value={form.objectives} onChange={(e) => set("objectives", e.target.value)} maxLength={3000} rows={3} className={cx(inputCls, "mt-1")} /></label>
              <label className={label}>Expected outcome<textarea value={form.outcome} onChange={(e) => set("outcome", e.target.value)} maxLength={2000} rows={2} className={cx(inputCls, "mt-1")} /></label>
              <label className={label}>Project stage<select value={form.stage} onChange={(e) => set("stage", e.target.value as Form["stage"])} className={cx(inputCls, "mt-1")}>{Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </>
          )}

          {step === 2 && (
            <>
              <fieldset className="space-y-2">
                <legend className={label}>Roles you need *</legend>
                {form.roles.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_5rem_auto] gap-2 rounded-xl border border-[var(--c-border)] p-2 sm:grid-cols-[1fr_5rem_1fr_auto]">
                    <label className="text-[11px] font-semibold text-[var(--c-muted)]">Role title<input value={r.title} onChange={(e) => set("roles", form.roles.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} maxLength={60} className={cx(inputCls, "mt-0.5")} {...aria(`roles.${i}.title`)} /></label>
                    <label className="text-[11px] font-semibold text-[var(--c-muted)]">Positions<input type="number" min={1} max={20} value={r.count} onChange={(e) => set("roles", form.roles.map((x, j) => (j === i ? { ...x, count: Number(e.target.value) } : x)))} className={cx(inputCls, "mt-0.5")} /></label>
                    <label className="col-span-3 text-[11px] font-semibold text-[var(--c-muted)] sm:col-span-1">Skills<input value={r.skills} onChange={(e) => set("roles", form.roles.map((x, j) => (j === i ? { ...x, skills: e.target.value } : x)))} placeholder="react, figma" className={cx(inputCls, "mt-0.5")} /></label>
                    <button type="button" aria-label={`Remove role ${i + 1}`} disabled={form.roles.length === 1} onClick={() => set("roles", form.roles.filter((_, j) => j !== i))} className={cx(btn.ghost, "row-start-1 self-end sm:row-auto")}><Trash2 aria-hidden className="size-4" /></button>
                    <div className="col-span-full">{errEl(`roles.${i}.title`)}</div>
                  </div>
                ))}
                {errEl("roles")}
                {form.roles.length < 10 && <button type="button" className={btn.ghost} onClick={() => set("roles", [...form.roles, { title: "", count: 1, skills: "" }])}><Plus aria-hidden className="size-4" /> Add a role</button>}
              </fieldset>
              <label className={label}>Other required skills<input value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Comma separated" className={cx(inputCls, "mt-1")} /></label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className={label}>Experience expected<input value={form.experience} onChange={(e) => set("experience", e.target.value)} maxLength={200} placeholder="e.g. Beginners welcome" className={cx(inputCls, "mt-1")} /></label>
                <label className={label}>Time commitment<input value={form.commitment} onChange={(e) => set("commitment", e.target.value)} maxLength={120} placeholder="e.g. 5 h/week" className={cx(inputCls, "mt-1")} /></label>
                <label className={label}>Duration<input value={form.duration} onChange={(e) => set("duration", e.target.value)} maxLength={120} placeholder="e.g. 3 months" className={cx(inputCls, "mt-1")} /></label>
              </div>
              <fieldset>
                <legend className={label}>Mode</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {(Object.keys(MODE_LABEL) as Form["mode"][]).map((m) => (
                    <label key={m} className={cx("inline-flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-semibold has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-[var(--c-focus)]", form.mode === m ? "border-[var(--c-accent)] bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]" : "border-[var(--c-border)] text-[var(--c-muted)]")}>
                      <input type="radio" name="mode" value={m} checked={form.mode === m} onChange={() => set("mode", m)} className="sr-only" /> {MODE_LABEL[m]}
                    </label>
                  ))}
                </div>
              </fieldset>
              {form.mode !== "remote" && <label className={label}>Location *<input value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={120} className={cx(inputCls, "mt-1")} {...aria("location")} />{errEl("location")}</label>}
            </>
          )}

          {step === 3 && form.category && (
            <>
              {CATEGORY_FIELDS[form.category].map((f) => (
                <label key={f.key} className={label}>
                  {f.label}{REQUIRED_DETAIL[form.category as PublicPost["category"]] === f.key ? " *" : ""}
                  <input value={form.details[f.key] ?? ""} onChange={(e) => set("details", { ...form.details, [f.key]: e.target.value })} maxLength={f.max} placeholder={f.placeholder} className={cx(inputCls, "mt-1")} {...aria(`details.${f.key}`)} />
                  {errEl(`details.${f.key}`)}
                </label>
              ))}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={label}>Start date<input type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} className={cx(inputCls, "mt-1")} /></label>
                <label className={label}>Application deadline<input type="date" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} className={cx(inputCls, "mt-1")} {...aria("deadline")} />{errEl("deadline")}</label>
              </div>
              <label className={label}>Portfolio or reference links (optional, up to 5)<textarea value={form.links} onChange={(e) => set("links", e.target.value)} rows={2} placeholder="https://github.com/team/repo" className={cx(inputCls, "mt-1")} /><FieldError id="cw-links-err" msg={Object.entries(errors).find(([k]) => k.startsWith("links"))?.[1]} /></label>
            </>
          )}

          {step === 4 && <Preview form={form} />}

          <div className="sticky bottom-0 -mx-5 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--c-border)] bg-[var(--c-surface)] px-5 py-3 sm:-mx-6 sm:px-6">
            <button type="button" className={btn.ghost} onClick={() => (step === 0 ? onClose() : setStep(step - 1))}><ArrowLeft aria-hidden className="size-4" /> {step === 0 ? "Cancel" : "Back"}</button>
            {step < STEPS.length - 1 ? (
              <button type="submit" className={btn.primary}>Continue <ArrowRight aria-hidden className="size-4" /></button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(!editId || editStatus === "draft") && <button type="button" className={btn.secondary} disabled={busy} onClick={() => save(false)}>Save draft</button>}
                <button type="button" className={btn.primary} disabled={busy} onClick={() => save(true)}>{busy ? "Saving…" : editId && editStatus !== "draft" ? "Save changes" : "Publish"}</button>
              </div>
            )}
          </div>
        </form>
    </>
  );
}

function Preview({ form }: { form: Form }) {
  const capacity = form.roles.reduce((n, r) => n + (Number(r.count) || 0), 0);
  return (
    <div className="space-y-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-accent-strong)]">{form.category ? CATEGORY_LABEL[form.category] : ""} · {STAGE_LABEL[form.stage]} · {MODE_LABEL[form.mode]}{form.location && form.mode !== "remote" ? ` · ${form.location}` : ""}</p>
      <p className="text-lg font-bold text-[var(--c-ink)]">{form.title || "Untitled"}</p>
      <p className="text-sm text-[var(--c-text)]">{form.summary}</p>
      {form.problem && <p className="whitespace-pre-wrap text-sm text-[var(--c-muted)]">{form.problem}</p>}
      <p className="text-sm text-[var(--c-text)]"><b>Team of {capacity}:</b> {form.roles.map((r) => `${r.title || "Role"} ×${r.count}`).join(", ")}</p>
      {form.deadline && <p className="text-sm text-[var(--c-warn)]">Apply by {form.deadline}</p>}
      <p className="text-xs text-[var(--c-muted)]">Visible to everyone, including people who aren&apos;t signed in. Your name is shown; your email and profile details are not.</p>
    </div>
  );
}
