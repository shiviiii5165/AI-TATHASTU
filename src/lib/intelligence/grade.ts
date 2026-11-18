// Turns a resume grade into a percentage of its own scale. Conservative on purpose: a grade is only used when its scale
// is stated or unambiguous, because a wrong conversion would silently mis-rank a student.

export interface ParsedGrade {
  percent: number;
  text: string;
}

export function parseReportedGrade(input: unknown): ParsedGrade | null {
  const raw = typeof input === "string" ? input : typeof input === "number" ? String(input) : input && typeof input === "object" && "value" in input ? String((input as { value: unknown }).value ?? "") : "";
  const text = raw.trim();
  if (!text || text.length > 80) return null;
  const t = text.toLowerCase().replace(/,/g, ".");

  // "8.6/10", "3.4 / 4", "8.6 out of 10"
  const scaled = t.match(/(\d{1,3}(?:\.\d+)?)\s*(?:\/|out of)\s*(\d{1,3}(?:\.\d+)?)/);
  if (scaled) {
    const v = Number(scaled[1]);
    const s = Number(scaled[2]);
    if ([4, 5, 10, 100].includes(s) && v >= 0 && v <= s) return { percent: round1((v / s) * 100), text };
    return null;
  }
  // "86%", "86 percent"
  const pct = t.match(/(\d{1,3}(?:\.\d+)?)\s*(?:%|percent)/);
  if (pct) {
    const v = Number(pct[1]);
    return v >= 0 && v <= 100 ? { percent: round1(v), text } : null;
  }
  // "CGPA 8.6" / "GPA: 9.1": no scale given; only values above 4 can only be on a 10-point scale.
  const gpa = t.match(/\b(?:c?gpa|cpi|sgpa)\b[^\d]{0,6}(\d{1,2}(?:\.\d+)?)/);
  if (gpa) {
    const v = Number(gpa[1]);
    return v > 4 && v <= 10 ? { percent: round1(v * 10), text } : null;
  }
  return null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
