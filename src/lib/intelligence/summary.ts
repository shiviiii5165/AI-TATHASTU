import { skillsToDevelop } from "@/lib/dashboard/intelligence";

import type { Student360 } from "./student";
import type { StudentResult } from "./types";

export interface SummaryLine {
  text: string;
  source: string;
  tone: "strength" | "gap" | "context";
}

const date = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * A short, deterministic summary. Every line restates a stored value and names where it came from. No inference
 * beyond the engine's own outputs, no causal claims, no language model. When there is too little evidence it says so.
 */
export function buildEvidenceSummary(s: Student360, rank: StudentResult | null, rankingName: string | null): SummaryLine[] {
  const out: SummaryLine[] = [];
  const intel = s.intel;
  if (rank && rankingName) {
    out.push(rank.rank
      ? { tone: "context", text: `Ranked #${rank.rank} in “${rankingName}” with ${rank.coverage}% of the weight backed by evidence.`, source: "Ranking engine, live" }
      : { tone: "context", text: `Not ranked in “${rankingName}”: ${rank.ineligibleReasons[0] ?? "insufficient evidence"}`, source: "Ranking engine, live" });
    const scored = rank.categories.filter((c) => c.score !== null).sort((a, b) => b.score! - a.score!);
    if (scored.length >= 2) {
      out.push({ tone: "strength", text: `Strongest category: ${scored[0].name} (${scored[0].score!.toFixed(0)}/100).`, source: "Ranking engine, relative to this cohort" });
      out.push({ tone: "gap", text: `Weakest scored category: ${scored[scored.length - 1].name} (${scored[scored.length - 1].score!.toFixed(0)}/100).`, source: "Ranking engine, relative to this cohort" });
    }
    const unmeasured = rank.categories.filter((c) => c.score === null).map((c) => c.name);
    if (unmeasured.length) out.push({ tone: "context", text: `No evidence yet for: ${unmeasured.join(", ")}. That is unmeasured, not weak.`, source: "Ranking engine" });
  }
  if (intel) {
    const top = intel.skills.filter((k) => k.proficiency !== null && (k.evidenceBasis === "demonstrated" || k.evidenceBasis === "assessed")).sort((a, b) => b.proficiency! - a.proficiency!).slice(0, 3);
    if (top.length) out.push({ tone: "strength", text: `Best-evidenced skills: ${top.map((k) => `${k.name} (${k.level})`).join(", ")}.`, source: `Career engine, ${date(intel.computedAt)}; shown in code or a platform assessment` });
    const gaps = skillsToDevelop(intel, s.goal.role).slice(0, 3);
    if (gaps.length) out.push({ tone: "gap", text: `Top development priorities${s.goal.label ? ` for ${s.goal.label}` : ""}: ${gaps.map((g) => g.skill).join(", ")}.`, source: "Career engine gap inventory (draft frameworks)" });
    const described = intel.skills.filter((k) => k.evidenceBasis === "described" || k.evidenceBasis === "claimed").length;
    if (described) out.push({ tone: "context", text: `${described} skill${described === 1 ? " is" : "s are"} only described or listed, with nothing independent behind ${described === 1 ? "it" : "them"} yet.`, source: "Career engine evidence basis" });
  } else {
    out.push({ tone: "context", text: "The career engine hasn't computed this student, so skills and gaps are unavailable.", source: "profile_views" });
  }
  if (s.github?.syncedAt && s.github.total !== null) out.push({ tone: "context", text: `${s.github.total} GitHub contributions in the synced year.`, source: `GitHub, synced ${date(s.github.syncedAt)}` });
  return out;
}
