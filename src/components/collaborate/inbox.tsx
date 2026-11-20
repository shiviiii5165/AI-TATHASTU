"use client";

import { ArrowLeft, Ban, Flag, Lock, Send, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { API, call, useApi } from "./api";
import { ReportForm } from "./post-detail";
import { Banner, btn, cx, fmtAgo, inputCls, StateBox, Spinner } from "./ui";

type Thread = { id: string; kind: "team" | "enquiry"; postId: string; postTitle: string; role: string; with: string | null; lastMessageAt: string | null; locked: boolean; unread: number; preview: string | null };
type Message = { id: string; mine: boolean; name: string; body: string | null; hidden: boolean; createdAt: string };
type ThreadView = { thread: { id: string; kind: "team" | "enquiry"; postId: string; postTitle: string; locked: boolean; role: string }; messages: Message[] };

/** Team conversations (accepted members only) and project-specific enquiries. Polls gently while open; no real-time socket. */
export function Inbox({ threadId, onSelect, onOpenPost, onChanged, refreshKey }: { threadId: string | null; onSelect: (id: string | null) => void; onOpenPost: (id: string) => void; onChanged: () => void; refreshKey: number }) {
  const { data, error, reload: load } = useApi<{ threads: Thread[] }>(`${API}/me?view=inbox`, refreshKey);
  const threads = data?.threads ?? null;

  if (error && !threads) return <StateBox tone="error" title="Inbox couldn't be loaded" body={error} action={<button type="button" className={btn.secondary} onClick={load}>Try again</button>} />;
  if (!threads) return <Spinner label="Loading inbox" />;

  return (
    <section aria-labelledby="inbox-h" className="grid min-h-[28rem] grid-cols-1 overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] lg:grid-cols-[18rem_1fr]">
      <h2 id="inbox-h" className="sr-only">Inbox</h2>
      <div className={cx("border-[var(--c-border)] lg:border-r", threadId && "hidden lg:block")}>
        {threads.length === 0 ? (
          <div className="p-4"><StateBox title="No conversations yet" body="A team conversation opens when you're accepted onto a team. Questions you ask or receive about a collaboration appear here too." /></div>
        ) : (
          <ul aria-label="Conversations" className="divide-y divide-[var(--c-border)]">
            {threads.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onSelect(t.id)} aria-current={t.id === threadId ? "true" : undefined} className={cx("flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--c-surface-2)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--c-focus)]", t.id === threadId && "bg-[var(--c-accent-soft)]")}>
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]">{t.kind === "team" ? <Users className="size-4" /> : <span className="text-xs font-bold">?</span>}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--c-ink)]">{t.postTitle}</span>
                      {t.unread > 0 && <span className="shrink-0 rounded-full bg-[var(--c-accent)] px-1.5 text-[10px] font-bold text-white dark:text-[#06181d]">{t.unread}<span className="sr-only"> unread</span></span>}
                    </span>
                    <span className="block truncate text-xs text-[var(--c-muted)]">{t.kind === "team" ? "Team" : t.with ? `Question from ${t.with}` : "Your question"}{t.preview ? ` · ${t.preview}` : ""}</span>
                    {t.lastMessageAt && <span className="block text-[10px] text-[var(--c-muted)]">{fmtAgo(t.lastMessageAt)}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className={cx("min-w-0", !threadId && "hidden lg:block")}>
        {threadId ? <Conversation key={threadId} id={threadId} onBack={() => onSelect(null)} onOpenPost={onOpenPost} onRead={() => { load(); onChanged(); }} /> : <div className="hidden h-full items-center justify-center p-8 text-sm text-[var(--c-muted)] lg:flex">Choose a conversation.</div>}
      </div>
    </section>
  );
}

function Conversation({ id, onBack, onOpenPost, onRead }: { id: string; onBack: () => void; onOpenPost: (id: string) => void; onRead: () => void }) {
  const [view, setView] = useState<ThreadView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const seen = useRef(-1);

  const apply = useCallback((r: Awaited<ReturnType<typeof call<ThreadView>>>) => {
    if (!r.ok) return setError(r.error);
    // Scroll to the newest message on first load and whenever new ones arrive.
    if (r.data.messages.length !== seen.current) setTimeout(() => end.current?.scrollIntoView({ block: "end" }), 0);
    seen.current = r.data.messages.length;
    setView(r.data);
  }, []);
  const load = useCallback(() => call<ThreadView>(`${API}/threads/${id}`).then(apply), [id, apply]);

  // Held in a ref: the parent passes a new function each render, which must not restart loading and polling.
  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  });

  useEffect(() => {
    let live = true;
    void call<ThreadView>(`${API}/threads/${id}`).then((r) => {
      if (!live) return;
      apply(r);
      onReadRef.current();
    });
    // Light polling while the conversation is open and the tab is visible.
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void call<ThreadView>(`${API}/threads/${id}`).then((r) => live && apply(r));
    }, 15000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [id, apply]);

  if (error) return <div className="p-4"><StateBox tone="error" title="This conversation isn't available" body={error} action={<button type="button" className={btn.secondary} onClick={onBack}>Back</button>} /></div>;
  if (!view) return <div className="p-6"><Spinner label="Loading conversation" /></div>;
  const t = view.thread;

  return (
    <div className="flex h-full max-h-[70vh] min-h-[28rem] flex-col">
      <header className="flex items-center gap-2 border-b border-[var(--c-border)] px-3 py-2.5">
        <button type="button" className={cx(btn.ghost, "lg:hidden")} onClick={onBack} aria-label="Back to conversations"><ArrowLeft aria-hidden className="size-4" /></button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onOpenPost(t.postId)} className="truncate text-left text-sm font-bold text-[var(--c-ink)] hover:underline">{t.postTitle}</button>
          <p className="text-[11px] text-[var(--c-muted)]">{t.kind === "team" ? "Team conversation · members only" : "Question about this collaboration"}</p>
        </div>
        {t.kind === "enquiry" && t.role === "owner" && !t.locked && (
          <button type="button" className={btn.ghost} onClick={async () => {
            if (!window.confirm("Block this person from contacting or applying to your collaborations?")) return;
            const r = await call(`${API}/threads/${id}`, { method: "POST", body: { block: true } });
            setNotice(r.ok ? "Blocked. This conversation is now closed." : r.error);
            void load();
          }}><Ban aria-hidden className="size-3.5" /> Block</button>
        )}
        <button type="button" className={btn.ghost} onClick={() => setReporting(reporting === id ? null : id)} aria-label="Report this conversation"><Flag aria-hidden className="size-3.5" /></button>
      </header>
      {notice && <div className="px-3 pt-2"><Banner tone="info">{notice}</Banner></div>}
      {reporting && <div className="px-3 pt-2"><ReportForm targetType={reporting === id ? "thread" : "message"} targetId={reporting} onDone={() => { setReporting(null); setNotice("Reported. Our moderators will review it."); }} /></div>}
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3" aria-live="polite" aria-label="Messages">
        {view.messages.length === 0 && <p className="py-8 text-center text-sm text-[var(--c-muted)]">{t.kind === "team" ? "Say hello to your team." : "No messages yet."}</p>}
        {view.messages.map((m) => (
          <div key={m.id} className={cx("group flex", m.mine ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[85%] rounded-2xl px-3 py-2 text-sm", m.mine ? "rounded-br-sm bg-[var(--c-accent)] text-white dark:text-[#06181d]" : "rounded-bl-sm bg-[var(--c-surface-2)] text-[var(--c-text)]")}>
              {!m.mine && <p className="text-[11px] font-bold opacity-80">{m.name}</p>}
              <p className="whitespace-pre-wrap break-words">{m.hidden ? <em className="opacity-70">Removed by moderators</em> : m.body}</p>
              <p className="mt-0.5 flex items-center justify-end gap-2 text-[10px] opacity-70">
                {fmtAgo(m.createdAt)}
                {!m.mine && !m.hidden && <button type="button" className="underline opacity-0 focus:opacity-100 group-hover:opacity-100" onClick={() => setReporting(m.id)}>Report</button>}
              </p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {t.locked ? (
        <p className="flex items-center gap-2 border-t border-[var(--c-border)] px-4 py-3 text-xs text-[var(--c-muted)]"><Lock aria-hidden className="size-3.5" /> This conversation is closed.</p>
      ) : (
        <form
          className="flex items-end gap-2 border-t border-[var(--c-border)] p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!body.trim() || sending) return;
            setSending(true);
            setSendError(null);
            const r = await call(`${API}/threads/${id}`, { method: "POST", body: { body } });
            setSending(false);
            if (!r.ok) return setSendError(r.error);
            setBody("");
            await load();
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Message</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Write a message"
              className={cx(inputCls, "max-h-32 resize-y")}
            />
            {sendError && <span role="alert" className="mt-1 block text-xs text-[var(--c-danger)]">{sendError}</span>}
          </label>
          <button type="submit" className={btn.primary} disabled={sending || !body.trim()} aria-label="Send message"><Send aria-hidden className="size-4" /></button>
        </form>
      )}
    </div>
  );
}
