"use client";

import { Bell, Compass, FolderKanban, Inbox as InboxIcon, LogIn, Plus, UserPlus } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { API, call, useApi } from "./api";
import { s } from "./styles";
import { CreateWizard } from "./create-wizard";
import { Discover } from "./discover";
import { Inbox } from "./inbox";
import { Mine } from "./mine";
import { NetworkArt } from "./network-art";
import { PostDetail } from "./post-detail";
import { Requests } from "./requests";
import { Banner, btn, cx, fmtAgo, StateBox, themed } from "./ui";
import type { HubView } from "./views";

const VIEWS: { key: HubView; label: string; Icon: typeof Compass }[] = [
  { key: "discover", label: "Discover", Icon: Compass },
  { key: "mine", label: "My Collaborations", Icon: FolderKanban },
  { key: "requests", label: "Requests", Icon: UserPlus },
  { key: "inbox", label: "Inbox", Icon: InboxIcon },
];

type Note = { id: string; title: string; body: string; href: string | null; read: boolean; createdAt: string };

/**
 * AVSAR → Collaborations. One client surface for discovery (public), the user's own collaborations, requests and
 * inbox (signed in). View, open post and open thread live in the URL, so links are shareable and survive refresh.
 */
export function CollaborateHub({
  signedIn,
  basePath,
  initialView = "discover",
  initialPost = null,
  initialThread = null,
}: {
  signedIn: boolean;
  /** e.g. "/opportunities?cat=collaborations" (in-app) or "/collaborations" (public). */
  basePath: string;
  initialView?: HubView;
  initialPost?: string | null;
  initialThread?: string | null;
}) {
  const [view, setView] = useState<HubView>(signedIn ? initialView : "discover");
  const [postId, setPostId] = useState<string | null>(initialPost);
  const [threadId, setThreadId] = useState<string | null>(initialThread);
  const [creating, setCreating] = useState<{ editId: string | null } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [countsTick, setCountsTick] = useState(0);
  const counts = useApi<{ requests: number; inbox: number; notifications: number }>(signedIn ? `${API}/me?view=counts` : null, refreshKey + countsTick).data ?? { requests: 0, inbox: 0, notifications: 0 };
  const [flash, setFlash] = useState<string | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // URL state without a server round trip (the AVSAR page around this is server-rendered).
  useEffect(() => {
    const url = new URL(basePath, window.location.origin);
    if (view !== "discover") url.searchParams.set("view", view);
    if (postId) url.searchParams.set("post", postId);
    if (threadId && view === "inbox") url.searchParams.set("thread", threadId);
    const next = `${url.pathname}${url.search}`;
    if (next !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(window.history.state, "", next);
  }, [view, postId, threadId, basePath]);

  const loadCounts = useCallback(() => setCountsTick((t) => t + 1), []);
  useEffect(() => {
    if (!signedIn) return;
    const t = setInterval(() => document.visibilityState === "visible" && loadCounts(), 60000);
    return () => clearInterval(t);
  }, [signedIn, loadCounts]);

  const changed = useCallback(() => setRefreshKey((k) => k + 1), []);
  const openThread = (id: string) => {
    setPostId(null);
    setThreadId(id);
    setView("inbox");
  };
  const loginHref = (pid?: string) => `/login?callbackUrl=${encodeURIComponent(`/collaborations${pid ? `?post=${pid}` : ""}`)}`;

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = VIEWS.length;
    const to = e.key === "ArrowRight" ? (i + 1) % n : e.key === "ArrowLeft" ? (i - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    setView(VIEWS[to].key);
    tabRefs.current[to]?.focus();
  };

  return (
    <div className={cx(themed(s.root), "space-y-4")} data-testid="collaborate-hub">
      <section aria-labelledby="collab-hero-h" className={cx(s.hero, "relative overflow-hidden rounded-3xl px-5 py-6 text-white sm:px-8 sm:py-8")}>
        <div aria-hidden className={cx(s.grid, "absolute inset-0")} />
        <NetworkArt className="pointer-events-none absolute -right-6 top-1/2 hidden h-[230px] w-[240px] -translate-y-1/2 opacity-90 md:block lg:right-6" />
        <div className="relative max-w-xl">
          <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-bold tracking-wide text-[#9beff8]">AVSAR · Collaborate</p>
          <h2 id="collab-hero-h" className="mt-3 font-heading text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Build it together.</h2>
          <p className="mt-2 text-sm leading-relaxed text-white/80">Publish an idea, find teammates by skill and role, form hackathon teams and research groups, and work together once your team is in.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {signedIn ? (
              <button type="button" onClick={() => setCreating({ editId: null })} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#3fd3e2] px-4 text-sm font-bold text-[#062027] transition-colors duration-150 hover:bg-[#7fe3ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white active:translate-y-px">
                <Plus aria-hidden className="size-4" /> Start a collaboration
              </button>
            ) : (
              <a href={loginHref()} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#3fd3e2] px-4 text-sm font-bold text-[#062027] hover:bg-[#7fe3ee] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                <LogIn aria-hidden className="size-4" /> Sign in to post or join
              </a>
            )}
            {signedIn && <Notifications count={counts.notifications} onRead={loadCounts} />}
          </div>
        </div>
      </section>

      <div role="tablist" aria-label="Collaborate" className="flex gap-1 overflow-x-auto border-b border-[var(--c-border)] [scrollbar-width:none]">
        {VIEWS.map(({ key, label, Icon }, i) => {
          const on = view === key;
          const badge = key === "requests" ? counts.requests : key === "inbox" ? counts.inbox : 0;
          return (
            <button
              key={key}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`collab-tab-${key}`}
              aria-selected={on}
              aria-controls="collab-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => setView(key)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cx(
                "relative inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--c-focus)]",
                on ? "text-[var(--c-accent-strong)] after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--c-accent)]" : "text-[var(--c-muted)] hover:text-[var(--c-text)]",
              )}
            >
              <Icon aria-hidden className="size-4" /> {label}
              {badge > 0 && <span className="rounded-full bg-[var(--c-accent)] px-1.5 text-[10px] font-bold text-white dark:text-[#06181d]">{badge}<span className="sr-only"> new</span></span>}
            </button>
          );
        })}
      </div>

      {flash && <Banner tone="ok">{flash}</Banner>}

      <div id="collab-panel" role="tabpanel" aria-labelledby={`collab-tab-${view}`}>
        {view === "discover" ? (
          <Discover key={refreshKey} onOpen={setPostId} />
        ) : !signedIn ? (
          <StateBox title="Sign in to see your collaborations" body="Your posts, requests and team conversations are private to your AI Tathastu account." action={<a href={loginHref()} className={btn.primary}>Sign in</a>} />
        ) : view === "mine" ? (
          <Mine onOpen={setPostId} onCreate={() => setCreating({ editId: null })} refreshKey={refreshKey} />
        ) : view === "requests" ? (
          <Requests onOpen={setPostId} onChanged={changed} refreshKey={refreshKey} />
        ) : (
          <Inbox threadId={threadId} onSelect={setThreadId} onOpenPost={setPostId} onChanged={loadCounts} refreshKey={refreshKey} />
        )}
      </div>

      <PostDetail id={postId} signedIn={signedIn} loginHref={loginHref} onClose={() => setPostId(null)} onEdit={(id) => setCreating({ editId: id })} onOpenThread={openThread} onChanged={changed} />
      {signedIn && (
        <CreateWizard
          open={!!creating}
          editId={creating?.editId ?? null}
          onClose={() => setCreating(null)}
          onSaved={(id, published) => {
            setCreating(null);
            setFlash(published ? "Saved and live. People can find it in Discover." : "Draft saved. Publish it from My Collaborations when you're ready.");
            setTimeout(() => setFlash(null), 6000);
            changed();
            setPostId(id);
          }}
        />
      )}
    </div>
  );
}

