import { AlertCircle, Filter, GraduationCap, Search, Shield, User, Users } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { listStudents } from "@/lib/admin/students";

export const metadata = {
  title: "Student Directory · Admin Control Center",
  robots: { index: false },
};

interface StudentsPageProps {
  searchParams: Promise<{
    q?: string;
    role?: string;
    university?: string;
  }>;
}

export default async function AdminStudentsPage({ searchParams }: StudentsPageProps) {
  await requireAdmin();
  await requireAdminPermission("students.read");

  const params = await searchParams;
  const searchQuery = params.q || undefined;
  const roleFilter = params.role || undefined;
  const universityFilter = params.university || undefined;

  const { students, total } = await listStudents({
    query: searchQuery,
    role: roleFilter,
    university: universityFilter,
    limit: 50,
  });

  const roles = [
    { label: "All Personas", value: undefined },
    { label: "Students", value: "student" },
    { label: "Faculty", value: "faculty" },
    { label: "Alumni", value: "alumni" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Users className="size-6 text-primary" />
            <span>Student & Account Directory</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Directory of registered students, faculty, alumni, verification status, and session controls.
          </p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border p-3.5 rounded-2xl shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
          {roles.map((tab) => {
            const isActive = tab.value === roleFilter || (!tab.value && !roleFilter);
            const queryParam = tab.value ? `?role=${tab.value}` : "/admin/students";

            return (
              <Link
                key={tab.label}
                href={tab.value ? `/admin/students?role=${tab.value}` : "/admin/students"}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <form method="GET" action="/admin/students" className="relative shrink-0 w-full lg:w-80">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search name, email, university..."
            className="w-full bg-muted/60 focus:bg-background border border-border text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none transition-colors"
          />
        </form>
      </div>

      {/* Students Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        {students.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="size-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <h3 className="text-sm font-semibold text-foreground">No accounts match criteria</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Try adjusting your search terms or filters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Persona</th>
                  <th className="py-3 px-4">Institution / University</th>
                  <th className="py-3 px-4">Degree</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/40 transition-colors group">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/admin/students/${s.id}`}
                        className="font-medium text-foreground hover:text-primary transition-colors flex items-center gap-2"
                      >
                        <div className="size-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {(s.name?.[0] || s.email?.[0] || "U").toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{s.name || "Unnamed Account"}</span>
                            {s.isAdmin && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary">
                                Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{s.email}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-muted text-foreground">
                        {s.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 max-w-[200px] truncate text-foreground font-medium">
                      {s.university || <span className="text-muted-foreground italic">Not specified</span>}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground max-w-[150px] truncate">
                      {s.degree || "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      {s.deletedAt ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400">
                          Tombstoned
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right text-muted-foreground font-mono">
                      {new Date(s.createdAt).toLocaleDateString("en-IN", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <span>Showing {students.length} of {total} accounts</span>
        <span>Search covers name, email, and university</span>
      </div>
    </div>
  );
}

