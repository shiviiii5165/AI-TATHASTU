import { ArrowLeft, CheckCircle2, Clock, Globe, KeyRound, Shield, User, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StudentActions } from "@/components/admin/student-actions";
import { requireAdmin } from "@/lib/admin";
import { hasPermission, requireAdminPermission } from "@/lib/admin/rbac";
import { getStudentDetail } from "@/lib/admin/students";

export const metadata = {
  title: "Account Details · Admin Control Center",
  robots: { index: false },
};

interface StudentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminStudentDetailPage({ params }: StudentDetailPageProps) {
  await requireAdmin();
  const ctx = await requireAdminPermission("students.read");
  // Student 360 shows evidence-level data; it keeps its own permission and audit log.
  const canSee360 = hasPermission(ctx, "intelligence.read");

  const { id } = await params;
  const student = await getStudentDetail(id);

  if (!student) {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/students"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to student directory</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center shrink-0">
              {(student.name?.[0] || student.email?.[0] || "U").toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
                  {student.name || "Unnamed Account"}
                </h1>
                {student.isAdmin && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-mono">{student.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canSee360 && (
              <Link
                href={`/admin/intelligence/students/${student.id}?back=/admin/students/${student.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                Open Student 360
              </Link>
            )}
            {student.deletedAt ? (
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                Tombstoned Deletion
              </span>
            ) : (
              <span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Active Account
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Profile Details & Connected Integrations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Academic / Profile Facts */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <User className="size-4 text-primary" />
            <span>Profile & Academic Credentials</span>
          </h2>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Account Persona</span>
              <span className="font-semibold capitalize text-foreground">{student.role}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">University / Institution</span>
              <span className="font-medium text-foreground">{student.university || "—"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Degree</span>
              <span className="font-medium text-foreground">{student.degree || "—"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Specialization</span>
              <span className="font-medium text-foreground">{student.specialization || "—"}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border/50">
              <span className="text-muted-foreground">Academic Year</span>
              <span className="font-medium text-foreground">{student.academicYear || "—"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Registered At</span>
              <span className="font-mono text-muted-foreground">
                {new Date(student.createdAt).toLocaleDateString("en-IN", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Linked Integrations */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Globe className="size-4 text-primary" />
            <span>Connected Identity Sources</span>
          </h2>

          {student.linkedConnections.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No third-party sources linked to this account.</p>
          ) : (
            <div className="space-y-2">
              {student.linkedConnections.map((c) => (
                <div
                  key={c.sourceId}
                  className="p-3 rounded-xl border border-border/80 bg-background/50 flex items-center justify-between text-xs"
                >
                  <span className="font-semibold capitalize text-foreground">{c.sourceId}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {c.status.replaceAll("_", " ")}
                    {c.lastSyncAt ? ` · synced ${new Date(c.lastSyncAt).toLocaleDateString("en-IN")}` : " · never synced"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Onboarding and resume: account-level facts from onboarding_state and files. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3" data-testid="onboarding-card">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Onboarding</h2>
          {!student.onboarding ? (
            <p className="text-xs text-muted-foreground">Not started.</p>
          ) : (
            <dl className="space-y-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Status</dt><dd className="font-semibold text-foreground">{student.onboarding.completedAt ? "Finished" : "Not finished"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{student.onboarding.completedAt ? "Finished on" : "Current step"}</dt><dd className="font-mono text-foreground">{student.onboarding.completedAt ? new Date(student.onboarding.completedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : student.onboarding.step.replaceAll("_", " ")}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Primary career goal</dt><dd className="text-foreground">{student.onboarding.careerRole?.replaceAll("_", " ") || "Not chosen"}</dd></div>
            </dl>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3" data-testid="resume-card">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">Resume uploads</h2>
          {student.resumes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No resume uploaded.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {student.resumes.map((r, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-foreground">{new Date(r.uploadedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-mono text-muted-foreground">{r.sizeBytes ? `${Math.max(1, Math.round(r.sizeBytes / 1024))} KB` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-muted-foreground">
            {canSee360 ? "Extracted skills, projects and evidence are in Student 360." : "Extracted evidence is visible to admins with Student Intelligence access."}
          </p>
        </div>
      </div>

      {/* Security Actions */}
      <StudentActions
        userId={student.id}
        userName={student.name}
        userEmail={student.email}
        isAdmin={student.isAdmin}
        isDeleted={!!student.deletedAt}
      />
    </div>
  );
}

