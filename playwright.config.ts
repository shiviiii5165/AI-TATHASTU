import { defineConfig, devices } from "@playwright/test";

import { E2E_ENV, E2E_PORTS } from "./e2e/support/env";

/**
 * End-to-end tests against a throwaway local stack (e2e/support/stack.ts):
 * in-memory Postgres + fake R2, and the Next app pointed at them. Nothing
 * touches Neon, R2, the worker or any OAuth provider.
 *
 *   npm run test:e2e            # headless
 *   npm run test:e2e -- --ui    # debug
 */
export default defineConfig({
  testDir: "e2e",
  testIgnore: ["**/._*"],
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_ENV.AUTH_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // Locally, reuse installed Chrome; CI installs Playwright's Chromium.
      use: { ...devices["Desktop Chrome"], ...(process.env.CI ? {} : { channel: "chrome" }) },
    },
  ],
  webServer: [
    {
      command: "node e2e/support/stack.mts",
      url: `http://127.0.0.1:${E2E_PORTS.r2}/health`,
      reuseExistingServer: true,
      stdout: "pipe",
    },
    {
      // Production build: what users get, and no dev-mode compile pauses.
      command: `npx next build && npx next start -p ${E2E_PORTS.app}`,
      url: `${E2E_ENV.AUTH_URL}/login`,
      reuseExistingServer: true,
      timeout: 300_000,
      env: E2E_ENV,
    },
  ],
});
