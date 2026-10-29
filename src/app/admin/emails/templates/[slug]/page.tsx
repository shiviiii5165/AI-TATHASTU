import { ArrowLeft, Mail } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TemplateEditor } from "@/components/admin/template-editor";
import { db } from "@/db";
import { emailTemplates, emailTemplateVersions } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { eq } from "drizzle-orm";

export const metadata = {
  title: "Edit Template · Email Studio",
  robots: { index: false },
};

interface TemplatePageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminTemplateDetailPage({ params }: TemplatePageProps) {
  const admin = await requireAdmin();
  await requireAdminPermission("email.templates.read");

  const { slug } = await params;

  const [template] = await db
    .select()
    .from(emailTemplates)
    .where(eq(emailTemplates.slug, slug));

  if (!template) {
    notFound();
  }

  const versions = await db
    .select()
    .from(emailTemplateVersions)
    .where(eq(emailTemplateVersions.templateId, template.id))
    .orderBy(emailTemplateVersions.versionNumber);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <Link
          href="/admin/emails/templates"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to template directory</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
              <span className="uppercase font-semibold px-2 py-0.5 rounded bg-muted">
                {template.category}
              </span>
              <span>·</span>
              <span>{template.slug}</span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
              {template.name}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground font-semibold">
              Current: v{template.version}
            </span>
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                template.status === "published"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              }`}
            >
              {template.status}
            </span>
          </div>
        </div>
      </div>

      <TemplateEditor
        template={template}
        versions={versions}
        adminEmail={admin.email || "admin@aitathastu.com"}
      />
    </div>
  );
}

