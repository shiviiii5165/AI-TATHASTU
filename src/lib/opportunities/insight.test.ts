import { describe, expect, it } from "vitest";

import { explainFit, type StudentSignals } from "./fit";
import { deriveInsight, stageFit, studentDisciplines } from "./insight";

// Titles as published by the live sources (IIT Hyderabad, IIT Kharagpur, IIT Roorkee, Max Planck, HZDR) on 2026-11-21.
const CASES: [string, string | null, string, string[]][] = [
  ["Junior Research Fellow, Department of Physics", "research_assistant", "jrf", ["Physics"]],
  ["Post of JRF/PhD", "research_assistant", "jrf", []],
  ["Post of JRF under SUT QUAD project (Conver?ble to PhD)", "research_assistant", "jrf", []],
  ["Senior Research Fellow (SRF)", "research_assistant", "srf", []],
  ["Post Doctoral Fellowship", "phd_position", "postdoc", []],
  ["Post-doctoral research fellow under CoE CLEANZ (CFD domain)", "fellowship", "postdoc", ["Mechanical & Aerospace"]],
  ["Postdoctoral Researcher (m/f/d) | Developmental Biology", "fellowship", "postdoc", ["Biology & Life Sciences"]],
  ["PhD Positions in Gravity at the Extreme", "phd_position", "phd", ["Physics"]],
  ["PhD Student (f/m/d) Probing Exotic Quantum Excitations via Spin Transport for Future Technologies - 2026/135", null, "phd", ["Physics"]],
  ["Research Associate (RA)", "research_assistant", "research_associate", []],
  ["Post of Research Associate-I, Department of Physics", "research_assistant", "research_associate", ["Physics"]],
  ["Project Assistant in the field of lasers and photonics", "research_assistant", "project_assistant", ["Physics"]],
  ["Sr. Project Assistant", "research_assistant", "project_assistant", []],
  ["Project Scientist - I", "research_assistant", "project_scientist", []],
  ["Animal Welfare Officer (m/f/d)", null, "non_research", []],
  ["Research Engineer (f/m/d) | Statistical 3D Model of Quadrupeds", null, "scientist", []],
  ["Scientific Employee (f/m/d) on the 'HPC-RSE-Nexus' project - 2026/132", null, "scientist", ["Computer Science & AI"]],
  ["Scientific Programmer (m/f/d): Climate Modelling, Data Infrastructure and Online Tools", null, "scientist", ["Earth & Climate"]],
  ["Post of JRF (Digital Twin, BIM) in AI CoE", "research_assistant", "jrf", ["Computer Science & AI", "Civil & Environmental"]],
];

describe("listing intelligence", () => {
  it.each(CASES)("%s", (title, kind, position, fields) => {
    const i = deriveInsight({ title, kind });
    expect(i.position).toBe(position);
    for (const f of fields) expect(i.disciplines).toContain(f);
    expect(i.basis.length).toBeGreaterThan(0);
  });

  it("states typical stage as typical, with a note", () => {
    const jrf = deriveInsight({ title: "Junior Research Fellow (JRF)" });
    expect(jrf.typicalStage).toBe("postgraduate");
    expect(jrf.stageNote).toMatch(/usually/);
    expect(stageFit("postgraduate", "undergraduate")).toBe("next_step");
    expect(stageFit("doctoral", "undergraduate")).toBe("later");
    expect(stageFit("undergraduate", "postgraduate")).toBe("suitable");
    expect(stageFit(null, "undergraduate")).toBe("unknown");
  });

  it("reads a student's fields from degree, specialisation and skills", () => {
    expect(studentDisciplines("B.Tech", "Electrical Engineering")).toContain("Electrical & Electronics");
    expect(studentDisciplines("B.Tech", null, "Python Machine Learning")).toContain("Computer Science & AI");
    expect(studentDisciplines(null, null)).toEqual([]);
  });
});

const student = (o: Partial<StudentSignals>): StudentSignals => ({ demonstrated: new Map(), listed: new Map(), level: "undergraduate", disciplines: [], ...o });
const fit = (title: string, s: StudentSignals) => explainFit({ requiredSkills: [], eligibleLevels: [], eligibility: null, topicText: title, insight: deriveInsight({ title }) }, s);

describe("fit from the intelligence layer", () => {
  const ml = student({ demonstrated: new Map([["machine learning", "Machine Learning"]]), disciplines: ["Computer Science & AI"], level: "postgraduate" });

  it("is strong when field, demonstrated method and stage all line up", () => {
    const r = fit("Post of JRF (Digital Twin, BIM) in AI CoE", ml);
    expect(r.state).toBe("strong_fit");
    expect(r.summary).toMatch(/your field/);
    expect(r.relevance?.stage).toBe("suitable");
  });

  it("is potential on field alone, and says skills aren't published", () => {
    const r = fit("Junior Research Fellow in the Department of Electrical Engineering", student({ listed: new Map([["c", "C"]]), disciplines: ["Electrical & Electronics"] }));
    expect(r.state).toBe("potential_fit");
    expect(r.summary).toMatch(/doesn't publish required skills/);
  });

  it("calls a postdoc a later step for an undergraduate, never 'not eligible'", () => {
    const r = fit("Post-Doctoral Research Fellowship, Department of Electrical Engineering", student({ listed: new Map([["c", "C"]]), disciplines: ["Electrical & Electronics"] }));
    expect(r.state).toBe("insufficient_information");
    expect(r.relevance?.stage).toBe("later");
    expect(r.summary).toMatch(/later step/);
  });

  it("asks for the degree when the field can't be matched", () => {
    const r = fit("Junior Research Fellow, Department of Physics", student({ listed: new Map([["python", "Python"]]) }));
    expect(r.summary).toMatch(/Add your degree and specialisation/);
  });

  it("marks non-research roles", () => {
    expect(fit("Animal Welfare Officer (m/f/d)", ml).summary).toMatch(/isn't a research role/);
  });
});
