import { describe, expect, it } from "vitest";

import { buildJourney, journeyView } from "./journey";

const titles = (records: Parameters<typeof buildJourney>[0]) => buildJourney(records).map((m) => m.title);

describe("buildJourney", () => {
  it("orders by date, with the ongoing item after dated ones and undated last", () => {
    expect(
      titles([
        { group: "experience", fields: { role: "Undated role" } },
        { group: "experience", fields: { role: "Engineer", start_date: "2023", end_date: "Present" } },
        { group: "education", fields: { degree: "B.Sc", end_date: "2021" } },
        { group: "experience", fields: { role: "Intern", end_date: "Jun 2022" } },
      ]),
    ).toEqual(["B.Sc", "Intern", "Engineer", "Undated role"]);
  });

  it("never turns a missing end date into 'Present'", () => {
    const [job] = buildJourney([{ group: "experience", fields: { role: "Analyst", start_date: "2020" } }]);
    expect(job).toMatchObject({ current: false, when: "2020" });
  });

  it("only marks an item current when the record says so, not because it's the latest", () => {
    const journey = buildJourney([{ group: "education", fields: { degree: "B.Sc", end_date: "2019" } }]);
    expect(journey[0].current).toBe(false);
    expect(buildJourney([{ group: "education", fields: { degree: "M.Sc", end_date: "Present" } }])[0].current).toBe(true);
  });

  it("has no date when the record has none", () => {
    expect(buildJourney([{ group: "education", fields: { degree: "B.Sc" } }])[0].when).toBeNull();
  });

  it("drops a record with no title instead of inventing 'Degree' or 'Role'", () => {
    expect(buildJourney([{ group: "education", fields: { end_date: "2020" } }, { group: "experience", fields: { end_date: "2021" } }])).toEqual([]);
  });

  it("uses the organization as a title when that's all there is, without repeating it", () => {
    expect(buildJourney([{ group: "experience", fields: { organization: "Acme" } }])[0]).toMatchObject({ title: "Acme", detail: "" });
  });

  it("includes dated projects, achievements and publications, and leaves out undated projects", () => {
    const journey = buildJourney([
      { group: "projects", fields: { title: "Dated", date: "2022" } },
      { group: "projects", fields: { title: "Undated" } },
      { group: "achievements", fields: { title: "Prize", date: "2021" } },
      { group: "publications", fields: { title: "Paper", venue: "NeurIPS", date: "2020" } },
      { group: "skills", fields: { skill: "Python" } },
    ]);
    expect(journey.map((m) => m.title)).toEqual(["Paper", "Prize", "Dated"]);
    expect(journey[0]).toMatchObject({ kind: "publication", detail: "NeurIPS" });
  });

  it("handles an empty profile", () => {
    expect(buildJourney([])).toEqual([]);
  });

  it("sorts a date range by its latest year", () => {
    expect(titles([{ group: "experience", fields: { role: "B", start_date: "2018", end_date: "2024" } }, { group: "experience", fields: { role: "A", start_date: "2019", end_date: "2020" } }])).toEqual(["A", "B"]);
  });
});

describe("journeyView", () => {
  const journey = buildJourney([
    { group: "education", fields: { degree: "School", end_date: "2015" } },
    { group: "education", fields: { degree: "B.Tech", end_date: "2019" } },
    { group: "experience", fields: { role: "Intern", start_date: "2019", end_date: "2019" } },
    { group: "experience", fields: { role: "Engineer", start_date: "2020", end_date: "Present" } },
    { group: "achievements", fields: { title: "Undated award" } },
  ]);

  it("keeps chronological order, oldest first, ending on the current position", () => {
    const v = journeyView(journey);
    expect(v.timeline.map((m) => m.title)).toEqual(["School", "B.Tech", "Intern", "Engineer"]);
    expect(v.timeline.at(-1)?.current).toBe(true);
  });

  it("keeps undated records apart instead of guessing where they belong", () => {
    const v = journeyView(journey);
    expect(v.undated.map((m) => m.title)).toEqual(["Undated award"]);
    expect(v.timeline.some((m) => m.title === "Undated award")).toBe(false);
  });

  it("drops the earliest records first when trimming, and counts them", () => {
    const v = journeyView(journey, 2);
    expect(v.timeline.map((m) => m.title)).toEqual(["Intern", "Engineer"]);
    expect(v.earlier).toBe(2);
  });

  it("is empty for an empty profile", () => {
    expect(journeyView([])).toEqual({ timeline: [], undated: [], earlier: 0, hiddenUndated: 0 });
  });
});
