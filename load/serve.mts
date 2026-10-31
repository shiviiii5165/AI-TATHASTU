// Builds and starts the app with the e2e stack's environment only (local
// Postgres + fake R2, every provider key blank). Usage: node load/serve.mts [--no-build]
import { spawnSync, spawn } from "node:child_process";

import { E2E_ENV, E2E_PORTS } from "../e2e/support/env.ts";

// A real Postgres (load/pg-setup.mts) can take more than the default pool of 4.
const env = { LOCAL_DB_POOL_MAX: "40", ...process.env, ...E2E_ENV } as NodeJS.ProcessEnv;
const shell = process.platform === "win32";
if (!process.argv.includes("--no-build")) {
  const build = spawnSync("npx", ["next", "build"], { env, stdio: "inherit", shell });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
spawn("npx", ["next", "start", "-p", String(E2E_PORTS.app)], { env, stdio: "inherit", shell });
