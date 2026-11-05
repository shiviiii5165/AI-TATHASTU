import { Code2 } from "lucide-react";

import type { CodingActivity } from "@/lib/profile/coding-activity";

const DIFFICULTY = [
  { key: "easy", label: "Easy", className: "bg-emerald-50 text-emerald-700" },
  { key: "medium", label: "Medium", className: "bg-amber-50 text-amber-700" },
  { key: "hard", label: "Hard", className: "bg-rose-50 text-rose-700" },
] as const;

/** Problem-solving activity imported from coding platforms. Shown apart from patents, honours and publications. */
export function CodingActivitySection({ items }: { items: CodingActivity[] }) {
  return (
    <section aria-labelledby="coding-activity-title" className="rounded-2xl border border-[#E7EAF3] bg-white p-6 shadow-2xs">
      <div className="flex items-center gap-2 border-b border-[#F0F2F7] pb-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          <Code2 className="size-4" />
        </div>
        <h2 id="coding-activity-title" className="font-sans text-sm font-bold text-[#11182B]">
          Coding Activity & Problem Solving ({items.length})
        </h2>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.source} className="rounded-xl border border-slate-100 bg-violet-50/30 p-4" data-testid={`coding-activity-${item.source}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-sans text-xs font-bold text-slate-900">{item.sourceLabel}</p>
                {item.total !== null && <p className="mt-0.5 text-[11px] text-slate-500">{item.total} problems solved</p>}
              </div>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600" title="Fetched from the platform's public profile for the username you entered; account ownership isn't verified.">
                Imported from public profile
              </span>
            </div>
            {DIFFICULTY.some((d) => item[d.key] !== null) && (
              <div className="mt-3 flex flex-wrap gap-2">
                {DIFFICULTY.filter((d) => item[d.key] !== null).map((d) => (
                  <span key={d.key} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.className}`}>
                    {d.label} {item[d.key]}
                  </span>
                ))}
              </div>
            )}
            {item.badges.length > 0 && (
              <p className="mt-3 text-[11px] text-slate-500">{item.badges.map((b) => `${b.name} ${b.stars}★`).join(" · ")}</p>
            )}
            {item.profileRef && <p className="mt-2 font-mono text-[10px] text-slate-400">{item.profileRef}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
