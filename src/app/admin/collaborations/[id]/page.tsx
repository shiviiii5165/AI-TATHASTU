import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { recordAdminAudit } from "@/lib/admin/audit";
import { hasPermission, requireAdminPermission } from "@/lib/admin/rbac";
import { adminPostDetail, adminReportContext } from "@/lib/collaborations/moderation";
import { CATEGORY_LABEL, CREATOR_LABEL, STATUS_LABEL } from "@/lib/collaborations/rules";

import { clearCollabReviewAction, hideCollabMessageAction, removeCollaborationAction, restoreCollaborationAction, suspendCollaborationAction, transferCollaborationAction } from "../actions";

export const metadata: Metadata = { title: "Collaboration · moderation", robots: { index: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> };
const input = "min-h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm";
const btn = "min-h-9 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";

export default function Page(props: Props) {
  return (
    <div className="max-w-5xl">
      <Link href="/admin/collaborations" className="text-xs text-muted-foreground hover:text-foreground">← All collaborations</Link>
      <Suspense fallback={<div role="status" aria-label="Loading" className="mt-6 h-64 animate-pulse rounded-lg border bg-muted" />}>
        <Detail {...props} />
      </Suspense>
    </div>
  );
}

function ReasonForm({ action, postId, label, tone = "border", extra }: { action: (fd: FormData) => Promise<void>; postId: string; label: string; tone?: "primary" | "danger" | "border"; extra?: React.ReactNode }) {
  const cls = tone === "primary" ? "bg-primary text-primary-foreground" : tone === "danger" ? "bg-red-600 text-white hover:bg-red-700" : "border border-border";
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="back" value={`/admin/collaborations/${postId}`} />
      {extra}
      <label className="min-w-48 flex-1 text-xs">Reason (kept in history)<input name="reason" required maxLength={500} className={input} /></label>
      <button className={`${btn} ${cls}`}>{label}</button>
    </form>
  );
}

