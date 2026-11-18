"use client";

import { Archive, Camera, Copy, Loader2, Pencil, Rocket } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { duplicateRankingAction, publishRankingAction, setRankingArchivedAction, takeSnapshotAction } from "@/app/admin/intelligence/actions";

type Res = { ok: true; id?: string; message?: string } | { ok: false; error: string };

export function RankingControls({ id, mode, canManage, cohort }: { id: string; mode: "auto" | "published" | "draft"; canManage: boolean; cohort: Record<string, string> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  if (!canManage || id === "auto") return null;

  const run = (fn: () => Promise<Res>, after?: (r: Res) => void) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: r.message ?? "Done." } : { ok: false, text: r.error });
      if (r.ok) { after?.(r); router.refresh(); }
    });

  const btn = "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/admin/intelligence/builder?id=${id}`} className={btn}><Pencil className="size-3.5" /> Edit</Link>
      <button type="button" disabled={pending} className={btn} onClick={() => run(() => publishRankingAction(id))}><Rocket className="size-3.5" /> Publish draft</button>
      {mode === "published" && (
        <button type="button" disabled={pending} className={btn} title="Freeze the current ranks of this cohort; later rank movement is measured against it." onClick={() => run(() => takeSnapshotAction(id, cohort))}>
          <Camera className="size-3.5" /> Save snapshot
        </button>
      )}
      <button type="button" disabled={pending} className={btn} onClick={() => run(() => duplicateRankingAction(id), (r) => r.ok && r.id && router.push(`/admin/intelligence/builder?id=${r.id}`))}><Copy className="size-3.5" /> Duplicate</button>
      <button type="button" disabled={pending} className={btn} onClick={() => { if (confirm("Archive this ranking? Its versions and snapshots are kept.")) run(() => setRankingArchivedAction(id, true), () => router.push("/admin/intelligence/rankings")); }}><Archive className="size-3.5" /> Archive</button>
      {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      {msg && <span role="status" className={`text-xs ${msg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{msg.text}</span>}
    </div>
  );
}
