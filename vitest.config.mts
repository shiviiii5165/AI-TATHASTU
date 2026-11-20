import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/._*", "node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Each DB-backed test file boots its own in-memory Postgres (PGlite) and applies every migration. With the default
    // worker count (CPUs − 1 = 15 here) free memory fell to 0.6 GB and setup hooks timed out; with 4 workers the full
    // suite passed in 77 s with 5.7 GB free. Override with VITEST_MAX_WORKERS on bigger machines.
    maxWorkers: Number(process.env.VITEST_MAX_WORKERS) || 4,
    setupFiles: [path.resolve(import.meta.dirname, "src/test/setup.ts")],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only-stub.ts"),
    },
  },
});
