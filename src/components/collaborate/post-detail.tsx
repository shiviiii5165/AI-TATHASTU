"use client";

import { ArrowUpRight, Flag, LogIn, MessageCircleQuestion, Pencil, Share2, UserMinus } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { PublicPost } from "@/lib/collaborations/public";

import { API, call } from "./api";
import s from "./collaborate.module.css";
import { Banner, btn, CATEGORY_ICON, cx, FieldError, fmtDay, Initials, inputCls, MODE_LABEL, Seats, Spinner, STAGE_LABEL, StateBox, themed } from "./ui";

type Viewer = { isOwner: boolean; membership: "owner" | "member" | null; application: { id: string; status: string } | null; enquiryThreadId: string | null; teamThreadId: string | null; canApply: boolean; blocked: boolean };
type Detail = { post: PublicPost; viewer: Viewer | null; ownerView: { problems: Record<string, string> } | null };
type Member = { id: string; name: string; role: string | null; kind: string; joinedAt: string; isYou: boolean };

/** Owner status actions offered for each status (the server re-checks every transition). */
const OWNER_ACTIONS: Partial<Record<PublicPost["status"], { action: string; label: string; tone?: "primary" | "danger" }[]>> = {
  draft: [{ action: "publish", label: "Publish", tone: "primary" }],
  recruiting: [{ action: "pause", label: "Pause recruiting" }, { action: "start", label: "Start the project" }, { action: "renew", label: "Renew for 60 days" }, { action: "close", label: "Close", tone: "danger" }],
  paused: [{ action: "resume", label: "Resume recruiting", tone: "primary" }, { action: "start", label: "Start the project" }, { action: "close", label: "Close", tone: "danger" }],
  team_full: [{ action: "start", label: "Start the project", tone: "primary" }, { action: "pause", label: "Pause" }, { action: "complete", label: "Mark completed" }, { action: "close", label: "Close", tone: "danger" }],
  in_progress: [{ action: "complete", label: "Mark completed", tone: "primary" }, { action: "close", label: "Close", tone: "danger" }],
  expired: [{ action: "renew", label: "Renew listing", tone: "primary" }, { action: "close", label: "Close", tone: "danger" }],
  closed: [{ action: "reopen", label: "Reopen recruiting" }],
};

type DetailProps = {
  id: string | null;
  signedIn: boolean;
  loginHref: (postId: string) => string;
  onClose: () => void;
  onEdit: (id: string) => void;
  onOpenThread: (threadId: string) => void;
  onChanged: () => void;
};

export function PostDetail(props: DetailProps) {
  return (
    <Sheet open={!!props.id} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent side="right" className={cx(themed(s.root), "w-full overflow-y-auto border-l border-[var(--c-border)] bg-[var(--c-surface)] p-0 sm:max-w-xl")}>
        {/* Keyed by post: opening another post starts from a clean state. */}
        {props.id && <DetailBody key={props.id} {...props} id={props.id} />}
      </SheetContent>
    </Sheet>
  );
}

async function fetchDetail(id: string): Promise<{ data: Detail | null; error: string | null; members: Member[] | null }> {
  const r = await call<Detail>(`${API}/${id}`);
  if (!r.ok) return { data: null, error: r.error, members: null };
  if (!r.data.viewer?.membership) return { data: r.data, error: null, members: null };
  const m = await call<{ members: Member[] }>(`${API}/${id}/members`);
  return { data: r.data, error: null, members: m.ok ? m.data.members : null };
}

