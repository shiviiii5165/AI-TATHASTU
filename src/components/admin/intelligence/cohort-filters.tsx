import { Filter } from "lucide-react";
import type { ReactNode } from "react";

import type { CohortOptions } from "@/lib/intelligence/overview";

const FIELDS: { name: keyof CohortOptions; label: string }[] = [
  { name: "institutionId", label: "Institution" },
  { name: "degreeId", label: "Degree" },
  { name: "specializationId", label: "Specialization" },
  { name: "academicYear", label: "Academic year" },
  { name: "graduationYear", label: "Graduation year" },
  { name: "careerRole", label: "Career goal" },
];

/** GET form: the filter state lives in the URL, so back navigation and shared links keep it. */
export function CohortFilters({ action, options, values, hidden = {}, children }: {
  action: string;
  options: CohortOptions;
  values: Record<string, string | undefined>;
  hidden?: Record<string, string | undefined>;
  children?: ReactNode;
}) {
  return (
    <form method="GET" action={action} className="rounded-2xl border border-border bg-card p-3.5 shadow-2xs">
      {Object.entries(hidden).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
        {FIELDS.map((f) => (
          <label key={f.name} className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground space-y-1">
            <span>{f.label}</span>
            <select name={f.name} defaultValue={values[f.name] ?? ""} className="w-full bg-muted/60 border border-border text-xs rounded-lg px-2 py-1.5 outline-none focus:border-primary normal-case tracking-normal font-normal text-foreground">
              <option value="">All</option>
              {options[f.name].map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {children}
        <button type="submit" className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity">
          <Filter className="size-3.5" /> Apply
        </button>
        <a href={action} className="px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">Reset</a>
      </div>
    </form>
  );
}
