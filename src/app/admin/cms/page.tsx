import { Bell, Globe, Megaphone, Plus } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { cmsAnnouncements } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { desc } from "drizzle-orm";

export const metadata = {
  title: "Website CMS & Banners · Admin Control Center",
  robots: { index: false },
};

export default async function AdminCmsPage() {
  await requireAdmin();
  await requireAdminPermission("cms.edit");

  // Seed initial announcement if empty
  const [existing] = await db.select().from(cmsAnnouncements).limit(1);
  if (!existing) {
    await db.insert(cmsAnnouncements).values({
      title: "Welcome to AI Tathastu 2.0",
      content: "Explore the new Career Intelligence Hub and interactive skill graph.",
      type: "info",
      targetAudience: "all",
      isActive: true,
    });
  }

  const announcements = await db
    .select()
    .from(cmsAnnouncements)
    .orderBy(desc(cmsAnnouncements.createdAt));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Globe className="size-6 text-primary" />
          <span>Website CMS & Platform Announcements</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Manage homepage alert banners, scheduled maintenance notices, and broadcast messages.
        </p>
      </div>

      {/* Announcements List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Broadcast Announcements ({announcements.length})
          </h2>
        </div>

        <div className="divide-y divide-border/60">
          {announcements.map((item) => (
            <div key={item.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="font-bold text-sm text-foreground flex items-center gap-2">
                  <span>{item.title}</span>
                  <span className="font-mono text-[10px] text-muted-foreground uppercase px-2 py-0.5 rounded bg-muted">
                    {item.type}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground capitalize">
                    Audience: {item.targetAudience}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">{item.content}</p>
              </div>

              <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
                Active
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

