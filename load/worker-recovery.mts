// Worker throughput and crash recovery against the LOCAL Postgres (load/pg-setup.mts,
// load/seed.mts): queues real compute_intelligence jobs, starts the real worker, hard-kills
// it mid-queue, restarts it, and checks every job reaches an honest end state.
//
// worker.py loads ../.env.local, which may hold production credentials, so every name
// in that file is blanked for the child first. The worker can reach only the local database.
//   node load/worker-recovery.mts [jobs=200] [concurrency=2] [--no-kill]
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import pg from "pg";

import { E2E_ENV } from "../e2e/support/env.ts";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const JOBS = Number(args[0] ?? 200);
const CONCURRENCY = args[1] ?? "2";
const KILL = !process.argv.includes("--no-kill");
const LOCK_SECONDS = 15; // Short, so a hard kill's lock expiry is observable in this run.

const url = new URL(E2E_ENV.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`refusing non-local database ${url.hostname}`);

const blanked = Object.fromEntries(
  (existsSync(".env.local") ? readFileSync(".env.local", "utf8") : "")
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1])
    .filter((name): name is string => Boolean(name))
    .map((name) => [name, ""]),
);
const env: NodeJS.ProcessEnv = {
  ...process.env,
  ...blanked,
  DATABASE_URL: E2E_ENV.DATABASE_URL,
  WORKER_DATABASE_URL: E2E_ENV.DATABASE_URL,
  WORKER_LOCK_SECONDS: String(LOCK_SECONDS),
  WORKER_CONCURRENCY: CONCURRENCY,
  PORT: "8123",
  WORKER_ID: "",
  LOG_LEVEL: "WARNING",
};

const db = new pg.Client({ connectionString: E2E_ENV.DATABASE_URL });
await db.connect();
const count = async (where: string) => Number((await db.query(`SELECT count(*) AS n FROM jobs WHERE idempotency_key LIKE 'recovery:%' AND ${where}`)).rows[0].n);

await db.query("DELETE FROM jobs WHERE idempotency_key LIKE 'recovery:%'");
await db.query(
  `INSERT INTO jobs (type, user_id, idempotency_key, payload)
   SELECT 'compute_intelligence', id, 'recovery:' || id, '{"trigger":"load"}'
     FROM (SELECT id FROM users WHERE email LIKE 'load-%' ORDER BY email LIMIT $1) u`,
  [JOBS],
);
const queued = await count("true");

const start = (): ChildProcess => spawn("python", ["server.py"], { cwd: "worker", env, stdio: "ignore" });
const kill = (p: ChildProcess) => {
  if (process.platform === "win32") spawnSync("taskkill", ["/F", "/T", "/PID", String(p.pid)]);
  else p.kill("SIGKILL");
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const startedAt = Date.now();
let worker = start();
let killedAt: { ms: number; running: number; done: number } | null = null;

if (KILL) {
  while ((await count("status = 'done'")) < Math.floor(queued / 3)) await sleep(250);
  const running = await count("status = 'running'");
  kill(worker);
  killedAt = { ms: Date.now() - startedAt, running, done: await count("status = 'done'") };
  console.log("hard-killed worker", killedAt);
  worker = start();
}

const deadline = Date.now() + 15 * 60_000;
while (Date.now() < deadline && (await count("status IN ('queued', 'running')")) > 0) await sleep(500);
const seconds = (Date.now() - startedAt) / 1000;
kill(worker);

const { rows } = await db.query(
  `SELECT status, count(*)::int AS n, max(attempts) AS max_attempts,
          round(avg(extract(epoch FROM finished_at - created_at)))::int AS avg_wait_s,
          round(max(extract(epoch FROM finished_at - created_at)))::int AS max_wait_s
     FROM jobs WHERE idempotency_key LIKE 'recovery:%' GROUP BY status ORDER BY status`,
);
console.table(rows);
const errors = await db.query("SELECT last_error, count(*)::int AS n FROM jobs WHERE idempotency_key LIKE 'recovery:%' AND last_error IS NOT NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 5");
if (errors.rows.length) console.table(errors.rows);
const stuck = await count("status IN ('queued', 'running')");
console.log(`jobs=${queued} concurrency=${CONCURRENCY} killed=${KILL} elapsed=${seconds.toFixed(1)}s throughput=${((queued - stuck) / seconds).toFixed(2)}/s stuck=${stuck}`);
await db.query("DELETE FROM jobs WHERE idempotency_key LIKE 'recovery:%'");
await db.end();
process.exit(stuck ? 1 : 0);
