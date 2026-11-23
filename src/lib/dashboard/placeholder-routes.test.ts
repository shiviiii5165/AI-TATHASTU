import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PLACEHOLDER_SLUGS } from "./nav";

// There is no catch-all route: unknown root paths (/robots.txt, /foo) must get
// the plain root 404, never the dashboard shell. So each placeholder slug needs
// its own folder.
describe("placeholder module routes", () => {
  const dir = path.join(process.cwd(), "src/app/(dashboard)");

  it.each(PLACEHOLDER_SLUGS)("%s has an explicit route", (slug) => {
    expect(existsSync(path.join(dir, slug, "page.tsx"))).toBe(true);
  });

  it("has no dynamic catch-all in the dashboard group", () => {
    expect(existsSync(path.join(dir, "[module]"))).toBe(false);
  });
});
