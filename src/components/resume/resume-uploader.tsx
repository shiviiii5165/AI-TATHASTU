"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  FileText,
  LoaderCircle,
  Upload,
  WifiOff,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { setExternalAiConsent } from "@/app/onboarding/resume/actions";
import { ContinueForm } from "@/components/onboarding/continue-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { useJobPoll } from "@/hooks/use-job-poll";
import type { Persona } from "@/db/schema";
import { RESUME_AI_CONSENT } from "@/lib/consent/catalog";
import type { JobView } from "@/lib/jobs";
import { cn } from "@/lib/utils";
import { RESUME_ACCEPT, RESUME_MAX_BYTES, RESUME_TYPES, resolveResumeMime } from "@/lib/uploads/resume";

type Phase =
  | { kind: "select"; error?: string }
  | { kind: "sending"; fileName: string; stage: "hashing" | "uploading" | "registering"; progress: number }
  | { kind: "processing"; fileName: string | null; job: JobView };

const FORMATS = Object.values(RESUME_TYPES).map((t) => t.label).join(" · ");
const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

const queuedJob = (id: string): JobView => ({
  id,
  status: "queued",
  attempts: 0,
  maxAttempts: 3,
  queuePosition: null,
  error: null,
  finishedAt: null,
  fileName: null,
});

export function ResumeUploader({
  initialJob,
  initialAiConsent,
  persona,
}: {
  initialJob: JobView | null;
  initialAiConsent: boolean;
  persona: Persona;
}) {
  const [phase, setPhase] = useState<Phase>(
    initialJob ? { kind: "processing", fileName: initialJob.fileName, job: initialJob } : { kind: "select" },
  );

  async function send(file: File) {
    const mime = resolveResumeMime(file);
    if (!mime) return setPhase({ kind: "select", error: `“${file.name}” isn't a supported format. Use ${FORMATS}.` });
    if (file.size === 0) return setPhase({ kind: "select", error: `“${file.name}” is empty.` });
    if (file.size > RESUME_MAX_BYTES) {
      return setPhase({ kind: "select", error: `“${file.name}” is ${mb(file.size)} MB. The limit is 10 MB.` });
    }

    const fileName = file.name;
    try {
      setPhase({ kind: "sending", fileName, stage: "hashing", progress: 0 });
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      const sha256 = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
      const meta = { fileName, sizeBytes: file.size, mime, sha256 };

      const presign = await postJson<
        { duplicate: true; jobId: string } | { duplicate: false; upload: { url: string; headers: Record<string, string> } }
      >("/api/upload/resume", meta);
      if (presign.duplicate) return setPhase({ kind: "processing", fileName, job: queuedJob(presign.jobId) });

      setPhase({ kind: "sending", fileName, stage: "uploading", progress: 0 });
      await putWithProgress(presign.upload.url, presign.upload.headers, file, (progress) =>
        setPhase({ kind: "sending", fileName, stage: "uploading", progress }),
      );

      setPhase({ kind: "sending", fileName, stage: "registering", progress: 1 });
      const { jobId } = await postJson<{ jobId: string }>("/api/upload/resume/complete", meta);
      setPhase({ kind: "processing", fileName, job: queuedJob(jobId) });
    } catch (error) {
      setPhase({ kind: "select", error: error instanceof Error ? error.message : "Upload failed. Try again." });
    }
  }

  const reset = () => setPhase({ kind: "select" });
  const isDone = phase.kind === "processing" && phase.job.status === "done";

  return (
    <>
      <div className="mx-auto mt-8 w-full max-w-2xl space-y-6">
        {/* AI Consent Card — shown before upload area */}
        <AiConsent initial={initialAiConsent} uploaded={phase.kind === "processing"} />

        {/* Dropzone Area */}
        {phase.kind === "select" && <Dropzone error={phase.error} onFile={send} />}
        {phase.kind === "sending" && <SendingPanel phase={phase} />}
        {phase.kind === "processing" && (
          <ProcessingPanel key={phase.job.id} fileName={phase.fileName} initial={phase.job} onReplace={reset} />
        )}

        {/* Reassurance text */}
        <p className="text-center text-xs text-slate-400 font-normal">
          Your file is used to build your profile.
        </p>
      </div>

      {isDone ? null : (
        <ContinueForm step="resume" persona={persona} canContinue hint="" label="Skip for now" variant="pink" />
      )}
    </>
  );
}

// ─── AI consent ─────────────────────────────────────────────────────────────

