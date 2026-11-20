"use client";

import { ArrowUpRight, Ban, Check, X } from "lucide-react";
import { useState } from "react";

import { API, call, useApi } from "./api";
import { Banner, btn, cx, fmtAgo, Initials, StateBox, Spinner } from "./ui";

type Received = { id: string; postId: string; postTitle: string; role: string | null; intro: string; motivation: string; skills: string[]; links: string[]; status: string; createdAt: string; decidedAt: string | null; name: string; university: string | null; persona: string };
type Sent = { id: string; postId: string; postTitle: string; postStatus: string; role: string | null; status: string; createdAt: string; decidedAt: string | null };

const STATUS_CLS: Record<string, string> = {
  pending: "bg-[var(--c-warn-soft)] text-[var(--c-warn)]",
  accepted: "bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]",
  rejected: "bg-[var(--c-surface-2)] text-[var(--c-muted)]",
  withdrawn: "bg-[var(--c-surface-2)] text-[var(--c-muted)]",
};
const Pill = ({ status }: { status: string }) => <span className={cx("rounded-md px-1.5 py-0.5 text-[11px] font-bold capitalize", STATUS_CLS[status])}>{status}</span>;

export function Requests({ onOpen, onChanged, refreshKey }: { onOpen: (postId: string) => void; onChanged: () => void; refreshKey: number }) {
  const { data, error, reload } = useApi<{ received: Received[]; sent: Sent[] }>(`${API}/me?view=requests`, refreshKey);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  async function act(id: string, action: "accept" | "reject" | "withdraw" | "block", ok: string) {
    if (action === "block" && !window.confirm("Block this person from applying to or asking about any of your collaborations?")) return;
    setBusy(id);
    setNotice(null);
    const r = await call(`${API}/applications/${id}`, { method: "POST", body: { action } });
    setBusy(null);
    setNotice(r.ok ? { tone: "ok", text: ok } : { tone: "error", text: r.error });
    reload();
    onChanged();
  }

  if (error && !data) return <StateBox tone="error" title="Requests couldn't be loaded" body={error} action={<button type="button" className={btn.secondary} onClick={reload}>Try again</button>} />;
  if (!data) return <Spinner label="Loading requests" />;

  const pending = data.received.filter((r) => r.status === "pending");
  const history = data.received.filter((r) => r.status !== "pending");

  return (
    <section aria-labelledby="req-h" className="space-y-4">
      <h2 id="req-h" className="sr-only">Requests</h2>
      <div role="tablist" aria-label="Requests" className="flex gap-2">
        {(["received", "sent"] as const).map((t) => (
          <button key={t} role="tab" type="button" aria-selected={tab === t} onClick={() => setTab(t)} className={cx("min-h-9 rounded-full border px-3 text-xs font-semibold", tab === t ? "border-[var(--c-accent)] bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]" : "border-[var(--c-border)] text-[var(--c-muted)]")}>
            {t === "received" ? `Received${pending.length ? ` (${pending.length} pending)` : ""}` : `Sent (${data.sent.length})`}
          </button>
        ))}
      </div>
      {notice && <Banner tone={notice.tone}>{notice.text}</Banner>}

      {tab === "received" ? (
        <>
          {pending.length === 0 ? (
            <StateBox title="No pending requests" body="When someone asks to join one of your collaborations, you'll review them here." />
          ) : (
            <ul className="space-y-3" aria-label="Pending requests">
              {pending.map((r) => (
                <li key={r.id} className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Initials name={r.name} size="size-9" />
                      <div>
                        <p className="text-sm font-bold text-[var(--c-ink)]">{r.name}</p>
                        <p className="text-xs text-[var(--c-muted)]">{[r.persona === "student" ? "Student" : r.persona === "faculty" ? "Faculty" : "Alumni", r.university].filter(Boolean).join(" · ")} · {fmtAgo(r.createdAt)}</p>
                      </div>
                    </div>
                    <button type="button" className={btn.ghost} onClick={() => onOpen(r.postId)}>{r.postTitle} <ArrowUpRight aria-hidden className="size-3" /></button>
                  </div>
                  {r.role && <p className="mt-2 text-xs"><span className="font-semibold">Role:</span> {r.role}</p>}
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--c-text)]">{r.intro}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--c-muted)]"><span className="font-semibold text-[var(--c-text)]">Why: </span>{r.motivation}</p>
                  {r.skills.length > 0 && <p className="mt-2 text-xs text-[var(--c-muted)]">Skills: {r.skills.join(", ")}</p>}
                  {r.links.length > 0 && (
                    <ul className="mt-1 flex flex-wrap gap-x-3 text-xs">
                      {r.links.map((l) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer nofollow ugc" className="font-semibold text-[var(--c-accent-strong)] hover:underline">{l.replace(/^https?:\/\//, "")}</a></li>)}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className={btn.primary} disabled={busy === r.id} onClick={() => act(r.id, "accept", `${r.name} joined the team.`)}><Check aria-hidden className="size-4" /> Accept</button>
                    <button type="button" className={btn.secondary} disabled={busy === r.id} onClick={() => act(r.id, "reject", "Request declined.")}><X aria-hidden className="size-4" /> Decline</button>
                    <button type="button" className={btn.ghost} disabled={busy === r.id} onClick={() => act(r.id, "block", "Blocked.")}><Ban aria-hidden className="size-3.5" /> Block</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {history.length > 0 && (
            <div>
              <button type="button" className={btn.ghost} aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>{showHistory ? "Hide" : "Show"} request history ({history.length})</button>
              {showHistory && (
                <ul className="mt-2 divide-y divide-[var(--c-border)] rounded-2xl border border-[var(--c-border)]">
                  {history.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                      <span>{r.name} → {r.postTitle}</span>
                      <span className="flex items-center gap-2 text-xs text-[var(--c-muted)]"><Pill status={r.status} /> {r.decidedAt ? fmtAgo(r.decidedAt) : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      ) : data.sent.length === 0 ? (
        <StateBox title="You haven't sent any requests" body="Find a team in Discover and request to join." />
      ) : (
        <ul className="divide-y divide-[var(--c-border)] rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)]" aria-label="Sent requests">
          {data.sent.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <span className="min-w-0">
                {r.postStatus === "unavailable" ? <span className="text-sm font-semibold text-[var(--c-muted)]">{r.postTitle} (no longer available)</span> : <button type="button" onClick={() => onOpen(r.postId)} className="text-left text-sm font-semibold text-[var(--c-ink)] hover:underline">{r.postTitle}</button>}
                <span className="block text-xs text-[var(--c-muted)]">{r.role ? `${r.role} · ` : ""}sent {fmtAgo(r.createdAt)}</span>
              </span>
              <span className="flex items-center gap-2">
                <Pill status={r.status} />
                {r.status === "pending" && <button type="button" className={btn.ghost} disabled={busy === r.id} onClick={() => act(r.id, "withdraw", "Request withdrawn.")}>Withdraw</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
