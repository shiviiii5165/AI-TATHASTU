"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import type { PublicPost } from "@/lib/collaborations/public";

import { API, useApi } from "./api";
import { btn, CardSkeleton, cx, PostCard, StateBox } from "./ui";

type Owned = PublicPost & { pendingRequests: number };
type Joined = PublicPost & { yourRole: string | null };

const GROUPS: { key: string; label: string; statuses: PublicPost["status"][] }[] = [
  { key: "active", label: "Recruiting", statuses: ["recruiting"] },
  { key: "drafts", label: "Drafts", statuses: ["draft"] },
  { key: "paused", label: "Paused", statuses: ["paused"] },
  { key: "full", label: "Team full", statuses: ["team_full"] },
  { key: "progress", label: "In progress", statuses: ["in_progress"] },
  { key: "done", label: "Completed, closed & expired", statuses: ["completed", "closed", "expired", "suspended"] },
];

export function Mine({ onOpen, onCreate, refreshKey }: { onOpen: (id: string) => void; onCreate: () => void; refreshKey: number }) {
  const { data, error, reload } = useApi<{ owned: Owned[]; joined: Joined[] }>(`${API}/me?view=mine`, refreshKey);
  const [filter, setFilter] = useState<"all" | "created" | "joined">("all");

  if (error && !data) return <StateBox tone="error" title="Your collaborations couldn't be loaded" body={error} action={<button type="button" className={btn.secondary} onClick={reload}>Try again</button>} />;
  if (!data) return <CardSkeleton count={3} />;
  if (!data.owned.length && !data.joined.length) {
    return <StateBox title="No collaborations yet" body="Publish your own idea, or request to join one from Discover." action={<button type="button" className={btn.primary} onClick={onCreate}><Plus aria-hidden className="size-4" /> Start a collaboration</button>} />;
  }

  return (
    <section aria-labelledby="mine-h" className="space-y-5">
      <h2 id="mine-h" className="sr-only">My collaborations</h2>
      <div role="group" aria-label="Show" className="flex gap-2">
        {(["all", "created", "joined"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cx("min-h-9 rounded-full border px-3 text-xs font-semibold", filter === f ? "border-[var(--c-accent)] bg-[var(--c-accent-soft)] text-[var(--c-accent-strong)]" : "border-[var(--c-border)] text-[var(--c-muted)]")}>
            {f === "all" ? "All" : f === "created" ? `Created (${data.owned.length})` : `Joined (${data.joined.length})`}
          </button>
        ))}
      </div>

      {filter !== "joined" &&
        GROUPS.map((g) => {
          const list = data.owned.filter((p) => g.statuses.includes(p.status));
          if (!list.length) return null;
          return (
            <section key={g.key} aria-label={`Created: ${g.label}`}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Created · {g.label} ({list.length})</h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((p) => (
                  <PostCard
                    key={p.id}
                    p={p}
                    onOpen={onOpen}
                    footer={p.pendingRequests > 0 ? <p className="text-xs font-semibold text-[var(--c-accent-strong)]">{p.pendingRequests} pending request{p.pendingRequests === 1 ? "" : "s"}</p> : undefined}
                  />
                ))}
              </ul>
            </section>
          );
        })}

      {filter !== "created" && data.joined.length > 0 && (
        <section aria-label="Joined">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--c-muted)]">Joined ({data.joined.length})</h3>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.joined.map((p) => <PostCard key={p.id} p={p} onOpen={onOpen} footer={<p className="text-xs text-[var(--c-muted)]">Your role: <b className="text-[var(--c-text)]">{p.yourRole || "Member"}</b></p>} />)}
          </ul>
        </section>
      )}
    </section>
  );
}
