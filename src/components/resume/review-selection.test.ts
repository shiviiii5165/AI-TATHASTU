import { describe, expect, it } from "vitest";

import { decisionsPayload, selectionSummary, setAllEligible, toggleAll, type Rows } from "./review-selection";

// high = a (already ticked), medium = b (pending), low = c (pending, edited), rejected = d.
const start = (): Rows => ({
  a: { decision: "save", value: "Ananya" },
  b: { decision: "pending", value: "ananya@example.com" },
  c: { decision: "pending", value: "Python, edited" },
  d: { decision: "reject", value: "Wrong school" },
});

describe("resume review selection", () => {
  it("leaves already-selected fields selected and reports indeterminate", () => {
    const s = selectionSummary(start());
    expect(s).toMatchObject({ save: 1, reject: 1, pending: 2, eligible: 3, master: "indeterminate" });
  });

  it("select all ticks every eligible field, including medium/low, but never rejected ones", () => {
    const rows = toggleAll(start());
    expect(rows.b.decision).toBe("save");
    expect(rows.c.decision).toBe("save");
    expect(rows.d.decision).toBe("reject");
    expect(selectionSummary(rows)).toMatchObject({ save: 3, reject: 1, pending: 0, master: "checked" });
  });

  it("preserves edited values through select and deselect", () => {
    const on = toggleAll(start());
    const off = toggleAll(on);
    expect(on.c.value).toBe("Python, edited");
    expect(off.c.value).toBe("Python, edited");
  });

  it("deselect all from checked clears selections but keeps rejections", () => {
    const off = toggleAll(toggleAll(start()));
    expect(selectionSummary(off)).toMatchObject({ save: 0, reject: 1, pending: 3, master: "unchecked" });
    expect(off.d.decision).toBe("reject");
  });

  it("unticking one field after select all makes the master indeterminate", () => {
    const rows = toggleAll(start());
    rows.b = { ...rows.b, decision: "pending" };
    expect(selectionSummary(rows).master).toBe("indeterminate");
  });

  it("ticking every eligible field by hand makes the master checked", () => {
    const rows = start();
    rows.b = { ...rows.b, decision: "save" };
    rows.c = { ...rows.c, decision: "save" };
    expect(selectionSummary(rows).master).toBe("checked");
  });

  it("is unchecked when nothing is eligible and the bulk action is a no-op", () => {
    const rows: Rows = { d: { decision: "reject", value: "x" } };
    expect(selectionSummary(rows)).toMatchObject({ eligible: 0, master: "unchecked" });
    expect(setAllEligible(rows, true)).toBe(rows);
  });

  it("payload sends only decided fields: selected as confirm, rejected as reject", () => {
    const payload = decisionsPayload(toggleAll(start()));
    expect(payload).toEqual([
      { id: "a", action: "confirm", value: "Ananya" },
      { id: "b", action: "confirm", value: "ananya@example.com" },
      { id: "c", action: "confirm", value: "Python, edited" },
      { id: "d", action: "reject", value: "Wrong school" },
    ]);
    expect(decisionsPayload(start()).map((d) => d.id)).toEqual(["a", "d"]);
  });
});