function DetailBody({ id, signedIn, loginHref, onEdit, onOpenThread, onChanged }: DetailProps & { id: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<"none" | "apply" | "ask" | "report">("none");
  const [members, setMembers] = useState<Member[] | null>(null);

  const applyResult = useCallback((r: Awaited<ReturnType<typeof fetchDetail>>) => {
    setData(r.data);
    setError(r.error);
    setMembers(r.members);
  }, []);
  const load = useCallback(() => fetchDetail(id).then(applyResult), [id, applyResult]);

  useEffect(() => {
    let live = true;
    void fetchDetail(id).then((r) => live && applyResult(r));
    return () => {
      live = false;
    };
  }, [id, applyResult]);

  async function act(url: string, body: unknown, success: string) {
    setBusy(true);
    setNotice(null);
    const r = await call(url, { method: "POST", body });
    setBusy(false);
    if (!r.ok) return setNotice({ tone: "error", text: r.error }), false;
    setNotice({ tone: "ok", text: success });
    await load();
    onChanged();
    return true;
  }

  const p = data?.post;
  const v = data?.viewer;
  const Icon = p ? CATEGORY_ICON[p.category] : null;

  return (
    <>
        {!p ? (
          <div className="p-6">
            <SheetTitle className="sr-only">Collaboration</SheetTitle>
            <SheetDescription className="sr-only">Collaboration details</SheetDescription>
            {error ? <StateBox tone="error" title="This collaboration isn't available" body={error} /> : <Spinner label="Loading collaboration" />}
          </div>
        ) : (
          <article className="pb-10">
            <header className={cx(s.hero, "relative overflow-hidden px-5 pb-5 pt-6 text-white sm:px-6")}>
              <div aria-hidden className={cx(s.grid, "absolute inset-0")} />
              <div className="relative">
                <p className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-[11px] font-bold">
                  {Icon && <Icon aria-hidden className="size-3.5" />} {p.categoryLabel}
                </p>
                <SheetTitle className="mt-3 pr-8 font-heading text-xl font-bold leading-tight text-white sm:text-2xl">{p.title}</SheetTitle>
                <SheetDescription className="mt-1.5 text-sm leading-relaxed text-white/80">{p.summary}</SheetDescription>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-2"><Initials name={p.creator.name} /><span><span className="block font-semibold">{p.creator.name}</span><span className="text-white/70">{p.creator.label}{p.creator.verified ? " · verified" : ""}</span></span></span>
                  <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-bold">{p.statusLabel}</span>
                </div>
              </div>
            </header>

            <div className="space-y-5 px-5 pt-5 sm:px-6">
              {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}
              {data.ownerView && Object.values(data.ownerView.problems).map((m) => <Banner key={m} tone="error">{m}</Banner>)}
              {p.ownerNote?.suspended && <Banner tone="error">Moderators suspended this collaboration. It&apos;s hidden from everyone else and can&apos;t be edited. Contact support if this is a mistake.</Banner>}

              <ViewerActions
                p={p}
                v={v ?? null}
                signedIn={signedIn}
                loginHref={loginHref(p.id)}
                busy={busy}
                panel={panel}
                setPanel={setPanel}
                onWithdraw={() => v?.application && act(`${API}/applications/${v.application.id}`, { action: "withdraw" }, "Request withdrawn.")}
                onLeave={() => window.confirm("Leave this team? You'll lose access to its conversation.") && act(`${API}/${p.id}/leave`, {}, "You left the team.")}
                onOpenThread={onOpenThread}
                onEdit={() => onEdit(p.id)}
                onStatus={(action, label) => (action !== "close" || window.confirm("Close this collaboration? Pending requests will be declined.")) && act(`${API}/${p.id}/status`, { action }, `${label}: done.`)}
              />

              {panel === "apply" && <ApplyForm p={p} onDone={async () => { setPanel("none"); setNotice({ tone: "ok", text: "Request sent. You'll be notified when the owner decides." }); await load(); onChanged(); }} />}
              {panel === "ask" && <AskForm postId={p.id} onDone={(threadId) => { setPanel("none"); setNotice({ tone: "ok", text: "Question sent. Replies appear in your Inbox." }); void load(); onOpenThread(threadId); }} />}
              {panel === "report" && <ReportForm targetType="post" targetId={p.id} onDone={() => { setPanel("none"); setNotice({ tone: "ok", text: "Thanks. Our moderators will review this." }); }} />}

              <dl className="grid grid-cols-2 gap-3 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface-2)] p-4 text-xs">
                <Fact k="Team"><Seats members={p.members} capacity={p.capacity} /></Fact>
                <Fact k="Stage">{STAGE_LABEL[p.stage]}</Fact>
                <Fact k="Mode">{MODE_LABEL[p.mode]}{p.location && p.mode !== "remote" ? ` · ${p.location}` : ""}</Fact>
                {p.commitment && <Fact k="Commitment">{p.commitment}</Fact>}
                {p.duration && <Fact k="Duration">{p.duration}</Fact>}
                {p.startDate && <Fact k="Starts">{fmtDay(p.startDate)}</Fact>}
                {p.deadline && <Fact k="Apply by">{fmtDay(p.deadline)}</Fact>}
                {p.experience && <Fact k="Experience">{p.experience}</Fact>}
                {Object.entries(p.details).map(([k, val]) => <Fact key={k} k={DETAIL_LABEL[k] ?? k}>{val}</Fact>)}
              </dl>

              {p.roles.length > 0 && (
                <section aria-labelledby="roles-h">
                  <h3 id="roles-h" className="text-sm font-bold text-[var(--c-ink)]">Roles needed</h3>
                  <ul className="mt-2 space-y-2">
                    {p.roles.map((r) => (
                      <li key={r.title} className="rounded-xl border border-[var(--c-border)] p-3">
                        <p className="text-sm font-semibold text-[var(--c-text)]">{r.title} <span className="font-normal text-[var(--c-muted)]">· {r.count} {r.count === 1 ? "position" : "positions"}</span></p>
                        {r.skills.length > 0 && <p className="mt-1 text-xs text-[var(--c-muted)]">{r.skills.join(", ")}</p>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {[["The problem", p.problem], ["Objectives", p.objectives], ["Expected outcome", p.outcome]].filter(([, t]) => t).map(([h, t]) => (
                <section key={h}>
                  <h3 className="text-sm font-bold text-[var(--c-ink)]">{h}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--c-text)]">{t}</p>
                </section>
              ))}

              {p.links.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-[var(--c-ink)]">Links</h3>
                  <ul className="mt-1 space-y-1">
                    {p.links.map((l) => (
                      <li key={l}>
                        <a href={l} target="_blank" rel="noopener noreferrer nofollow ugc" className="inline-flex items-center gap-1 break-all text-sm font-semibold text-[var(--c-accent-strong)] hover:underline">
                          {l.replace(/^https?:\/\//, "")} <ArrowUpRight aria-hidden className="size-3.5 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {members && (
                <section aria-labelledby="team-h">
                  <h3 id="team-h" className="text-sm font-bold text-[var(--c-ink)]">Your team</h3>
                  <ul className="mt-2 divide-y divide-[var(--c-border)] rounded-xl border border-[var(--c-border)]">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="flex items-center gap-2 text-sm">
                          <Initials name={m.name} />
                          <span>{m.isYou ? "You" : m.name}<span className="block text-[11px] text-[var(--c-muted)]">{m.kind === "owner" ? "Owner" : m.role || "Member"}</span></span>
                        </span>
                        {v?.isOwner && m.kind === "member" && (
                          <button type="button" className={btn.ghost} disabled={busy} onClick={() => window.confirm(`Remove ${m.name} from the team?`) && act(`${API}/${p.id}/remove`, { memberId: m.id }, `${m.name} was removed.`)}>
                            <UserMinus aria-hidden className="size-3.5" /> Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="flex flex-wrap gap-2 border-t border-[var(--c-border)] pt-4">
                <ShareButton postId={p.id} />
                {signedIn && !v?.isOwner && p.status !== "draft" && (
                  <button type="button" className={btn.ghost} onClick={() => setPanel(panel === "report" ? "none" : "report")} aria-expanded={panel === "report"}>
                    <Flag aria-hidden className="size-3.5" /> Report
                  </button>
                )}
              </div>
            </div>
          </article>
        )}
    </>
  );
}

const DETAIL_LABEL: Record<string, string> = { domain: "Domain", event: "Hackathon", eventDate: "Hackathon date", theme: "Track", field: "Research area", institution: "Lab / institution", publicationGoal: "Publication goal", topic: "Topic", cadence: "Meets" };

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-muted)]">{k}</dt>
      <dd className="mt-0.5 break-words font-semibold text-[var(--c-text)]">{children}</dd>
    </div>
  );
}

function ShareButton({ postId }: { postId: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={btn.ghost}
      onClick={async () => {
        const url = `${window.location.origin}/collaborations?post=${postId}`;
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link", url);
        }
      }}
    >
      <Share2 aria-hidden className="size-3.5" /> {copied ? "Link copied" : "Copy public link"}
    </button>
  );
}

function ViewerActions(props: {
  p: PublicPost;
  v: Viewer | null;
  signedIn: boolean;
  loginHref: string;
  busy: boolean;
  panel: string;
  setPanel: (p: "none" | "apply" | "ask" | "report") => void;
  onWithdraw: () => void;
  onLeave: () => void;
  onOpenThread: (id: string) => void;
  onEdit: () => void;
  onStatus: (action: string, label: string) => void;
}) {
  const { p, v, signedIn, busy, panel, setPanel } = props;
  if (!signedIn || !v) {
    return (
      <div className="rounded-2xl border border-[var(--c-border)] p-4">
        <p className="text-sm text-[var(--c-text)]">Sign in to AI Tathastu to ask a question or request to join this team.</p>
        <a href={props.loginHref} className={cx(btn.primary, "mt-3")}>
          <LogIn aria-hidden className="size-4" /> Sign in to apply
        </a>
      </div>
    );
  }
  if (v.isOwner) {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--c-border)] p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">You own this collaboration</p>
        <div className="flex flex-wrap gap-2">
          {p.status !== "suspended" && <button type="button" className={btn.secondary} onClick={props.onEdit} disabled={busy}><Pencil aria-hidden className="size-4" /> Edit</button>}
          {(OWNER_ACTIONS[p.status] ?? []).map((a) => (
            <button key={a.action} type="button" disabled={busy} className={a.tone === "primary" ? btn.primary : a.tone === "danger" ? btn.danger : btn.secondary} onClick={() => props.onStatus(a.action, a.label)}>
              {a.label}
            </button>
          ))}
          {v.teamThreadId && <button type="button" className={btn.secondary} onClick={() => props.onOpenThread(v.teamThreadId!)}>Team chat</button>}
        </div>
        {p.ownerNote?.activitySince && ["recruiting", "paused"].includes(p.status) && (
          <p className="text-[11px] text-[var(--c-muted)]">Listings expire 60 days after publishing or the last renewal. This one counts from {new Date(p.ownerNote.activitySince).toLocaleDateString()}.</p>
        )}
      </div>
    );
  }
  if (v.membership === "member") {
    return (
      <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--c-border)] p-4">
        <p className="w-full text-sm font-semibold text-[var(--c-accent-strong)]">You&apos;re on this team.</p>
        {v.teamThreadId && <button type="button" className={btn.primary} onClick={() => props.onOpenThread(v.teamThreadId!)}>Open team chat</button>}
        <button type="button" className={btn.danger} disabled={busy} onClick={props.onLeave}>Leave team</button>
      </div>
    );
  }
  const pending = v.application?.status === "pending";
  return (
    <div className="space-y-2 rounded-2xl border border-[var(--c-border)] p-4">
      {pending && <p className="text-sm font-semibold text-[var(--c-text)]">Your request is waiting for the owner.</p>}
      {v.application?.status === "rejected" && <p className="text-sm text-[var(--c-muted)]">Your last request wasn&apos;t accepted.</p>}
      {v.blocked && <p className="text-sm text-[var(--c-muted)]">You can&apos;t contact this collaboration.</p>}
      {!v.canApply && !pending && !v.blocked && <p className="text-sm text-[var(--c-muted)]">{p.status === "recruiting" ? (p.openPositions === 0 ? "This team is full." : "Applications are closed.") : `This collaboration is ${p.statusLabel.toLowerCase()}, so it isn't taking requests.`}</p>}
      <div className="flex flex-wrap gap-2">
        {v.canApply && <button type="button" className={btn.primary} aria-expanded={panel === "apply"} onClick={() => setPanel(panel === "apply" ? "none" : "apply")}>Request to join</button>}
        {pending && <button type="button" className={btn.secondary} disabled={busy} onClick={props.onWithdraw}>Withdraw request</button>}
        {v.enquiryThreadId ? (
          <button type="button" className={btn.secondary} onClick={() => props.onOpenThread(v.enquiryThreadId!)}><MessageCircleQuestion aria-hidden className="size-4" /> Your questions</button>
        ) : (
          !v.blocked && ["recruiting", "paused", "team_full"].includes(p.status) && (
            <button type="button" className={btn.secondary} aria-expanded={panel === "ask"} onClick={() => setPanel(panel === "ask" ? "none" : "ask")}><MessageCircleQuestion aria-hidden className="size-4" /> Ask a question</button>
          )
        )}
      </div>
    </div>
  );
}

function ApplyForm({ p, onDone }: { p: PublicPost; onDone: () => void }) {
  const [form, setForm] = useState({ role: p.roles[0]?.title ?? "", intro: "", skills: "", motivation: "", links: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await call(`${API}/${p.id}/apply`, {
      method: "POST",
      body: { role: form.role || null, intro: form.intro, motivation: form.motivation, skills: form.skills.split(",").map((x) => x.trim()).filter(Boolean), links: form.links.split(/\s+/).filter(Boolean) },
    });
    setBusy(false);
    if (!r.ok) {
      setErrors(r.fields ?? {});
      setError(r.error);
      return;
    }
    onDone();
  }
  const field = (k: keyof typeof form) => ({ value: form[k], onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })), "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `apply-${k}-err` : undefined });
  return (
    <form onSubmit={submit} className={cx(s.enter, "space-y-3 rounded-2xl border border-[var(--c-accent)]/40 bg-[var(--c-accent-soft)]/40 p-4")} noValidate>
      <h3 className="text-sm font-bold text-[var(--c-ink)]">Request to join</h3>
      <p className="text-xs text-[var(--c-muted)]">The owner sees your name, your stated university and what you write here. Never your email.</p>
      {error && <Banner tone="error">{error}</Banner>}
      {p.roles.length > 0 && (
        <label className="block text-xs font-semibold text-[var(--c-text)]">Role
          <select {...field("role")} className={cx(inputCls, "mt-1")}>
            {p.roles.map((r) => <option key={r.title} value={r.title}>{r.title}</option>)}
            <option value="">Open to any role</option>
          </select>
        </label>
      )}
      <label className="block text-xs font-semibold text-[var(--c-text)]">Short introduction *
        <textarea {...field("intro")} rows={3} maxLength={600} required className={cx(inputCls, "mt-1")} placeholder="Who you are and what you've built" />
        <FieldError id="apply-intro-err" msg={errors.intro} />
      </label>
      <label className="block text-xs font-semibold text-[var(--c-text)]">Relevant skills
        <input {...field("skills")} className={cx(inputCls, "mt-1")} placeholder="Comma separated, e.g. react, figma" />
      </label>
      <label className="block text-xs font-semibold text-[var(--c-text)]">Why this collaboration? *
        <textarea {...field("motivation")} rows={3} maxLength={1500} required className={cx(inputCls, "mt-1")} />
        <FieldError id="apply-motivation-err" msg={errors.motivation} />
      </label>
      <label className="block text-xs font-semibold text-[var(--c-text)]">Portfolio or project links (optional)
        <input {...field("links")} className={cx(inputCls, "mt-1")} placeholder="https://github.com/you  https://…" />
        <FieldError id="apply-links-err" msg={Object.entries(errors).find(([k]) => k.startsWith("links"))?.[1]} />
      </label>
      <button type="submit" className={btn.primary} disabled={busy}>{busy ? "Sending…" : "Send request"}</button>
    </form>
  );
}

function AskForm({ postId, onDone }: { postId: string; onDone: (threadId: string) => void }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={cx(s.enter, "space-y-2 rounded-2xl border border-[var(--c-border)] p-4")}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        const r = await call<{ threadId: string }>(`${API}/${postId}/enquiry`, { method: "POST", body: { body } });
        setBusy(false);
        if (!r.ok) return setError(r.error);
        onDone(r.data.threadId);
      }}
    >
      <label className="block text-xs font-semibold text-[var(--c-text)]">Your question for the owner
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={1000} required className={cx(inputCls, "mt-1")} placeholder="e.g. Is this open to first-year students?" />
      </label>
      <p className="text-[11px] text-[var(--c-muted)]">Questions are about this collaboration only. You can send up to 3 before the owner replies. No contact details are shared.</p>
      {error && <Banner tone="error">{error}</Banner>}
      <button type="submit" className={btn.primary} disabled={busy || !body.trim()}>{busy ? "Sending…" : "Send question"}</button>
    </form>
  );
}

export function ReportForm({ targetType, targetId, onDone }: { targetType: "post" | "message" | "thread"; targetId: string; onDone: () => void }) {
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={cx(s.enter, "space-y-2 rounded-2xl border border-[var(--c-danger)]/30 p-4")}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await call(`${API}/reports`, { method: "POST", body: { targetType, targetId, reason, details } });
        setBusy(false);
        if (!r.ok) return setError(r.error);
        onDone();
      }}
    >
      <h3 className="text-sm font-bold text-[var(--c-ink)]">Report to moderators</h3>
      <label className="block text-xs font-semibold text-[var(--c-text)]">Reason
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={cx(inputCls, "mt-1")}>
          <option value="spam">Spam</option>
          <option value="fraud">Fraud or scam</option>
          <option value="harassment">Harassment</option>
          <option value="inappropriate">Inappropriate content</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="block text-xs font-semibold text-[var(--c-text)]">Details (optional)
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} maxLength={1000} className={cx(inputCls, "mt-1")} />
      </label>
      {error && <Banner tone="error">{error}</Banner>}
      <button type="submit" className={btn.danger} disabled={busy}>{busy ? "Sending…" : "Send report"}</button>
    </form>
  );
}