function Notifications({ count, onRead }: { count: number; onRead: () => void }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    void call<{ notifications: Note[] }>(`${API}/me?view=notifications`).then((r) => {
      setNotes(r.ok ? r.data.notifications : []);
      if (r.ok && r.data.notifications.some((n) => !n.read)) void call(`${API}/me`, { method: "POST", body: {} }).then(onRead);
    });
    const close = (e: MouseEvent | globalThis.KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, onRead]);

  return (
    <div ref={box} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        <Bell aria-hidden className="size-4" /> Updates
        {count > 0 && <span className="rounded-full bg-[#3fd3e2] px-1.5 text-[10px] font-bold text-[#062027]">{count}<span className="sr-only"> unread</span></span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Collaboration updates" className={cx(s.enter, "absolute left-0 z-30 mt-2 w-[min(22rem,calc(100vw-3rem))] overflow-hidden rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] shadow-xl")}>
          {!notes ? (
            <p className="p-4 text-xs text-[var(--c-muted)]" role="status">Loading…</p>
          ) : notes.length === 0 ? (
            <p className="p-4 text-xs text-[var(--c-muted)]">No updates yet.</p>
          ) : (
            <ul className="max-h-80 divide-y divide-[var(--c-border)] overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className={cx("px-4 py-3", !n.read && "bg-[var(--c-accent-soft)]/60")}>
                  {n.href ? <a href={n.href} className="text-sm font-semibold hover:underline">{n.title}</a> : <p className="text-sm font-semibold">{n.title}</p>}
                  {n.body && <p className="mt-0.5 text-xs text-[var(--c-muted)]">{n.body}</p>}
                  <p className="mt-0.5 text-[10px] text-[var(--c-muted)]">{fmtAgo(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
