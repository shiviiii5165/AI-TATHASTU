// Feature flags admin (until the admin screen exists). Talks to Neon over HTTPS.
//   npm run flags                      list
//   npm run flags -- on pilot_site_embed
//   npm run flags -- off avasar_profile_api
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

import { assertTestIsolation, assertWriteAllowed } from "./lib/db-target.mjs";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error: console.error });
const [cmd, key] = process.argv.slice(2);
const sql = neon(cmd === "on" || cmd === "off" ? assertWriteAllowed(process.env.DATABASE_URL) : assertTestIsolation(process.env.DATABASE_URL));
const who = `cli:${process.env.USER ?? "unknown"}`;

if (cmd === "on" || cmd === "off") {
  const rows = await sql`update feature_flags set enabled = ${cmd === "on"}, updated_by = ${who}, updated_at = now()
                         where key = ${key} returning key`;
  if (!rows.length) {
    console.error(`unknown flag: ${key}`);
    process.exit(1);
  }
}
console.table(await sql`select key, enabled, updated_by, updated_at from feature_flags order by key`);
