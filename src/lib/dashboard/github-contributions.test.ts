import { describe, expect, it } from "vitest";

import { describeDay, layoutCalendar, toContributionsData } from "./github-contributions";

const days = (start: string, counts: number[]) =>
  counts.map((count, i) => {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return { date: d.toISOString().slice(0, 10), count, level: count === 0 ? 0 : 1 };
  });

const row = (over: Partial<Parameters<typeof toContributionsData>[0] & object> = {}) => ({
  totalContributions: 10,
  days: days("2025-11-09", [1, 2, 3, 4]),
  categoryTotals: { commits: 8, pullRequests: 1, issues: 1, reviews: 0, restricted: 0 },
  hasRestrictedContributions: false,
  syncedAt: new Date("2026-11-10T08:00:00Z"),
  lastError: null,
  lastErrorAt: null,
  ...over,
});

describe("toContributionsData", () => {
  it("is null when nothing was ever stored (no fake fallback)", () => {
    expect(toContributionsData(null)).toBeNull();
  });

  it("marks a row that never synced as unavailable, not zero", () => {
    const data = toContributionsData(
      row({ syncedAt: null, totalContributions: null, days: null, categoryTotals: null, lastError: "Could not reach GitHub", lastErrorAt: new Date() }),
    )!;
    expect(data.available).toBe(false);
    expect(data.total).toBeNull();
    expect(data.days).toEqual([]);
    expect(data.totals).toBeNull();
    expect(data.lastError).toBe("Could not reach GitHub");
  });

  it("keeps a real zero as zero", () => {
    const data = toContributionsData(row({ totalContributions: 0, days: days("2025-11-09", [0, 0]) }))!;
    expect(data.available).toBe(true);
    expect(data.total).toBe(0);
  });

  it("shows the last good snapshot together with a later failure", () => {
    const data = toContributionsData(row({ lastError: "GitHub rate limit reached", lastErrorAt: new Date() }))!;
    expect(data.available).toBe(true);
    expect(data.total).toBe(10);
    expect(data.lastError).toBe("GitHub rate limit reached");
  });
});

describe("layoutCalendar", () => {
  it("lays days into Sunday-first weeks with gaps outside the range", () => {
    // 2025-11-12 is a Wednesday.
    const { weeks } = layoutCalendar(days("2025-11-12", [1, 2, 3, 4, 5]));
    expect(weeks).toHaveLength(2);
    expect(weeks[0].slice(0, 3)).toEqual([null, null, null]);
    expect(weeks[0][3]).toMatchObject({ date: "2025-11-12", count: 1 });
    expect(weeks[1][0]).toMatchObject({ date: "2025-11-16", count: 5 });
    expect(weeks[1].slice(1)).toEqual([null, null, null, null, null, null]);
  });

  it("covers a full year including a leap day, without dropping or duplicating dates", () => {
    const year = days("2027-12-31", Array.from({ length: 366 }, () => 1));
    const { weeks, months } = layoutCalendar(year);
    const dates = weeks.flat().filter(Boolean).map((c) => c!.date);
    expect(dates).toHaveLength(366);
    expect(new Set(dates).size).toBe(366);
    expect(dates).toContain("2028-02-29");
    expect(months.map((m) => m.label)).toContain("Feb");
    expect(months.at(-1)!.label).toBe("Dec");
  });

  it("fills a day GitHub omitted inside the range as zero only within GitHub's own window", () => {
    const { weeks } = layoutCalendar([
      { date: "2025-11-09", count: 3, level: 2 },
      { date: "2025-11-11", count: 1, level: 1 },
    ]);
    expect(weeks[0][1]).toEqual({ date: "2025-11-10", count: 0, level: 0 });
  });

  it("is empty for an empty calendar", () => {
    expect(layoutCalendar([])).toEqual({ weeks: [], months: [] });
  });
});

describe("describeDay", () => {
  it("reads the calendar date in UTC", () => {
    expect(describeDay({ date: "2028-02-29", count: 1 })).toBe("1 contribution on Tue, 29 Feb 2028");
    expect(describeDay({ date: "2026-01-01", count: 0 })).toBe("No contributions on Thu, 1 Jan 2026");
  });
});
