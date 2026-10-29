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

  // Seed starter articles if empty
  const [count] = await db.select().from(knowledgeBaseArticles).limit(1);
  if (!count) {
    await db.insert(knowledgeBaseArticles).values([
      {
        slug: "how-github-intelligence-works",
        title: "How GitHub Repository & Commit Intelligence Works",
        category: "integrations",
        content: "AI Tathastu analyzes your public GitHub commits, languages, and PR activity to generate verified skill evidence and ERIS score metrics.",
        isInternalOnly: false,
        isPublished: true,
      },
      {
        slug: "troubleshooting-magic-link-email",
        title: "Troubleshooting Passwordless Magic-Link Delivery",
        category: "auth",
        content: "If you do not see your sign-in email within 60 seconds, check your spam/junk folder. Ensure your domain accepts automated emails from support.aitathastu@gmail.com.",
        isInternalOnly: false,
        isPublished: true,
      },
      {
        slug: "support-agent-onboarding-sop",
        title: "Standard Operating Procedure: Support Escalations",
        category: "internal",
        content: "For tier-2 infrastructure or database discrepancies, assign the ticket to @engineering with internal notes summarizing user correlation IDs.",
        isInternalOnly: true,
        isPublished: true,
      },
    ]);
  }

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