async function Detail({ params, searchParams }: Props) {
  const ctx = await requireAdminPermission("collaborations.moderate");
  const { id } = await params;
  const sp = await searchParams;
  const d = await adminPostDetail(id);
  if (!d) notFound();
  const canManage = hasPermission(ctx, "collaborations.manage");
  const p = d.post;
  const investigating = sp.report ? await adminReportContext(sp.report) : null;
  // Reading a reported conversation is sensitive: logged with the operator.
  if (investigating?.messages.length) await recordAdminAudit({ actorId: ctx.user.id, actorEmail: ctx.user.email ?? "unknown", action: "collaboration.view_reported_conversation", resource: "collaborations", targetId: id, details: { reportId: sp.report } });
  const activeMembers = d.members.filter((m) => m.status === "active" && m.kind === "member");

  return (
    <div className="mt-4 space-y-6">
      {sp.notice && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{sp.notice}</p>}
      {sp.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">{sp.error}</p>}
      <header>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{CATEGORY_LABEL[p.category]} · {CREATOR_LABEL[p.creatorType]} · {STATUS_LABEL[p.status]}</p>
        <h1 className="mt-2 font-heading text-3xl tracking-tight">{p.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Owner: {d.ownerEmail ?? "none (account removed)"}{d.ownerDeleted ? " · account deleted" : ""} · Team {d.members.filter((m) => m.status === "active" && m.kind === "member").length}/{p.capacity} · Requests: {Object.entries(d.applications).map(([k, v]) => `${v} ${k}`).join(", ") || "none"}</p>
        {p.needsOwnerReview && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Flagged for owner review: {p.ownerReviewReason?.replaceAll("_", " ")}.</p>}
      </header>

      <section aria-labelledby="content-h" className="rounded-2xl border border-border bg-card p-4 text-sm">
        <h2 id="content-h" className="font-semibold">Listing</h2>
        <p className="mt-2 whitespace-pre-wrap">{p.summary}</p>
        {p.problem && <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{p.problem}</p>}
        {p.links.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{p.links.map((l) => <li key={l}>{l}</li>)}</ul>}
      </section>

      <section aria-labelledby="mod-h" className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h2 id="mod-h" className="font-semibold">Moderation</h2>
        {p.status !== "suspended" && <ReasonForm action={suspendCollaborationAction} postId={p.id} label="Suspend" tone="primary" />}
        {p.status === "suspended" && p.statusBeforeSuspension && <ReasonForm action={restoreCollaborationAction} postId={p.id} label={`Restore (to ${STATUS_LABEL[p.statusBeforeSuspension]})`} />}
        {!(p.status === "suspended" && !p.statusBeforeSuspension) && <ReasonForm action={removeCollaborationAction} postId={p.id} label="Remove permanently" tone="danger" />}
      </section>

      {canManage && (
        <section aria-labelledby="own-h" className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <h2 id="own-h" className="font-semibold">Ownership recovery</h2>
          <p className="text-xs text-muted-foreground">Transfer only after verifying the owner can&apos;t manage the team (deleted account, no response). The successor must be an active member. Everyone on the team is notified.</p>
          {activeMembers.length ? (
            <ReasonForm
              action={transferCollaborationAction}
              postId={p.id}
              label="Transfer ownership"
              tone="primary"
              extra={<label className="text-xs">Successor<select name="memberId" className={input}>{activeMembers.map((m) => <option key={m.id} value={m.id}>{m.name ?? m.email} ({m.email})</option>)}</select></label>}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No active members to transfer to.</p>
          )}
          {p.needsOwnerReview && <ReasonForm action={clearCollabReviewAction} postId={p.id} label="Clear flag (owner is fine)" />}
        </section>
      )}

      {investigating && (
        <section aria-labelledby="inv-h" className="space-y-2 rounded-2xl border border-amber-300 bg-card p-4">
          <h2 id="inv-h" className="font-semibold">Reported conversation (access is logged)</h2>
          {investigating.messages.length === 0 && <p className="text-sm text-muted-foreground">The report is about the listing itself.</p>}
          <ul className="space-y-2">
            {investigating.messages.map((m) => (
              <li key={m.id} className={`rounded-lg border p-2 text-sm ${m.id === investigating.report.targetId ? "border-amber-400 bg-amber-50 dark:bg-amber-950" : "border-border"}`}>
                <p className="text-xs text-muted-foreground">{m.senderEmail ?? "deleted account"} · {m.createdAt.toLocaleString("en-GB")}{m.hiddenAt ? " · hidden" : ""}</p>
                <p className="whitespace-pre-wrap">{m.body}</p>
                {!m.hiddenAt && (
                  <form action={hideCollabMessageAction} className="mt-1 flex gap-2">
                    <input type="hidden" name="messageId" value={m.id} />
                    <input type="hidden" name="back" value={`/admin/collaborations/${p.id}`} />
                    <label className="flex-1"><span className="sr-only">Reason</span><input name="reason" required placeholder="Reason to hide" className={input} /></label>
                    <button className={`${btn} border border-border`}>Hide</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="rep-h" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="rep-h" className="font-semibold">Reports ({d.reports.length})</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {d.reports.map(({ report: r, reporterEmail }) => (
            <li key={r.id}>
              <Link href={`/admin/collaborations/${p.id}?report=${r.id}`} className="hover:underline">{r.reason} · {r.targetType} · {r.status}</Link> <span className="text-xs text-muted-foreground">by {reporterEmail ?? "deleted account"}{r.resolution ? ` — ${r.resolution}` : ""}</span>
            </li>
          ))}
          {!d.reports.length && <li className="text-muted-foreground">None.</li>}
        </ul>
      </section>

      <section aria-labelledby="mem-h" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="mem-h" className="font-semibold">Members</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {d.members.map((m) => <li key={m.id}>{m.name ?? "—"} <span className="text-xs text-muted-foreground">{m.email} · {m.kind}{m.role ? ` · ${m.role}` : ""} · {m.status}</span></li>)}
          {!d.members.length && <li className="text-muted-foreground">No members yet.</li>}
        </ul>
      </section>

      <section aria-labelledby="hist-h" className="rounded-2xl border border-border bg-card p-4">
        <h2 id="hist-h" className="font-semibold">Moderation history</h2>
        <ol className="mt-2 space-y-1 text-sm">
          {d.history.map((h) => <li key={h.id}><b>{h.action.replaceAll("_", " ")}</b> by {h.actorEmail} · {h.createdAt.toLocaleString("en-GB")} — {h.reason}</li>)}
          {!d.history.length && <li className="text-muted-foreground">No moderation actions.</li>}
        </ol>
      </section>
    </div>
  );
}
