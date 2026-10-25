import { asc, count, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Metadata } from "next";
import { Suspense } from "react";

import { PendingInstitutionRow } from "@/components/admin/pending-institution-row";
import { db } from "@/db";
import { institutions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";

export const metadata: Metadata = { title: "Pending institutions", robots: { index: false } };

export default function AdminInstitutionsPage() {
  return (
    <div className="max-w-6xl">
      <p className="font-mono text-xs tracking-wider text-muted-foreground uppercase">Admin · Institutions</p>
      <h1 className="mt-3 font-heading text-3xl sm:text-4xl md:text-5xl leading-[1.05] tracking-tight">Pending institutions</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Entries users typed under &quot;Other / Not listed&quot;. Approve adds one to everyone&apos;s search. Merge moves its
        users to an existing institution. Reject unlinks them and keeps what they typed.
      </p>
      <Suspense fallback={<div role="status" aria-label="Loading" className="mt-10 h-64 animate-pulse rounded-lg border bg-muted" />}>
        <PendingTable />
      </Suspense>
    </div>
  );
}

async function PendingTable() {
  await requireAdmin();
  const author = alias(users, "author");
  const rows = await db
    .select({
      id: institutions.id,
      name: institutions.canonicalName,
      city: institutions.city,
      state: institutions.state,
      createdAt: institutions.createdAt,
      authorName: author.name,
      authorEmail: author.email,
    })
    .from(institutions)
    .leftJoin(author, eq(author.id, institutions.createdBy))
    .where(eq(institutions.verificationStatus, "pending"))
    .orderBy(asc(institutions.createdAt));
  const counts = rows.length
    ? await db
        .select({ id: users.institutionId, n: count() })
        .from(users)
        .where(inArray(users.institutionId, rows.map((r) => r.id)))
        .groupBy(users.institutionId)
    : [];
  const usersOf = (id: string) => counts.find((c) => c.id === id)?.n ?? 0;

  if (!rows.length) {
    return <p className="mt-10 rounded-lg border border-dashed p-8 text-muted-foreground">Nothing to review. New entries appear here as users add them.</p>;
  }
  return (
    <div className="mt-10 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">Pending institutions, oldest first</caption>
        <thead className="border-b bg-muted/40 font-mono text-xs tracking-wider text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-normal">Institution</th>
            <th scope="col" className="px-4 py-3 font-normal">Added by</th>
            <th scope="col" className="px-4 py-3 text-right font-normal">Users</th>
            <th scope="col" className="px-4 py-3 font-normal">Review</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <PendingInstitutionRow
              key={r.id}
              row={{
                id: r.id,
                name: r.name,
                place: [r.city, r.state].filter(Boolean).join(", "),
                addedBy: r.authorName ?? r.authorEmail ?? "Deleted user",
                addedAt: r.createdAt.toISOString(),
                users: usersOf(r.id),
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
