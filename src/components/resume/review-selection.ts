import type { ResumeReviewInput } from "@/app/onboarding/actions";

/**
 * Review state for extracted resume facts. Confidence is display-only and never
 * implies a decision: every fact starts "pending" (not selected) until the user
 * ticks it ("save") or rejects it ("reject").
 */
export type Decision = "pending" | "save" | "reject";
export type RowState = { decision: Decision; value: string };
export type Rows = Record<string, RowState>;

export type MasterState = "unchecked" | "indeterminate" | "checked";

/** Eligible = not explicitly rejected. Rejections are only undone by the row's own Undo. */
export function selectionSummary(rows: Rows) {
  let save = 0;
  let reject = 0;
  let pending = 0;
  for (const r of Object.values(rows)) {
    if (r.decision === "save") save++;
    else if (r.decision === "reject") reject++;
    else pending++;
  }
  const eligible = save + pending;
  const master: MasterState = eligible === 0 || save === 0 ? "unchecked" : pending === 0 ? "checked" : "indeterminate";
  return { save, reject, pending, eligible, master };
}

/** Bulk select or deselect every eligible fact. Rejected facts and edited values are left as they are. */
export function setAllEligible(rows: Rows, selected: boolean): Rows {
  const from: Decision = selected ? "pending" : "save";
  const to: Decision = selected ? "save" : "pending";
  let changed = false;
  const next: Rows = {};
  for (const [id, r] of Object.entries(rows)) {
    if (r.decision === from) {
      next[id] = { ...r, decision: to };
      changed = true;
    } else next[id] = r;
  }
  return changed ? next : rows;
}

/** Checked → deselect all; unchecked or indeterminate → select all. */
export function toggleAll(rows: Rows): Rows {
  return setAllEligible(rows, selectionSummary(rows).master !== "checked");
}

/** Only decided facts are sent; pending ones stay unconfirmed on the server. */
export function decisionsPayload(rows: Rows): ResumeReviewInput["decisions"] {
  return Object.entries(rows)
    .filter(([, r]) => r.decision !== "pending")
    .map(([id, r]) => ({ id, action: r.decision === "save" ? ("confirm" as const) : ("reject" as const), value: r.value.trim() }));
}