function AiConsent({ initial, uploaded }: { initial: boolean; uploaded: boolean }) {
  const [granted, setGranted] = useState(initial);
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function change(next: boolean) {
    setGranted(next);
    setSaving(true);
    setNote(null);
    const result = await setExternalAiConsent(next).catch(() => ({ ok: false as const, error: "Couldn't save. Try again." }));
    setSaving(false);
    if (!result.ok) {
      setGranted(!next);
      setNote(result.error);
    } else if (next && uploaded) {
      setNote("Saved. We're reading your resume again with AI; the review will include the new fields.");
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-white px-4 py-2 shadow-xs transition-colors duration-150 sm:px-5",
        granted
          ? "border-[#FF2A85]/40 bg-[#FFF5F7]/20 ring-1 ring-[#FF2A85]/20"
          : "border-slate-200 hover:border-slate-300"
      )}
    >
      <div className="flex items-start justify-between gap-x-3 gap-y-1">
        {/* The whole label is the hit area: at least 44px tall, 16px text. */}
        <label htmlFor="ai-consent" className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-start gap-3 py-2.5">
          <Checkbox
            id="ai-consent"
            checked={granted}
            disabled={saving}
            onCheckedChange={(v) => change(v === true)}
            aria-describedby="ai-consent-body"
            className="mt-0.5 size-5 shrink-0 rounded-md border-slate-300 data-[state=checked]:bg-[#FF2A85] data-[state=checked]:border-[#FF2A85]"
          />
          <span className="text-base font-semibold leading-snug text-[#0F172A]">{RESUME_AI_CONSENT.label}</span>
        </label>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 text-sm font-semibold text-[#FF2A85] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2A85]/40"
          aria-expanded={expanded}
          aria-controls="ai-consent-details"
        >
          Read more
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform duration-150 motion-reduce:transition-none", expanded && "rotate-180")}
          />
        </button>
      </div>
      <p id="ai-consent-body" className="pb-2.5 pl-8 text-sm leading-relaxed text-slate-600">
        We extract profile details for you to review before saving.
      </p>

      <dl
        id="ai-consent-details"
        hidden={!expanded}
        className="mb-3 ml-8 space-y-2.5 border-t border-slate-100 pt-3 text-sm text-slate-700"
      >
        {RESUME_AI_CONSENT.details.map((d) => (
          <div key={d.term}>
            <dt className="font-semibold text-[#0F172A]">{d.term}</dt>
            <dd className="mt-0.5 max-w-[65ch] leading-relaxed">{d.text}</dd>
          </div>
        ))}
      </dl>

      {note && (
        <p role="status" className="pb-2.5 pl-8 text-sm font-semibold text-[#FF2A85]">
          {note}
        </p>
      )}
    </div>
  );
}

// ─── Dropzone ───────────────────────────────────────────────────────────────

