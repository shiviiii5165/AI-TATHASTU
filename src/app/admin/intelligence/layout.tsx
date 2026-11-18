import "./intelligence.css";

import { Brain } from "lucide-react";
import type { ReactNode } from "react";

import { IntelligenceSubnav } from "@/components/admin/intelligence/subnav";
import { requireAdminPermission } from "@/lib/admin/rbac";

export const metadata = {
  title: "Student Intelligence · Admin Control Center",
  robots: { index: false },
};

export default async function IntelligenceLayout({ children }: { children: ReactNode }) {
  await requireAdminPermission("intelligence.read");
  return (
    <div className="si-root space-y-6">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Brain className="size-6 text-primary" />
            <span>Student Intelligence</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Evidence-based rankings and Student 360° profiles. Every score traces to a stored record; missing evidence is shown as missing, never as zero.
          </p>
        </div>
        <IntelligenceSubnav />
      </div>
      {children}
    </div>
  );
}
