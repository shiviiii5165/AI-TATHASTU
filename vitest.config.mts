import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/._*", "node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    setupFiles: [path.resolve(import.meta.dirname, "src/test/setup.ts")],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only-stub.ts"),
    },
  },
});