function Dropzone({ error, onFile }: { error?: string; onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  return (
    <>
      <label
        onDragEnter={(e) => {
          e.preventDefault();
          depth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          if (--depth.current === 0) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          depth.current = 0;
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
        className={cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-3.5 sm:gap-4 rounded-2xl sm:rounded-3xl border-2 border-dashed bg-white p-6 sm:p-12 text-center transition-all duration-200 touch-manipulation",
          "border-slate-200/90 hover:border-slate-300 shadow-xs focus-within:ring-2 focus-within:ring-[#FF2A85]/20",
          dragging && "border-[#FF2A85] bg-rose-50/40 scale-[1.01]",
          error && !dragging ? "border-red-300 bg-red-50/10" : "border-slate-200"
        )}
      >
        <div
          aria-hidden="true"
          className={cn(
            "grid size-14 place-items-center rounded-2xl transition-all duration-150 shadow-xs",
            dragging
              ? "bg-[#FF2A85] text-white scale-110"
              : "bg-pink-50 text-[#FF2A85] group-hover:scale-105"
          )}
        >
          <Upload className="size-6 stroke-[2]" />
        </div>

        <div>
          <span className="block font-sans text-sm sm:text-base font-bold tracking-tight text-[#0F172A]">
            Drag your file here or{" "}
            <span className="font-semibold text-[#FF2A85] underline underline-offset-4 cursor-pointer">
              Browse files
            </span>
          </span>
        </div>

        <div className="inline-flex items-center rounded-full bg-slate-100 px-3.5 py-1 text-xs font-medium text-slate-500">
          PDF or DOCX · Max 10 MB
        </div>

        <input
          type="file"
          accept={RESUME_ACCEPT}
          className="sr-only"
          aria-describedby={error ? "upload-error" : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
      </label>

      {error && (
        <div id="upload-error" role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/80 p-3.5 text-xs text-red-700 font-medium">
          <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}
    </>
  );
}

// ─── Sending Panel ──────────────────────────────────────────────────────────

function SendingPanel({ phase }: { phase: Extract<Phase, { kind: "sending" }> }) {
  const label =
    phase.stage === "hashing" ? "Preparing file" : phase.stage === "uploading" ? "Uploading to secure storage" : "Registering extraction job";
  const pct = Math.round(phase.progress * 100);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
      <FileLine fileName={phase.fileName} />
      <div className="mt-6 flex items-center justify-between text-xs font-bold text-slate-700">
        <span className="flex items-center gap-2">
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-[#FF2A85]" />
          {label}…
        </span>
        {phase.stage === "uploading" && <span className="font-mono text-slate-500">{pct}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={phase.stage === "hashing" ? undefined : pct}
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
      >
        <div
          className="h-full origin-left bg-gradient-to-r from-[#FF6B4A] to-[#FF2A85] transition-transform duration-150"
          style={{ transform: `scaleX(${phase.stage === "hashing" ? 0.05 : Math.max(0.05, phase.progress)})` }}
        />
      </div>
    </div>
  );
}

// ─── Processing Panel ───────────────────────────────────────────────────────

function ProcessingPanel({
  fileName,
  initial,
  onReplace,
}: {
  fileName: string | null;
  initial: JobView;
  onReplace: () => void;
}) {
  const { job, offline } = useJobPoll(initial.id, initial);
  const failed = job.status === "failed" || job.status === "needs_review";

  const stages = [
    { label: "File securely uploaded", state: "done" as const },
    {
      label: "Queued in pipeline",
      detail:
        job.status === "queued"
          ? job.queuePosition
            ? `${job.queuePosition} ${job.queuePosition === 1 ? "resume" : "resumes"} ahead of yours`
            : "Starting momentarily"
          : undefined,
      state: job.status === "queued" ? ("active" as const) : ("done" as const),
    },
    {
      label: "Extracting skills, experience & education",
      detail: job.status === "running" ? "Usually takes under a minute" : undefined,
      state: job.status === "running" ? ("active" as const) : job.status === "queued" ? ("todo" as const) : ("done" as const),
    },
    { label: "Ready to review extracted facts", state: job.status === "done" ? ("done" as const) : ("todo" as const) },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-5">
        <FileLine fileName={fileName} />
        <button
          type="button"
          onClick={onReplace}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600"
        >
          <X aria-hidden="true" className="size-3.5" />
          Remove
        </button>
      </div>

      {failed ? (
        <div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50/80 p-4 text-xs text-red-700">
          <p className="flex items-center gap-2 font-bold">
            <CircleAlert aria-hidden="true" className="size-4 shrink-0 text-red-600" />
            {job.error ?? "We couldn't read this file format."}
          </p>
          <p className="mt-1.5 pl-6 text-slate-600">
            Try uploading a clean text-based PDF or DOCX file, or continue manually.
          </p>
        </div>
      ) : (
        <ol className="mt-6 space-y-4" aria-label="Processing progress">
          {stages.map((s) => (
            <li key={s.label} className="flex items-start gap-3.5" aria-current={s.state === "active" ? "step" : undefined}>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-all",
                  s.state === "done" && "border-emerald-600 bg-emerald-600 text-white shadow-xs",
                  s.state === "active" && "border-[#FF2A85] bg-rose-50 text-[#FF2A85]",
                  s.state === "todo" && "border-slate-200 bg-white text-slate-400"
                )}
              >
                {s.state === "done" && <Check className="size-3.5 stroke-[2.5]" />}
                {s.state === "active" && <LoaderCircle className="size-3.5 animate-spin" />}
              </span>
              <div>
                <span className={cn("block text-xs font-bold", s.state === "todo" ? "text-slate-400" : "text-[#0F172A]")}>
                  {s.label}
                </span>
                {s.detail && <span className="block text-[0.6875rem] text-slate-500 mt-0.5">{s.detail}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {job.status === "done" && (
        <div className="mt-7 border-t border-slate-100 pt-5">
          <Button asChild className="h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-[#FF6B4A] to-[#FF2A85] text-sm font-bold text-white shadow-md shadow-rose-500/25 hover:opacity-95">
            <Link href="/onboarding/resume/review">
              Review what we found
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}

      {offline && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-amber-700">
          <WifiOff aria-hidden="true" className="size-3.5" />
          Reconnecting to check progress…
        </p>
      )}
    </div>
  );
}

function FileLine({ fileName }: { fileName: string | null }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid size-9 place-items-center rounded-xl bg-rose-50 text-[#FF2A85]">
        <FileText aria-hidden="true" className="size-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[#0F172A]">{fileName ?? "Uploaded Resume"}</p>
        <p className="text-[0.6875rem] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
          <CheckCircle2 className="size-3" /> Ready for verification
        </p>
      </div>
    </div>
  );
}

// ─── Transport ──────────────────────────────────────────────────────────────

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Upload failed. Try again.");
  return data as T;
}

function putWithProgress(url: string, headers: Record<string, string>, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload was rejected. Try again."));
    xhr.onerror = () => reject(new Error("The upload didn't go through. Check your connection and try again."));
    xhr.send(file);
  });
}
