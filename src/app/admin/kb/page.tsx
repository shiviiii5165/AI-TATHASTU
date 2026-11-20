import { BookOpen, FileText, Lock, Plus, Search } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { knowledgeBaseArticles } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { desc } from "drizzle-orm";

export const metadata = {
  title: "Knowledge Base · Admin Control Center",
  robots: { index: false },
};

export default async function AdminKbPage() {
  await requireAdmin();
  await requireAdminPermission("kb.manage");

  // Read-only: viewing this page never creates articles. Existing records are shown as they are.
  const articles = await db
    .select()
    .from(knowledgeBaseArticles)
    .orderBy(desc(knowledgeBaseArticles.createdAt));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <BookOpen className="size-6 text-primary" />
            <span>Support Knowledge Base & Help Center</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Author and publish self-service guides, integration FAQs, and internal troubleshooting runbooks.
          </p>
        </div>
      </div>

      <div role="note" data-testid="not-live-notice" className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
        <strong>Not live on the student site.</strong> No student-facing page reads these articles yet, so &quot;published&quot; here is
        not visible to students. This page is read-only: articles can&apos;t be created or edited here yet.
      </div>

      {articles.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-12 text-center text-xs text-muted-foreground">No articles in the knowledge base.</div>
      )}

      {/* Articles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((a) => (
          <div
            key={a.id}
            className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-3 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] text-muted-foreground font-semibold uppercase px-2 py-0.5 rounded bg-muted">
                  {a.category}
                </span>
                {a.isInternalOnly && (
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Lock className="size-3" />
                    Internal SOP
                  </span>
                )}
              </div>

              <h2 className="font-bold text-sm text-foreground">{a.title}</h2>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-3 leading-relaxed">
                {a.content}
              </p>
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
              <span>{a.viewCount} views</span>
              <span>{a.helpfulCount} helpful</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

