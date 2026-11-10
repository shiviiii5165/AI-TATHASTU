"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface NextActionItem {
  num: number;
  title: string;
  desc: string;
  btnText: string;
  btnHref: string;
  category?: string;
}

interface NextActionsRowProps {
  actions?: NextActionItem[];
  /** Kept for callers; Yora is reached from the hero, so this row no longer repeats it. */
  onOpenYora?: () => void;
}

const ACCENTS = ["#2878F0", "#8554FF", "#0E9D6D", "#FF496D", "#F59E0B"];

/** The engine's next steps for this user, in its order. Nothing is shown until the profile has been processed. */
export function NextActionsRow({ actions: dynamicActions }: NextActionsRowProps) {
  const actions = (dynamicActions ?? []).slice(0, 5);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-2xs sm:p-5" aria-labelledby="next-steps-title">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <div className="flex size-7 items-center justify-center rounded-lg bg-[#EDF5FF] text-[#2878F0] dark:bg-blue-500/15 dark:text-blue-300">
          <CheckCircle2 aria-hidden className="size-4" />
        </div>
        <h2 id="next-steps-title" className="font-sans text-sm font-bold text-foreground">
          Your next steps
        </h2>
      </div>

      {actions.length === 0 ? (
        <p className="my-6 text-center text-xs text-muted-foreground">Your next steps appear once your profile has been processed.</p>
      ) : (
        <ol className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {actions.map((act, idx) => {
            const accent = ACCENTS[idx % ACCENTS.length];
            return (
              <li key={`${act.num}-${act.title}`} className="flex flex-col justify-between rounded-xl border border-border bg-muted/30 p-3 transition-colors duration-200 hover:bg-muted/60">
                <div>
                  <span className="flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: accent }}>
                    {idx + 1}
                  </span>
                  <p className="mt-2 line-clamp-2 text-xs font-bold leading-snug text-foreground" title={act.title}>
                    {act.title}
                  </p>
                  <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-muted-foreground">{act.desc}</p>
                </div>
                <Link href={act.btnHref || "/dashboard"} className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold hover:underline" style={{ color: accent }}>
                  {(act.btnText || "Start").replace(/\s*→\s*$/, "")}
                  <ArrowRight aria-hidden className="size-3" />
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
