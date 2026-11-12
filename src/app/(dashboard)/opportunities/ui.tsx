import type { FitState } from "@/lib/opportunities/fit";

export const KIND_LABEL: Record<string, string> = {
  research_assistant: "Research assistant / JRF / SRF",
  research_project: "Research project",
  research_internship: "Research internship",
  collaboration: "Student collaboration",
  funded_programme: "Funded programme",
  call_for_collaborators: "Call for collaborators",
  phd_position: "PhD position",
  fellowship: "Fellowship / postdoc",
};

const FIT: Record<FitState, { label: string; cls: string }> = {
  strong_fit: { label: "Strong fit", cls: "bg-[#E8FAF4] text-[#0E7C66]" },
  potential_fit: { label: "Potential fit", cls: "bg-[#EDF5FF] text-[#1D5FC4]" },
  insufficient_information: { label: "Not enough information", cls: "bg-[#F4F6F9] text-[#475569]" },
  not_eligible: { label: "Not eligible", cls: "bg-[#FFF4E5] text-[#9A5B00]" },
};

export function FitBadge({ state }: { state: FitState }) {
  const f = FIT[state];
  return <span className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold ${f.cls}`}>{f.label}</span>;
}

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
