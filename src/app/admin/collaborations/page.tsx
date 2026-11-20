import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { hasPermission, requireAdminPermission } from "@/lib/admin/rbac";
import { adminListPosts, adminOpenReports, listVerifications } from "@/lib/collaborations/moderation";
import { CATEGORY_LABEL, CREATOR_LABEL, STATUS_LABEL } from "@/lib/collaborations/rules";
import { COLLAB_CATEGORIES, COLLAB_STATUSES } from "@/db/schema";

import { resolveCollabReportAction, revokeCollabCreatorAction, verifyCollabCreatorAction } from "./actions";

export const metadata: Metadata = { title: "Collaborations moderation", robots: { index: false } };

type SP = Promise<Record<string, string | undefined>>;
const TABS = { listings: "Listings", reports: "Open reports", review: "Owner review", verifications: "Faculty & alumni" } as const;
type Tab = keyof typeof TABS;

const input = "min-h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2";
const btn = "min-h-9 rounded-lg px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2";

export default function AdminCollaborationsPage({ searchParams }: { searchParams: SP }) {
  return (
    <div className="max-w-6xl">
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Admin · AVSAR Collaborations</p>
      <h1 className="mt-3 font-heading text-3xl leading-[1.05] tracking-tight sm:text-4xl">Collaborations</h1>
      <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
        Moderate listings, investigate reports and recover teams whose owner has gone. Every action needs a reason and is kept in the
        collaboration&apos;s history and the security audit log. Moderators never act as an owner.
      </p>
      <Suspense fallback={<div role="status" aria-label="Loading" className="mt-8 h-64 animate-pulse rounded-lg border bg-muted" />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  const ctx = await requireAdminPermission("collaborations.moderate");
  const sp = await searchParams;
  const tab: Tab = sp.tab && sp.tab in TABS ? (sp.tab as Tab) : "listings";
  const canManage = hasPermission(ctx, "collaborations.manage");

  return (
    <div className="mt-6 space-y-4">
      {sp.notice && <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{sp.notice}</p>}
      {sp.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-100">{sp.error}</p>}
      <nav aria-label="Collaboration moderation sections" className="flex flex-wrap gap-1.5">
        {(Object.keys(TABS) as Tab[]).filter((t) => t !== "verifications" || canManage).map((t) => (
          <Link key={t} href={`/admin/collaborations?tab=${t}`} aria-current={t === tab ? "page" : undefined} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${t === tab ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
            {TABS[t]}
          </Link>
        ))}
      </nav>
      {tab === "listings" && <Listings sp={sp} />}
      {tab === "review" && <Listings sp={{ ...sp, review: "1" }} review />}
      {tab === "reports" && <Reports />}
      {tab === "verifications" && canManage && <Verifications />}
    </div>
  );
}

async function Listings({ sp, review = false }: { sp: Record<string, string | undefined>; review?: boolean }) {
  const { rows, total, page } = await adminListPosts({ q: sp.q, status: sp.status, category: sp.category, creator: sp.creator, review: sp.review, page: Number(sp.page) || 1 });
  return (
    <section aria-label={review ? "Collaborations needing owner review" : "All collaborations"} className="space-y-3">
      {!review && (
        <form method="GET" action="/admin/collaborations" className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-5" aria-label="Filter collaborations">
          <input type="hidden" name="tab" value="listings" />
          <label className="sm:col-span-2"><span className="sr-only">Search titles</span><input name="q" defaultValue={sp.q} placeholder="Search titles" className={input} /></label>
          <label><span className="sr-only">Status</span>
            <select name="status" defaultValue={sp.status ?? ""} className={input}><option value="">Any status</option>{COLLAB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
          </label>
          <label><span className="sr-only">Category</span>
            <select name="category" defaultValue={sp.category ?? ""} className={input}><option value="">Any category</option>{COLLAB_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}</select>
          </label>
          <div className="flex gap-2">
            <label className="flex-1"><span className="sr-only">Creator</span>
              <select name="creator" defaultValue={sp.creator ?? ""} className={input}><option value="">Any creator</option>{Object.entries(CREATOR_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </label>
            <button type="submit" className={`${btn} bg-primary text-primary-foreground`}>Filter</button>
          </div>
        </form>
      )}
      {review && <p className="text-sm text-muted-foreground">Flagged by the daily job: the owner&apos;s account was deleted, or they haven&apos;t managed an active team for 90 days. Verify the situation, then transfer to a member or clear the flag.</p>}
      <p className="text-xs text-muted-foreground">{total} collaboration{total === 1 ? "" : "s"}</p>
      {rows.length === 0 ? (
        <p role="status" className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nothing here.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border text-left text-xs text-muted-foreground">
              <tr><th className="p-3">Title</th><th className="p-3">Status</th><th className="p-3">Category</th><th className="p-3">Creator</th><th className="p-3">Team</th><th className="p-3">Reports</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.post.id} className="border-b border-border last:border-0">
                  <td className="p-3"><Link href={`/admin/collaborations/${r.post.id}`} className="font-semibold hover:underline">{r.post.title}</Link>{r.post.needsOwnerReview && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900">Owner review</span>}</td>
                  <td className="p-3">{STATUS_LABEL[r.post.status]}</td>
                  <td className="p-3">{CATEGORY_LABEL[r.post.category]}</td>
                  <td className="p-3">{CREATOR_LABEL[r.post.creatorType]}<span className="block text-xs text-muted-foreground">{r.ownerEmail ?? "No owner"}</span></td>
                  <td className="p-3 tabular-nums">{r.members}/{r.post.capacity}</td>
                  <td className="p-3 tabular-nums">{r.reports ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-3 text-xs">
        {page > 1 && <Link className="font-semibold hover:underline" href={`/admin/collaborations?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(page - 1) })}`}>Previous</Link>}
        {page * 50 < total && <Link className="font-semibold hover:underline" href={`/admin/collaborations?${new URLSearchParams({ ...(sp as Record<string, string>), page: String(page + 1) })}`}>Next</Link>}
      </div>
    </section>
  );
}

async function Reports() {
  const reports = await adminOpenReports();
  if (!reports.length) return <p role="status" className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No open reports.</p>;
  return (
    <ul className="space-y-3" aria-label="Open reports">
      {reports.map(({ report: r, reporterEmail, postTitle }) => (
        <li key={r.id} className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{r.reason} · {r.targetType}</p>
          <p className="mt-1 text-sm font-semibold">{r.postId ? <Link href={`/admin/collaborations/${r.postId}?report=${r.id}`} className="hover:underline">{postTitle ?? "Collaboration"}</Link> : "Deleted collaboration"}</p>
          {r.details && <p className="mt-1 whitespace-pre-wrap text-sm">{r.details}</p>}
          <p className="mt-1 text-xs text-muted-foreground">Reported by {reporterEmail ?? "a deleted account"} on {r.createdAt.toLocaleString("en-GB")}</p>
          <form action={resolveCollabReportAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="reportId" value={r.id} />
            <input type="hidden" name="back" value="/admin/collaborations?tab=reports" />
            <label className="min-w-56 flex-1 text-xs">Resolution note<input name="reason" required maxLength={500} className={input} /></label>
            <button name="outcome" value="actioned" className={`${btn} bg-primary text-primary-foreground`}>Mark actioned</button>
            <button name="outcome" value="dismissed" className={`${btn} border border-border`}>Dismiss</button>
          </form>
        </li>
      ))}
    </ul>
  );
}

async function Verifications() {
  const rows = await listVerifications();
  return (
    <section className="space-y-4" aria-label="Faculty and alumni verification">
      <p className="text-sm text-muted-foreground">Only verified accounts publish as Faculty-led or Alumni-led. The persona someone picks at sign-up never counts. Verify against an institutional email, staff page or alumni record, and note what you checked.</p>
      <form action={verifyCollabCreatorAction} className="grid grid-cols-1 gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-4">
        <input type="hidden" name="back" value="/admin/collaborations?tab=verifications" />
        <label className="text-xs">Account email<input name="email" type="email" required className={input} /></label>
        <label className="text-xs">Verified as<select name="kind" className={input}><option value="faculty">Faculty</option><option value="alumni">Alumni</option></select></label>
        <label className="text-xs">What you checked<input name="reason" required maxLength={500} className={input} /></label>
        <button className={`${btn} self-end bg-primary text-primary-foreground`}>Verify</button>
      </form>
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {rows.map((v) => (
          <li key={v.userId} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <span><b>{v.name ?? v.email}</b> · {v.kind} {v.revokedAt ? <em className="text-muted-foreground">(revoked)</em> : null}<span className="block text-xs text-muted-foreground">{v.email} · {v.note}</span></span>
            {!v.revokedAt && (
              <form action={revokeCollabCreatorAction} className="flex gap-2">
                <input type="hidden" name="userId" value={v.userId} />
                <input type="hidden" name="back" value="/admin/collaborations?tab=verifications" />
                <label><span className="sr-only">Reason</span><input name="reason" required placeholder="Reason" className={input} /></label>
                <button className={`${btn} border border-border`}>Revoke</button>
              </form>
            )}
          </li>
        ))}
        {!rows.length && <li className="p-6 text-center text-sm text-muted-foreground">No verified creators yet.</li>}
      </ul>
    </section>
  );
}
