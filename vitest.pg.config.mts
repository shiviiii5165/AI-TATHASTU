import path from "node:path";

import { defineConfig } from "vitest/config";

// Real Postgres with independent connections, for what PGlite's single connection can't
// prove: concurrency. Needs TEST_POSTGRES_URL at a throwaway local database, which each
// file wipes. `npm run test:pg`; CI gives it a disposable service.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.pgtest.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only-stub.ts"),
    },
  },
});
