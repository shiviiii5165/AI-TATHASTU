import { CheckCircle2, Mail, Palette, Shield } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";

export const metadata = {
  title: "Email Branding & Configuration · Admin Control Center",
  robots: { index: false },
};

export default async function AdminEmailSettingsPage() {
  await requireAdmin();
  await requireAdminPermission("email.templates.edit");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Palette className="size-6 text-primary" />
          <span>Global Email Branding & Sender Profiles</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Configure official brand colors, logos, support contact headers, and SPF/DKIM verification.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-5">
        <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Sender Profiles & Domain Authentication
        </h2>

        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-border bg-background/50 flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-foreground">Auth Sender Profile (`auth`)</div>
              <p className="text-muted-foreground text-[11px]">Used for magic links & authentication verification tokens</p>
            </div>
            <span className="font-mono text-muted-foreground">
              {process.env.SMTP_HELLO_USER || process.env.SMTP_USER || "hello@aitathastu.com"}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border bg-background/50 flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-foreground">Support Sender Profile (`support`)</div>
              <p className="text-muted-foreground text-[11px]">Used for ticket updates, agent replies, and user assistance</p>
            </div>
            <span className="font-mono text-muted-foreground">
              {process.env.SMTP_SUPPORT_USER || "support.aitathastu@gmail.com"}
            </span>
          </div>

          <div className="p-4 rounded-xl border border-border bg-background/50 flex items-center justify-between text-xs">
            <div>
              <div className="font-semibold text-foreground">System Sender Profile (`system`)</div>
              <p className="text-muted-foreground text-[11px]">Used for onboarding welcome notices & intelligence ready alerts</p>
            </div>
            <span className="font-mono text-muted-foreground">
              {process.env.SMTP_INFO_USER || "info@aitathastu.com"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs space-y-4">
        <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
          Brand Colors & Asset References
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl border border-border bg-background/50 space-y-1">
            <span className="text-muted-foreground">Brand Mark Asset</span>
            <div className="font-mono font-medium text-foreground">/icons/icon-192.png</div>
          </div>

          <div className="p-3.5 rounded-xl border border-border bg-background/50 space-y-1">
            <span className="text-muted-foreground">Primary Accent Color</span>
            <div className="font-mono font-medium text-foreground flex items-center gap-2">
              <span className="size-3.5 rounded-full bg-[#E11D48] inline-block" />
              <span>#E11D48 (Rose)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

