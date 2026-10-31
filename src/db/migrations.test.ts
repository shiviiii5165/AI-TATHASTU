import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const DIR = path.join(import.meta.dirname, "migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();

// CI's E2E database (PGlite) ignores "already exists", so a repeat only fails on real Postgres.
describe("migration chain", () => {
  it("never creates a table or index a previous statement already created, unguarded", () => {
    const seen = new Map<string, string>();
    const repeats: string[] = [];
    for (const file of files) {
      const text = readFileSync(path.join(DIR, file), "utf8");
      for (const m of text.matchAll(/CREATE\s+(?:UNIQUE\s+)?(TABLE|INDEX)\s+(IF\s+NOT\s+EXISTS\s+)?"?([\w.]+)"?/gi)) {
        const key = `${m[1].toUpperCase()} ${m[3]}`;
        const earlier = seen.get(key);
        if (earlier && !m[2]) repeats.push(`${key}: ${earlier} then ${file}`);
        if (!earlier) seen.set(key, file);
      }
    }
    expect(repeats).toEqual([]);
  });

  it("lists every migration file in the journal, in order", () => {
    const journal = JSON.parse(readFileSync(path.join(DIR, "meta/_journal.json"), "utf8")) as { entries: { tag: string; when: number }[] };
    expect(journal.entries.map((e) => `${e.tag}.sql`)).toEqual(files);
    const when = journal.entries.map((e) => e.when);
    expect(when).toEqual([...when].sort((a, b) => a - b));
  });
});
