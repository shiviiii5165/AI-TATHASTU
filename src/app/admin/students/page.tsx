import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { hasPermission, requireAdminPermission } from "@/lib/admin/rbac";
import { listStudentFacets, listStudents, STUDENT_SORTS, type StudentSort } from "@/lib/admin/students";

export const metadata = {
  title: "Student Directory · Admin Control Center",
  robots: { index: false },
};

const PAGE_SIZE = 25;
type SP = Record<string, string | undefined>;

const PERSONAS = [
  { label: "All personas", value: "" },
  { label: "Students", value: "student" },
  { label: "Faculty", value: "faculty" },
  { label: "Alumni", value: "alumni" },
];

const one = (v: string | undefined) => v?.trim() || undefined;

/** Builds a directory URL keeping the current filters, with overrides. */
function hrefWith(sp: SP, over: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/admin/students?${s}` : "/admin/students";
}

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  const ctx = await requireAdminPermission("students.read");
  const canSee360 = hasPermission(ctx, "intelligence.read");

  const raw = await searchParams;
  const sp: SP = {
    q: one(raw.q),
    role: one(raw.role),
    university: one(raw.university),
    degree: one(raw.degree),
    year: one(raw.year),
    grad: one(raw.grad),
    onboarding: raw.onboarding === "complete" || raw.onboarding === "incomplete" ? raw.onboarding : undefined,
    sort: raw.sort && raw.sort in STUDENT_SORTS ? raw.sort : undefined,
  };
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);

  const [{ students, total }, facets] = await Promise.all([
    listStudents({
      query: sp.q,
      role: sp.role,
      university: sp.university,
      degree: sp.degree,
      academicYear: sp.year,
      graduationYear: sp.grad ? Number(sp.grad) || undefined : undefined,
      onboarding: sp.onboarding as "complete" | "incomplete" | undefined,
      sort: sp.sort as StudentSort | undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listStudentFacets(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const activeFilters = [sp.q, sp.role, sp.university, sp.degree, sp.year, sp.grad, sp.onboarding].filter(Boolean).length;
  const field = "w-full min-h-9 bg-background border border-border text-xs rounded-lg px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Users className="size-6 text-primary" />
          <span>Student &amp; Account Directory</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Every registered account (deleted accounts excluded). Search, filter and open an account for its details{canSee360 ? " or its Student 360 profile" : ""}.
        </p>
      </div>

      {/* Filters: a plain GET form, so every filter is in the URL and the back button works. */}
      <form method="GET" action="/admin/students" className="rounded-2xl border border-border bg-card p-3.5 shadow-2xs space-y-3" aria-label="Filter students">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <label className="relative sm:col-span-2">
            <span className="sr-only">Search</span>
            <Search aria-hidden className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input name="q" defaultValue={sp.q} placeholder="Name, email, institution, degree, specialization" className={`${field} pl-8`} />
          </label>
          <label>
            <span className="sr-only">Persona</span>
            <select name="role" defaultValue={sp.role ?? ""} className={field}>
              {PERSONAS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Institution</span>
            <input name="university" defaultValue={sp.university} placeholder="Institution contains…" className={field} />
          </label>
          <label>
            <span className="sr-only">Degree</span>
            <select name="degree" defaultValue={sp.degree ?? ""} className={field}>
              <option value="">Any degree</option>
              {facets.degrees.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Academic year</span>
            <select name="year" defaultValue={sp.year ?? ""} className={field}>
              <option value="">Any academic year</option>
              {facets.academicYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Graduation year</span>
            <select name="grad" defaultValue={sp.grad ?? ""} className={field}>
              <option value="">Any graduation year</option>
              {facets.graduationYears.map((y) => <option key={y} value={String(y)}>{y}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Onboarding</span>
            <select name="onboarding" defaultValue={sp.onboarding ?? ""} className={field}>
              <option value="">Any onboarding status</option>
              <option value="complete">Onboarding finished</option>
              <option value="incomplete">Onboarding not finished</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Sort
            <select name="sort" defaultValue={sp.sort ?? "newest"} className="min-h-9 bg-background border border-border text-xs rounded-lg px-2 py-1.5">
              {Object.entries(STUDENT_SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
            {activeFilters > 0 && <Link href="/admin/students" className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2">Clear filters</Link>}
            <button type="submit" className="min-h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2">Apply</button>
          </div>
        </div>
      </form>

      <p className="text-xs text-muted-foreground" data-testid="directory-count" aria-live="polite">
        {total === 0 ? "No accounts match." : `Showing ${from}–${to} of ${total.toLocaleString("en-IN")} matching accounts`}
        {activeFilters > 0 && ` · ${activeFilters} filter${activeFilters > 1 ? "s" : ""} applied`}
      </p>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        {students.length === 0 ? (
          <div className="py-16 text-center">
            <Users aria-hidden className="size-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <h2 className="text-sm font-semibold text-foreground">No accounts match these filters</h2>
            <p className="text-xs text-muted-foreground mt-1">Change or clear the filters to see more accounts.</p>
          </div>
        ) : (
          // relative: keeps the visually hidden caption and header inside the scroll box, so they can't widen the page.
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Accounts, {STUDENT_SORTS[(sp.sort as StudentSort) ?? "newest"]}</caption>
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th scope="col" className="py-3 px-4">Account</th>
                  <th scope="col" className="py-3 px-4">Persona</th>
                  <th scope="col" className="py-3 px-4">Institution</th>
                  <th scope="col" className="py-3 px-4">Degree · year</th>
                  <th scope="col" className="py-3 px-4">Onboarding</th>
                  <th scope="col" className="py-3 px-4 text-right">Registered</th>
                  {canSee360 && <th scope="col" className="py-3 px-4"><span className="sr-only">Student 360</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/admin/students/${s.id}`} className="flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-2">
                        <span aria-hidden className="size-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                          {(s.name?.[0] || s.email?.[0] || "U").toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="font-semibold text-foreground hover:text-primary flex items-center gap-1.5">
                            {s.name || "Unnamed account"}
                            {s.isAdmin && <span className="text-[10px] font-mono px-1.5 rounded bg-primary/10 text-primary">Admin</span>}
                          </span>
                          <span className="block text-[11px] text-muted-foreground">{s.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-3 px-4"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-muted text-foreground">{s.role}</span></td>
                    <td className="py-3 px-4 max-w-[200px] truncate text-foreground">{s.university || <span className="text-muted-foreground italic">Not given</span>}</td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate">
                      {[s.degree, s.academicYear, s.graduationYear ? `class of ${s.graduationYear}` : null].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="py-3 px-4">
                      {s.onboardingCompletedAt ? (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Finished</span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
                          {s.onboardingStep ? `At step: ${s.onboardingStep.replaceAll("_", " ")}` : "Not started"}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(s.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    {canSee360 && (
                      <td className="py-3 px-4 text-right">
                        <Link href={`/admin/intelligence/students/${s.id}?back=${encodeURIComponent(hrefWith(sp, { page: page > 1 ? String(page) : undefined }))}`} className="text-[11px] font-semibold text-primary hover:underline whitespace-nowrap">Student 360</Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-xs">
          {page > 1 ? (
            <Link href={hrefWith(sp, { page: String(page - 1) })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-accent"><ChevronLeft aria-hidden className="size-3.5" /> Previous</Link>
          ) : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? (
            <Link href={hrefWith(sp, { page: String(page + 1) })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-accent">Next <ChevronRight aria-hidden className="size-3.5" /></Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
