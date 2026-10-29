import { ArrowRight, Code, Eye, Mail, Plus, Sparkles } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { emailTemplates } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { seedStarterTemplates } from "@/lib/admin/email-engine";
import { requireAdminPermission } from "@/lib/admin/rbac";

export const metadata = {
  title: "Email Template Studio · Admin Control Center",
  robots: { index: false },
};

export default async function AdminEmailTemplatesPage() {
  await requireAdmin();
  await requireAdminPermission("email.templates.read");

  await seedStarterTemplates();

  const templates = await db
    .select()
    .from(emailTemplates)
    .orderBy(emailTemplates.category, emailTemplates.name);

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Mail className="size-6 text-primary" />
            <span>Email Template Studio</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Manage, customize, and publish versioned transactional email templates with zero-eval safety.
          </p>
        </div>

        <Link
          href="/admin/emails/deliveries"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-accent transition-colors"
        >
          <span>Delivery Outbox</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>

      {/* Templates Grouped by Category */}
      <div className="space-y-8">
        {categories.map((cat) => {
          const catTemplates = templates.filter((t) => t.category === cat);
          return (
            <div key={cat} className="space-y-3">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {cat} Templates ({catTemplates.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catTemplates.map((t) => (
                  <Link
                    key={t.id}
                    href={`/admin/emails/templates/${t.slug}`}
                    className="p-5 rounded-2xl border border-border bg-card hover:border-primary/50 hover:shadow-md transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] text-muted-foreground font-semibold uppercase px-2 py-0.5 rounded bg-muted">
                          v{t.version}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            t.status === "published"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                        {t.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                        {t.description || t.subject}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-medium text-muted-foreground">
                      <span className="font-mono text-[11px] truncate max-w-[150px]">{t.slug}</span>
                      <span className="text-primary font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        <span>Edit</span>
                        <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

