"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { PublicPost } from "@/lib/collaborations/public";
import { CATEGORY_LABEL, CREATOR_LABEL } from "@/lib/collaborations/rules";

import { API, call } from "./api";
import { btn, CardSkeleton, CATEGORY_ICON, cx, inputCls, MODE_LABEL, PostCard, STAGE_LABEL, StateBox } from "./ui";

type Filters = { q: string; category: string; skill: string; creator: string; mode: string; stage: string; open: boolean; sort: "newest" | "deadline" | "open" };
const EMPTY: Filters = { q: "", category: "", skill: "", creator: "", mode: "", stage: "", open: false, sort: "newest" };
const CATEGORIES = Object.keys(CATEGORY_LABEL) as PublicPost["category"][];
const CATEGORY_PLURAL: Record<PublicPost["category"], string> = { project: "Projects", hackathon: "Hackathons", research: "Research", learning_group: "Learning Groups" };
const PUBLIC_CREATORS = ["student", "faculty", "alumni"] as const;

function toQuery(f: Filters, page: number) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set("q", f.q.trim());
  for (const k of ["category", "skill", "creator", "mode", "stage"] as const) if (f[k]) p.set(k, f[k]);
  if (f.open) p.set("open", "1");
  if (f.sort !== "newest") p.set("sort", f.sort);
  if (page > 1) p.set("page", String(page));
  return p.toString();
}

export function Discover({ onOpen }: { onOpen: (id: string) => void }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [query, setQuery] = useState(""); // the search box, debounced into filters.q
  // Results are tagged with the query they answer: "loading" is simply "the shown results aren't for these filters".
  const key = toQuery(filters, 1);
  const [result, setResult] = useState<{ key: string; items: PublicPost[]; page: number; hasMore: boolean } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === query ? f : { ...f, q: query })), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const ctl = new AbortController();
    void call<{ items: PublicPost[]; hasMore: boolean }>(`${API}?${key}`, { signal: ctl.signal }).then((r) => {
      if (ctl.signal.aborted) return;
      if (r.ok) setResult({ key, items: r.data.items, page: 1, hasMore: r.data.hasMore });
      else setFailedKey(key);
    });
    return () => ctl.abort();
  }, [key, retry]);

  const loadMore = useCallback(async () => {
    if (!result) return;
    setLoadingMore(true);
    const r = await call<{ items: PublicPost[]; hasMore: boolean }>(`${API}?${toQuery(filters, result.page + 1)}`);
    setLoadingMore(false);
    if (!r.ok) return;
    setResult((prev) => (prev && prev.key === key ? { ...prev, items: [...prev.items, ...r.data.items.filter((i) => !prev.items.some((p) => p.id === i.id))], page: prev.page + 1, hasMore: r.data.hasMore } : prev));
  }, [result, filters, key]);

  const state = result?.key === key ? "ready" : failedKey === key ? "error" : "loading";
  const items = result?.key === key ? result.items : [];
  const hasMore = !!result?.hasMore && result.key === key;
  const load = () => {
    setFailedKey(null);
    setRetry((n) => n + 1);
  };

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const active = [filters.skill, filters.creator, filters.mode, filters.stage, filters.open || ""].filter(Boolean).length;
  const select = cx(inputCls, "min-h-10");

  return (
    <section aria-labelledby="collab-discover-h" className="space-y-4">
      <h2 id="collab-discover-h" className="sr-only">Discover collaborations</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">Search collaborations</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--c-muted)]" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search projects, hackathon teams, research…" className={cx(inputCls, "pl-9")} maxLength={100} />
        </label>
        <div className="flex gap-2">
          <button type="button" className={btn.secondary} aria-expanded={showFilters} aria-controls="collab-filters" onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal aria-hidden className="size-4" /> Filters{active ? ` (${active})` : ""}
          </button>
          <label>
            <span className="sr-only">Sort</span>
            <select value={filters.sort} onChange={(e) => set("sort", e.target.value as Filters["sort"])} className={select}>
              <option value="newest">Newest</option>
              <option value="deadline">Deadline soonest</option>
              <option value="open">Most open spots</option>
            </select>
          </label>
        </div>
      </div>

      <div role="group" aria-label="Category" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] sm:flex-wrap">
        {[{ k: "", label: "All", Icon: null }, ...CATEGORIES.map((k) => ({ k, label: CATEGORY_PLURAL[k], Icon: CATEGORY_ICON[k] }))].map(({ k, label, Icon }) => {
          const on = filters.category === k;
          return (
            <button
              key={k || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => set("category", k)}
              className={cx(
                "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-focus)]",
                on ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-white dark:text-[#06181d]" : "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)] hover:border-[var(--c-border-strong)] hover:text-[var(--c-text)]",
              )}
            >
              {Icon && <Icon aria-hidden className="size-4" />} {label}
            </button>
          );
        })}
      </div>

      {showFilters && (
        <div id="collab-filters" className="grid grid-cols-1 gap-2 rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Skill
            <input value={filters.skill} onChange={(e) => set("skill", e.target.value)} placeholder="e.g. react" className={cx(inputCls, "mt-1")} maxLength={40} />
          </label>
          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Led by
            <select value={filters.creator} onChange={(e) => set("creator", e.target.value)} className={cx(select, "mt-1")}>
              <option value="">Anyone</option>
              {PUBLIC_CREATORS.map((c) => <option key={c} value={c}>{CREATOR_LABEL[c]}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Mode
            <select value={filters.mode} onChange={(e) => set("mode", e.target.value)} className={cx(select, "mt-1")}>
              <option value="">Any</option>
              {Object.entries(MODE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--c-muted)]">
            Stage
            <select value={filters.stage} onChange={(e) => set("stage", e.target.value)} className={cx(select, "mt-1")}>
              <option value="">Any</option>
              {Object.entries(STAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="flex items-end justify-between gap-2">
            <label className="flex min-h-10 items-center gap-2 text-xs font-semibold text-[var(--c-text)]">
              <input type="checkbox" checked={filters.open} onChange={(e) => set("open", e.target.checked)} className="size-4 accent-[var(--c-accent)]" /> Open spots only
            </label>
            {active > 0 && (
              <button type="button" className={btn.ghost} onClick={() => setFilters((f) => ({ ...EMPTY, q: f.q, category: f.category, sort: f.sort }))}>
                <X aria-hidden className="size-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {state === "loading" ? (
        <CardSkeleton />
      ) : state === "error" ? (
        <StateBox tone="error" title="Collaborations couldn't be loaded" body="This is a connection problem, not an empty list." action={<button type="button" className={btn.secondary} onClick={load}>Try again</button>} />
      ) : items.length === 0 ? (
        <StateBox
          title={filters.q || active || filters.category ? "No collaborations match" : "No open collaborations yet"}
          body={filters.q || active || filters.category ? "Try fewer filters or a different search." : "Be the first: publish a project, hackathon team, research idea or learning group and find your people."}
          action={filters.q || active || filters.category ? <button type="button" className={btn.secondary} onClick={() => { setQuery(""); setFilters(EMPTY); }}>Clear search and filters</button> : undefined}
        />
      ) : (
        <>
          <p className="sr-only" role="status">{items.length} collaborations shown</p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" aria-label="Collaborations">
            {items.map((p) => <PostCard key={p.id} p={p} onOpen={onOpen} />)}
          </ul>
          {hasMore && (
            <div className="flex justify-center">
              <button type="button" className={btn.secondary} disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? "Loading…" : "Show more"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
